const ASAAS_BASE_URL = process.env.ASAAS_API_URL ?? 'https://api.asaas.com/v3'

export class AsaasApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    public readonly body: string,
  ) {
    super(`Asaas API ${path} falhou (${status}): ${body}`)
    this.name = 'AsaasApiError'
  }
}

/**
 * Lê a chave da API removendo o que nunca faz parte de uma chave Asaas real.
 *
 * A chave começa com `$`, e no `.env.local` ela **precisa** ser escrita como
 * `\$aact_...`: o `dotenv-expand` do Next trata `$` como início de
 * interpolação de variável, então sem o escape a chave viraria string vazia.
 * O `dotenv-expand` consome essa barra ao carregar, e localmente tudo funciona.
 *
 * Na Vercel não há `dotenv-expand`, o valor é injetado literal. Copiar a
 * chave do arquivo **com** a barra faz o runtime enviar `\$aact_...` no header
 * e o Asaas responder 401 `invalid_access_token`, com a mesma aparência de
 * "chave errada". O mesmo vale para aspas ou espaço colados junto.
 *
 * Como nenhum desses caracteres pode abrir uma chave legítima, normalizar aqui
 * é seguro e elimina a classe inteira de erro de cópia.
 */
export function readAsaasApiKey(): string {
  const raw = process.env.ASAAS_API_KEY

  if (!raw || raw.trim() === '') {
    // Falha explícita em vez de mandar `access_token: undefined` e receber um
    // 401 genérico, que faz parecer chave inválida quando na verdade é
    // variável ausente ou fora do escopo de Production.
    throw new Error(
      'ASAAS_API_KEY não está definida no ambiente. Confira a variável no painel de deploy, inclusive o escopo (Production).',
    )
  }

  return raw
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/^\\/, '')
}

export async function asaasFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${ASAAS_BASE_URL}${path}`, {
    ...init,
    // Depois do spread, não antes: sem isso, o `fetch()` do Next 14 usa
    // `force-cache` por padrão mesmo em página dinâmica, status de
    // pagamento nunca pode vir de cache, ou a tela de cobrança mostra
    // fatura pendente que já foi paga. Fixo em `no-store` de propósito,
    // pra nenhum call site conseguir reintroduzir cache sem querer.
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      access_token: readAsaasApiKey(),
      ...init?.headers,
    },
  })

  if (!res.ok) {
    const body = await res.text()
    // 401 aqui, já com a chave normalizada, aponta para chave revogada ou de
    // outra conta, não mais para erro de formatação. Não confundir com o
    // token do webhook, que é outro segredo e não valida este caminho.
    throw new AsaasApiError(res.status, path, body)
  }

  return res.json() as Promise<T>
}
