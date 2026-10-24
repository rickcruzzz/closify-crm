import type { DadosDoEvento } from '@/lib/enterprise/eventos'
import { normalizarTelefoneBrasileiro } from '@/lib/leads/whatsapp'
import { contatoDoEventoCompleto } from '@/lib/enterprise/contato'

/**
 * O que a Exa devolve de uma página, transformado em evento — ou recusado.
 *
 * ## Por que existe uma camada pura aqui
 *
 * A Exa lê a página e um modelo resume nos campos do `ESQUEMA_DO_EVENTO`. Esse
 * resumo é TEXTO de modelo: pode vir com data no formato errado, cidade de
 * outro estado, evento que já passou ou contato inventado. Nada disso pode
 * chegar ao banco sem passar por aqui, e cada recusa tem motivo escrito para a
 * tela dizer por que a página ficou de fora.
 *
 * ## O contato vem do TEXTO da página, não só do resumo
 *
 * Medido em 22/10 contra a API real: a página inicial do BTX 26 voltou com
 * `contato_email`, `contato_nome` e `contato_telefone` nulos no resumo, e o
 * e-mail estava no rodapé. O resumo é preferido; quando ele não traz, o
 * primeiro e-mail e o primeiro telefone brasileiro válidos ESCRITOS na página
 * entram no lugar. Nunca um contato que não esteja na página.
 */

/** O esquema que a Exa preenche. String vazia ou nulo quando não está escrito. */
export const ESQUEMA_DO_EVENTO = {
  type: 'object',
  properties: {
    e_evento_futuro: {
      type: 'boolean',
      description: 'A página descreve UM evento presencial específico com data marcada no futuro',
    },
    nome: { type: 'string' },
    data_inicio: { type: 'string', description: 'Data de início no formato AAAA-MM-DD' },
    cidade: { type: 'string' },
    organizador: { type: 'string' },
    contato_nome: { type: 'string' },
    contato_email: { type: 'string' },
    contato_telefone: { type: 'string' },
    publico_estimado: { type: 'integer', description: 'Só se a página declarar um número' },
    perfil_publico: { type: 'string' },
  },
  required: ['e_evento_futuro', 'nome'],
} as const

export const PERGUNTA_DO_RESUMO =
  'Extraia os dados do evento descrito nesta página. Use string vazia quando a informação não estiver escrita na página. Nunca invente nem estime: contato, público e organizador só se estiverem escritos.'

export type EventoExtraido = DadosDoEvento & {
  /** O contato saiu do texto da página, e não do resumo: a tela diz isso. */
  contatoDoTexto: boolean
  /**
   * A página onde o contato está escrito, quando NÃO é a do evento (25/10).
   * Nulo quando e-mail e telefone saíram da própria página do evento.
   */
  fonte_contato_url: string | null
}

export type ResultadoDaExtracao =
  | { ok: true; evento: EventoExtraido }
  | {
      ok: false
      motivo: string
      /**
       * O evento passou em tudo menos no contato. É o único caso que vale
       * procurar o contato em outra página pública (`contatoEmOutraFonte`).
       */
      semContato?: true
      nome?: string
    }

export type PaginaDeContato = { url: string; texto: string | null }

/** Quão longe no futuro um evento ainda interessa ao radar. */
const HORIZONTE_EM_DIAS = 540

const texto = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null
  const limpo = v.replace(/\s+/g, ' ').trim()
  return limpo ? limpo.slice(0, max) : null
}

/** Sem acento e em minúsculas: "Salvador - BA" e "salvador" são a mesma cidade. */
function semAcento(v: string): string {
  return v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi
// Extensões de arquivo que o padrão de e-mail confunde: `logo@2x.png` casa com
// a expressão e não é endereço de ninguém.
const NAO_E_EMAIL = /\.(png|jpe?g|gif|svg|webp|avif)$/i
const TELEFONE = /(?:\+?55[\s.-]?)?\(?\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}/g

export function primeiroEmail(textoDaPagina: string | null | undefined): string | null {
  for (const achado of (textoDaPagina ?? '').match(EMAIL) ?? []) {
    const email = achado.toLowerCase()
    if (!NAO_E_EMAIL.test(email)) return email
  }
  return null
}

export function primeiroTelefone(textoDaPagina: string | null | undefined): string | null {
  for (const achado of (textoDaPagina ?? '').match(TELEFONE) ?? []) {
    const numero = normalizarTelefoneBrasileiro(achado)
    if (numero) return numero
  }
  return null
}

/**
 * O resumo da Exa chega como STRING de JSON. Lê sem lançar: resumo quebrado é
 * página recusada, não Action derrubada.
 */
export function lerResumo(resumo: unknown): Record<string, unknown> | null {
  if (resumo && typeof resumo === 'object') return resumo as Record<string, unknown>
  if (typeof resumo !== 'string') return null
  try {
    const lido: unknown = JSON.parse(resumo)
    return lido && typeof lido === 'object' ? (lido as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export function extrairEvento(params: {
  url: string
  resumo: unknown
  textoDaPagina: string | null
  cidadeDoRadar: string
  /** `AAAA-MM-DD` de hoje em São Paulo. */
  hoje: string
  /**
   * Páginas públicas de uma busca dirigida pelo contato do evento. Só são
   * lidas quando a página do evento não traz e-mail E telefone.
   */
  paginasDeContato?: PaginaDeContato[]
}): ResultadoDaExtracao {
  const dados = lerResumo(params.resumo)
  if (!dados) return { ok: false, motivo: 'A página não pôde ser lida.' }
  if (dados.e_evento_futuro !== true) {
    return { ok: false, motivo: 'A página não descreve um evento futuro específico.' }
  }

  const nome = texto(dados.nome, 200)
  if (!nome || nome.length < 3) return { ok: false, motivo: 'O nome do evento não está na página.' }

  const data = texto(dados.data_inicio, 10)
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data) || !Number.isFinite(Date.parse(`${data}T12:00:00Z`))) {
    return { ok: false, motivo: 'A data do evento não está clara na página.' }
  }
  if (data < params.hoje) return { ok: false, motivo: 'O evento já aconteceu.' }
  const dias = (Date.parse(`${data}T12:00:00Z`) - Date.parse(`${params.hoje}T12:00:00Z`)) / 86_400_000
  if (dias > HORIZONTE_EM_DIAS) return { ok: false, motivo: 'O evento está longe demais para abordar agora.' }

  // ## Cidade ausente no resumo NÃO é cidade errada
  //
  // Medido na varredura real de 22/10: 3 de 10 páginas voltaram com `cidade`
  // nula, entre elas a única com e-mail E telefone. Se o resumo diz OUTRA
  // cidade, recusa; se não diz nenhuma, aceita só quando o texto da página
  // escreve a cidade do radar.
  const cidade = texto(dados.cidade, 120)
  const alvo = semAcento(params.cidadeDoRadar)
  const naCidade = cidade
    ? semAcento(cidade).includes(alvo)
    : semAcento(params.textoDaPagina ?? '').includes(alvo)
  if (!naCidade) {
    return { ok: false, motivo: `O evento não é em ${params.cidadeDoRadar}.` }
  }

  let url: URL
  try {
    url = new URL(params.url)
  } catch {
    return { ok: false, motivo: 'Endereço da página inválido.' }
  }
  if (url.protocol !== 'https:') return { ok: false, motivo: 'A página não é HTTPS.' }

  const emailDoResumo = texto(dados.contato_email, 200)?.toLowerCase() ?? null
  const telefoneDoResumo = normalizarTelefoneBrasileiro(texto(dados.contato_telefone, 40))
  const emailsNaFonte = (params.textoDaPagina ?? '').match(EMAIL)?.map((email) => email.toLowerCase()) ?? []
  const telefonesNaFonte = ((params.textoDaPagina ?? '').match(TELEFONE) ?? []).map(normalizarTelefoneBrasileiro)
  // O resumo é saída de IA, não comprovação. Aceite apenas contato escrito na fonte.
  const emailValido = emailDoResumo && emailsNaFonte.includes(emailDoResumo) && !NAO_E_EMAIL.test(emailDoResumo) ? emailDoResumo : null
  let contato_email = emailValido ?? primeiroEmail(params.textoDaPagina)
  const telefoneVerificado = telefoneDoResumo && telefonesNaFonte.includes(telefoneDoResumo) ? telefoneDoResumo : null
  let contato_telefone = telefoneVerificado ?? primeiroTelefone(params.textoDaPagina)
  let fonte_contato_url: string | null = null
  if (!contatoDoEventoCompleto({ contato_email, contato_telefone })) {
    // ## O contato pode estar em OUTRA página pública do evento (25/10)
    //
    // Medido na varredura real: 6 de 7 eventos válidos não escreviam e-mail e
    // telefone na própria página, e uma busca dirigida achou os dois em 4 de 5
    // (página de expositores, de patrocínio, site da organizadora). A regra de
    // 22/10 continua inteira: só entra contato ESCRITO numa página, lido por
    // expressão regular, nunca o que o resumo da IA disser. O que muda é que a
    // página pode ser outra, e ela fica registrada como fonte do contato.
    const externo = params.paginasDeContato
      ? contatoEmOutraFonte(params.paginasDeContato, { nome, fonteUrl: params.url })
      : null
    if (!externo) {
      return {
        ok: false,
        motivo: 'A fonte não informa e-mail e telefone válidos. O resultado não será adicionado ao Radar nem aos contatos.',
        semContato: true,
        nome,
      }
    }
    contato_email = externo.email
    contato_telefone = externo.telefone
    fonte_contato_url = externo.url
  }

  const publico = typeof dados.publico_estimado === 'number' ? dados.publico_estimado : null

  return {
    ok: true,
    evento: {
      nome,
      data_inicio: data,
      // A cidade do RADAR, e não a escrita da página ("Salvador - BA", "Salvador/Bahia"):
      // o resto do produto compara por igualdade.
      cidade: params.cidadeDoRadar,
      fonte_url: url.href,
      organizador: texto(dados.organizador, 160),
      contato_nome: texto(dados.contato_nome, 120),
      contato_email,
      contato_telefone,
      publico_estimado:
        publico !== null && Number.isInteger(publico) && publico > 0 && publico <= 10_000_000 ? publico : null,
      perfil_publico: texto(dados.perfil_publico, 200),
      contatoDoTexto:
        fonte_contato_url !== null ||
        (!emailValido && contato_email !== null) || (!telefoneVerificado && contato_telefone !== null),
      fonte_contato_url,
    },
  }
}

/**
 * Palavras que não identificam evento nenhum: aparecem no nome de metade dos
 * congressos do país. Uma página que cita "Congresso Nacional" não é, por isso,
 * a página do "23º Congresso Nacional Anamt".
 */
const PALAVRAS_GENERICAS = new Set([
  'congresso', 'nacional', 'internacional', 'brasileiro', 'brasileira', 'feira',
  'evento', 'eventos', 'expo', 'edicao', 'salvador', 'bahia', 'brasil', 'simposio',
  'encontro', 'conferencia', 'semana', 'festival', 'forum', 'seminario', 'the',
  'and', 'for', 'dos', 'das', 'com', 'para',
])

/** As palavras do nome que identificam ESTE evento, sem número e sem acento. */
export function palavrasDoEvento(nome: string): string[] {
  return Array.from(new Set(
    semAcento(nome)
      .split(/[^a-z0-9]+/)
      .map((p) => p.replace(/\d+/g, ''))
      .filter((p) => p.length >= 3 && !PALAVRAS_GENERICAS.has(p)),
  ))
}

function dominioBase(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return null
  }
}

/**
 * E-mail de função antes de e-mail de pessoa: `comercial@` responde por mais
 * tempo e não é o endereço pessoal de alguém que só aparece citado na página.
 */
const EMAIL_DE_FUNCAO = /^(comercial|eventos?|contato|patrocinio|expositor|expositores|marketing|vendas|atendimento|info|organizacao)/i
const NAO_E_EMAIL_DE_CONTATO = /^(no-?reply|nao-?responda|privacidade|lgpd|dpo)@/i

/**
 * E-mail e telefone escritos numa página que é DO EVENTO, ou nulo.
 *
 * "Do evento" quer dizer: mesmo domínio da página oficial, ou um texto que cita
 * as palavras que identificam o evento (`palavrasDoEvento`, pelo menos duas
 * quando o nome tem duas). Os dois contatos precisam estar NA MESMA página:
 * e-mail de uma e telefone de outra poderiam ser de empresas diferentes, e é
 * exatamente o par que a conversa do CRM vai usar.
 */
export function contatoEmOutraFonte(
  paginas: PaginaDeContato[],
  evento: { nome: string; fonteUrl: string },
): { email: string; telefone: string; url: string } | null {
  const dominio = dominioBase(evento.fonteUrl)
  const palavras = palavrasDoEvento(evento.nome)
  // ## Com UMA palavra distintiva, uma página que a cita não prova nada
  //
  // Medido na varredura real de 25/10: "Bahia Connect 2027" tem só "connect"
  // fora das genéricas, e uma página do Coffee Connect passou, entregando o
  // e-mail da Bahia Farm Show. Com uma palavra só, a página precisa escrever o
  // NOME INTEIRO (sem número), ou ser do mesmo domínio.
  const nomeInteiro = semAcento(evento.nome).replace(/\d+/g, ' ').replace(/[^a-z]+/g, ' ').trim()

  const candidatas = paginas
    .filter((p) => p.url.startsWith('https://') && p.texto)
    .map((p) => {
      const host = dominioBase(p.url)
      const mesmoDominio = !!dominio && !!host && (host === dominio || host.endsWith(`.${dominio}`) || dominio.endsWith(`.${host}`))
      const texto = semAcento(p.texto!)
      const citadas = palavras.filter((palavra) => texto.includes(palavra)).length
      const cita =
        palavras.length >= 2
          ? citadas >= 2
          : palavras.length === 1 && nomeInteiro.length > 0 &&
            texto.replace(/[^a-z]+/g, ' ').includes(nomeInteiro)
      return { ...p, mesmoDominio, doEvento: mesmoDominio || cita }
    })
    .filter((p) => p.doEvento)
    // Mesmo domínio primeiro: é a organizadora falando dela mesma.
    .sort((a, b) => Number(b.mesmoDominio) - Number(a.mesmoDominio))

  for (const pagina of candidatas) {
    const emails = Array.from(new Set((pagina.texto!.match(EMAIL) ?? []).map((e) => e.toLowerCase())))
      .filter((e) => !NAO_E_EMAIL.test(e) && !NAO_E_EMAIL_DE_CONTATO.test(e))
    const email = emails.find((e) => EMAIL_DE_FUNCAO.test(e)) ?? emails[0]
    const telefone = primeiroTelefone(pagina.texto)
    if (email && telefone && contatoDoEventoCompleto({ contato_email: email, contato_telefone: telefone })) {
      return { email, telefone, url: pagina.url }
    }
  }
  return null
}

/**
 * A chave que diz "esta página já está no radar".
 *
 * Sem barra final e sem `www.`: a Exa devolve `https://evento.com.br/` numa
 * varredura e `https://www.evento.com.br` na seguinte, e as duas são a mesma
 * página. Sem isso o mesmo evento seria analisado (e cobrado) a cada varredura.
 */
export function chaveDaPagina(url: string): string {
  try {
    const u = new URL(url)
    return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}`.toLowerCase()
  } catch {
    return url.toLowerCase()
  }
}
