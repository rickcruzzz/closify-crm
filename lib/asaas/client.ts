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

export async function asaasFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${ASAAS_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      access_token: process.env.ASAAS_API_KEY!,
      ...init?.headers,
    },
  })

  if (!res.ok) {
    const body = await res.text()
    // 401 aqui quase sempre é ASAAS_API_KEY desatualizada ou com formatação
    // errada (a barra invertida do .env.local vazando pra produção, por
    // exemplo) — não confundir com o token do webhook, que é outro segredo e
    // não valida este caminho.
    throw new AsaasApiError(res.status, path, body)
  }

  return res.json() as Promise<T>
}
