import { describe, expect, it } from 'vitest'

import { STATUS_QUE_DECIDEM, ehVeredito } from '@/lib/whatsapp/veredito-do-provedor'

/**
 * Qual resposta do provedor pode DERRUBAR a conexão de um cliente.
 *
 * ## O defeito que isto trava, e ele era meu
 *
 * A primeira versão de `conferirConexoes` dizia "4xx é veredito, 5xx é não
 * sei". A faixa era larga demais: **429 é 4xx e significa tente de novo**, não
 * "esta instância morreu" — e é justamente o status que uma empresa enviando
 * muito recebe.
 *
 * Derrubar por ele faria o pior caminho inteiro: o sino avisa a empresa toda
 * que o WhatsApp caiu, o relógio da purga (0091) começa a contar sete dias
 * até apagar a instância no provedor, e a pessoa refaz o pareamento lendo um
 * QR no celular. Por causa de um limite de taxa que passa em um minuto.
 *
 * O número em risco é o DO CLIENTE, que é o mesmo argumento da escada de
 * aquecimento.
 */
describe('só uma lista curta de status derruba a conexão', () => {
  it.each([400, 401, 403, 404])(
    '%i derruba: o provedor está dizendo que a instância não vale mais',
    (status) => {
      expect(ehVeredito(status)).toBe(true)
    },
  )

  /**
   * O CONTROLE que importa, e o que motivou o teste. Estes três são "tente de
   * novo", e nenhum deles é resposta sobre a instância.
   */
  it.each([
    [408, 'timeout da requisição'],
    [425, 'cedo demais, repita'],
    [429, 'limite de taxa, e é o que uma empresa que envia muito recebe'],
  ])('%i NÃO derruba (%s)', (status) => {
    expect(ehVeredito(status)).toBe(false)
  })

  it.each([500, 502, 503, 504, 0])('%i NÃO derruba: o provedor não respondeu', (status) => {
    expect(ehVeredito(status)).toBe(false)
  })

  /**
   * A lista é FECHADA de propósito. Se alguém trocá-la por uma faixa de novo,
   * este caso reprova — e é ele que impede o defeito de voltar pela porta de
   * trás.
   */
  it('a lista é fechada, e não uma faixa', () => {
    expect(STATUS_QUE_DECIDEM.size).toBe(4)
    for (let s = 405; s < 500; s++) expect(ehVeredito(s)).toBe(false)
  })
})
