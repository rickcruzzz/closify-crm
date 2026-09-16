import { describe, expect, it } from 'vitest'

import {
  ESCADA_DE_ENTREGA,
  proximoStatusDeEntrega,
  statusDaZapi,
  type StatusDaMensagem,
} from './entrega'

describe('statusDaZapi', () => {
  it('traduz os três estados que descrevem a NOSSA mensagem', () => {
    expect(statusDaZapi('SENT')).toBe('enviada')
    expect(statusDaZapi('RECEIVED')).toBe('entregue')
    expect(statusDaZapi('READ')).toBe('lida')
  })

  it('PLAYED conta como lida, porque áudio ouvido é áudio visto', () => {
    // O Brasil manda 4x mais áudio que qualquer outro país. Deixar PLAYED de
    // fora faria a maioria das mensagens do público-alvo parar em "entregue".
    expect(statusDaZapi('PLAYED')).toBe('lida')
  })

  it('READ_BY_ME NÃO vira lida, e esse é o caso que importa', () => {
    // Ele diz que NÓS lemos algo que nos mandaram. Mapear para `lida`
    // afirmaria que o cliente leu quando quem leu foi o vendedor — e essa
    // distinção é o que faz a tela valer alguma coisa.
    expect(statusDaZapi('READ_BY_ME')).toBeNull()
  })

  it('status desconhecido devolve null em vez de um palpite', () => {
    // Palpite viraria valor fora do `check` da 0090, e o Postgres recusaria a
    // linha inteira com 23514 — a classe de defeito que a 0086 existe para
    // evitar.
    expect(statusDaZapi('DELETED')).toBeNull()
    expect(statusDaZapi('')).toBeNull()
    expect(statusDaZapi(null)).toBeNull()
    expect(statusDaZapi(undefined)).toBeNull()
  })
})

describe('proximoStatusDeEntrega', () => {
  it('anda para frente', () => {
    expect(proximoStatusDeEntrega('pendente', 'enviada')).toBe('enviada')
    expect(proximoStatusDeEntrega('enviada', 'entregue')).toBe('entregue')
    expect(proximoStatusDeEntrega('entregue', 'lida')).toBe('lida')
  })

  it('NUNCA regride, e é o caso que motivou o arquivo', () => {
    // Webhook entrega fora de ordem: READ chegando antes de RECEIVED é normal
    // quando a pessoa abre o WhatsApp no instante em que a mensagem cai.
    // Regredir apagaria o dado que decide se o silêncio do cliente é falta de
    // interesse ou falta de aviso.
    expect(proximoStatusDeEntrega('lida', 'entregue')).toBe('lida')
    expect(proximoStatusDeEntrega('lida', 'enviada')).toBe('lida')
    expect(proximoStatusDeEntrega('entregue', 'enviada')).toBe('entregue')
    expect(proximoStatusDeEntrega('enviada', 'pendente')).toBe('enviada')
  })

  it('o mesmo degrau de novo não muda nada, e é o reenvio do provedor', () => {
    for (const d of ESCADA_DE_ENTREGA) {
      expect(proximoStatusDeEntrega(d, d)).toBe(d)
    }
  })

  it('falhou é terminal: nada o desfaz', () => {
    // Mensagem que não saiu não tem `external_id`, então nenhum callback casa
    // com ela. Se casar, a contradição merece ser preservada, não apagada.
    for (const d of ESCADA_DE_ENTREGA) {
      expect(proximoStatusDeEntrega('falhou', d)).toBe('falhou')
    }
  })

  it('falhou manda sempre quando é a notícia nova', () => {
    // É a única informação que vem do NOSSO lado, e ela sabe algo que o
    // provedor não sabe: a chamada nem aconteceu.
    for (const d of ESCADA_DE_ENTREGA) {
      expect(proximoStatusDeEntrega(d, 'falhou')).toBe('falhou')
    }
  })

  it('valor fora da escada devolve o ATUAL, e nenhum -1 entra em comparação', () => {
    // O defeito de 12/09, exato: `indexOf` devolve -1 para quem não está na
    // lista, e -1 é menor que tudo — então qualquer estágio comum ficava
    // "maior" que OPTED_OUT, e a mensagem seguinte desfazia o pedido de saída.
    const inventado = 'entregando' as StatusDaMensagem
    expect(proximoStatusDeEntrega('lida', inventado)).toBe('lida')
    expect(proximoStatusDeEntrega('pendente', inventado)).toBe('pendente')
    // E o inverso: atual desconhecido não pode travar o avanço legítimo.
    expect(proximoStatusDeEntrega(inventado, 'lida')).toBe('lida')
  })

  it('TODO status que statusDaZapi produz está na escada', () => {
    // Sem este caso, um mapeamento novo poderia devolver um valor que
    // `proximoStatusDeEntrega` trataria como fora da escada — e a mensagem
    // ficaria congelada para sempre, em silêncio.
    for (const bruto of ['SENT', 'RECEIVED', 'READ', 'PLAYED']) {
      const s = statusDaZapi(bruto)
      expect(s).not.toBeNull()
      expect(ESCADA_DE_ENTREGA).toContain(s)
    }
  })

  it('a escada inteira é alcançável a partir de pendente, em ordem', () => {
    let atual: StatusDaMensagem = 'pendente'
    for (const d of ESCADA_DE_ENTREGA) {
      atual = proximoStatusDeEntrega(atual, d)
    }
    expect(atual).toBe('lida')
  })
})
