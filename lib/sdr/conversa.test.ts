import { describe, expect, it } from 'vitest'

import {
  humanoAssumiu,
  mensagensPendentes,
  montarHistorico,
  saiuPelaApi,
  temMensagemDoCliente,
  textoDa,
  ultimaDoCliente,
  type MensagemCrua,
} from './conversa'

/** Mensagem do agente: id do Baileys (`3EB0…`) e `source: web`. */
function doAgente(texto: string, em: number, id = '3EB0' + em): MensagemCrua {
  return {
    key: { id, fromMe: true, remoteJid: '5571@s.whatsapp.net' },
    message: { conversation: texto },
    messageTimestamp: em,
    source: 'web',
  }
}

/** Mensagem do dono pelo celular: id do app oficial (`3A…`) e `source: android`. */
function doAtendente(texto: string, em: number): MensagemCrua {
  return {
    key: { id: '3A' + em, fromMe: true, remoteJid: '5571@s.whatsapp.net' },
    message: { conversation: texto },
    messageTimestamp: em,
    source: 'android',
  }
}

function doCliente(texto: string, em: number, id = '3A9' + em): MensagemCrua {
  return {
    key: { id, fromMe: false, remoteJid: '5571@s.whatsapp.net' },
    message: { conversation: texto },
    messageTimestamp: em,
    source: 'android',
  }
}

describe('saiuPelaApi', () => {
  it('reconhece a mensagem que o agente enviou', () => {
    expect(saiuPelaApi(doAgente('oi', 100))).toBe(true)
  })

  it('reconhece a mensagem que o dono mandou do celular', () => {
    expect(saiuPelaApi(doAtendente('deixa comigo', 200))).toBe(false)
  })

  /**
   * O furo que faz `source` sozinho não servir: responder pelo WhatsApp Web
   * também produz `web`. Só o prefixo do id separa o atendente do agente — e
   * é exatamente o caso que a pausa existe para pegar.
   */
  it('não confunde o atendente no WhatsApp Web com o agente', () => {
    const pelaWeb: MensagemCrua = {
      key: { id: '3A55667788', fromMe: true },
      message: { conversation: 'oi, sou eu' },
      messageTimestamp: 300,
      source: 'web',
    }
    expect(saiuPelaApi(pelaWeb)).toBe(false)
  })

  it('sem id, trata como humano (o lado seguro)', () => {
    expect(saiuPelaApi({ key: { fromMe: true }, messageTimestamp: 1 })).toBe(false)
  })
})

describe('humanoAssumiu', () => {
  it('é falso quando só o agente respondeu', () => {
    expect(humanoAssumiu([doCliente('oi', 1), doAgente('olá!', 2)])).toBe(false)
  })

  it('é verdadeiro depois que o dono respondeu pelo celular', () => {
    expect(
      humanoAssumiu([doCliente('oi', 1), doAgente('olá!', 2), doAtendente('eu assumo', 3)]),
    ).toBe(true)
  })

  it('continua verdadeiro mesmo se o cliente escrever de novo depois', () => {
    expect(
      humanoAssumiu([doAtendente('eu assumo', 3), doCliente('beleza', 4)]),
    ).toBe(true)
  })

  it('conversa vazia não é atendimento humano', () => {
    expect(humanoAssumiu([])).toBe(false)
  })
})

describe('montarHistorico', () => {
  it('ordena do mais antigo ao mais novo e rotula quem falou', () => {
    expect(
      montarHistorico([doAgente('olá!', 2), doCliente('oi', 1)]),
    ).toEqual([
      { de: 'cliente', texto: 'oi' },
      { de: 'agente', texto: 'olá!' },
    ])
  })

  /**
   * Corta pelo FIM. Guardar o começo e jogar fora o que acabou de ser
   * combinado é o oposto do útil numa conversa de venda.
   */
  it('guarda os mais recentes quando passa do limite', () => {
    const muitas = Array.from({ length: 30 }, (_, i) => doCliente(`msg ${i}`, i))
    const h = montarHistorico(muitas, 5)
    expect(h).toHaveLength(5)
    expect(h.at(0)?.texto).toBe('msg 25')
    expect(h.at(-1)?.texto).toBe('msg 29')
  })

  it('descarta mídia sem texto em vez de criar turno vazio', () => {
    const audio: MensagemCrua = {
      key: { id: '3A1', fromMe: false },
      messageType: 'audioMessage',
      messageTimestamp: 5,
    }
    expect(montarHistorico([doCliente('oi', 1), audio])).toEqual([
      { de: 'cliente', texto: 'oi' },
    ])
  })

  it('lê texto de mensagem citada (extendedTextMessage)', () => {
    const citada: MensagemCrua = {
      key: { id: '3A2', fromMe: false },
      message: { extendedTextMessage: { text: 'e o prazo?' } },
      messageTimestamp: 9,
    }
    expect(textoDa(citada)).toBe('e o prazo?')
  })
})

describe('ultimaDoCliente', () => {
  it('devolve a mais recente do cliente, ignorando as nossas', () => {
    expect(
      ultimaDoCliente([doCliente('oi', 1), doAgente('olá', 2), doCliente('quanto custa?', 3, 'X9')]),
    ).toEqual({ id: 'X9', em: 3 })
  })

  it('devolve null quando só existem mensagens nossas', () => {
    expect(ultimaDoCliente([doAgente('olá', 1)])).toBeNull()
  })
})

describe('mensagensPendentes', () => {
  /**
   * O caso que o buffer existe para resolver: a PME escreve quebrado, e sem
   * juntar o agente responde três vezes — a primeira sem saber que existiam
   * as outras duas.
   */
  it('junta tudo que chegou depois da última resposta nossa', () => {
    expect(
      mensagensPendentes([
        doCliente('oi', 1),
        doAgente('olá! como posso ajudar?', 2),
        doCliente('quanto custa?', 3),
        doCliente('pra 3 pessoas', 4),
      ]),
    ).toBe('quanto custa?\n\npra 3 pessoas')
  })

  it('sem resposta nossa ainda, junta a conversa inteira', () => {
    expect(mensagensPendentes([doCliente('oi', 1), doCliente('tudo bem?', 2)])).toBe(
      'oi\n\ntudo bem?',
    )
  })

  it('devolve vazio quando a última palavra foi nossa', () => {
    expect(mensagensPendentes([doCliente('oi', 1), doAgente('olá', 2)])).toBe('')
  })
})

describe('temMensagemDoCliente', () => {
  /**
   * Medido em produção em 11/09: a Evolution desta instalação não persiste
   * mensagem RECEBIDA. `findMessages` devolveu 1 registro para uma conversa com
   * três áudios, e o único registro era a resposta do agente.
   *
   * Isso matava o fluxo em dois lugares ao mesmo tempo — a rota calava "nada
   * novo" e o n8n ia para `Ignora`. Três execuções `success`, zero respostas.
   */
  it('é falso quando só há mensagem nossa — o caso real', () => {
    expect(temMensagemDoCliente([doAgente('olá!', 1)])).toBe(false)
  })

  it('é verdadeiro quando o cliente aparece', () => {
    expect(temMensagemDoCliente([doAgente('olá!', 1), doCliente('oi', 2)])).toBe(true)
  })

  it('conversa vazia não tem histórico útil', () => {
    expect(temMensagemDoCliente([])).toBe(false)
  })
})
