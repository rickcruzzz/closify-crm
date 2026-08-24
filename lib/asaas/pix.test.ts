import { describe, expect, it } from 'vitest'

import { avisoDeValidade, prepararPixParaExibir } from './pix'

/** Formato real da resposta, copiado de uma chamada à API em 23/08. */
const RESPOSTA_REAL = {
  success: true,
  encodedImage: 'iVBORw0KGgoAAAANSUhEUg==',
  payload: '00020101021226800014br.gov.bcb.pix2558pix.asaas.com/qr/cobv/abc',
  expirationDate: '2027-09-19 23:59:59',
}

describe('preparar o Pix para a tela', () => {
  it('monta a data URL que a <img> entende', () => {
    const pix = prepararPixParaExibir(RESPOSTA_REAL)
    expect(pix?.imagemDataUrl).toBe(`data:image/png;base64,${RESPOSTA_REAL.encodedImage}`)
    expect(pix?.copiaECola).toBe(RESPOSTA_REAL.payload)
  })

  /**
   * O Asaas devolve o Base64 CRU. Esquecer o prefixo faz a `<img>` não
   * renderizar nada, sem erro de console e sem exceção — o QR simplesmente não
   * aparece, e a pessoa que ia pagar olha para um espaço vazio.
   */
  it('o prefixo data: é obrigatório, não decorativo', () => {
    const pix = prepararPixParaExibir(RESPOSTA_REAL)
    expect(pix?.imagemDataUrl.startsWith('data:image/png;base64,')).toBe(true)
  })

  // Falha de exibição não pode derrubar a página de quem está tentando pagar:
  // quem chama mostra o caminho alternativo do Asaas.
  it('resposta incompleta devolve null em vez de estourar', () => {
    expect(prepararPixParaExibir(null)).toBeNull()
    expect(prepararPixParaExibir({ success: false })).toBeNull()
    expect(prepararPixParaExibir({ encodedImage: 'abc' })).toBeNull()
    expect(prepararPixParaExibir({ payload: '000201' })).toBeNull()
  })
})

describe('aviso de validade', () => {
  // 12:00 UTC = 09:00 em Brasília. Os horários dos casos abaixo estão no fuso
  // de Brasília, que é como o Asaas responde.
  const agora = new Date('2026-08-23T12:00:00.000Z')

  /**
   * Medido na API: cobrança com vencimento futuro devolve validade de mais de
   * um ano. "Expira em 391 dias" não muda o comportamento de ninguém e só
   * ocupa espaço numa tela que precisa de foco.
   */
  it('não avisa quando o prazo é longo', () => {
    expect(avisoDeValidade('2027-09-19 23:59:59', agora)).toBeNull()
  })

  it('avisa quando falta menos de um dia', () => {
    // 20:00 em Brasília = 23:00 UTC. De 12:00 UTC, faltam 11 horas.
    expect(avisoDeValidade('2026-08-23 20:00:00', agora)).toBe('Este código expira em 11 horas.')
  })

  it('trata a última hora à parte', () => {
    // 09:30 em Brasília = 12:30 UTC. De 12:00 UTC, falta meia hora.
    expect(avisoDeValidade('2026-08-23 09:30:00', agora)).toBe(
      'Este código expira em menos de 1 hora.',
    )
  })

  it('diz claramente quando já expirou', () => {
    expect(avisoDeValidade('2026-08-22 10:00:00', agora)).toBe(
      'Este código expirou. Gere um novo para pagar.',
    )
  })

  /**
   * O caso que este arquivo existe para travar: sem o `-03:00` explícito, a
   * mesma string dá resultados DIFERENTES conforme o fuso de quem executa. Em
   * UTC (Vercel) daria 6 horas; em Brasília (máquina do dev), 9. O bug só
   * apareceria em produção.
   */
  it('a resposta não depende do fuso de quem executa', () => {
    // 18:00 em Brasília = 21:00 UTC. De 12:00 UTC, faltam 9 horas — sempre.
    expect(avisoDeValidade('2026-08-23 18:00:00', agora)).toBe('Este código expira em 9 horas.')
  })

  /**
   * O Asaas manda `YYYY-MM-DD HH:mm:ss`, que NÃO é ISO 8601. Sem trocar o
   * espaço por `T`, o Safari devolve `Invalid Date` — e a tela quebraria só
   * nele, num defeito que não aparece em desenvolvimento e só surge na mão do
   * cliente.
   */
  it('entende o formato do Asaas, que não é ISO', () => {
    expect(avisoDeValidade('2026-08-23 15:00:00', agora)).toBe('Este código expira em 6 horas.')
    expect(avisoDeValidade('data quebrada', agora)).toBeNull()
    expect(avisoDeValidade(null, agora)).toBeNull()
  })
})
