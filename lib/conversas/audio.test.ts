import { afterEach, describe, expect, it, vi } from 'vitest'
import { AudioIndisponivelError, responderAudioDaMensagem, TETO_DO_AUDIO, validarUrlAudio } from './audio'

const url = 'https://f004.backblazeb2.com/file/exemplo/audio.ogg'
const ogg = new TextEncoder().encode('OggS000000000000')
afterEach(() => vi.unstubAllGlobals())

function resposta(headers: Record<string, string> = {}, status = 200, bytes = ogg) {
  const buscar = vi.fn().mockResolvedValue(new Response(bytes, { status, headers: { 'content-type': 'audio/ogg; codecs=opus', 'content-length': String(bytes.length), ...headers } }))
  vi.stubGlobal('fetch', buscar)
  return buscar
}

describe('proxy seguro dos áudios WhatsApp', () => {
  it('aceita apenas HTTPS do host real do provedor', () => {
    expect(validarUrlAudio(url).hostname).toBe('f004.backblazeb2.com')
    for (const chave of [null, '', 'http://f004.backblazeb2.com/a', 'https://127.0.0.1/a', 'https://f004.backblazeb2.com.evil.test/a', 'https://outro.backblazeb2.com/a', 'https://senha@f004.backblazeb2.com/a', 'https://f004.backblazeb2.com:8443/a']) {
      expect(() => validarUrlAudio(chave)).toThrow(AudioIndisponivelError)
    }
  })
  it('reproduz bytes Ogg por streaming sem cache público, redirecionamento ou credenciais externas', async () => {
    const buscar = resposta()
    const r = await responderAudioDaMensagem({ chave: url })
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toBe('audio/ogg')
    expect(r.headers.get('cache-control')).toBe('private, no-store')
    expect(r.headers.get('x-content-type-options')).toBe('nosniff')
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(ogg)
    const opcoes = buscar.mock.calls[0]![1]
    expect(opcoes.redirect).toBe('error')
    expect(opcoes.headers).toEqual({})
  })
  it('suporta a continuação de um áudio com Range e MIME genérico do armazenamento', async () => {
    resposta({ 'content-type': 'application/octet-stream', 'content-range': 'bytes 16-31/64' }, 206, new Uint8Array(16))
    const r = await responderAudioDaMensagem({ chave: url, mime: 'audio/ogg; codecs=opus', range: 'bytes=16-31' })
    expect(r.status).toBe(206)
    expect(r.headers.get('content-range')).toBe('bytes 16-31/64')
    expect(r.headers.get('content-type')).toBe('audio/ogg')
    expect((await r.arrayBuffer()).byteLength).toBe(16)
  })
  it('aceita application/ogg apenas com assinatura de áudio válida', async () => {
    resposta({ 'content-type': 'application/ogg' })
    expect((await responderAudioDaMensagem({ chave: url })).headers.get('content-type')).toBe('audio/ogg')
  })
  it('aceita o probe inicial de dois bytes do player quando os MIME concordam', async () => {
    resposta({ 'content-range': 'bytes 0-1/64' }, 206, ogg.subarray(0, 2))
    const r = await responderAudioDaMensagem({ chave: url, mime: 'audio/ogg; codecs=opus', range: 'bytes=0-1' })
    expect(r.status).toBe(206)
    expect(r.headers.get('content-range')).toBe('bytes 0-1/64')
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(ogg.subarray(0, 2))
  })
  it('não dispensa assinatura de um probe sem MIME confiável ou com MIME divergente', async () => {
    for (const mime of [null, 'audio/mp4']) {
      resposta({ 'content-range': 'bytes 0-1/64' }, 206, ogg.subarray(0, 2))
      await expect(responderAudioDaMensagem({ chave: url, mime, range: 'bytes=0-1' })).rejects.toThrow(AudioIndisponivelError)
    }
  })
  it('recusa um trecho diferente do solicitado', async () => {
    resposta({ 'content-range': 'bytes 16-31/64' }, 206)
    await expect(responderAudioDaMensagem({ chave: url, range: 'bytes=0-15' })).rejects.toThrow(AudioIndisponivelError)
  })
  it('recusa Range múltiplo, invertido ou acima do teto antes da rede', async () => {
    const buscar = resposta()
    for (const range of ['bytes=0-1,4-5', 'bytes=10-2', 'bytes=-', 'bytes=999999999-']) {
      await expect(responderAudioDaMensagem({ chave: url, range })).rejects.toMatchObject({ status: 416 })
    }
    expect(buscar).not.toHaveBeenCalled()
  })
  it('expiração não vira um áudio falso', async () => {
    resposta({}, 404)
    await expect(responderAudioDaMensagem({ chave: url })).rejects.toMatchObject({ status: 410 })
  })
  it('recusa HTML e bytes criptografados mesmo com cabeçalho audio/ogg', async () => {
    resposta({}, 200, new TextEncoder().encode('<html>nao e audio</html>'))
    await expect(responderAudioDaMensagem({ chave: url })).rejects.toThrow(AudioIndisponivelError)
  })
  it('recusa arquivo acima do teto sem baixar o corpo inteiro', async () => {
    resposta({ 'content-length': String(TETO_DO_AUDIO + 1) })
    await expect(responderAudioDaMensagem({ chave: url })).rejects.toThrow(AudioIndisponivelError)
  })
})
