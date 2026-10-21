import 'server-only'

/**
 * O ÚNICO lugar que fala HTTP com a Evolution API.
 *
 * Irmão de `lib/whatsapp/zapi.ts`, e com a mesma regra: quem chama daqui para
 * cima nunca monta URL nem manda cabeçalho. A credencial não sobe.
 *
 * ## O contrato foi MEDIDO contra o servidor, não lido em documentação
 *
 * Sondado em 25/09 contra a instância real (v2.3.7), com uma instância
 * descartável criada e apagada no mesmo script:
 *
 *     POST   /instance/create              201  { instance, hash, webhook, ... }
 *     GET    /instance/connectionState/{n} 200  { instance: { state } }
 *     GET    /instance/connect/{n}         200  { pairingCode, code, base64, count }
 *     POST   /webhook/set/{n}              201  aceita `headers` customizado
 *     GET    /webhook/find/{n}             200  devolve o que foi gravado
 *     DELETE /instance/delete/{n}          200
 *
 * Isto não é zelo: o caminho da Z-API foi escrito a partir da documentação em
 * 17/09 e ela levou a erro CINCO vezes, duas das quais "consertando" o que já
 * funcionava. A API real é a única autoridade.
 *
 * ## O `hash` é o token, e o nome não ajuda
 *
 * `POST /instance/create` devolve o token da instância no campo `hash`, não em
 * `token` nem em `apikey`. Medido, porque adivinhar o nome do campo é como o
 * `notifySentByMe` da Z-API passou dias sendo aceito e ignorado.
 */

const BASE = process.env.EVOLUTION_BASE_URL ?? 'https://8-evolution-api.zohnng.easypanel.host'

/**
 * Dez segundos, e o motivo é a VPS.
 *
 * Ela já saiu do ar antes, e sem o sinal de abortar uma VPS pendurada seguraria
 * a função serverless até o teto dela. Num webhook isso faz a Evolution
 * reentregar um evento cujo trabalho já foi feito.
 */
const TIMEOUT_MS = 10_000

export class EvolutionError extends Error {
  constructor(
    readonly status: number,
    readonly caminho: string,
    readonly corpo: string,
  ) {
    super(`Evolution respondeu ${status} em ${caminho}`)
    this.name = 'EvolutionError'
  }
}

/**
 * A chave GLOBAL, que cria e apaga instância.
 *
 * Diferente da Z-API, onde cada instância traz o próprio par de credenciais: na
 * Evolution a chave global é de administração do servidor inteiro. Ela nunca
 * sai daqui, e nenhuma função exportada a recebe como parâmetro.
 */
function chaveGlobal(): string {
  const k = process.env.EVOLUTION_GLOBAL_API_KEY ?? process.env.EVOLUTION_API_KEY
  // Lança em vez de mandar `undefined`: sem a chave o servidor responde 401 e o
  // erro que chega em cima diz "não autorizado", que manda investigar
  // permissão quando o problema é variável ausente.
  if (!k) throw new Error('EVOLUTION_GLOBAL_API_KEY não está definida')
  return k
}

async function chamar<T>(
  caminho: string,
  opcoes: { method?: string; body?: unknown; apikey?: string } = {},
): Promise<T> {
  const resposta = await fetch(`${BASE}${caminho}`, {
    method: opcoes.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      apikey: opcoes.apikey ?? chaveGlobal(),
    },
    body: opcoes.body === undefined ? undefined : JSON.stringify(opcoes.body),
    // Estado que muda por minuto (QR, conexão). Cache aqui entregaria um QR
    // morto, que é a mesma armadilha registrada no cliente da Z-API.
    cache: 'no-store',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })

  const texto = await resposta.text()
  if (!resposta.ok) {
    throw new EvolutionError(resposta.status, caminho, texto.slice(0, 500))
  }
  return (texto ? JSON.parse(texto) : {}) as T
}

/** As credenciais de UMA instância, já decifradas. Nunca sobem daqui. */
export type InstanciaEvolution = {
  /** O `instanceName`, que na Evolution é escolhido por nós. */
  nome: string
  /** O `hash` devolvido na criação. */
  token: string
}

// ---------------------------------------------------------------------------
// Criar, conectar, conferir, apagar
// ---------------------------------------------------------------------------

export type InstanciaCriada = { nome: string; token: string }

/**
 * Cria a instância no servidor e devolve o token dela.
 *
 * `qrcode: false` de propósito: o QR é pedido depois, por
 * `qrCode()`, no instante em que a tela vai mostrá-lo. Pedir na criação
 * geraria um código que expira antes de alguém olhar.
 */
export async function criarInstancia(nome: string): Promise<InstanciaCriada> {
  const r = await chamar<{ hash?: string; instance?: { instanceName?: string } }>(
    '/instance/create',
    {
      method: 'POST',
      body: { instanceName: nome, integration: 'WHATSAPP-BAILEYS', qrcode: false },
    },
  )

  const token = r.hash
  if (!token) {
    // Falhar alto: instância criada sem token é instância órfã, que ocupa a
    // VPS e nenhuma tela alcança. É a mesma classe da "cobrança invisível" que
    // a 0090 evita na Z-API.
    throw new Error('Evolution criou a instância e não devolveu `hash`')
  }
  return { nome: r.instance?.instanceName ?? nome, token }
}

export type EstadoDaConexao = 'open' | 'close' | 'connecting' | 'desconhecido'

/** Em que estado a Evolution diz que esta instância está. */
export async function estadoDaInstancia(nome: string): Promise<EstadoDaConexao> {
  const r = await chamar<{ instance?: { state?: string } }>(
    `/instance/connectionState/${encodeURIComponent(nome)}`,
  )
  const s = r.instance?.state
  return s === 'open' || s === 'close' || s === 'connecting' ? s : 'desconhecido'
}

/**
 * O QR para parear, como data URI.
 *
 * `null` quer dizer "não há QR agora", que é o caso NORMAL de uma instância já
 * conectada. Falha de verdade sobe como exceção, porque ela pede tentativa de
 * novo e "já está conectado" não pede.
 */
export async function qrCode(nome: string): Promise<string | null> {
  const r = await chamar<{ base64?: string; code?: string }>(
    `/instance/connect/${encodeURIComponent(nome)}`,
  )
  if (typeof r.base64 === 'string' && r.base64.startsWith('data:image')) return r.base64
  // Alguns caminhos devolvem só o `code`, que é o conteúdo do QR e não a
  // imagem. Devolver isso como se fosse imagem pintaria um `<img>` quebrado.
  return null
}

/**
 * Aponta os webhooks desta instância para nós.
 *
 * ## O segredo vai no CABEÇALHO, e não na URL
 *
 * A Vercel registra a URL de toda requisição no log. Segredo em caminho é
 * segredo em log, e o log fica fora de qualquer purga. A Evolution 2.3.7
 * aceita `headers` customizado, e isso foi CONFERIDO lendo de volta com
 * `GET /webhook/find` em 25/09.
 *
 * É a mesma decisão do webhook de prospecção, de 12/09, e o motivo é o mesmo.
 *
 * ## Só dois eventos
 *
 * `MESSAGES_UPSERT` traz a mensagem, `CONNECTION_UPDATE` traz a queda. Assinar
 * todos encheria a rota de evento de presença e de leitura, que este produto
 * não usa, e cada um deles é uma chamada serverless paga.
 */
export async function apontarWebhook(params: {
  nome: string
  url: string
  segredo: string
}): Promise<void> {
  await chamar(`/webhook/set/${encodeURIComponent(params.nome)}`, {
    method: 'POST',
    body: {
      webhook: {
        enabled: true,
        url: params.url,
        headers: { authorization: `Bearer ${params.segredo}` },
        events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
        byEvents: false,
        base64: false,
      },
    },
  })
}

/** O que a Evolution diz que o webhook desta instância é. Para conferir. */
export async function lerWebhook(nome: string): Promise<{
  enabled: boolean
  url: string | null
  temCabecalho: boolean
  eventos: string[]
}> {
  const r = await chamar<{
    enabled?: boolean
    url?: string
    headers?: Record<string, string>
    events?: string[]
  }>(`/webhook/find/${encodeURIComponent(nome)}`)
  return {
    enabled: r.enabled === true,
    url: r.url ?? null,
    // O VALOR do cabeçalho nunca sobe: quem confere precisa saber se ele
    // existe, não qual é.
    temCabecalho: Boolean(r.headers?.authorization),
    eventos: r.events ?? [],
  }
}

/**
 * Apaga a instância no servidor.
 *
 * Chamado quando a conexão é removida e no rollback de uma criação que não
 * virou linha no banco. Instância sem linha é instância que nenhuma tela
 * alcança e nenhuma varredura reencontra, ocupando a VPS para sempre.
 */
export async function apagarInstancia(nome: string): Promise<void> {
  await chamar(`/instance/delete/${encodeURIComponent(nome)}`, { method: 'DELETE' })
}

// ---------------------------------------------------------------------------
// Enviar
// ---------------------------------------------------------------------------

export type EnvioFeito = { externalId: string | null }

/**
 * Manda uma mensagem de texto.
 *
 * Usa o token DA INSTÂNCIA, não a chave global: se ele for revogado, o estrago
 * para naquela empresa em vez de derrubar o servidor inteiro.
 */
export async function enviarTexto(
  instancia: InstanciaEvolution,
  numero: string,
  texto: string,
): Promise<EnvioFeito> {
  const r = await chamar<{ key?: { id?: string } }>(
    `/message/sendText/${encodeURIComponent(instancia.nome)}`,
    {
      method: 'POST',
      body: { number: numero, text: texto },
      apikey: instancia.token,
    },
  )
  // `key.id` é o id da mensagem no WhatsApp, e é ele que o webhook de status
  // devolve depois. `null` não é falha: a mensagem saiu, só não dá para
  // correlacionar o recibo.
  return { externalId: r.key?.id ?? null }
}
