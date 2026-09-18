import { describe, expect, it } from 'vitest'

import {
  DIAS_ATE_RECONFERIR,
  caminhoDaFoto,
  deveBuscarFoto,
  linkDeFotoValido,
  tipoAceito,
} from '@/lib/whatsapp/foto'

const AGORA = new Date('2026-09-18T12:00:00Z')
const diasAtras = (n: number) => new Date(AGORA.getTime() - n * 86_400_000).toISOString()

describe('deveBuscarFoto', () => {
  it('contato novo com telefone: busca', () => {
    expect(deveBuscarFoto({ telefone: '5571999999999', fotoVerificadaEm: null }, AGORA)).toEqual({
      buscar: true,
    })
  })

  /**
   * Contato sem telefone existe: a caixa recebe de LID e de grupo, e a
   * importação de planilha aceita quem só tem e-mail. Pedir a foto de um número
   * que não existe gasta a chamada e devolve nada.
   */
  it('sem telefone nao busca', () => {
    expect(deveBuscarFoto({ telefone: null, fotoVerificadaEm: null }, AGORA)).toMatchObject({
      buscar: false,
      motivo: 'sem_telefone',
    })
  })

  /**
   * A porta que impede o laço infinito, e o caso que ela cobre é o COMUM:
   * quem não tem foto de perfil visível. Sem `fotoVerificadaEm`, esse contato
   * seria perguntado ao provedor a cada passagem do cron, para sempre.
   */
  describe('quem ja foi conferido', () => {
    it('conferido ontem nao busca de novo, mesmo SEM foto guardada', () => {
      expect(
        deveBuscarFoto({ telefone: '5571999999999', fotoVerificadaEm: diasAtras(1) }, AGORA),
      ).toMatchObject({ buscar: false, motivo: 'ja_conferida' })
    })

    it('passou a janela, reconfere', () => {
      expect(
        deveBuscarFoto(
          { telefone: '5571999999999', fotoVerificadaEm: diasAtras(DIAS_ATE_RECONFERIR + 1) },
          AGORA,
        ).buscar,
      ).toBe(true)
    })

    /** O corte é a constante, e não um número solto no meio da função. */
    it('um dia ANTES da janela ainda segura', () => {
      expect(
        deveBuscarFoto(
          { telefone: '5571999999999', fotoVerificadaEm: diasAtras(DIAS_ATE_RECONFERIR - 1) },
          AGORA,
        ).buscar,
      ).toBe(false)
    })
  })

  /**
   * Errar segurando custa uma foto velha. Errar soltando gasta uma chamada ao
   * provedor por contato a cada rodada do cron.
   */
  it('data ilegivel segura, nao solta', () => {
    expect(
      deveBuscarFoto({ telefone: '5571999999999', fotoVerificadaEm: 'nao e data' }, AGORA),
    ).toMatchObject({ buscar: false, motivo: 'ja_conferida' })
  })

  /** A ordem das portas: sem telefone vence, inclusive se nunca foi conferido. */
  it('sem telefone E nunca conferido conta como sem telefone', () => {
    expect(deveBuscarFoto({ telefone: '', fotoVerificadaEm: null }, AGORA)).toMatchObject({
      motivo: 'sem_telefone',
    })
  })
})

describe('caminhoDaFoto', () => {
  /**
   * O primeiro segmento é a empresa, e é a segurança inteira: a policy da 0096
   * resolve o dono por `workspace_do_caminho`, que lê esse segmento como uuid.
   */
  it('a empresa vem PRIMEIRO', () => {
    const w = '11111111-1111-1111-1111-111111111111'
    const l = '22222222-2222-2222-2222-222222222222'
    expect(caminhoDaFoto(w, l)).toBe(`${w}/${l}.jpg`)
    expect(caminhoDaFoto(w, l).split('/')[0]).toBe(w)
  })

  /** Um arquivo por contato, sobrescrito: a pergunta é "qual é a foto de agora". */
  it('o mesmo contato devolve sempre o mesmo caminho', () => {
    const w = '11111111-1111-1111-1111-111111111111'
    const l = '22222222-2222-2222-2222-222222222222'
    expect(caminhoDaFoto(w, l)).toBe(caminhoDaFoto(w, l))
  })
})

describe('tipoAceito', () => {
  it('aceita os tres do bucket', () => {
    expect(tipoAceito('image/jpeg')).toBe(true)
    expect(tipoAceito('image/png')).toBe(true)
    expect(tipoAceito('image/webp')).toBe(true)
  })

  /** O provedor manda charset junto, e o cabeçalho cru não casaria por igualdade. */
  it('ignora o que vem depois do ponto e virgula', () => {
    expect(tipoAceito('image/jpeg; charset=binary')).toBe(true)
  })

  /**
   * O controle que importa: SVG não entra. Ele é executável no navegador, e um
   * arquivo servido do nosso domínio com script dentro é XSS com a nossa
   * origem, que é exatamente o que a CSP existe para impedir.
   */
  it('recusa SVG, HTML e ausencia', () => {
    expect(tipoAceito('image/svg+xml')).toBe(false)
    expect(tipoAceito('text/html')).toBe(false)
    expect(tipoAceito(null)).toBe(false)
    expect(tipoAceito('')).toBe(false)
  })
})

/**
 * Achado exercitando a API REAL em 18/09, com um numero que tem foto e outro
 * que nao tem. A Z-API devolve a STRING "null", nao JSON null.
 *
 * Sem esta porta: `"null"` e truthy, `fetch("null")` lanca, o `catch` do
 * chamador nao grava `foto_verificada_em` de proposito (falha de rede pede
 * nova tentativa), e TODO contato sem foto volta a fila a cada passagem do
 * cron, para sempre. E o laco infinito que a coluna existe para fechar.
 */
describe('linkDeFotoValido', () => {
  it('a STRING "null" e recusada', () => {
    expect(linkDeFotoValido('null')).toBe(false)
  })

  it('a URL real do provedor passa', () => {
    expect(linkDeFotoValido('https://pps.whatsapp.net/v/t61.24694-24/abc.jpg?oe=6ABA8F21')).toBe(
      true,
    )
  })

  /**
   * O controle que separa "consertei o caso de hoje" de "fechei a classe": a
   * pergunta nao e "veio a palavra null", e sim "isto e algo que da para
   * baixar".
   */
  it('recusa qualquer lixo que nao seja http', () => {
    for (const lixo of ['', ' ', 'undefined', 'NULL', 'sem foto', '/caminho/relativo', 'data:image/png;base64,AAA']) {
      expect(linkDeFotoValido(lixo)).toBe(false)
    }
  })

  it('recusa o que nem e texto', () => {
    expect(linkDeFotoValido(null)).toBe(false)
    expect(linkDeFotoValido(undefined)).toBe(false)
    expect(linkDeFotoValido(42)).toBe(false)
    expect(linkDeFotoValido({ link: 'https://x' })).toBe(false)
  })

  it('espaco em volta nao atrapalha', () => {
    expect(linkDeFotoValido('  https://pps.whatsapp.net/a.jpg  ')).toBe(true)
  })
})
