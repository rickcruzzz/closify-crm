/**
 * Ler a conversa do WhatsApp: quem falou o quê, e se um humano assumiu.
 *
 * ## O defeito que esta camada fecha, medido em 11/09
 *
 * O fluxo do n8n avisa o atendente E responde ao cliente na mesma passagem —
 * as conexões provam (`Chama o atendente` -> `Responde no WhatsApp`). E na
 * mensagem seguinte o agente responde de novo, porque **nada guarda que um
 * humano entrou**. O cliente fica conversando com duas pessoas ao mesmo tempo,
 * e quem parece desorganizado é a empresa.
 *
 * Junto, o agente não tinha memória nenhuma: a rota aceita `historico` desde
 * que nasceu e o n8n só mandava `mensagem` e `empresa`. Quem dissesse "somos
 * 3" na primeira mensagem recebia a segunda resposta como se fosse a primeira.
 * Mesma família do `gclid` gravado e nunca lido, e do `htmlLink` que o Google
 * devolvia e a tela descartava.
 *
 * ## Onde o estado mora, e por que não é numa tabela
 *
 * Em lugar nenhum: **a conversa do WhatsApp já é o banco de dados.**
 * `POST /chat/findMessages/{instancia}` da Evolution devolve o histórico, e o
 * n8n — que é quem tem a credencial — o manda para cá.
 *
 * Isso evita três coisas de uma vez: subir um Redis só para isto, criar tabela
 * de prospecção no schema que os clientes usam (decisão já travada em
 * `lib/dono/silenciados.ts`), e manter dois registros da mesma conversa que
 * podem discordar.
 *
 * **O limite, dito em vez de descoberto depois:** a Evolution só guarda o que
 * passou por ela desde que a instância conectou. Reconectar zera o histórico —
 * e foi o que aconteceu em 11/09. O agente volta a tratar a conversa como
 * nova, o que é degradação aceitável: ele fica menos esperto, nunca errado.
 */

/**
 * Uma mensagem como a Evolution devolve.
 *
 * Tipo frouxo de propósito: o formato varia entre versões da Evolution e entre
 * tipos de mídia, e quebrar a leitura inteira porque um campo veio diferente é
 * pior que ignorar a mensagem que não se entendeu.
 */
export type MensagemCrua = {
  key?: { id?: string; fromMe?: boolean; remoteJid?: string } | null
  message?: {
    conversation?: string | null
    extendedTextMessage?: { text?: string | null } | null
  } | null
  messageType?: string | null
  messageTimestamp?: number | string | null
  source?: string | null
}

export type Turno = { de: 'cliente' | 'agente'; texto: string }

/**
 * Esta mensagem saiu pela API (o agente) ou do celular (a pessoa)?
 *
 * Dois sinais, e os dois precisam existir porque cada um sozinho erra:
 *
 *     prefixo do id   mensagem criada pelo Baileys — que e a biblioteca que a
 *                     Evolution usa — comeca com `3EB0`. O app oficial gera
 *                     ids com outro formato (`3A...`), conferido no payload
 *                     real de duas instalacoes diferentes
 *     source          a Evolution marca `web` no que sai pela API, e
 *                     `android`/`ios` no que sai do aparelho
 *
 * **`source` sozinho nao serve**, e e o furo que importa: responder pelo
 * WhatsApp Web do navegador também produz `web`, e aí o atendente humano seria
 * confundido com o agente — exatamente o caso que esta funcao existe para
 * pegar. O prefixo do id desempata.
 *
 * Em duvida, responde `false` — ou seja, trata como humano. Errar para esse
 * lado faz o agente calar quando nao precisava, e alguem reclama. Errar para o
 * outro faz o agente falar por cima do atendente, e ninguem avisa.
 */
export function saiuPelaApi(m: MensagemCrua): boolean {
  const id = m.key?.id ?? ''
  if (!id) return false
  const daBiblioteca = id.toUpperCase().startsWith('3EB0')
  const fonte = (m.source ?? '').toLowerCase()
  const doAparelho = fonte === 'android' || fonte === 'ios'
  return daBiblioteca && !doAparelho
}

/** O texto de uma mensagem, quando ela tem texto. */
export function textoDa(m: MensagemCrua): string | null {
  const t = m.message?.conversation ?? m.message?.extendedTextMessage?.text ?? null
  const limpo = (t ?? '').trim()
  return limpo || null
}

/** Ordena do mais antigo ao mais novo, que é como o modelo espera ler. */
function porTempo(a: MensagemCrua, b: MensagemCrua): number {
  return Number(a.messageTimestamp ?? 0) - Number(b.messageTimestamp ?? 0)
}

/**
 * Um humano assumiu esta conversa?
 *
 * Verdadeiro quando existe mensagem nossa que **não** saiu pela API — ou seja,
 * o dono pegou o celular e respondeu. A partir daí o agente cala.
 *
 * ## Por que a janela é por mensagem, e não por tempo
 *
 * Um TTL (o Redis do template usa 1 hora) faz o agente voltar a falar sozinho
 * no meio de um atendimento que ainda está aberto — e o cliente vê o robô
 * interromper o humano. Aqui o critério é o que de fato aconteceu na conversa.
 *
 * `apos` existe para o caso de o atendimento ter terminado e o cliente voltar
 * dias depois: passando o timestamp da última mensagem humana conhecida, quem
 * chama pode decidir reabrir. Hoje ninguém passa, e o padrão é o mais
 * conservador — uma vez que o humano entrou, ele é o dono da conversa.
 */
export function humanoAssumiu(mensagens: readonly MensagemCrua[], apos = 0): boolean {
  return mensagens.some(
    (m) =>
      m.key?.fromMe === true &&
      Number(m.messageTimestamp ?? 0) >= apos &&
      !saiuPelaApi(m),
  )
}

/**
 * O histórico no formato que a rota do agente recebe.
 *
 * `limite` de 20 turnos casa com o teto do schema em `app/api/sdr/responder`.
 * São os 20 mais RECENTES, e a ordem devolvida continua do mais antigo ao mais
 * novo: cortar pelo fim guardaria o começo da conversa e jogaria fora o que
 * acabou de ser combinado, que é o oposto do útil.
 *
 * Mídia sem texto (áudio, imagem, figurinha) sai fora em vez de virar um turno
 * vazio. Um turno em branco no meio do histórico faz o modelo inventar o que
 * havia ali — pior que a lacuna.
 */
export function montarHistorico(
  mensagens: readonly MensagemCrua[],
  limite = 20,
): Turno[] {
  const turnos: Turno[] = []
  for (const m of [...mensagens].sort(porTempo)) {
    const texto = textoDa(m)
    if (!texto) continue
    turnos.push({ de: m.key?.fromMe === true ? 'agente' : 'cliente', texto })
  }
  return turnos.slice(-limite)
}

/**
 * A última mensagem que o cliente mandou (id e horário).
 *
 * É a âncora do buffer: o fluxo guarda isto, espera, e confere se ainda é a
 * mesma. Se mudou, outra execução mais nova assumiu e esta morre sem
 * responder — sem isso, quem escreve em quatro linhas recebe quatro respostas.
 */
export function ultimaDoCliente(
  mensagens: readonly MensagemCrua[],
): { id: string; em: number } | null {
  const doCliente = [...mensagens].filter((m) => m.key?.fromMe !== true).sort(porTempo)
  const ultima = doCliente.at(-1)
  if (!ultima?.key?.id) return null
  return { id: ultima.key.id, em: Number(ultima.messageTimestamp ?? 0) }
}

/**
 * Tudo que o cliente escreveu e o agente ainda não respondeu, junto.
 *
 * O buffer existe porque a PME brasileira escreve quebrado — "oi" / "quanto
 * custa?" / "pra 3 pessoas" são três mensagens em dez segundos. Sem juntar, o
 * agente responde três vezes, e a primeira resposta sai sem saber que existiam
 * as outras duas.
 *
 * Junta com quebra de linha dupla, que é como o modelo lê parágrafos.
 */
export function mensagensPendentes(mensagens: readonly MensagemCrua[]): string {
  const ordenadas = [...mensagens].sort(porTempo)
  const ultimaNossa = ordenadas.map((m) => m.key?.fromMe === true).lastIndexOf(true)
  const depois = ultimaNossa === -1 ? ordenadas : ordenadas.slice(ultimaNossa + 1)
  return depois
    .map(textoDa)
    .filter((t): t is string => t !== null)
    .join('\n\n')
}
