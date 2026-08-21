import 'server-only'

/**
 * Cliente HTTP do Evolution API.
 *
 * ## O que é, e o aviso que precisa vir junto
 *
 * O Evolution é uma camada REST sobre o Baileys, que fala o protocolo do
 * WhatsApp por engenharia reversa — **não é a API oficial da Meta**. Isso tem
 * uma consequência que nenhuma linha de código resolve: a Meta pode restringir
 * ou banir o número conectado, sem aviso e sem recurso.
 *
 * Desde janeiro de 2026 a detecção deixou de olhar só volume e passou a olhar
 * **fingerprint de cliente** — cadência de mensagem, tempo entre ações,
 * geolocalização do IP e assinatura de automação. Duas consequências práticas:
 * volume baixo não protege mais, e número antigo não protege mais.
 *
 * As camadas deste módulo (rate limit por idade da conexão, ausência de
 * disparo em massa, preferência pela janela de resposta) reduzem
 * substancialmente o risco. **Não o eliminam.** Quem conecta um número aqui
 * precisa saber disso antes, e é por isso que o aviso aparece na tela de
 * conexão, não só neste comentário.
 *
 * ## Por que um cliente próprio e não `fetch` solto
 *
 * Mesma razão de `lib/asaas/client.ts`: timeout obrigatório (um Evolution
 * pendurado prenderia a função da Vercel até o teto), `cache: 'no-store'`
 * fixo (status de conexão nunca pode vir de cache), e erro tipado que o
 * chamador consegue tratar em vez de string solta.
 */

export class EvolutionApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    public readonly body: string,
  ) {
    super(`Evolution API ${path} falhou (${status}): ${body}`)
    this.name = 'EvolutionApiError'
  }
}

/**
 * Endereço do servidor Evolution.
 *
 * Sem valor padrão de propósito: um default silencioso apontando para
 * `localhost` faria a integração "funcionar" em desenvolvimento e falhar em
 * produção com erro de rede, que é o tipo de defeito que só aparece quando
 * alguém já está esperando a mensagem chegar.
 */
function baseUrl(): string {
  const url = process.env.EVOLUTION_API_URL
  if (!url) {
    throw new Error(
      'EVOLUTION_API_URL não configurada. É o endereço do seu servidor Evolution (ex.: http://SEU_IP:8080).',
    )
  }
  return url.replace(/\/+$/, '')
}

/**
 * Chave global da API.
 *
 * O Evolution não tem login: quem tem esta chave cria instância, lê mensagem e
 * envia em nome de qualquer número conectado. É credencial de servidor, nunca
 * pode ir para o browser — daí o `server-only` no topo do arquivo.
 */
function apiKey(): string {
  const key = process.env.EVOLUTION_API_KEY
  if (!key) {
    throw new Error(
      'EVOLUTION_API_KEY não configurada. É a chave que o painel da Hostinger gerou ao subir o template.',
    )
  }
  return key
}

export async function evolutionFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response

  try {
    res = await fetch(`${baseUrl()}${path}`, {
      ...init,
      // Depois do spread, não antes: o `fetch` do Next 14 usa `force-cache`
      // por padrão, e status de conexão vindo de cache faria a tela dizer
      // "conectado" para um número que caiu.
      cache: 'no-store',
      // Um Evolution degradado prenderia a função até o teto da Vercel. Falhar
      // em 15s com erro tratável é melhor que pendurar sem explicação.
      signal: AbortSignal.timeout(15_000),
      headers: {
        'Content-Type': 'application/json',
        apikey: apiKey(),
        ...init?.headers,
      },
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new EvolutionApiError(0, path, 'Tempo esgotado ao falar com o Evolution (15s).')
    }
    throw err
  }

  if (!res.ok) {
    throw new EvolutionApiError(res.status, path, await res.text())
  }

  // Algumas rotas do Evolution respondem 200 com corpo vazio.
  const texto = await res.text()
  return (texto ? JSON.parse(texto) : null) as T
}
