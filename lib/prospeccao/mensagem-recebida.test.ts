import { describe, expect, it } from 'vitest'

import { deveRegistrar, normalizarMensagem } from '@/lib/prospeccao/mensagem-recebida'

/**
 * O formato que a instalação de HOJE usa: Evolution 2.3.7 sobre Baileys.
 *
 * Não é suposição sobre a documentação. `lib/sdr/conversa.ts` lê exatamente
 * esta forma do `/chat/findMessages` da mesma instância — `key.remoteJid`,
 * `key.fromMe`, `key.id`, `source` — e o prefixo `3EB0` do id é o que aquele
 * módulo usa para distinguir mensagem da API de mensagem do aparelho.
 */
const BAILEYS = {
  key: {
    remoteJid: '557193309404@s.whatsapp.net',
    fromMe: false,
    id: '3EB0C767D26B8F1A2B3C',
  },
  pushName: 'Marcenaria Silva',
  message: { conversation: 'Quanto custa?' },
  messageType: 'conversation',
  messageTimestamp: 1789199551,
  source: 'android',
}

/**
 * O formato que custou a investigação de 25/08: Evolution GO sobre whatsmeow.
 *
 * A rota daquela época foi escrita a partir do Swagger, que descreve os campos
 * em minúscula e no nível raiz. O webhook manda `Info`/`Message`, capitalizados
 * e aninhados. `mensagem.id` vinha `undefined`, o laço fazia `continue`, e a
 * rota respondia `200 {"ok":true}` sem gravar nada — com o servidor logando
 * *"webhook sent successfully, status: 200"*.
 *
 * Fica aqui para que uma leitura de código nunca mais baste para dar isso por
 * certo, e porque trocar a VPS traz o formato de volta.
 */
const WHATSMEOW = {
  Info: {
    ID: '2AECBEEDF3E39E800EDE',
    Chat: '557193309404@s.whatsapp.net',
    Sender: '557193309404@s.whatsapp.net',
    SenderAlt: '179431486288122@lid',
    IsFromMe: false,
    IsGroup: false,
    PushName: 'Marcenaria Silva',
  },
  Message: { conversation: 'Olá tudo bem', messageContextInfo: {} },
}

describe('Evolution 2.x / Baileys — o formato em uso', () => {
  it('lê a mensagem inteira', () => {
    const m = normalizarMensagem(BAILEYS)
    expect(m).not.toBeNull()
    expect(m!.id).toBe('3EB0C767D26B8F1A2B3C')
    expect(m!.telefone).toBe('557193309404')
    expect(m!.nome).toBe('Marcenaria Silva')
    expect(m!.texto).toBe('Quanto custa?')
    expect(m!.deNos).toBe(false)
    expect(m!.ehGrupo).toBe(false)
    expect(m!.tipo).toBe('texto')
  })

  it('lê texto com citação (extendedTextMessage)', () => {
    const m = normalizarMensagem({
      ...BAILEYS,
      message: { extendedTextMessage: { text: 'não tenho interesse' } },
    })
    expect(m!.texto).toBe('não tenho interesse')
  })

  it('mensagem NOSSA voltando como evento é marcada', () => {
    // A própria abordagem volta pelo webhook. Tratá-la como resposta marcaria
    // o prospect como "respondeu" no segundo em que a mensagem saiu.
    const m = normalizarMensagem({ ...BAILEYS, key: { ...BAILEYS.key, fromMe: true } })
    expect(m!.deNos).toBe(true)
    expect(deveRegistrar(m)).toBe(false)
  })

  it('grupo não vira contato', () => {
    const m = normalizarMensagem({
      ...BAILEYS,
      key: { ...BAILEYS.key, remoteJid: '557191035159-1593002939@g.us' },
    })
    expect(m!.ehGrupo).toBe(true)
    expect(m!.telefone).toBeNull()
    expect(deveRegistrar(m)).toBe(false)
  })

  /**
   * O LID é o identificador de privacidade do WhatsApp, não o telefone. Lê-lo
   * criaria um contato com um número que não existe — pior que descartar,
   * porque o erro fica no banco parecendo dado bom.
   */
  it.each([
    '179431486288122@lid',
    '120363178382810106@newsletter',
    'status@broadcast',
  ])('não trata "%s" como telefone', (jid) => {
    const m = normalizarMensagem({ ...BAILEYS, key: { ...BAILEYS.key, remoteJid: jid } })
    expect(m!.telefone).toBeNull()
    expect(deveRegistrar(m)).toBe(false)
  })

  /**
   * O Brasil manda 4x mais áudio que qualquer outro país, e os nichos
   * prospectados — marcenaria, vidraçaria, dedetizadora — mandam áudio porque
   * é como se escreve na obra. Tratar áudio como texto vazio apagaria a
   * resposta mais comum do público-alvo.
   */
  it('áudio vira tipo e descrição, com a mídia referenciada e NÃO baixada', () => {
    const m = normalizarMensagem({
      ...BAILEYS,
      message: {
        audioMessage: {
          mediaKey: 'abc123',
          mimetype: 'audio/ogg; codecs=opus',
          seconds: 14,
        },
      },
    })
    expect(m!.tipo).toBe('audio')
    expect(m!.texto).toBe('(enviou um áudio)')
    expect(m!.midiaChave).toBe('abc123')
    expect(m!.midiaMime).toBe('audio/ogg; codecs=opus')
    expect(m!.midiaSegundos).toBe(14)
    expect(deveRegistrar(m)).toBe(true)
  })

  it('legenda de imagem é o texto — quase sempre é a pergunta de verdade', () => {
    const m = normalizarMensagem({
      ...BAILEYS,
      message: { imageMessage: { caption: 'é isso aqui?', mediaKey: 'k', mimetype: 'image/jpeg' } },
    })
    expect(m!.tipo).toBe('imagem')
    expect(m!.texto).toBe('é isso aqui?')
  })

  it('imagem sem legenda ainda é registrada', () => {
    const m = normalizarMensagem({ ...BAILEYS, message: { imageMessage: { mediaKey: 'k' } } })
    expect(m!.texto).toBe('(enviou uma imagem)')
    expect(deveRegistrar(m)).toBe(true)
  })
})

describe('Evolution GO / whatsmeow — o formato de 25/08', () => {
  it('continua sendo lido', () => {
    const m = normalizarMensagem(WHATSMEOW)
    expect(m!.id).toBe('2AECBEEDF3E39E800EDE')
    expect(m!.telefone).toBe('557193309404')
    expect(m!.texto).toBe('Olá tudo bem')
  })

  /**
   * `Chat` e nunca `SenderAlt`. A Evolution já faz o swap do LID antes de
   * mandar, então `Chat` traz o número real — e `SenderAlt` traz o LID.
   */
  it('usa Chat, nunca SenderAlt', () => {
    const m = normalizarMensagem(WHATSMEOW)
    expect(m!.telefone).toBe('557193309404')
    expect(m!.telefone).not.toContain('1794')
  })

  it('grupo não vira contato', () => {
    const m = normalizarMensagem({
      Info: { ...WHATSMEOW.Info, Chat: '557191035159-1593002939@g.us', IsGroup: true },
      Message: { conversation: 'oi pessoal' },
    })
    expect(m!.ehGrupo).toBe(true)
    expect(m!.telefone).toBeNull()
  })
})

describe('o que NÃO é mensagem', () => {
  /**
   * A Evolution manda vários tipos de evento pelo mesmo caminho. Nenhum deles
   * é erro: responder 500 a um evento de presença faria a fila dela penalizar
   * o endereço e INTERROMPER — que é exatamente o que o webhook do Asaas já
   * fez quatro vezes em nove dias, e fila parada é indistinguível de "ninguém
   * respondeu".
   */
  it.each([
    { entrada: null, rotulo: 'nulo' },
    { entrada: undefined, rotulo: 'ausente' },
    { entrada: 'texto solto', rotulo: 'string' },
    { entrada: [1, 2, 3], rotulo: 'array' },
    { entrada: { status: 'available' }, rotulo: 'evento de presença' },
  ])('devolve null para $rotulo', ({ entrada }) => {
    expect(normalizarMensagem(entrada)).toBeNull()
  })

  it('sem id não é registrável: não haveria dedupe', () => {
    const m = normalizarMensagem({ ...BAILEYS, key: { ...BAILEYS.key, id: undefined } })
    expect(m!.id).toBeNull()
    expect(deveRegistrar(m)).toBe(false)
  })

  it('deveRegistrar recusa null sem explodir', () => {
    expect(deveRegistrar(null)).toBe(false)
  })
})
