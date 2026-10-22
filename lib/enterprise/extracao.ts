import type { DadosDoEvento } from '@/lib/enterprise/eventos'
import { normalizarTelefoneBrasileiro } from '@/lib/leads/whatsapp'

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
}

export type ResultadoDaExtracao =
  | { ok: true; evento: EventoExtraido }
  | { ok: false; motivo: string }

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
  const emailValido = emailDoResumo && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailDoResumo) ? emailDoResumo : null
  const contato_email = emailValido ?? primeiroEmail(params.textoDaPagina)
  const contato_telefone = telefoneDoResumo ?? primeiroTelefone(params.textoDaPagina)

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
        (!emailValido && contato_email !== null) || (!telefoneDoResumo && contato_telefone !== null),
    },
  }
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
