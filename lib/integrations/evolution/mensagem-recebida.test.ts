import { describe, expect, it } from 'vitest'

import { normalizarMensagem } from './mensagem-recebida'

/**
 * O caso real, capturado em 25/08 com um ouvinte dentro da VPS.
 *
 * A rota lia `data.id` / `data.chat` / `data.isFromMe` porque é isso que o
 * Swagger do servidor descreve. O webhook manda outra coisa: a estrutura
 * nativa do `whatsmeow`, com `Info` e `Message` capitalizados.
 *
 * O resultado era o pior tipo de falha — `if (!eventId) continue` na primeira
 * linha do laço, resposta `200 {"ok":true}`, e a mensagem do cliente sumindo
 * sem erro em lugar nenhum. Do lado do servidor o log dizia
 * `webhook sent successfully, status: 200`.
 *
 * Estes testes existem para que uma leitura de código nunca mais seja
 * suficiente para dar isso por certo.
 */
const REAL = {
  Info: {
    ID: '2AECBEEDF3E39E800EDE',
    Chat: '557193309404@s.whatsapp.net',
    Sender: '557193309404@s.whatsapp.net',
    SenderAlt: '179431486288122@lid',
    IsFromMe: false,
    IsGroup: false,
    PushName: '𝖵𝖾𝗅𝗈 𝖥𝗎𝗇𝗂𝗅',
    Type: 'text',
    MediaType: '',
    Timestamp: '2026-08-25T04:35:53-03:00',
  },
  Message: { conversation: 'Olá tudo bem', messageContextInfo: {} },
}

describe('formato real do webhook (whatsmeow)', () => {
  it('lê a mensagem capturada em produção', () => {
    const m = normalizarMensagem(REAL)
    expect(m).not.toBeNull()
    expect(m!.id).toBe('2AECBEEDF3E39E800EDE')
    expect(m!.telefone).toBe('557193309404')
    expect(m!.texto).toBe('Olá tudo bem')
    expect(m!.deNos).toBe(false)
    expect(m!.ehGrupo).toBe(false)
    expect(m!.nome).toBe('𝖵𝖾𝗅𝗈 𝖥𝗎𝗇𝗂𝗅')
  })

  it('usa Chat, nunca SenderAlt, que é o LID', () => {
    // O WhatsApp passou a mandar `179431486288122@lid`, que NÃO é telefone. O
    // Evolution já faz o swap: `Chat` traz o número real. Ler `SenderAlt`
    // criaria contato com número inexistente — pior que descartar, porque o
    // erro fica no banco parecendo dado bom.
    expect(normalizarMensagem(REAL)!.telefone).toBe('557193309404')
    expect(normalizarMensagem(REAL)!.telefone).not.toContain('1794')
  })

  it('grupo não vira contato', () => {
    const grupo = {
      Info: { ...REAL.Info, Chat: '557191035159-1593002939@g.us', IsGroup: true },
      Message: { conversation: 'oi pessoal' },
    }
    expect(normalizarMensagem(grupo)!.telefone).toBeNull()
    expect(normalizarMensagem(grupo)!.ehGrupo).toBe(true)
  })

  it('canal e transmissão também não viram contato', () => {
    // Chegaram de verdade no teste: `120363178382810106@newsletter`. Sem este
    // corte, o id do canal viraria um "telefone" que nunca casa com ninguém.
    for (const chat of [
      '120363178382810106@newsletter',
      'status@broadcast',
      '179431486288122@lid',
    ]) {
      const m = normalizarMensagem({ Info: { ...REAL.Info, Chat: chat }, Message: {} })
      expect(m!.telefone, chat).toBeNull()
    }
  })

  it('mensagem que nós enviamos é marcada', () => {
    // Ela volta como evento também. Registrar viraria eco: a atividade já foi
    // criada no momento do envio.
    const nossa = { Info: { ...REAL.Info, IsFromMe: true }, Message: REAL.Message }
    expect(normalizarMensagem(nossa)!.deNos).toBe(true)
  })

  it('descreve o que não é texto em vez de descartar', () => {
    // O cliente mandou algo, e isso é informação. Timeline que diz "mandou um
    // áudio" vale mais que uma que não diz nada.
    const casos: Array<[Record<string, unknown>, string]> = [
      [{ audioMessage: {} }, '(enviou um áudio)'],
      [{ imageMessage: {} }, '(enviou uma imagem)'],
      [{ imageMessage: { caption: 'olha isso' } }, 'olha isso'],
      [{ videoMessage: {} }, '(enviou um vídeo)'],
      [{ documentMessage: { fileName: 'orcamento.pdf' } }, '(enviou um arquivo: orcamento.pdf)'],
      [{ extendedTextMessage: { text: 'resposta citada' } }, 'resposta citada'],
      [{}, '(mensagem de tipo não suportado)'],
    ]
    for (const [conteudo, esperado] of casos) {
      const m = normalizarMensagem({ Info: REAL.Info, Message: conteudo })
      expect(m!.texto, JSON.stringify(conteudo)).toBe(esperado)
    }
  })
})

describe('formato antigo, o que o Swagger descreve', () => {
  it('continua sendo lido', () => {
    // Não é educação: se o servidor voltar ao formato documentado, ou se outra
    // VPS rodar versão diferente, ler só um dos dois recria este bug — e o
    // sintoma dele é silêncio.
    const antigo = {
      id: 'ABC123',
      chat: '5511988887777@s.whatsapp.net',
      isFromMe: false,
      isGroup: false,
      pushName: 'Maria',
      message: { conversation: 'quero um orçamento' },
    }
    const m = normalizarMensagem(antigo)!
    expect(m.id).toBe('ABC123')
    expect(m.telefone).toBe('5511988887777')
    expect(m.texto).toBe('quero um orçamento')
    expect(m.nome).toBe('Maria')
  })
})

describe('entrada inesperada', () => {
  it('não estoura, devolve null', () => {
    // O servidor manda outros tipos de evento pelo mesmo caminho. Quem chama
    // trata `null` como "pular", nunca como erro.
    for (const lixo of [null, undefined, '', 0, 'texto', []]) {
      expect(normalizarMensagem(lixo), String(lixo)).toBeNull()
    }
  })

  it('mensagem sem id devolve id null, e quem chama decide', () => {
    // Sem id não há dedupe possível. Devolver o objeto com `id: null` deixa a
    // decisão com a rota, em vez de esconder o caso aqui.
    const m = normalizarMensagem({ Info: { Chat: REAL.Info.Chat }, Message: {} })
    expect(m!.id).toBeNull()
    expect(m!.telefone).toBe('557193309404')
  })
})

/**
 * O Brasil envia 4x mais áudio que qualquer outro país, e 8 em cada 10
 * brasileiros mandam áudio. Uma caixa de entrada que só entende texto está
 * quebrada para a maioria das conversas do público-alvo.
 */
describe('tipo e mídia', () => {
  function comConteudo(Message: Record<string, unknown>) {
    return normalizarMensagem({
      Info: { ID: 'x1', Chat: '5571999998888@s.whatsapp.net', IsFromMe: false },
      Message,
    })
  }

  it('texto continua sendo texto, sem mídia', () => {
    const m = comConteudo({ conversation: 'bom dia' })
    expect(m?.tipo).toBe('texto')
    expect(m?.midiaChave).toBeNull()
    expect(m?.midiaSegundos).toBeNull()
  })

  it('áudio traz tipo, mime e duração', () => {
    const m = comConteudo({
      audioMessage: { mediaKey: 'abc123', mimetype: 'audio/ogg; codecs=opus', seconds: 38 },
    })
    expect(m?.tipo).toBe('audio')
    expect(m?.midiaChave).toBe('abc123')
    expect(m?.midiaMime).toBe('audio/ogg; codecs=opus')
    expect(m?.midiaSegundos).toBe(38)
  })

  it('imagem com legenda mantém a legenda como texto', () => {
    const m = comConteudo({ imageMessage: { mediaKey: 'k', caption: 'olha isso' } })
    expect(m?.tipo).toBe('imagem')
    expect(m?.texto).toBe('olha isso')
  })

  it('figurinha, vídeo e documento são reconhecidos', () => {
    expect(comConteudo({ stickerMessage: { mediaKey: 'k' } })?.tipo).toBe('figurinha')
    expect(comConteudo({ videoMessage: { mediaKey: 'k', seconds: 12 } })?.tipo).toBe('video')
    expect(comConteudo({ documentMessage: { mediaKey: 'k', fileName: 'nota.pdf' } })?.tipo).toBe(
      'documento',
    )
  })

  // Duração ausente ou zero vira null, não 0: "áudio de 0 segundos" na tela é
  // pior que não mostrar duração nenhuma.
  it('duração ausente ou zero vira null', () => {
    expect(comConteudo({ audioMessage: { mediaKey: 'k' } })?.midiaSegundos).toBeNull()
    expect(comConteudo({ audioMessage: { mediaKey: 'k', seconds: 0 } })?.midiaSegundos).toBeNull()
  })

  // Tipo que o WhatsApp inventar depois cai em `outro` em vez de virar `texto`.
  // Rotular localização como texto faria a tela mostrar "(não suportado)" como
  // se fosse o que o cliente escreveu.
  it('tipo desconhecido vira "outro", não "texto"', () => {
    expect(comConteudo({ locationMessage: { degreesLatitude: -12.9 } })?.tipo).toBe('outro')
  })

  it('o formato antigo do Swagger também traz mídia', () => {
    const m = normalizarMensagem({
      id: 'y1',
      chat: '5571999998888@s.whatsapp.net',
      message: { audioMessage: { mediaKey: 'zzz', seconds: 5 } },
    })
    expect(m?.tipo).toBe('audio')
    expect(m?.midiaChave).toBe('zzz')
  })
})
