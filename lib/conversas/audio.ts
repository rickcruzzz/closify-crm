/** A mídia só é buscada depois da autorização da mensagem na rota. */
export const TETO_DO_AUDIO = 20 * 1024 * 1024

// Hosts do armazenamento da Z-API, não qualquer endereço vindo de webhook.
const HOSTS_DE_AUDIO = new Set(['f004.backblazeb2.com'])
const MIMES_DE_AUDIO = new Set([
  'audio/ogg', 'audio/opus', 'audio/mpeg', 'audio/mp3', 'audio/mp4',
  'audio/aac', 'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/amr', 'audio/3gpp',
])

export class AudioIndisponivelError extends Error {
  constructor(readonly status = 502) {
    super('Áudio indisponível. O arquivo pode ter expirado no WhatsApp.')
  }
}

export function validarUrlAudio(chave: string | null): URL {
  let url: URL
  try { url = new URL(chave ?? '') } catch { throw new AudioIndisponivelError(410) }
  if (
    url.protocol !== 'https:' || url.username || url.password || url.hash ||
    (url.port && url.port !== '443') || !HOSTS_DE_AUDIO.has(url.hostname)
  ) throw new AudioIndisponivelError(410)
  return url
}

function mimeDosBytes(bytes: Uint8Array): string | null {
  const inicio = String.fromCharCode(...Array.from(bytes.subarray(0, 12)))
  if (inicio.startsWith('OggS')) return 'audio/ogg'
  if (inicio.startsWith('ID3') || (bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0)) return 'audio/mpeg'
  if (inicio.startsWith('RIFF') && inicio.slice(8, 12) === 'WAVE') return 'audio/wav'
  if (inicio.slice(4, 8) === 'ftyp') return 'audio/mp4'
  if (inicio.startsWith('#!AMR')) return 'audio/amr'
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return 'audio/webm'
  return null
}

export async function responderAudioDaMensagem(params: {
  chave: string | null
  mime?: string | null
  range?: string | null
  signal?: AbortSignal
}): Promise<Response> {
  const url = validarUrlAudio(params.chave)
  const range = params.range?.trim()
  const partes = range?.match(/^bytes=(\d*)-(\d*)$/)
  if (range && (!partes || (!partes[1] && !partes[2]) ||
    (partes[1] && Number(partes[1]) >= TETO_DO_AUDIO) ||
    (partes[2] && Number(partes[2]) > TETO_DO_AUDIO) ||
    (partes[1] && partes[2] && Number(partes[1]) > Number(partes[2])))) {
    throw new AudioIndisponivelError(416)
  }
  const sinal = params.signal
    ? AbortSignal.any([params.signal, AbortSignal.timeout(12_000)])
    : AbortSignal.timeout(12_000)
  const upstream = await fetch(url, {
    headers: range ? { Range: range } : {},
    redirect: 'error', cache: 'no-store', signal: sinal,
  })
  const rejeitar = async (status = 502): Promise<never> => {
    await upstream.body?.cancel().catch(() => {})
    throw new AudioIndisponivelError(status)
  }
  if (upstream.status === 404 || upstream.status === 410) return rejeitar(410)
  if (![200, 206].includes(upstream.status) || !upstream.body) return rejeitar()

  const tamanhoBruto = upstream.headers.get('content-length')
  const tamanho = tamanhoBruto === null ? null : Number(tamanhoBruto)
  if (tamanho !== null && (!Number.isSafeInteger(tamanho) || tamanho <= 0 || tamanho > TETO_DO_AUDIO)) return rejeitar()
  const contentRange = upstream.headers.get('content-range')
  const trecho = contentRange?.match(/^bytes (\d+)-(\d+)\/(\d+)$/)
  if (upstream.status === 206 && (!range || !trecho ||
    Number(trecho[1]) > Number(trecho[2]) || Number(trecho[2]) >= Number(trecho[3]) ||
    Number(trecho[3]) > TETO_DO_AUDIO ||
    (tamanho !== null && tamanho !== Number(trecho[2]) - Number(trecho[1]) + 1))) return rejeitar()
  if (upstream.status === 206 && trecho && partes) {
    const totalArquivo = Number(trecho[3])
    const inicioPedido = partes[1] ? Number(partes[1]) : Math.max(0, totalArquivo - Number(partes[2]))
    const fimPedido = partes[1] && partes[2] ? Math.min(Number(partes[2]), totalArquivo - 1) : totalArquivo - 1
    if (Number(trecho[1]) !== inicioPedido || Number(trecho[2]) > fimPedido) return rejeitar()
  }

  const bruto = upstream.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()
  const declarado = bruto === 'application/ogg' ? 'audio/ogg' : bruto
  const mimeSalvo = params.mime?.split(';')[0]?.trim().toLowerCase()
  const reader = upstream.body.getReader()
  const primeiros: Uint8Array[] = []
  let total = 0
  let acabou = false
  try {
    while (total < 16 && !acabou) {
      const parte = await reader.read()
      acabou = parte.done
      if (parte.value) { total += parte.value.byteLength; primeiros.push(parte.value) }
      if (total > TETO_DO_AUDIO) throw new AudioIndisponivelError()
    }
    const cabecalho = new Uint8Array(Math.min(total, 16))
    let posicao = 0
    for (const parte of primeiros) {
      const fatia = parte.subarray(0, cabecalho.length - posicao)
      cabecalho.set(fatia, posicao)
      posicao += fatia.length
      if (posicao === cabecalho.length) break
    }
    const inicioDoArquivo = upstream.status === 200 || Number(trecho?.[1]) === 0
    const detectado = inicioDoArquivo ? mimeDosBytes(cabecalho) : null
    const mime = detectado ?? (declarado && MIMES_DE_AUDIO.has(declarado) ? declarado : null)
      ?? (mimeSalvo && MIMES_DE_AUDIO.has(mimeSalvo) ? mimeSalvo : null)
    // Safari pode começar com bytes=0-1: não há assinatura completa nesses dois
    // bytes. Nesse probe validado, exigimos concordância dos dois MIME de áudio.
    const probeCurto = upstream.status === 206 && inicioDoArquivo && acabou &&
      total < 12 && tamanho === total && declarado === mimeSalvo &&
      Boolean(declarado && MIMES_DE_AUDIO.has(declarado))
    // Um 200 de HTML, JSON ou bytes criptografados não é áudio reproduzível.
    if (!total || (inicioDoArquivo && !detectado && !probeCurto) || !mime ||
      (declarado && declarado !== 'application/octet-stream' && !MIMES_DE_AUDIO.has(declarado))) {
      throw new AudioIndisponivelError()
    }
    const headers = new Headers({
      'Content-Type': detectado === 'audio/mpeg' && mimeSalvo === 'audio/aac' ? mimeSalvo : mime,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
      'Accept-Ranges': 'bytes',
    })
    if (tamanho !== null) headers.set('Content-Length', String(tamanho))
    if (upstream.status === 206) headers.set('Content-Range', contentRange!)
    const corpo = new ReadableStream<Uint8Array>({
      start(controlador) {
        for (const parte of primeiros) controlador.enqueue(parte)
        if (acabou) controlador.close()
      },
      async pull(controlador) {
        try {
          const parte = await reader.read()
          if (parte.done) { controlador.close(); return }
          total += parte.value.byteLength
          if (total > TETO_DO_AUDIO) {
            await reader.cancel()
            controlador.error(new AudioIndisponivelError())
            return
          }
          controlador.enqueue(parte.value)
        } catch {
          await reader.cancel().catch(() => {})
          controlador.error(new AudioIndisponivelError())
        }
      },
      cancel: () => reader.cancel(),
    })
    return new Response(corpo, { status: upstream.status, headers })
  } catch {
    await reader.cancel().catch(() => {})
    throw new AudioIndisponivelError()
  }
}
