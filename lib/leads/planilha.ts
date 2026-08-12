/**
 * Camada de cima da importação: matriz de células + mapeamento → leads.
 *
 * Separada de `lib/leads/csv.ts` porque a planilha em Excel chega já como
 * matriz — o `.xlsx` é lido no navegador — e precisa passar exatamente pela
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
 * planilha do Excel, do Google Sheets e do que os concorrentes documentam —
 * não de suposição.
 */
const APELIDOS: Record<CampoDestino, string[]> = {
  name: ['nome', 'name', 'nome completo', 'contato', 'lead', 'cliente', 'nome do cliente', 'nome do contato', 'responsavel'],
  phone: ['telefone', 'phone', 'celular', 'whatsapp', 'zap', 'fone', 'tel', 'contato telefonico', 'numero'],
  email: ['e-mail', 'email', 'mail', 'e mail', 'correio eletronico'],
  company: ['empresa', 'company', 'razao social', 'organizacao', 'negocio', 'estabelecimento', 'cliente empresa'],
  value: ['valor', 'value', 'ticket', 'valor do negocio', 'valor estimado', 'valor proposta', 'preco', 'orcamento'],
  status: ['etapa', 'status', 'situacao', 'fase', 'estagio', 'stage', 'funil'],
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
 * cabeçalho desconhecido abortava o arquivo inteiro — "Razão Social" em vez de
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
 * Devolve `null` quando não reconhece — quem chama decide cair em 'novo' e
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
 * cada variação viraria um lead diferente — o jeito mais rápido de sujar um
 * pipeline recém-importado.
 */
export function apenasDigitos(bruto: string): string {
  const digitos = bruto.replace(/\D/g, '')
  const semPais = digitos.startsWith('55') && digitos.length > 11 ? digitos.slice(2) : digitos
  return semPais.startsWith('0') ? semPais.slice(1) : semPais
}

/**
 * A chave que identifica o contato entre linhas e contra o banco. E-mail tem
 * prioridade por ser único de verdade; telefone é o plano B para a lista que
 * não tem e-mail nenhum.
 */
export function chaveDeContato(email: string | null, phone: string | null): string | null {
  if (email) return `e:${email.toLowerCase()}`
  const digitos = phone ? apenasDigitos(phone) : ''
  // Menos de 8 dígitos não é telefone, é resto de célula — não serve de chave.
  return digitos.length >= 8 ? `t:${digitos}` : null
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
   * R$ 0,00 por cima do valor real — perda silenciosa, do tipo que só aparece
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
    erros.push(
      `A planilha tem ${corpo.length} linhas; só as primeiras ${limiteDeLinhas} foram lidas.`,
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
    const email = celula('email').toLowerCase()
    const phone = celula('phone')
    const company = celula('company')
    const valorBruto = celula('value')
    const etapaBruta = celula('status')

    // Linha totalmente vazia é resto de planilha, não erro de quem preencheu.
    if (!name && !email && !phone) return

    if (name.length < 2) {
      erros.push(`Linha ${numeroDaLinha}: nome ausente ou muito curto.`)
      return
    }

    const chave = chaveDeContato(email || null, phone || null)
    if (!chave) {
      erros.push(`Linha ${numeroDaLinha}: sem e-mail nem telefone — não há como contatar.`)
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
          `Linha ${numeroDaLinha}: etapa "${etapaBruta}" não reconhecida —` +
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
 * lado de cada campo mapeado — a diferença entre escolher uma coluna às
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
