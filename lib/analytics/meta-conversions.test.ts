import { describe, expect, it } from 'vitest'

import { montarCorpoDoEvento, normalizarTelefone } from './meta-conversions'

describe('normalizarTelefone', () => {
  // A Meta documenta que aceita variação de formatação no envio, mas duas
  // grafias do mesmo número precisam virar o MESMO hash para casar com o que
  // o Pixel do navegador (ou outro evento) já mandou — daí remover toda
  // pontuação antes de hashear.
  it('remove parênteses, espaço e traço', () => {
    expect(normalizarTelefone('(11) 99999-9999')).toBe('11999999999')
  })

  it('mantém string já só com dígitos intacta', () => {
    expect(normalizarTelefone('11999999999')).toBe('11999999999')
  })

  it('remove o + do DDI', () => {
    expect(normalizarTelefone('+55 11 99999-9999')).toBe('5511999999999')
  })
})

const base = { email: 'pessoa@exemplo.com.br', eventId: 'lead:abc' }
const evento = (corpo: ReturnType<typeof montarCorpoDoEvento>) => corpo.data[0]!

describe('montarCorpoDoEvento', () => {
  /**
   * `test_event_code` roteia o evento para o painel "Testar eventos".
   *
   * Ressalva medida em 30/08, e ela vale mais que o campo: o código precisa
   * ser o REAL, copiado do Gerenciador de Eventos. Com um inventado
   * (`TEST00000`) a Meta responde `events_received: 1` e **grava no dataset
   * de produção do mesmo jeito** — sem erro e sem aviso. Foi assim que quatro
   * eventos de teste entraram no dataset durante a própria prova desta
   * implementação.
   *
   * O segundo caso é o que importa em produção, onde a variável nunca é
   * definida: um `test_event_code` vazando para lá mandaria TODO evento real
   * para o painel de teste, e as conversões sumiriam da campanha sem nenhum
   * erro aparecer.
   */
  it('inclui test_event_code quando ele existe', () => {
    const corpo = montarCorpoDoEvento('Lead', base, 'TEST12345')
    expect(corpo).toHaveProperty('test_event_code', 'TEST12345')
  })

  it('NÃO inclui o campo quando não há código', () => {
    expect(montarCorpoDoEvento('Lead', base)).not.toHaveProperty('test_event_code')
  })

  /**
   * `event_id` é o que a Meta usa para deduplicar. Estes eventos usam id
   * derivado do recurso (`checkout:<assinatura>`, `pagamento:<cobrança>`) e
   * não `crypto.randomUUID()`, porque o diálogo de pagamento pode ser fechado
   * e reaberto: com UUID novo, cada reabertura contaria como uma intenção de
   * compra a mais, e a campanha otimizaria em cima de um número inflado.
   */
  it('repassa o event_id sem tocar, para a Meta poder deduplicar', () => {
    const primeiro = evento(montarCorpoDoEvento('InitiateCheckout', { ...base, eventId: 'checkout:sub_1' }))
    const segundo = evento(montarCorpoDoEvento('InitiateCheckout', { ...base, eventId: 'checkout:sub_1' }))

    expect(primeiro.event_id).toBe('checkout:sub_1')
    expect(segundo.event_id).toBe(primeiro.event_id)
  })

  it('hasheia o e-mail e nunca o manda cru', () => {
    const corpo = JSON.stringify(montarCorpoDoEvento('Lead', base))

    expect(corpo).not.toContain('pessoa@exemplo.com.br')
    // SHA-256 em hexadecimal minúsculo, como a API exige.
    expect(evento(montarCorpoDoEvento('Lead', base)).user_data.em[0]).toMatch(/^[a-f0-9]{64}$/)
  })

  /**
   * A Meta casa o evento com quem clicou pelo `fbc`/`fbp`, e esses dois vão
   * CRUS — hasheá-los junto com o resto os tornaria inúteis. Um teste aqui
   * porque o campo mora no meio de sete outros que SÃO hasheados.
   */
  it('manda fbc e fbp sem hash', () => {
    const dados = evento(
      montarCorpoDoEvento('Lead', { ...base, fbc: 'fb.1.123.CLIQUE', fbp: 'fb.1.123.456' }),
    ).user_data

    expect(dados.fbc).toBe('fb.1.123.CLIQUE')
    expect(dados.fbp).toBe('fb.1.123.456')
  })

  /**
   * Campo ausente não pode virar `null` no payload: a Meta trata chave
   * presente com valor vazio como identificador que não casou, e isso DERRUBA
   * o Event Match Quality — a métrica que decide o quanto o algoritmo
   * reconhece a conversão. Medido em 30/08: 6.2 de 10, com as quatro chaves
   * presentes em 100%.
   */
  it('omite o que não existe em vez de mandar vazio', () => {
    const dados = evento(montarCorpoDoEvento('Lead', base)).user_data

    expect(dados).not.toHaveProperty('ph')
    expect(dados).not.toHaveProperty('fbc')
    expect(dados).not.toHaveProperty('external_id')
  })

  /**
   * `system_generated` é para conversão que nasce sem navegador — o Purchase,
   * que chega por webhook do Asaas horas depois do Pix. Os três eventos novos
   * acontecem com a pessoa NO SITE, e mandar o valor errado custa caro de um
   * jeito invisível: medido em 22/08, com `system_generated` o relatório de
   * qualidade do canal web voltava VAZIO e os eventos não eram contados como
   * conversão de site, apesar de chegarem.
   */
  it('respeita o action_source pedido, e cai em system_generated sem ele', () => {
    expect(evento(montarCorpoDoEvento('Lead', { ...base, actionSource: 'website' })).action_source).toBe(
      'website',
    )
    expect(evento(montarCorpoDoEvento('Purchase', base)).action_source).toBe('system_generated')
  })
})
