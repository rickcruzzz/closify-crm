const ASAAS_BASE_URL = process.env.ASAAS_API_URL ?? 'https://api.asaas.com/v3'

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
    throw new Error(`Asaas API ${path} falhou (${res.status}): ${body}`)
  }

  return res.json() as Promise<T>
}
