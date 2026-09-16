import type { MensagemRecebida, TipoDeMensagem } from '@/lib/prospeccao/mensagem-recebida'

/**
 * O que a Z-API entrega, traduzido para o que a rota já sabe gravar.
 *
 * ## Por que o tipo de saída é emprestado da prospecção
 *
 * `MensagemRecebida` não é um formato do Evolution: é o que a gravação PRECISA
 * saber, seja qual for a ponte. A rota de 12/09 já transforma essa forma em
 * `conversas` + `mensagens`, e foi provada 20 de 20 contra produção.
 *
 * Reusar o tipo é o que faz o pipeline de recebimento continuar sendo UM. Um
 * segundo tipo com os mesmos campos produziria duas gravações que divergem no
 * dia em que uma ganhar um campo — e foi assim que este projeto quase ganhou
 * uma segunda caixa de entrada.
 *
 * ## `fromMe` NÃO é descartado aqui, e é o que muda em relação à prospecção
 *
 * `deveRegistrar` da prospecção joga fora `deNos`, e está certo lá: a mensagem
 * que sai é a nossa abordagem voltando, e contá-la como resposta marcaria o
 * prospect como "respondeu" no segundo em que o disparo saiu.
 *
 * No produto é o contrário. A Z-API tem "notify sent by me", e ligá-la é o que
 * faz a mensagem que o dono mandou **pelo celular** aparecer no CRM. Sem isso a
 * caixa de entrada mostraria metade da conversa, e a metade que falta é
 * justamente a que prova que alguém respondeu.
 *
 * Por isso a decisão de descartar sai daqui e vai para a rota, que sabe o que
 * está fazendo com a mensagem.
 *
 * ## Mídia é REFERENCIADA, nunca baixada
 *
 * Mesma decisão da 0056 e da rota de 12/09: baixar dentro do webhook gastaria o
 * `maxDuration` inteiro num arquivo que quase ninguém abre. A Z-API guarda a
 * mídia por 30 dias, e a URL vai para `mensagens.midia_chave`.
 */

/** O envelope que a Z-API manda em `ReceivedCallback`. */
type Bruta = Record<string, unknown>

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor.length > 0 ? valor : null
}

function objeto(valor: unknown): Bruta | null {
  return valor && typeof valor === 'object' && !Array.isArray(valor) ? (valor as Bruta) : null
}

function digitos(valor: unknown): string | null {
  const s = texto(valor)
  if (!s) return null

  // ## O `@` é recusado ANTES de qualquer limpeza, e o teste pegou isto
  //
  // O WhatsApp passou a usar LID (`81896604192873@lid`), um identificador que
  // NÃO é telefone. Tirar os não-dígitos primeiro deixa `81896604192873`, que
  // tem 14 caracteres e passa por qualquer faixa de tamanho plausível — então
  // uma checagem só por comprimento aprova o LID e grava no banco um número que
  // não recebe mensagem. Dado errado com aparência de dado bom.
  //
  // Qualquer `@` significa JID (`...@c.us`, `...@g.us`, `...@lid`), e nenhum
  // deles é o que se disca.
  if (s.includes('@')) return null

  const so = s.replace(/\D/g, '')
  // Oito dígitos é o miolo de um número brasileiro sem DDD; abaixo disso não é
  // telefone, é lixo. O teto de 15 é o máximo do E.164.
  return so.length >= 8 && so.length <= 15 ? so : null
}

/**
 * O conteúdo, por tipo. A ordem é a frequência real no público-alvo: texto
 * primeiro, áudio logo depois. O Brasil manda 4x mais áudio que qualquer outro
 * país, e 8 em cada 10 brasileiros mandam áudio.
 */
function conteudo(bruta: Bruta): {
  tipo: TipoDeMensagem
  texto: string
  midiaChave: string | null
  midiaMime: string | null
  midiaSegundos: number | null
} {
  const t = objeto(bruta.text)
  if (t) {
    return {
      tipo: 'texto',
      texto: texto(t.message) ?? '',
      midiaChave: null,
      midiaMime: null,
      midiaSegundos: null,
    }
  }

  const audio = objeto(bruta.audio)
  if (audio) {
    const segundos = typeof audio.seconds === 'number' ? audio.seconds : null
    return {
      tipo: 'audio',
      // O texto nunca fica vazio: a lista de conversas mostra uma prévia, e
      // prévia em branco lê-se como mensagem perdida.
      texto: segundos ? `Áudio de ${segundos}s` : 'Áudio',
      midiaChave: texto(audio.audioUrl),
      midiaMime: texto(audio.mimeType),
      midiaSegundos: segundos,
    }
  }

  const imagem = objeto(bruta.image)
  if (imagem) {
    return {
      tipo: 'imagem',
      // A legenda é o que a pessoa escreveu, e vale mais que a palavra "Imagem".
      texto: texto(imagem.caption) ?? 'Imagem',
      midiaChave: texto(imagem.imageUrl),
      midiaMime: texto(imagem.mimeType),
      midiaSegundos: null,
    }
  }

  const video = objeto(bruta.video)
  if (video) {
    return {
      tipo: 'video',
      texto: texto(video.caption) ?? 'Vídeo',
      midiaChave: texto(video.videoUrl),
      midiaMime: texto(video.mimeType),
      midiaSegundos: typeof video.seconds === 'number' ? video.seconds : null,
    }
  }

  const documento = objeto(bruta.document)
  if (documento) {
    return {
      tipo: 'documento',
      texto: texto(documento.fileName) ?? texto(documento.caption) ?? 'Documento',
      midiaChave: texto(documento.documentUrl),
      midiaMime: texto(documento.mimeType),
      midiaSegundos: null,
    }
  }

  const figurinha = objeto(bruta.sticker)
  if (figurinha) {
    return {
      tipo: 'figurinha',
      texto: 'Figurinha',
      midiaChave: texto(figurinha.stickerUrl),
      midiaMime: texto(figurinha.mimeType),
      midiaSegundos: null,
    }
  }

  // Contato, localização, enquete, reação. Não são gravados com conteúdo, e
  // também não são descartados: a linha existir na conversa é o que impede a
  // pessoa de achar que a mensagem se perdeu.
  return {
    tipo: 'outro',
    texto: 'Mensagem não suportada',
    midiaChave: null,
    midiaMime: null,
    midiaSegundos: null,
  }
}

/**
 * Normaliza um `ReceivedCallback`.
 *
 * Devolve `null` quando o corpo não é um callback de mensagem — evento de outro
 * tipo, corpo vazio, ou JSON que não é objeto. Nunca lança: webhook que lança
 * vira 500, e 500 faz o provedor reentregar para sempre um evento que nunca vai
 * dar certo.
 */
export function normalizarZapi(corpo: unknown): MensagemRecebida | null {
  const bruta = objeto(corpo)
  if (!bruta) return null

  // `type` distingue os três callbacks que apontam para a mesma base de URL.
  // Sem a checagem, um `MessageStatusCallback` viraria uma mensagem de texto
  // vazia na conversa.
  if (bruta.type !== 'ReceivedCallback') return null

  const id = texto(bruta.messageId)
  const grupo = bruta.isGroup === true
  const c = conteudo(bruta)

  return {
    id,
    // Em grupo, `phone` é o id do grupo e não o de ninguém. Devolver `null`
    // faz a rota descartar antes de criar um contato com um "telefone" que não
    // recebe mensagem.
    telefone: grupo ? null : digitos(bruta.phone),
    nome: texto(bruta.senderName) ?? texto(bruta.chatName),
    texto: c.texto,
    deNos: bruta.fromMe === true,
    ehGrupo: grupo,
    tipo: c.tipo,
    midiaChave: c.midiaChave,
    midiaMime: c.midiaMime,
    midiaSegundos: c.midiaSegundos,
  }
}

/** O `instanceId` que o callback declara, para conferir contra o que o segredo achou. */
export function instanciaDoPayload(corpo: unknown): string | null {
  return texto(objeto(corpo)?.instanceId)
}

/**
 * O que um `MessageStatusCallback` diz, e sobre quais mensagens.
 *
 * `ids` é array porque o WhatsApp confirma em lote: abrir uma conversa com
 * dez mensagens não lidas gera UM callback com dez ids.
 */
export function normalizarStatusZapi(
  corpo: unknown,
): { status: string; ids: string[] } | null {
  const bruta = objeto(corpo)
  if (!bruta || bruta.type !== 'MessageStatusCallback') return null

  const status = texto(bruta.status)
  const ids = Array.isArray(bruta.ids)
    ? bruta.ids.filter((v): v is string => typeof v === 'string' && v.length > 0)
    : []

  if (!status || ids.length === 0) return null
  return { status, ids }
}

/**
 * Um `DisconnectedCallback`.
 *
 * `error` vem do provedor e vai direto para `whatsapp_instances.ultimo_erro`,
 * que a tela mostra. Não é traduzido: inventar uma frase amigável a partir de
 * um texto que não controlamos esconderia o motivo real de quem precisa dele.
 */
export function normalizarDesconexaoZapi(
  corpo: unknown,
): { erro: string | null } | null {
  const bruta = objeto(corpo)
  if (!bruta || bruta.type !== 'DisconnectedCallback') return null
  return { erro: texto(bruta.error) }
}
