/**
 * Leitura do CSV de importação de leads (Nome, Telefone, E-mail, Valor).
 *
 * Sem dependência externa de propósito: o formato aceito é pequeno e
 * conhecido, e uma lib de CSV completa entraria no bundle só para isso. O
 * parser roda no servidor (Server Action), nunca confia no cliente e devolve
 * erro por linha em vez de abortar o arquivo inteiro — planilha real sempre
 * tem uma linha suja no meio, e derrubar as outras 300 por causa dela seria
 * pior do que importar o que dá e avisar o resto.
 */

/** Acima disto o arquivo não é "planilha simples", é carga em massa. */
export const CSV_MAX_BYTES = 512 * 1024
export const CSV_MAX_LINHAS = 1000

export type LinhaCsvLead = {
  /** Linha no arquivo (1 = cabeçalho), para a mensagem de erro citar onde. */
  linha: number
  name: string
  email: string
  phone: string | null
  value: number
}

export type ResultadoCsv = {
  linhas: LinhaCsvLead[]
  /** Uma mensagem por linha descartada, já pronta para exibir. */
  erros: string[]
}

const ALIASES: Record<'name' | 'phone' | 'email' | 'value', string[]> = {
  name: ['nome', 'name', 'nome completo', 'contato', 'lead', 'cliente'],
  phone: ['telefone', 'phone', 'celular', 'whatsapp', 'fone', 'tel'],
  email: ['e-mail', 'email', 'mail', 'e mail'],
  value: ['valor', 'value', 'ticket', 'valor do negocio', 'valor estimado'],
}

/** Tira acento e caixa para o cabeçalho casar com "E-mail", "EMAIL", "e mail". */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    // Faixa dos diacríticos combinantes: `\p{Diacritic}` seria mais legível,
    // mas exige a flag `u`, que o target do tsconfig não aceita.
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

/**
 * Excel em português exporta com `;`, Google Sheets com `,`. Detectar em vez
 * de fixar evita o modo de falha mais comum: o arquivo inteiro virar uma
 * coluna só e nenhuma linha ser importada.
 */
function detectarSeparador(cabecalho: string): string {
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
 * aspas contendo quebra de linha — endereço colado da planilha faz isso.
 */
function tokenizar(texto: string, separador: string): string[][] {
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
 * Aceita "1.234,56" (pt-BR), "1234.56" (en) e "R$ 1.234,56". Devolve `null`
 * quando sobra algo que não é número — melhor recusar a linha do que gravar
 * um valor errado num CRM de vendas.
 */
export function parseValorBRL(bruto: string): number | null {
  const original = bruto.trim()
  // Célula em branco é 0 (lead sem valor estimado é caso normal); célula com
  // conteúdo que não tem dígito nenhum é erro, não zero — antes "abc" virava
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
    // grupo desempata — três dígitos é separador de milhar.
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

export function parseCsvLeads(texto: string): ResultadoCsv {
  // BOM do Excel vira caractere invisível grudado no primeiro cabeçalho e faz
  // "Nome" deixar de casar com "nome".
  const conteudo = texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto

  if (!conteudo.trim()) {
    return { linhas: [], erros: ['O arquivo está vazio.'] }
  }

  const primeiraLinha = conteudo.split('\n', 1)[0] ?? ''
  const separador = detectarSeparador(primeiraLinha)
  const registros = tokenizar(conteudo, separador)

  const cabecalho = (registros[0] ?? []).map(normalizar)
  const indice = {
    name: cabecalho.findIndex((c) => ALIASES.name.includes(c)),
    email: cabecalho.findIndex((c) => ALIASES.email.includes(c)),
    phone: cabecalho.findIndex((c) => ALIASES.phone.includes(c)),
    value: cabecalho.findIndex((c) => ALIASES.value.includes(c)),
  }

  const faltando: string[] = []
  if (indice.name < 0) faltando.push('Nome')
  if (indice.email < 0) faltando.push('E-mail')
  if (faltando.length > 0) {
    return {
      linhas: [],
      erros: [
        `Cabeçalho sem ${faltando.join(' e ')}. A primeira linha precisa ter as colunas Nome, Telefone, E-mail e Valor.`,
      ],
    }
  }

  const corpo = registros.slice(1)
  const erros: string[] = []

  if (corpo.length > CSV_MAX_LINHAS) {
    erros.push(
      `O arquivo tem ${corpo.length} linhas; só as primeiras ${CSV_MAX_LINHAS} foram lidas.`,
    )
  }

  const linhas: LinhaCsvLead[] = []
  const emailsVistos = new Set<string>()

  corpo.slice(0, CSV_MAX_LINHAS).forEach((celulas, i) => {
    // +2: índice zero-based do corpo mais a linha do cabeçalho.
    const numeroDaLinha = i + 2
    const celula = (posicao: number) => (posicao >= 0 ? (celulas[posicao] ?? '').trim() : '')

    const name = celula(indice.name)
    const email = celula(indice.email).toLowerCase()
    const phoneBruto = celula(indice.phone)
    const valorBruto = celula(indice.value)

    if (!name && !email) return

    if (name.length < 2) {
      erros.push(`Linha ${numeroDaLinha}: nome ausente ou muito curto.`)
      return
    }

    if (!email) {
      erros.push(`Linha ${numeroDaLinha}: e-mail ausente.`)
      return
    }

    // Duplicata dentro do próprio arquivo: importar duas vezes o mesmo
    // contato é o erro que mais suja pipeline depois.
    if (emailsVistos.has(email)) {
      erros.push(`Linha ${numeroDaLinha}: e-mail ${email} repetido no arquivo.`)
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

    emailsVistos.add(email)
    linhas.push({
      linha: numeroDaLinha,
      name,
      email,
      phone: phoneBruto || null,
      value,
    })
  })

  return { linhas, erros }
}
