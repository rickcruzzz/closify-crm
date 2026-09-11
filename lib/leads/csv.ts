/**
 * Camada de baixo da importação: bytes de arquivo → matriz de células.
 *
 * Só o formato do ARQUIVO mora aqui. Quem decide que coluna é o quê, e o que
 * é um lead válido, é `lib/leads/planilha.ts`. A separação existe porque a
 * planilha em Excel chega já como matriz (a leitura do `.xlsx` acontece no
 * navegador) e precisa entrar no mesmo caminho de validação do CSV.
 *
 * Sem dependência externa de propósito para o CSV: o formato é pequeno e
 * conhecido, e uma lib completa entraria no bundle só para isso.
 */

/** Acima disto o arquivo não é "planilha simples", é carga em massa. */
export const CSV_MAX_BYTES = 512 * 1024
export const CSV_MAX_LINHAS = 1000

/**
 * Decodifica o arquivo respeitando a codificação real dele.
 *
 * `File.text()` decodifica SEMPRE em UTF-8, e o Excel em português salva
 * "CSV (separado por vírgulas)" em Windows-1252. Medido: "José Antônio"
 * chegava como "Jos� Ant�nio", ou seja, todo lead com acento
 * entrava no banco com o nome quebrado, calado, na planilha mais comum do
 * mercado brasileiro.
 *
 * A ordem importa. BOM primeiro, porque é declaração explícita. Depois UTF-8
 * com `fatal: true`, que ERRA em vez de trocar o byte inválido por U+FFFD,
 * é exatamente esse silêncio que escondia o defeito. Só então Windows-1252,
 * que aceita qualquer byte e nunca falha, e por isso não pode vir antes.
 */
export function decodificarPlanilha(dados: ArrayBuffer | Uint8Array): string {
  const bytes = dados instanceof Uint8Array ? dados : new Uint8Array(dados)

  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3))
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

/**
 * Excel em português exporta com `;`, Google Sheets com `,`. Detectar em vez
 * de fixar evita o modo de falha mais comum: o arquivo inteiro virar uma
 * coluna só e nenhuma linha ser importada.
 */
const CANDIDATOS: string[] = [';', ',', '\t']

/**
 * O separador de UMA linha, pelo número de ocorrências.
 *
 * Continua exportado e testado, mas **não é mais quem decide a leitura do
 * arquivo** — quem decide é `escolherSeparador`, que julga o conteúdo inteiro.
 * Esta função sozinha era o defeito de 08/09: aplicada à primeira linha, uma
 * planilha com título acima do cabeçalho virava uma coluna só.
 */
export function detectarSeparador(cabecalho: string): string {
  const foraDeAspas = cabecalho.replace(/"[^"]*"/g, '')

  let escolhido = ','
  let maior = 0
  for (const candidato of CANDIDATOS) {
    const total = foraDeAspas.split(candidato).length - 1
    if (total > maior) {
      maior = total
      escolhido = candidato
    }
  }

  return escolhido
}

/**
 * Percorre caractere a caractere porque `split('\n')` quebra em campo com
 * aspas contendo quebra de linha, endereço colado da planilha faz isso.
 */
export function tokenizar(texto: string, separador: string): string[][] {
  const linhas: string[][] = []
  let celulas: string[] = []
  let atual = ''
  let dentroDeAspas = false

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]!

    if (dentroDeAspas) {
      if (c === '"') {
        // `""` dentro de campo entre aspas é uma aspa literal.
        if (texto[i + 1] === '"') {
          atual += '"'
          i++
        } else {
          dentroDeAspas = false
        }
      } else {
        atual += c
      }
      continue
    }

    if (c === '"') {
      dentroDeAspas = true
    } else if (c === separador) {
      celulas.push(atual)
      atual = ''
    } else if (c === '\n') {
      celulas.push(atual)
      linhas.push(celulas)
      celulas = []
      atual = ''
    } else if (c !== '\r') {
      atual += c
    }
  }

  celulas.push(atual)
  linhas.push(celulas)

  return linhas.filter((celulas) => celulas.some((c) => c.trim() !== ''))
}

/**
 * Texto CSV → matriz de células, já com o BOM fora e o separador detectado.
 *
 * O BOM do Excel vira caractere invisível grudado no primeiro cabeçalho e faz
 * "Nome" deixar de casar com "nome". `decodificarPlanilha` já o remove quando
 * lê os bytes, mas esta função também aceita texto pronto (teste, colagem), e
 * aí ele pode ter sobrado.
 */
/**
 * O separador do arquivo INTEIRO, escolhido por consistência entre linhas.
 *
 * ## O defeito que isto conserta, medido em 08/09/2026
 *
 * `lerCsv` decidia o separador olhando a PRIMEIRA LINHA DO ARQUIVO. Relatório
 * exportado quase sempre traz título antes do cabeçalho:
 *
 *     RELATORIO DE CLIENTES
 *     Gerado em 08/09/2026
 *     Nome;Telefone;Empresa
 *     Joao;11988887777;Joao ME
 *
 * A primeira linha não tem `;` nenhum, então caía no padrão `,` e **o arquivo
 * inteiro virava uma coluna só**. Pular linhas na tela não salvava: o estrago
 * acontece na leitura, antes de a pessoa escolher qualquer coisa. E o modo de
 * falha é silencioso — nenhum erro, só uma prévia com uma coluna que ninguém
 * consegue mapear.
 *
 * ## Por que consistência, e não "a linha com mais separadores"
 *
 * Contar separadores numa linha só erra dos dois lados. Um endereço com
 * ponto-e-vírgula numa única linha de dados venceria o `,` de um arquivo do
 * Google Sheets; um título com vírgulas venceria o `;` de um arquivo do Excel.
 *
 * Aqui cada candidato é julgado por **em quantas linhas ele produz o MESMO
 * número de colunas** — que é o que um separador de verdade faz e um caractere
 * que aparece dentro do texto não faz. Linha sem o candidato não vota, e é
 * assim que a linha de título deixa de decidir a leitura do arquivo.
 *
 * As aspas saem antes de contar, sobre o conteúdo inteiro e não linha a linha:
 * um campo entre aspas pode conter quebra de linha, e ali a quebra não é fim de
 * registro.
 */
export function escolherSeparador(conteudo: string): string {
  const semAspas = conteudo.replace(/"[^"]*"/g, '')
  const linhas = semAspas
    .split(/\r?\n/)
    .filter((l) => l.trim())
    // Vinte linhas bastam para decidir e mantêm o custo constante numa
    // planilha de mil: o padrão de um CSV aparece nas primeiras.
    .slice(0, 20)

  if (linhas.length === 0) return ','

  let escolhido = ','
  let melhorNota = 0

  for (const candidato of CANDIDATOS) {
    const votos = new Map<number, number>()
    for (const linha of linhas) {
      const colunas = linha.split(candidato).length
      // `1` significa "o candidato não aparece nesta linha". Não é voto contra
      // nem a favor — é a linha de título se abstendo.
      if (colunas > 1) votos.set(colunas, (votos.get(colunas) ?? 0) + 1)
    }

    let modal = 0
    let apoio = 0
    // `Array.from` e não `for...of` direto no `Map`: o `target` deste projeto
    // recusa iterar Map sem `downlevelIteration`, e o `vitest` (que usa esbuild)
    // NÃO reclama — os testes passavam com o `tsc` reprovando.
    for (const [colunas, quantas] of Array.from(votos.entries())) {
      // Empate em apoio vai para quem produz MAIS colunas: um separador que
      // reparte o texto em cinco campos explica melhor a linha que um que
      // reparte em dois por acidente.
      if (quantas > apoio || (quantas === apoio && colunas > modal)) {
        modal = colunas
        apoio = quantas
      }
    }

    const nota = apoio * 1000 + modal
    if (nota > melhorNota) {
      melhorNota = nota
      escolhido = candidato
    }
  }

  return escolhido
}

export function lerCsv(texto: string): string[][] {
  const conteudo = texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto
  if (!conteudo.trim()) return []

  return tokenizar(conteudo, escolherSeparador(conteudo))
}

/**
 * Aceita "1.234,56" (pt-BR), "1234.56" (en) e "R$ 1.234,56". Devolve `null`
 * quando sobra algo que não é número, melhor recusar a linha do que gravar
 * um valor errado num CRM de vendas.
 */
export function parseValorBRL(bruto: string): number | null {
  const original = bruto.trim()
  // Célula em branco é 0 (lead sem valor estimado é caso normal); célula com
  // conteúdo que não tem dígito nenhum é erro, não zero, antes "abc" virava
  // R$ 0,00 em silêncio, que é pior do que recusar a linha.
  if (!original) return 0

  const limpo = original.replace(/[^\d,.-]/g, '')
  if (!/\d/.test(limpo)) return null

  const ultimaVirgula = limpo.lastIndexOf(',')
  const ultimoPonto = limpo.lastIndexOf('.')

  let normalizado: string
  if (ultimaVirgula >= 0 && ultimoPonto >= 0) {
    // Os dois presentes: o último a aparecer é o decimal, o outro é milhar.
    normalizado =
      ultimaVirgula > ultimoPonto
        ? limpo.replace(/\./g, '').replace(',', '.')
        : limpo.replace(/,/g, '')
  } else if (ultimaVirgula >= 0) {
    normalizado = limpo.replace(',', '.')
  } else if (ultimoPonto >= 0) {
    // Só ponto é ambíguo: "1.200" numa planilha brasileira é mil e duzentos,
    // enquanto "1234.56" é decimal exportado em inglês. O tamanho do último
    // grupo desempata, três dígitos é separador de milhar.
    const grupoFinal = limpo.slice(ultimoPonto + 1)
    normalizado =
      grupoFinal.length === 3
        ? limpo.replace(/\./g, '')
        : `${limpo.slice(0, ultimoPonto).replace(/\./g, '')}.${grupoFinal}`
  } else {
    normalizado = limpo
  }

  const numero = Number(normalizado)
  return Number.isFinite(numero) ? numero : null
}

/**
 * Em qual linha está o cabeçalho?
 *
 * ## O defeito que isto fecha, reproduzido pela TELA em 11/09
 *
 * Planilha exportada de outro sistema vem com título e data antes do
 * cabeçalho:
 *
 *     1  RELATORIO DE CLIENTES
 *     2  Gerado em 10/09/2026
 *     3  Nome;Telefone;Empresa      <- a linha que importa
 *
 * O diálogo mapeava a linha 0, achava "RELATORIO DE CLIENTES" como único
 * título, todas as colunas ficavam em "Nenhuma coluna" e o botão de confirmar
 * nascia **desabilitado**. Quem não descobrisse sozinho que precisa mover o
 * seletor de linha concluía que a importação não funciona — e foi exatamente
 * o relato do dono: *"até agora não consegui importar nenhuma planilha"*.
 *
 * Medido: dos cinco formatos testados pela interface, quatro passavam
 * (Google Sheets, Excel pt-BR, só-telefone, `.xlsx`) e **só o de título
 * falhava**. Não era a leitura — era qual linha ela lia.
 *
 * ## Como decide, e por que não é só "a primeira linha cheia"
 *
 * Pontua cada uma das primeiras linhas por quantas células casam com um
 * campo conhecido (`sugerirMapeamento` é a mesma função que o diálogo usa
 * depois, então a detecção e o mapeamento nunca discordam).
 *
 * Linha de título tem uma célula só e não casa com campo nenhum: pontua 0.
 * O cabeçalho de verdade casa com duas ou mais.
 *
 * ## O empate é resolvido para CIMA, e isso é decisão
 *
 * Sem nenhuma linha pontuando 2 ou mais, devolve 0 — o comportamento de hoje.
 * Errar para baixo custaria pular dados: numa planilha SEM cabeçalho, a
 * primeira linha já é contato, e "detectar" um cabeçalho ali apagaria uma
 * pessoa da importação sem ninguém notar.
 *
 * Só olha as primeiras linhas: cabeçalho no meio do arquivo não é planilha de
 * contatos, é relatório com seções, e adivinhar ali erraria mais que acertaria.
 */
export function detectarLinhaDoCabecalho(
  matriz: readonly (readonly string[])[],
  sugerir: (cabecalho: string[]) => Record<string, unknown>,
  limite = 8,
): number {
  let melhor = 0
  let melhorPontos = 0

  for (let i = 0; i < Math.min(limite, matriz.length); i++) {
    const linha = matriz[i] ?? []
    const preenchidas = linha.filter((c) => c.trim() !== '')
    // Uma célula só é título, não cabeçalho: "RELATORIO DE CLIENTES" numa
    // linha sozinha é o caso que motivou esta função.
    if (preenchidas.length < 2) continue

    const pontos = Object.keys(sugerir([...linha])).length
    if (pontos > melhorPontos) {
      melhorPontos = pontos
      melhor = i
    }
  }

  // Nenhuma linha reconhecida: fica em 0 e a pessoa escolhe, que é o
  // comportamento anterior. Melhor não mexer do que pular um contato.
  return melhorPontos >= 2 ? melhor : 0
}
