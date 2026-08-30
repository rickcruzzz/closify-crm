import { describe, expect, it } from 'vitest'

import {
  ANEXO_TAMANHO_MAXIMO,
  caminhoDoAnexo,
  detectarFormatoDeAnexo,
  formatarTamanho,
  validarAnexo,
} from '@/lib/storage/anexo-de-feedback'

/** Monta bytes com uma assinatura no começo, preenchendo o resto. */
function comAssinatura(assinatura: number[], tamanho = 64): Uint8Array {
  const bytes = new Uint8Array(tamanho)
  bytes.set(assinatura, 0)
  return bytes
}

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const JPEG = [0xff, 0xd8, 0xff]
const PDF = [0x25, 0x50, 0x44, 0x46]

describe('detectarFormatoDeAnexo', () => {
  it('reconhece PNG, JPEG e PDF pela assinatura', () => {
    expect(detectarFormatoDeAnexo(comAssinatura(PNG))).toBe('png')
    expect(detectarFormatoDeAnexo(comAssinatura(JPEG))).toBe('jpeg')
    expect(detectarFormatoDeAnexo(comAssinatura(PDF))).toBe('pdf')
  })

  // WEBP tem a marca PARTIDA: "RIFF", quatro bytes de tamanho, e só então
  // "WEBP". Checar só o "RIFF" aceitaria WAV e AVI, que começam igual.
  it('reconhece WEBP com a marca partida, e recusa RIFF de outro tipo', () => {
    const webp = new Uint8Array(64)
    webp.set([0x52, 0x49, 0x46, 0x46], 0)
    webp.set([0x57, 0x45, 0x42, 0x50], 8)
    expect(detectarFormatoDeAnexo(webp)).toBe('webp')

    // RIFF sem WEBP no offset 8 — é um WAV, e não pode passar.
    const wav = new Uint8Array(64)
    wav.set([0x52, 0x49, 0x46, 0x46], 0)
    wav.set([0x57, 0x41, 0x56, 0x45], 8)
    expect(detectarFormatoDeAnexo(wav)).toBeNull()
  })

  /**
   * O caso que a validação existe para pegar, e o único que importa de
   * verdade: extensão e Content-Type são escolhidos por quem envia. Um
   * executável renomeado para `.png` chega declarando `image/png`, passa pelo
   * `allowed_mime_types` do bucket (que compara com o que o cliente disse), e
   * só os BYTES o denunciam.
   */
  it('recusa executável renomeado para .png (assinatura MZ do Windows)', () => {
    expect(detectarFormatoDeAnexo(comAssinatura([0x4d, 0x5a]))).toBeNull()
  })

  it('recusa SVG, que é texto e pode carregar script', () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg">')
    expect(detectarFormatoDeAnexo(svg)).toBeNull()
  })

  it('recusa ZIP, que é o que um .docx e um .xlsx de fato são', () => {
    expect(detectarFormatoDeAnexo(comAssinatura([0x50, 0x4b, 0x03, 0x04]))).toBeNull()
  })

  // Menos de 12 bytes não dá para checar o WEBP, cuja segunda marca está no
  // offset 8. Arquivo assim é lixo, e devolver `null` é o correto.
  it('recusa arquivo curto demais para conter qualquer assinatura', () => {
    expect(detectarFormatoDeAnexo(new Uint8Array([0x89, 0x50]))).toBeNull()
  })
})

describe('validarAnexo', () => {
  it('aceita PNG e PDF dentro do limite', () => {
    expect(validarAnexo(comAssinatura(PNG))).toMatchObject({ formato: 'png', extensao: 'png' })
    expect(validarAnexo(comAssinatura(PDF))).toMatchObject({
      formato: 'pdf',
      tipoMime: 'application/pdf',
    })
  })

  // JPEG vira `.jpg` e não `.jpeg`: o formato tem dois nomes e a extensão de
  // arquivo é uma só. Sem isso o bucket acumularia os dois para o mesmo tipo.
  it('grava JPEG com extensão jpg', () => {
    expect(validarAnexo(comAssinatura(JPEG))).toMatchObject({ extensao: 'jpg' })
  })

  it('recusa arquivo vazio', () => {
    expect(validarAnexo(new Uint8Array(0))).toHaveProperty('erro')
  })

  /**
   * A mensagem diz o tamanho REAL e o limite. "Arquivo muito grande" obriga a
   * pessoa a adivinhar quanto cortar — e a lição de 20/08 (galeria de
   * criativos) é que a recusa precisa dizer o que fazer, senão ela desiste em
   * vez de tentar de novo.
   */
  it('recusa acima de 10 MB dizendo o tamanho e o limite', () => {
    const grande = new Uint8Array(ANEXO_TAMANHO_MAXIMO + 1)
    grande.set(PNG, 0)
    const veredito = validarAnexo(grande)

    expect(veredito).toHaveProperty('erro')
    expect((veredito as { erro: string }).erro).toContain('10 MB')
  })

  it('a recusa por formato lista o que serve', () => {
    const veredito = validarAnexo(comAssinatura([0x4d, 0x5a]))
    expect((veredito as { erro: string }).erro).toMatch(/PNG.*JPG.*WEBP.*PDF/i)
  })
})

describe('caminhoDoAnexo', () => {
  /**
   * O PRIMEIRO segmento é o que a RLS do Storage lê (`workspace_do_caminho`,
   * migration 0031). Mudar este formato quebra a política **em silêncio**: a
   * função devolve `null`, `is_workspace_member(null)` é `false`, e todo
   * upload passa a ser recusado sem erro que explique por quê.
   */
  it('começa pelo workspace, depois o relato', () => {
    const caminho = caminhoDoAnexo('11111111-1111-4111-8111-111111111111', 'rel-1', 'png')

    expect(caminho.startsWith('11111111-1111-4111-8111-111111111111/rel-1/')).toBe(true)
    expect(caminho.endsWith('.png')).toBe(true)
  })

  // Dois anexos podem ter o mesmo nome original: "Captura de tela.png" é o
  // padrão do sistema, e o segundo sobrescreveria o primeiro.
  it('gera nome diferente a cada chamada', () => {
    const a = caminhoDoAnexo('w', 'r', 'png')
    const b = caminhoDoAnexo('w', 'r', 'png')
    expect(a).not.toBe(b)
  })
})

describe('formatarTamanho', () => {
  it.each([
    [512, '512 B'],
    [348_160, '340 KB'],
    [1_258_291, '1.2 MB'],
  ])('%i vira %s', (bytes, esperado) => {
    expect(formatarTamanho(bytes)).toBe(esperado)
  })
})
