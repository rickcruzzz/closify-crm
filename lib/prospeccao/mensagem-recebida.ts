/**
 * O que o webhook da Evolution entrega, traduzido para o que a rota precisa.
 *
 * ## Por que isto é um módulo próprio, puro, e não um `JSON.parse` na rota
 *
 * Porque já quebrou em silêncio uma vez, e o sintoma foi ausência.
 *
 * Em 25/08 a rota do webhook foi escrita a partir do **Swagger do servidor**,
 * que descreve os campos em minúscula e no nível raiz (`id`, `chat`,
 * `isFromMe`). O webhook não usa esse formato. `mensagem.id` vinha `undefined`,
 * o laço fazia `continue` na primeira linha, e a rota respondia
 * `200 {"ok":true}` sem gravar nada. Do lado do servidor tudo parecia perfeito
 * — *"webhook sent successfully, status: 200"*. Nenhum erro em lugar nenhum, e
 * a mensagem do cliente sumia.
 *
 * Foi preciso montar um ouvinte dentro da VPS e ler o corpo cru para descobrir.
 * **Nenhuma leitura de código acharia isso, porque o código estava coerente com
 * a documentação — a documentação é que não descreve o webhook.**
 *
 * Esta versão recupera aquele aprendizado do `git`
 * (`lib/integrations/evolution/mensagem-recebida.ts`, removido em `c52a718`) e
 * acrescenta o formato que a instalação de HOJE de fato usa.
 *
 * ## Os TRÊS formatos, e por que nenhum sai
 *
 *     key/message      Evolution 2.x sobre Baileys — e o que a instancia
 *                      `VELO` usa hoje. Nao e suposicao: `lib/sdr/conversa.ts`
 *                      le exatamente esta forma de `/chat/findMessages`, com
 *                      `key.remoteJid`, `key.fromMe`, `key.id` e `source`
 *     Info/Message     Evolution GO sobre whatsmeow, capitalizado e aninhado.
 *                      E o formato que custou a investigacao de 25/08
 *     id/chat/isFromMe o que o Swagger descreve
 *
 * Ler só um recria o defeito de 25/08 no dia em que a VPS for atualizada ou
 * trocada — e o sintoma é silêncio, que é o mais caro de perceber.
 *
 * ## `remoteJid` e não `participant` nem `senderLid`
 *
 * O WhatsApp passou a usar **LID** (`179431486288122@lid`), um identificador
 * que não é o telefone. Ler o LID criaria um contato com um número que não
 * existe — pior que descartar, porque o erro fica no banco parecendo dado bom.
 */

/** O que a rota precisa saber, seja qual for o formato que chegou. */
export type MensagemRecebida = {
  /** Identificador único da mensagem. É o dedupe. */
  id: string | null
  /** Telefone só de dígitos, ou `null` para grupo, canal e LID. */
  telefone: string | null
  /** Nome que a pessoa usa no WhatsApp, quando existe. */
  nome: string | null
  /** Texto, ou uma descrição quando o conteúdo não é texto. */
  texto: string
  /** Mensagem que NÓS enviamos volta como evento; não pode virar resposta. */
  deNos: boolean
  ehGrupo: boolean
  tipo: TipoDeMensagem
  /** Chave da mídia no servidor, para buscar sob demanda. Nunca baixada aqui. */
  midiaChave: string | null
  midiaMime: string | null
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
 * O texto de uma mensagem, seja qual for o tipo.
 *
 * Áudio, imagem e documento não têm texto puro. Em vez de descartar — a pessoa
 * mandou algo, e isso é informação —, registra o tipo. Uma conversa que diz
 * "mandou um áudio" é melhor que uma que não diz nada, e o Brasil manda 4x
 * mais áudio que qualquer outro país.
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
 * A mídia **não é baixada aqui**, de propósito: o webhook tem teto de execução
 * e um áudio de um minuto são ~1 MB. Guardamos a referência; quem precisar
 * busca depois. A 0056 já documenta a mesma decisão na coluna `midia_chave`.
 */
function midiaDaMensagem(conteudo: Bruta | null): {
  tipo: TipoDeMensagem
  midiaChave: string | null
  midiaMime: string | null
  midiaSegundos: number | null
} {
  const nada = {
    tipo: 'texto' as TipoDeMensagem,
    midiaChave: null,
    midiaMime: null,
    midiaSegundos: null,
  }
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

/**
 * `5511999998888@s.whatsapp.net` vira `5511999998888`. Grupo devolve `null`.
 *
 * `@g.us` (grupo), `@newsletter` (canal), `@broadcast` (lista) e `@lid`
 * (identificador de privacidade) não são o telefone de uma pessoa. Deixar
 * qualquer um deles passar gravaria um "telefone" que nunca casa com ninguém
 * — e no caso do LID, um número que parece válido.
 */
function telefoneDoJid(jid: string | null, ehGrupo: boolean): string | null {
  if (!jid || ehGrupo) return null
  if (/@(g\.us|newsletter|broadcast|lid)$/i.test(jid)) return null

  const digitos = (jid.split('@')[0] ?? '').replace(/\D/g, '')
  return digitos.length > 0 ? digitos : null
}

/**
 * Normaliza uma mensagem do webhook, nos três formatos conhecidos.
 *
 * Devolve `null` quando o objeto não é reconhecível como mensagem. Quem chama
 * trata isso como "pular", nunca como erro: a Evolution manda vários tipos de
 * evento pelo mesmo caminho, e responder 500 a um evento de presença faria a
 * fila dela penalizar o endereço — exatamente o que aconteceu com o Asaas.
 */
export function normalizarMensagem(bruta: unknown): MensagemRecebida | null {
  const dados = objeto(bruta)
  if (!dados) return null

  // 1. Evolution 2.x / Baileys — o formato desta instalação.
  const chave = objeto(dados.key)
  if (chave) {
    const jid = texto(chave.remoteJid)
    const ehGrupo = /@g\.us$/i.test(jid ?? '')

    return {
      id: texto(chave.id),
      telefone: telefoneDoJid(jid, ehGrupo),
      nome: texto(dados.pushName),
      texto: textoDaMensagem(objeto(dados.message), dados),
      deNos: chave.fromMe === true,
      ehGrupo,
      ...midiaDaMensagem(objeto(dados.message)),
    }
  }

  // 2. Evolution GO / whatsmeow — o que custou a investigação de 25/08.
  const info = objeto(dados.Info)
  if (info) {
    const jid = texto(info.Chat) ?? texto(info.Sender)
    const ehGrupo = info.IsGroup === true

    return {
      id: texto(info.ID),
      telefone: telefoneDoJid(jid, ehGrupo),
      nome: texto(info.PushName),
      texto: textoDaMensagem(objeto(dados.Message), dados),
      deNos: info.IsFromMe === true,
      ehGrupo,
      ...midiaDaMensagem(objeto(dados.Message)),
    }
  }

  // 3. O formato que o Swagger descreve. Sem `id` nem `chat` não é mensagem.
  const jid = texto(dados.chat)
  if (!jid && !texto(dados.id)) return null
  const ehGrupo = dados.isGroup === true

  return {
    id: texto(dados.id),
    telefone: telefoneDoJid(jid, ehGrupo),
    nome: texto(dados.pushName),
    texto: textoDaMensagem(objeto(dados.message), dados),
    deNos: dados.isFromMe === true,
    ehGrupo,
    ...midiaDaMensagem(objeto(dados.message)),
  }
}

/**
 * A mensagem deve virar registro?
 *
 * Três recusas, e cada uma tem um motivo diferente de ser recusa e não erro:
 *
 *     sem id       sem dedupe, e o reenvio da Evolution gravaria duas vezes
 *     deNos        e a nossa propria abordagem voltando como evento. Tratar
 *                  como resposta marcaria o prospect como "respondeu" no
 *                  segundo em que a mensagem saiu
 *     grupo        prospeccao nao manda para grupo, entao um evento de grupo
 *                  so pode ser outra conversa do dono no mesmo numero
 */
export function deveRegistrar(m: MensagemRecebida | null): m is MensagemRecebida {
  return Boolean(m && m.id && !m.deNos && !m.ehGrupo && m.telefone)
}
