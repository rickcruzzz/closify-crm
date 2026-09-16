import { describe, expect, it } from 'vitest'

import {
  instanciaDoPayload,
  normalizarDesconexaoZapi,
  normalizarStatusZapi,
  normalizarZapi,
} from './payload'

/**
 * Os payloads abaixo são os da documentação oficial da Z-API, lidos em 16/09,
 * campo por campo. Não são inventados.
 *
 * Isso importa porque o defeito de 25/08 nasceu do contrário: a rota do
 * Evolution foi escrita a partir do Swagger, que descreve outra forma, e a rota
 * respondia `200 {"ok":true}` sem gravar nada. O sintoma foi SILÊNCIO, que é o
 * mais caro de perceber.
 */
const TEXTO = {
  isGroup: false,
  instanceId: 'A20DA9C0183A2D35A260F53F5D2B9244',
  messageId: '3EB0C767D097E9ECFE97',
  phone: '5544999999999',
  fromMe: false,
  momment: 1632228638000,
  status: 'RECEIVED',
  chatName: 'Marcenaria Silva',
  senderName: 'Jose',
  type: 'ReceivedCallback',
  text: { message: 'quanto custa?', description: null, title: null, url: null },
}

const AUDIO = {
  ...TEXTO,
  text: undefined,
  audio: {
    ptt: true,
    seconds: 10,
    audioUrl: 'https://storage.z-api.io/a.ogg',
    mimeType: 'audio/ogg; codecs=opus',
  },
}

const IMAGEM = {
  ...TEXTO,
  text: undefined,
  image: {
    mimeType: 'image/jpeg',
    imageUrl: 'https://storage.z-api.io/i.jpg',
    caption: 'segue a foto do movel',
    width: 600,
    height: 315,
  },
}

describe('normalizarZapi', () => {
  it('lê o payload de texto da documentação', () => {
    const m = normalizarZapi(TEXTO)
    expect(m).not.toBeNull()
    expect(m!.id).toBe('3EB0C767D097E9ECFE97')
    expect(m!.telefone).toBe('5544999999999')
    expect(m!.nome).toBe('Jose')
    expect(m!.texto).toBe('quanto custa?')
    expect(m!.tipo).toBe('texto')
    expect(m!.deNos).toBe(false)
  })

  it('áudio nunca fica com prévia vazia, e guarda a URL sem baixar', () => {
    // Prévia em branco na lista de conversas lê-se como mensagem perdida.
    const m = normalizarZapi(AUDIO)!
    expect(m.tipo).toBe('audio')
    expect(m.texto).toBe('Áudio de 10s')
    expect(m.midiaChave).toBe('https://storage.z-api.io/a.ogg')
    expect(m.midiaSegundos).toBe(10)
  })

  it('imagem usa a LEGENDA como texto, e não a palavra "Imagem"', () => {
    const m = normalizarZapi(IMAGEM)!
    expect(m.tipo).toBe('imagem')
    expect(m.texto).toBe('segue a foto do movel')
    expect(m.midiaChave).toBe('https://storage.z-api.io/i.jpg')
  })

  it('tipo sem suporte vira linha visível, e não desaparece', () => {
    // Contato, localização, enquete. A linha existir é o que impede a pessoa de
    // achar que a mensagem se perdeu.
    const m = normalizarZapi({ ...TEXTO, text: undefined, contact: { displayName: 'x' } })!
    expect(m.tipo).toBe('outro')
    expect(m.texto.length).toBeGreaterThan(0)
  })

  it('grupo não vira contato: o telefone é o id do grupo, não o de ninguém', () => {
    const m = normalizarZapi({ ...TEXTO, isGroup: true })!
    expect(m.ehGrupo).toBe(true)
    expect(m.telefone).toBeNull()
  })

  it('fromMe é PRESERVADO, e não descartado aqui', () => {
    // A prospecção descarta, e está certa lá. No produto, "notify sent by me" é
    // o que faz a mensagem enviada pelo celular do dono aparecer no CRM — sem
    // ela a caixa mostraria metade da conversa. Quem decide é a rota.
    const m = normalizarZapi({ ...TEXTO, fromMe: true })!
    expect(m.deNos).toBe(true)
    expect(m.telefone).toBe('5544999999999')
  })

  it('LID não vira telefone', () => {
    // `179431486288122@lid` tem 15 dígitos e NÃO é um número que recebe
    // mensagem. Gravá-lo poria no banco um dado errado com aparência de bom.
    expect(normalizarZapi({ ...TEXTO, phone: '81896604192873@lid' })!.telefone).toBeNull()
  })

  it('outro tipo de callback NÃO vira mensagem', () => {
    // Sem a checagem de `type`, um MessageStatusCallback viraria uma mensagem
    // de texto vazia dentro da conversa do cliente.
    expect(normalizarZapi({ type: 'MessageStatusCallback', status: 'READ' })).toBeNull()
    expect(normalizarZapi({ type: 'DisconnectedCallback' })).toBeNull()
  })

  it('corpo inválido devolve null e NUNCA lança', () => {
    // Webhook que lança vira 500, e 500 faz o provedor reentregar para sempre
    // um evento que nunca vai dar certo. É a lição da fila do Asaas.
    for (const lixo of [null, undefined, '', 'texto', 42, [], {}]) {
      expect(() => normalizarZapi(lixo)).not.toThrow()
      expect(normalizarZapi(lixo)).toBeNull()
    }
  })

  it('mensagem sem messageId devolve id nulo, e a rota descarta', () => {
    expect(normalizarZapi({ ...TEXTO, messageId: undefined })!.id).toBeNull()
  })
})

describe('instanciaDoPayload', () => {
  it('lê o instanceId declarado, para CONFERIR contra o que o segredo achou', () => {
    // Ele nunca resolve a empresa. Quem resolve é o segredo na URL. Este campo
    // serve só para detectar divergência e ignorar o evento.
    expect(instanciaDoPayload(TEXTO)).toBe('A20DA9C0183A2D35A260F53F5D2B9244')
    expect(instanciaDoPayload({})).toBeNull()
    expect(instanciaDoPayload(null)).toBeNull()
  })
})

describe('normalizarStatusZapi', () => {
  it('lê o callback de status com o lote de ids', () => {
    // `ids` é array porque o WhatsApp confirma em lote: abrir uma conversa com
    // dez mensagens não lidas gera UM callback com dez ids.
    const r = normalizarStatusZapi({
      instanceId: 'x',
      status: 'READ',
      ids: ['A', 'B'],
      type: 'MessageStatusCallback',
    })
    expect(r).toEqual({ status: 'READ', ids: ['A', 'B'] })
  })

  it('sem ids não há o que atualizar', () => {
    expect(
      normalizarStatusZapi({ status: 'READ', ids: [], type: 'MessageStatusCallback' }),
    ).toBeNull()
    expect(
      normalizarStatusZapi({ status: 'READ', type: 'MessageStatusCallback' }),
    ).toBeNull()
  })

  it('descarta id que não é string, sem derrubar o lote inteiro', () => {
    const r = normalizarStatusZapi({
      status: 'SENT',
      ids: ['A', null, 7, '', 'B'],
      type: 'MessageStatusCallback',
    })
    expect(r).toEqual({ status: 'SENT', ids: ['A', 'B'] })
  })

  it('outro tipo de callback não passa', () => {
    expect(normalizarStatusZapi(TEXTO)).toBeNull()
  })
})

describe('normalizarDesconexaoZapi', () => {
  it('lê o motivo CRU do provedor, para a tela poder dizer', () => {
    // Não é traduzido: inventar uma frase amigável a partir de um texto que não
    // controlamos esconderia o motivo real de quem precisa dele.
    expect(
      normalizarDesconexaoZapi({
        momment: 1580163342,
        error: 'Device has been disconnected',
        disconnected: true,
        type: 'DisconnectedCallback',
        instanceId: 'x',
      }),
    ).toEqual({ erro: 'Device has been disconnected' })
  })

  it('sem motivo continua sendo desconexão', () => {
    expect(normalizarDesconexaoZapi({ type: 'DisconnectedCallback' })).toEqual({
      erro: null,
    })
  })

  it('outro tipo de callback não passa', () => {
    expect(normalizarDesconexaoZapi(TEXTO)).toBeNull()
  })
})
