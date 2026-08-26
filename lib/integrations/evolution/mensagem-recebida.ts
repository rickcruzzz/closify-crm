/**
 * O formato de mensagem que o Evolution GO realmente manda no webhook.
 *
 * ## O defeito que isto corrige, capturado em 25/08
 *
 * A rota do webhook foi escrita a partir do Swagger do servidor, que descreve
 * os campos em minúscula e no nível raiz (`id`, `chat`, `isFromMe`). **O
 * webhook não usa esse formato.** Ele entrega a estrutura nativa do
 * `whatsmeow`, com maiúsculas e aninhada:
 *
 *     { "event": "Message",
 *       "data": { "Info": { "ID", "Chat", "Sender", "SenderAlt",
 *                           "IsFromMe", "IsGroup", "PushName" },
 *                 "Message": { "conversation": "Olá tudo bem" } } }
 *
 * Consequência: `mensagem.id` era `undefined`, o laço fazia `continue` na
 * primeira linha, e a rota respondia `200 {"ok":true}` sem gravar nada. Do
 * lado do servidor tudo parecia perfeito — `webhook sent successfully,
 * status: 200`. Nenhum erro em lugar nenhum, e a mensagem do cliente sumia.
 *
 * Foi preciso montar um ouvinte dentro da VPS e ler o corpo cru para
 * descobrir: nenhuma leitura de código encontraria isso, porque o código
 * estava coerente com a documentação. **A documentação é que não descreve o
 * webhook.**
 *
 * ## Por que aceita os dois formatos
 *
 * O formato antigo continua tratado. Não por educação: se o servidor for
 * atualizado e voltar ao que o Swagger diz, ou se uma versão diferente do
 * Evolution rodar noutra VPS, ler só um dos dois recria exatamente este bug —
 * e ele é invisível, porque o sintoma é silêncio.
 *
 * ## `Chat` e não `SenderAlt`
 *
 * O WhatsApp passou a usar **LID** (`179431486288122@lid`), um identificador
 * que não é o telefone. O Evolution faz o swap antes de mandar: `Info.Chat` e
 * `Info.Sender` já trazem `557193309404@s.whatsapp.net`, e o LID fica em
 * `SenderAlt`. Ler `SenderAlt` criaria contato com um número que não existe —
 * pior do que descartar, porque o erro fica no banco parecendo dado bom.
 */

/** O que a rota precisa saber sobre uma mensagem, seja qual for o formato. */
export type MensagemNormalizada = {
  /** Identificador único, usado para dedupe. */
  id: string | null
  /** Telefone só de dígitos, ou `null` para grupo e canal. */
  telefone: string | null
  /** Nome que a pessoa usa no WhatsApp, quando existe. */
  nome: string | null
  /** Texto, ou uma descrição quando o conteúdo não é texto. */
  texto: string
  /** Mensagem que NÓS enviamos volta como evento; não deve virar atividade. */
  deNos: boolean
  ehGrupo: boolean
  /**
   * Que tipo de mensagem é.
   *
   * O Brasil envia 4x mais áudio que qualquer outro país, e 8 em cada 10
   * brasileiros mandam áudio. Uma caixa de entrada que só entende texto está
   * quebrada para a maioria das conversas do público-alvo: o cliente manda 40
   * segundos perguntando preço e a tela mostra "não suportado".
   */
  tipo: TipoDeMensagem
  /**
   * Chave da mídia no servidor, para buscar sob demanda.
   *
   * Não é baixada aqui de propósito: o `maxDuration` do webhook é 15s e o laço
   * já gasta ~330ms por mensagem. Baixar áudio no meio disso estouraria o teto
   * e apagaria mensagens que já tinham dedupe gravado.
   */
  midiaChave: string | null
  midiaMime: string | null
  /** Duração do áudio ou vídeo, quando o WhatsApp informa. */
  midiaSegundos: number | null
}

export type TipoDeMensagem =
  | 'texto'
  | 'audio'
  | 'imagem'
  | 'video'
  | 'documento'
  | 'figurinha'
  | 'outro'

type Bruta = Record<string, unknown>

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor.length > 0 ? valor : null
}

function objeto(valor: unknown): Bruta | null {
  return valor && typeof valor === 'object' && !Array.isArray(valor) ? (valor as Bruta) : null
}

/**
 * Extrai o texto de uma mensagem, seja qual for o tipo.
 *
 * Áudio, imagem e documento não têm texto puro. Em vez de descartar — o
 * cliente mandou algo, e isso é informação —, registra o tipo. Uma timeline
 * que diz "mandou um áudio" é melhor que uma que não diz nada.
 */
function textoDaMensagem(conteudo: Bruta | null, raiz: Bruta): string {
  const direto = texto(raiz.text)
  if (direto) return direto

  if (!conteudo) return '(mensagem sem conteúdo)'

  const conversa = texto(conteudo.conversation)
  if (conversa) return conversa

  const estendida = objeto(conteudo.extendedTextMessage)
  const textoEstendido = estendida && texto(estendida.text)
  if (textoEstendido) return textoEstendido

  const imagem = objeto(conteudo.imageMessage)
  if (imagem) return texto(imagem.caption) ?? '(enviou uma imagem)'

  if (conteudo.audioMessage) return '(enviou um áudio)'
  if (conteudo.videoMessage) return '(enviou um vídeo)'
  if (conteudo.stickerMessage) return '(enviou uma figurinha)'

  const documento = objeto(conteudo.documentMessage)
  if (documento) {
    return `(enviou um arquivo: ${texto(documento.fileName) ?? 'sem nome'})`
  }

  return '(mensagem de tipo não suportado)'
}

/**
 * Que tipo de mensagem é, e onde está a mídia dela.
 *
 * O `mediaKey` sozinho não basta para baixar: o Evolution pede o ID da
 * mensagem. Guardamos o que ele dá e a rota de mídia resolve o resto — se um
 * dia o servidor mudar de contrato, muda só aqui.
 */
function midiaDaMensagem(conteudo: Bruta | null): {
  tipo: TipoDeMensagem
  midiaChave: string | null
  midiaMime: string | null
  midiaSegundos: number | null
} {
  const nada = { tipo: 'texto' as TipoDeMensagem, midiaChave: null, midiaMime: null, midiaSegundos: null }
  if (!conteudo) return nada

  const candidatos: Array<[TipoDeMensagem, string]> = [
    ['audio', 'audioMessage'],
    ['imagem', 'imageMessage'],
    ['video', 'videoMessage'],
    ['figurinha', 'stickerMessage'],
    ['documento', 'documentMessage'],
  ]

  for (const [tipo, chave] of candidatos) {
    const bloco = objeto(conteudo[chave])
    if (!bloco) continue
    const segundos = bloco.seconds
    return {
      tipo,
      midiaChave: texto(bloco.mediaKey) ?? texto(bloco.url) ?? null,
      midiaMime: texto(bloco.mimetype) ?? null,
      midiaSegundos: typeof segundos === 'number' && segundos > 0 ? Math.round(segundos) : null,
    }
  }

  if (conteudo.conversation || conteudo.extendedTextMessage) return nada

  return { ...nada, tipo: 'outro' }
}

/** `5511999998888@s.whatsapp.net` vira `5511999998888`. Grupo devolve `null`. */
function telefoneDoChat(chat: string | null, ehGrupo: boolean): string | null {
  if (!chat || ehGrupo) return null

  // Grupo (`@g.us`) e canal (`@newsletter`) não são pessoa, e o identificador
  // deles viraria um "telefone" que nunca casa com ninguém. `@lid` também sai:
  // é o identificador de privacidade, não o número.
  if (/@(g\.us|newsletter|broadcast|lid)$/i.test(chat)) return null

  const digitos = (chat.split('@')[0] ?? '').replace(/\D/g, '')
  return digitos.length > 0 ? digitos : null
}

/**
 * Normaliza uma mensagem vinda do webhook, nos dois formatos conhecidos.
 *
 * Devolve `null` quando o objeto não é reconhecível como mensagem — quem
 * chama trata isso como "pular", nunca como erro: o servidor manda outros
 * tipos de evento pelo mesmo caminho.
 */
export function normalizarMensagem(bruta: unknown): MensagemNormalizada | null {
  const dados = objeto(bruta)
  if (!dados) return null

  // Formato real do webhook (whatsmeow): Info + Message, capitalizado.
  const info = objeto(dados.Info)
  if (info) {
    const chat = texto(info.Chat) ?? texto(info.Sender)
    const ehGrupo = info.IsGroup === true

    return {
      id: texto(info.ID),
      telefone: telefoneDoChat(chat, ehGrupo),
      nome: texto(info.PushName),
      texto: textoDaMensagem(objeto(dados.Message), dados),
      deNos: info.IsFromMe === true,
      ehGrupo,
      ...midiaDaMensagem(objeto(dados.Message)),
    }
  }

  // Formato que o Swagger descreve, mantido porque uma atualização do servidor
  // pode voltar a ele — e o sintoma de ler o formato errado é silêncio.
  const chat = texto(dados.chat)
  const ehGrupo = dados.isGroup === true

  return {
    id: texto(dados.id),
    telefone: telefoneDoChat(chat, ehGrupo),
    nome: texto(dados.pushName),
    texto: textoDaMensagem(objeto(dados.message), dados),
    deNos: dados.isFromMe === true,
    ehGrupo,
    ...midiaDaMensagem(objeto(dados.message)),
  }
}
