/**
 * Camada de cima da importação: matriz de células + mapeamento → leads.
 *
 * Separada de `lib/leads/csv.ts` porque a planilha em Excel chega já como
 * matriz, o `.xlsx` é lido no navegador, e precisa passar exatamente pela
 * mesma validação do CSV. Um caminho só de validação evita o modo de falha
 * clássico: o formato novo aceitar dado que o antigo recusava.
 *
 * Nada aqui toca rede ou banco. É lógica pura, coberta por teste.
 */

import { parseValorBRL } from '@/lib/leads/csv'
import { leadStatusLabels, type LeadStatus } from '@/lib/leads/types'

export type CampoDestino = 'name' | 'email' | 'phone' | 'company' | 'value' | 'status'

/**
 * Ordem de exibição na tela de mapeamento.
 *
 * Nenhum campo é obrigatório sozinho. A regra real é "dá para falar com essa
 * pessoa?": precisa de nome, e de e-mail OU telefone. Exigir e-mail rejeitava
 * 100% de uma lista de WhatsApp, que é a planilha mais comum do público-alvo.
 */
export const CAMPOS: { campo: CampoDestino; rotulo: string }[] = [
  { campo: 'name', rotulo: 'Nome' },
  { campo: 'email', rotulo: 'E-mail' },
  { campo: 'phone', rotulo: 'Telefone' },
  { campo: 'company', rotulo: 'Empresa' },
  { campo: 'value', rotulo: 'Valor' },
  { campo: 'status', rotulo: 'Etapa' },
]

/** Campo de destino → índice da coluna na planilha. Ausente = não importar. */
export type Mapeamento = Partial<Record<CampoDestino, number>>

/**
 * Cabeçalhos que o mercado usa de verdade. A lista veio de exportação de
 * planilha do Excel, do Google Sheets e do que os concorrentes documentam,
 * não de suposição.
 */
const APELIDOS: Record<CampoDestino, string[]> = {
  name: ['nome', 'name', 'nome completo', 'contato', 'lead', 'cliente', 'nome do cliente', 'nome do contato', 'responsavel', 'full name'],
  phone: ['telefone', 'phone', 'celular', 'whatsapp', 'zap', 'fone', 'tel', 'contato telefonico', 'numero', 'mobile'],
  email: ['e-mail', 'email', 'mail', 'e mail', 'correio eletronico'],
  // `organization` entrou em 09/09: o Pipedrive exporta assim, em inglês, e
  // `organizacao` não casa com ele. A empresa vinha VAZIA e a importação dizia
  // que tinha dado certo — a classe de erro mais cara deste projeto, porque o
  // número parece plausível e ninguém confere.
  company: ['empresa', 'company', 'razao social', 'organizacao', 'organization', 'negocio', 'estabelecimento', 'cliente empresa', 'account'],
  value: ['valor', 'value', 'ticket', 'valor do negocio', 'valor estimado', 'valor proposta', 'preco', 'orcamento', 'amount'],
  status: ['etapa', 'status', 'situacao', 'fase', 'estagio', 'stage', 'funil', 'pipeline'],
}

/** Tira acento e caixa para o cabeçalho casar com "E-mail", "EMAIL", "e mail". */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    // Faixa dos diacríticos combinantes: `\p{Diacritic}` seria mais legível,
    // mas exige a flag `u`, que o target do tsconfig não aceita.
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

/**
 * Chuta o mapeamento a partir do cabeçalho.
 *
 * É só um chute: a tela mostra o resultado e a pessoa corrige. Antes disso o
 * cabeçalho desconhecido abortava o arquivo inteiro, "Razão Social" em vez de
 * "Empresa" e nenhuma linha entrava, sem explicação útil.
 *
 * Casa por igualdade primeiro e só depois por conter, porque "nome" está
 * contido em "nome da empresa" e o palpite errado é pior que palpite nenhum:
 * a pessoa confia na tela e importa o campo trocado.
 */
export function sugerirMapeamento(cabecalho: string[]): Mapeamento {
  const colunas = cabecalho.map(normalizarTexto)
  const mapeamento: Mapeamento = {}
  const usadas = new Set<number>()

  for (const modo of ['exato', 'contem'] as const) {
    for (const { campo } of CAMPOS) {
      if (mapeamento[campo] !== undefined) continue

      const indice = colunas.findIndex((coluna, i) => {
        if (usadas.has(i) || !coluna) return false
        return modo === 'exato'
          ? APELIDOS[campo].includes(coluna)
          : APELIDOS[campo].some((apelido) => coluna.includes(apelido))
      })

      if (indice >= 0) {
        mapeamento[campo] = indice
        usadas.add(indice)
      }
    }
  }

  return mapeamento
}

/**
 * Como a planilha escreve cada etapa do funil. A pessoa digitou à mão numa
 * célula durante meses; não existe valor canônico.
 */
const ETAPAS: Record<LeadStatus, string[]> = {
  novo: ['novo', 'novo lead', 'lead', 'prospect', 'prospeccao', 'entrada', 'a contatar'],
  contato_realizado: ['contato realizado', 'contato', 'contatado', 'em contato', 'primeiro contato', 'abordado'],
  proposta_enviada: ['proposta enviada', 'proposta', 'orcamento enviado', 'orcamento', 'enviado'],
  negociacao: ['negociacao', 'negociando', 'em negociacao', 'follow up', 'followup'],
  fechado_ganho: ['fechado ganho', 'ganho', 'fechado', 'vendido', 'venda', 'cliente', 'convertido', 'sim'],
  fechado_perdido: ['fechado perdido', 'perdido', 'perda', 'recusado', 'declinado', 'sem interesse', 'nao', 'cancelado'],
}

/**
 * Devolve `null` quando não reconhece, quem chama decide cair em 'novo' e
 * avisar. Adivinhar a etapa errada move o negócio para "Fechado Ganho" sem
 * ninguém ter vendido nada, e isso mente no dashboard.
 */
export function normalizarEtapa(bruto: string): LeadStatus | null {
  const texto = normalizarTexto(bruto)
  if (!texto) return null

  for (const [etapa, apelidos] of Object.entries(ETAPAS) as [LeadStatus, string[]][]) {
    if (apelidos.includes(texto)) return etapa
  }
  // Só depois do casamento exato, para "nao" não bater dentro de "negociacao".
  for (const [etapa, apelidos] of Object.entries(ETAPAS) as [LeadStatus, string[]][]) {
    if (apelidos.some((apelido) => apelido.length >= 4 && texto.includes(apelido))) return etapa
  }

  return null
}

/**
 * Só os dígitos, sem o 55 do país e sem o 0 de operadora.
 *
 * Serve de chave de deduplicação quando não há e-mail: "(11) 90000-0000",
 * "11900000000" e "+55 11 90000-0000" são a mesma pessoa, e sem normalizar
 * cada variação viraria um lead diferente, o jeito mais rápido de sujar um
 * pipeline recém-importado.
 */
export function apenasDigitos(bruto: string): string {
  const digitos = bruto.replace(/\D/g, '')
  const semPais = digitos.startsWith('55') && digitos.length > 11 ? digitos.slice(2) : digitos
  return semPais.startsWith('0') ? semPais.slice(1) : semPais
}

/**
 * O contato é de verdade, ou é resto de célula?
 *
 * ## O defeito que estas duas funções fecham (09/09)
 *
 * Um cliente importou `Tabela_de_Precos_Pintura.xlsx` — 108 tintas com o preço
 * de cada fornecedor — e o produto aceitou as 108 como contatos. Ficou assim
 * na tela de Contatos:
 *
 *     BRANCO TAFFETA     55 | 52
 *     VERNIZ 5500        56 | 58 | 67,12 | 57,87
 *     DISCO 80           3 | 2,69 | 2,5 | 3,3 | 2,59
 *
 * Reproduzido com o arquivo real: **não havia nenhuma validação de formato**.
 * `"75 | 104 | 82 | 99 | 145,25"` era aceito como e-mail — 4 de 4 linhas, zero
 * erros. E como telefone passava também, porque a única regra era "8 dígitos
 * ou mais", e cinco preços concatenados dão catorze.
 *
 * ## Por que as regras são frouxas de propósito
 *
 * `temFormaDeEmail` não valida RFC: exige arroba, um ponto depois dela e nada
 * de espaço. E-mail exótico existe e recusar cliente de verdade é pior que
 * deixar entrar um esquisito — o que se quer barrar aqui é a célula que
 * claramente não é endereço nenhum.
 *
 * `temFormaDeTelefone` aceita 10 ou 11 dígitos (fixo e celular com DDD), ou 12
 * e 13 com o `55` na frente. O que ela recusa é o caso real: número comprido
 * demais, curto demais, ou com DDD que não existe no Brasil.
 */
export function temFormaDeEmail(valor: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor.trim())
}

/** DDDs que existem. Fora desta lista, o "telefone" é outra coisa. */
const DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
])

export function temFormaDeTelefone(valor: string): boolean {
  const digitos = apenasDigitos(valor)
  // `apenasDigitos` já tira o `55` do país quando há mais de 11 dígitos, então
  // o que sobra tem que ser DDD + número.
  if (digitos.length !== 10 && digitos.length !== 11) return false
  return DDDS.has(Number(digitos.slice(0, 2)))
}

/**
 * A chave que identifica o contato entre linhas e contra o banco. E-mail tem
 * prioridade por ser único de verdade; telefone é o plano B para a lista que
 * não tem e-mail nenhum.
 */
export function chaveDeContato(email: string | null, phone: string | null): string | null {
  if (email) return `e:${email.toLowerCase()}`
  const digitos = phone ? apenasDigitos(phone) : ''
  // Menos de 8 dígitos não é telefone, é resto de célula, não serve de chave.
  return digitos.length >= 8 ? `t:${digitos}` : null
}

/**
 * TODAS as chaves pelas quais um contato já cadastrado pode ser reencontrado.
 *
 * ## Por que a versão no singular não bastava contra o banco
 *
 * `chaveDeContato` devolve UMA chave, com o e-mail tendo prioridade. Isso está
 * certo para deduplicar linhas dentro da própria planilha: a mesma pessoa
 * aparecendo duas vezes com o mesmo e-mail é uma repetição, e o telefone não
 * muda essa conclusão.
 *
 * Contra o BANCO ela abria um buraco. Um lead gravado com e-mail **e**
 * telefone entrava no mapa só como `e:...`. Uma linha nova com e-mail inédito
 * e o telefone daquele lead não casava com nada, passava pela dedupe como
 * contato novo, e batia no índice `leads_workspace_telefone_unico` (0045) já
 * dentro do `insert`.
 *
 * O efeito era desproporcional: `23505` derruba o **lote inteiro**, então uma
 * única linha com telefone repetido fazia as outras 999 se perderem junto — e
 * a mensagem era "Não foi possível importar os leads", sem dizer qual linha
 * nem por quê.
 *
 * Indexando as duas, o conflito deixa de existir em vez de virar mensagem de
 * erro melhor.
 */
export function chavesDoContato(email: string | null, phone: string | null): string[] {
  const chaves: string[] = []
  if (email) chaves.push(`e:${email.toLowerCase()}`)
  const digitos = phone ? apenasDigitos(phone) : ''
  if (digitos.length >= 8) chaves.push(`t:${digitos}`)
  return chaves
}

export type LinhaPlanilha = {
  /** Linha no arquivo (1 = cabeçalho), para a mensagem citar onde. */
  linha: number
  name: string
  email: string | null
  phone: string | null
  company: string | null
  value: number
  status: LeadStatus
  chave: string
  /**
   * Campos cuja célula veio PREENCHIDA nesta linha.
   *
   * Existe por causa da reimportação: célula em branco não pode apagar dado que
   * já está no CRM. Sem isso, subir de novo uma planilha onde a coluna Empresa
   * está vazia limparia a empresa de todo mundo, e um Valor em branco viraria
   * R$ 0,00 por cima do valor real, perda silenciosa, do tipo que só aparece
   * no fechamento do mês.
   */
  preenchidos: CampoDestino[]
}

export type ResultadoPlanilha = {
  linhas: LinhaPlanilha[]
  /** Uma mensagem por linha descartada, já pronta para exibir. */
  erros: string[]
}

/**
 * Aplica o mapeamento sobre a matriz e devolve o que dá para importar.
 *
 * Erro é por LINHA, nunca pelo arquivo: planilha real sempre tem uma linha
 * suja no meio, e derrubar as outras 300 por causa dela seria pior do que
 * importar o que dá e avisar o resto.
 *
 * Recebe a matriz COM cabeçalho e o descarta aqui, para que o número da linha
 * nas mensagens bata com o que a pessoa vê no Excel.
 */
export function interpretarPlanilha(
  matriz: string[][],
  mapeamento: Mapeamento,
  limiteDeLinhas: number,
): ResultadoPlanilha {
  const erros: string[] = []

  if (matriz.length <= 1) {
    return { linhas: [], erros: ['A planilha não tem nenhuma linha além do cabeçalho.'] }
  }

  if (mapeamento.name === undefined) {
    return { linhas: [], erros: ['Escolha qual coluna da planilha é o Nome.'] }
  }

  if (mapeamento.email === undefined && mapeamento.phone === undefined) {
    return {
      linhas: [],
      erros: ['Escolha ao menos uma forma de contato: a coluna de E-mail ou a de Telefone.'],
    }
  }

  const corpo = matriz.slice(1)
  if (corpo.length > limiteDeLinhas) {
    // "foram lidas" descrevia o passado e nao dizia o que ia acontecer. A
    // frase agora promete o que o envio de fato faz — o cliente corta a matriz
    // no mesmo limite antes de mandar, entao tela e servidor dizem a mesma
    // coisa. Antes a tela prometia 1000 de 1500 e o servidor recusava as 1500.
    erros.push(
      `A planilha tem ${corpo.length} linhas. Vamos importar as primeiras ${limiteDeLinhas}.`,
    )
  }

  const linhas: LinhaPlanilha[] = []
  const chavesVistas = new Set<string>()

  corpo.slice(0, limiteDeLinhas).forEach((celulas, i) => {
    // +2: índice zero-based do corpo mais a linha do cabeçalho.
    const numeroDaLinha = i + 2
    const celula = (campo: CampoDestino) => {
      const posicao = mapeamento[campo]
      return posicao === undefined ? '' : (celulas[posicao] ?? '').trim()
    }

    const name = celula('name')
    const emailBruto = celula('email').toLowerCase()
    const phoneBruto = celula('phone')

    // ## O formato é conferido ANTES de a célula virar contato
    //
    // Sem isto, `"75 | 104 | 82 | 99 | 145,25"` entrava como e-mail e como
    // telefone — foi como 108 tintas viraram contatos em 09/09. A célula que
    // não tem forma de contato é DESCARTADA em vez de derrubar a linha: uma
    // planilha real tem célula suja no meio, e recusar a pessoa inteira por
    // causa de um telefone mal digitado perderia o contato bom que veio junto.
    //
    // Quando as duas caem, aí a linha não tem como ser contatada e o erro
    // abaixo explica isso — que é a mensagem certa.
    const email = temFormaDeEmail(emailBruto) ? emailBruto : ''
    const phone = temFormaDeTelefone(phoneBruto) ? phoneBruto : ''
    const company = celula('company')
    const valorBruto = celula('value')
    const etapaBruta = celula('status')

    // Linha totalmente vazia é resto de planilha, não erro de quem preencheu.
    // Olha o BRUTO: a célula com lixo dentro foi preenchida por alguém, e
    // tratá-la como vazia esconderia o erro em vez de explicá-lo.
    if (!name && !emailBruto && !phoneBruto) return

    if (name.length < 2) {
      erros.push(`Linha ${numeroDaLinha}: nome ausente ou muito curto.`)
      return
    }

    const chave = chaveDeContato(email || null, phone || null)
    if (!chave) {
      // A mensagem CITA o que veio na célula. "sem e-mail nem telefone" era
      // verdadeiro e inútil quando a coluna estava preenchida — a pessoa olha
      // a planilha, vê algo escrito ali, e conclui que o sistema está errado.
      const oQueVeio = [emailBruto, phoneBruto].filter(Boolean).join(' / ')
      erros.push(
        oQueVeio
          ? `Linha ${numeroDaLinha}: "${oQueVeio}" não é e-mail nem telefone.`
          : `Linha ${numeroDaLinha}: sem e-mail nem telefone, não há como contatar.`,
      )
      return
    }

    if (chavesVistas.has(chave)) {
      erros.push(`Linha ${numeroDaLinha}: ${email || phone} repetido na própria planilha.`)
      return
    }

    const value = parseValorBRL(valorBruto)
    if (value === null) {
      erros.push(`Linha ${numeroDaLinha}: valor "${valorBruto}" não é um número.`)
      return
    }
    if (value < 0) {
      erros.push(`Linha ${numeroDaLinha}: valor negativo.`)
      return
    }

    let status: LeadStatus = 'novo'
    if (etapaBruta) {
      const reconhecida = normalizarEtapa(etapaBruta)
      if (reconhecida) {
        status = reconhecida
      } else {
        erros.push(
          `Linha ${numeroDaLinha}: etapa "${etapaBruta}" não reconhecida,` +
            ` entrou como "${leadStatusLabels.novo}".`,
        )
      }
    }

    const preenchidos: CampoDestino[] = []
    if (name) preenchidos.push('name')
    if (email) preenchidos.push('email')
    if (phone) preenchidos.push('phone')
    if (company) preenchidos.push('company')
    if (valorBruto.trim()) preenchidos.push('value')
    if (etapaBruta.trim()) preenchidos.push('status')

    chavesVistas.add(chave)
    linhas.push({
      linha: numeroDaLinha,
      name,
      email: email || null,
      phone: phone || null,
      company: company || null,
      value,
      status,
      chave,
      preenchidos,
    })
  })

  return { linhas, erros }
}

/** Quantos itens de `erros` são avisos do arquivo, e não linhas descartadas. */
export function contarAvisosDeArquivo(erros: string[]): number {
  return erros.filter((e) => !/^Linha \d+:/.test(e)).length
}

/**
 * O primeiro valor não-vazio de uma coluna, entre as linhas de corpo.
 *
 * Existe pra tela mostrar "Telefone → Coluna 2 · ex: (11) 98888-7777" ao
 * lado de cada campo mapeado, a diferença entre escolher uma coluna às
 * cegas (só pelo número ou por um cabeçalho que pode nem existir) e escolher
 * vendo o dado real por trás dela. `null` quando a coluna está vazia em toda
 * linha de corpo, ou o índice não existe.
 */
export function amostraDaColuna(corpo: string[][], indice: number): string | null {
  for (const linha of corpo) {
    const valor = (linha[indice] ?? '').trim()
    if (valor) return valor
  }
  return null
}

/**
 * Descobre o papel de cada coluna pelo CONTEÚDO, quando o título não resolve.
 *
 * ## Por que precisa existir
 *
 * `sugerirMapeamento` lê o cabeçalho, e há dois casos comuns em que não há
 * cabeçalho nenhum para ler:
 *
 *     lista escrita a mao    "Mariana | mariana@… | (71) 99111-1001"
 *     exportacao de sistema  cabecalho em idioma ou jargao que ninguem previu
 *
 * O primeiro é o arquivo que o dono mandou em 11/09. Sem esta função, ele
 * ficava bloqueado em "não achei e-mail nem telefone" — com o e-mail e o
 * telefone ali, na tela, visíveis para qualquer pessoa que olhasse.
 *
 * ## Reusa o que já existe
 *
 * `temFormaDeEmail` exige arroba e ponto depois dela. `temFormaDeTelefone`
 * exige 10 ou 11 dígitos **com DDD que existe de verdade** — é a lista que
 * impediu "75 | 104 | 82" de virar telefone quando 108 tintas foram importadas
 * como contatos em 09/09. Nenhum detector novo nasce aqui.
 *
 * ## A maioria decide, não a primeira célula
 *
 * Uma coluna de telefone tem célula vazia e célula mal digitada. Exigir todas
 * barraria arquivo bom; aceitar uma bastaria para um CEP virar telefone. A
 * metade das células preenchidas, com mínimo de duas, é o corte — o mesmo que
 * `semColunaDeContato` já usa no diálogo.
 *
 * ## E o nome é o que SOBRA
 *
 * Não existe formato de nome. O que dá para afirmar é o negativo: a coluna que
 * não é e-mail, não é telefone, não é dinheiro e tem texto com letra é a
 * candidata. Entre duas candidatas, a mais à esquerda — em toda lista escrita
 * por gente, o nome vem primeiro.
 */
/**
 * Tem alguma letra?
 *
 * Construida com `new RegExp` e nao como literal `/\p{L}/u`: o `target` deste
 * tsconfig e anterior a es6 e o compilador recusa a flag `u` num literal, ainda
 * que o runtime a suporte. Mesma saida que `lib/sdr/blindagem.ts` usa nas
 * guardas de palavra com acento.
 */
const TEM_LETRA = new RegExp('\\p{L}', 'u')

export function inferirPorConteudo(
  matriz: readonly (readonly string[])[],
  primeiraLinhaDeDados = 0,
  amostra = 12,
): Mapeamento {
  const linhas = matriz.slice(primeiraLinhaDeDados, primeiraLinhaDeDados + amostra)
  if (linhas.length === 0) return {}

  const largura = Math.max(0, ...linhas.map((l) => l.length))
  const mapeamento: Mapeamento = {}
  const usadas = new Set<number>()

  const celulasDe = (coluna: number) =>
    linhas.map((l) => (l[coluna] ?? '').trim()).filter(Boolean)

  const maioria = (quantos: number, total: number) => total >= 2 && quantos * 2 >= total

  // E-mail e telefone primeiro: são os únicos com forma conferível, e acertar
  // um deles remove a coluna da disputa pelos outros campos.
  for (const [campo, detecta] of [
    ['email', temFormaDeEmail],
    ['phone', temFormaDeTelefone],
  ] as const) {
    for (let c = 0; c < largura; c++) {
      if (usadas.has(c) || mapeamento[campo] !== undefined) continue
      const celulas = celulasDe(c)
      if (maioria(celulas.filter(detecta).length, celulas.length)) {
        mapeamento[campo] = c
        usadas.add(c)
      }
    }
  }

  // Valor: célula que vira número depois de tirar "R$" e separador de milhar.
  for (let c = 0; c < largura; c++) {
    if (usadas.has(c) || mapeamento.value !== undefined) continue
    const celulas = celulasDe(c)
    const numericas = celulas.filter((v) => {
      const n = parseValorBRL(v)
      return n !== null && n > 0
    }).length
    if (maioria(numericas, celulas.length)) {
      mapeamento.value = c
      usadas.add(c)
    }
  }

  // Nome: o que sobra com texto. A mais à esquerda ganha — em lista escrita por
  // gente, o nome vem primeiro.
  for (let c = 0; c < largura; c++) {
    if (usadas.has(c) || mapeamento.name !== undefined) continue
    const celulas = celulasDe(c)
    const comLetra = celulas.filter((v) => TEM_LETRA.test(v)).length
    if (maioria(comLetra, celulas.length)) {
      mapeamento.name = c
      usadas.add(c)
    }
  }

  return mapeamento
}
