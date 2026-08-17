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
export function detectarSeparador(cabecalho: string): string {
  const foraDeAspas = cabecalho.replace(/"[^"]*"/g, '')
  const candidatos: string[] = [';', ',', '\t']

  let escolhido = ','
  let maior = 0
  for (const candidato of candidatos) {
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
export function lerCsv(texto: string): string[][] {
  const conteudo = texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto
  if (!conteudo.trim()) return []

  const primeiraLinha = conteudo.split('\n', 1)[0] ?? ''
  return tokenizar(conteudo, detectarSeparador(primeiraLinha))
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
