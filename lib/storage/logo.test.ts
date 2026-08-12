import { describe, expect, it } from 'vitest'

import {
  LOGO_TAMANHO_MAXIMO,
  caminhoDaLogo,
  detectarFormato,
  validarLogo,
} from './logo'

/** Monta bytes com a assinatura pedida e enchimento até o tamanho. */
function arquivo(assinatura: number[], tamanho = 64): Uint8Array {
  const bytes = new Uint8Array(tamanho)
  bytes.set(assinatura)
  return bytes
}

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const JPEG = [0xff, 0xd8, 0xff, 0xe0]
// RIFF + 4 bytes de tamanho + WEBP
const WEBP = [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]

describe('detectarFormato', () => {
  it('reconhece PNG, JPEG e WEBP pela assinatura', () => {
    expect(detectarFormato(arquivo(PNG))).toBe('png')
    expect(detectarFormato(arquivo(JPEG))).toBe('jpeg')
    expect(detectarFormato(arquivo(WEBP))).toBe('webp')
  })

  it('recusa arquivo curto demais para ter assinatura', () => {
    expect(detectarFormato(new Uint8Array([0x89, 0x50]))).toBeNull()
  })

  // RIFF sozinho é contêiner de WAV e AVI também. Sem conferir a marca "WEBP"
  // no byte 8, um áudio entraria como imagem.
  it('recusa RIFF que não seja WEBP', () => {
    const wav = arquivo([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45])
    expect(detectarFormato(wav)).toBeNull()
  })
})

describe('validarLogo', () => {
  it('aceita os três formatos com o mime e a extensão certos', () => {
    expect(validarLogo(arquivo(PNG))).toEqual({
      formato: 'png',
      tipoMime: 'image/png',
      extensao: 'png',
    })
    expect(validarLogo(arquivo(JPEG))).toMatchObject({ extensao: 'jpg' })
    expect(validarLogo(arquivo(WEBP))).toMatchObject({ tipoMime: 'image/webp' })
  })

  // O ponto do arquivo: extensão e Content-Type são escolhidos por quem envia,
  // e o `allowed_mime_types` do bucket compara com o que o cliente DECLAROU.
  // A checagem que vale é esta.
  it('recusa arquivo que só finge ser imagem', () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>')
    expect(validarLogo(svg)).toEqual({
      erro: 'Formato não aceito. Envie um arquivo PNG, JPG ou WEBP.',
    })

    const html = new TextEncoder().encode('<!doctype html><script>alert(1)</script>')
    expect(validarLogo(html)).toMatchObject({ erro: expect.stringContaining('PNG') })
  })

  it('recusa arquivo vazio', () => {
    expect(validarLogo(new Uint8Array(0))).toEqual({
      erro: 'O arquivo está vazio. Escolha outra imagem.',
    })
  })

  it('recusa acima de 2 MB, dizendo o tamanho e o limite', () => {
    const grande = arquivo(PNG, LOGO_TAMANHO_MAXIMO + 1)
    expect(validarLogo(grande)).toEqual({ erro: 'A imagem tem 2.0 MB. O limite é 2 MB.' })
  })

  it('aceita exatamente no limite', () => {
    expect(validarLogo(arquivo(PNG, LOGO_TAMANHO_MAXIMO))).toMatchObject({ formato: 'png' })
  })
})

describe('caminhoDaLogo', () => {
  const ws = '11111111-2222-3333-4444-555555555555'

  // O primeiro segmento é o que a RLS do Storage lê (0031). Mudar este formato
  // quebraria a política em silêncio: `workspace_do_caminho` devolveria null e
  // tudo seria recusado.
  it('põe o workspace como primeiro segmento', () => {
    expect(caminhoDaLogo(ws, 'png').startsWith(`${ws}/`)).toBe(true)
    expect(caminhoDaLogo(ws, 'png').endsWith('.png')).toBe(true)
  })

  it('gera nome diferente a cada envio, para não servir a logo antiga do cache', () => {
    expect(caminhoDaLogo(ws, 'png')).not.toBe(caminhoDaLogo(ws, 'png'))
  })
})
