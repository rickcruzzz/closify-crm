// SharedArray carrega o JSON UMA vez e compartilha read-only entre todos os
// VUs (k6 roda cada VU numa goroutine com sua própria cópia de heap JS, sem
// SharedArray, 1000 VUs replicariam ~1000 cópias do manifesto de tokens).
import { SharedArray } from 'k6/data'

export const tokens = new SharedArray('tokens', function () {
  const data = JSON.parse(open('../../auth/tokens.json'))
  if (data.length === 0) {
    throw new Error('tokens.json vazio, rode auth/mint-tokens.mjs antes de qualquer cenário k6')
  }
  return data
})

export const tenants = new SharedArray('tenants', function () {
  return JSON.parse(open('../../seed/tenants.json'))
})

export function randomToken() {
  return tokens[Math.floor(Math.random() * tokens.length)]
}

export function tokensOfGroup(group) {
  return tokens.filter((t) => t.group === group)
}

/** Dois tokens DIFERENTES do mesmo workspace, usado pelos cenários race*. */
export function twoTokensSameWorkspace() {
  const byWorkspace = new Map()
  for (const t of tokens) {
    if (!byWorkspace.has(t.workspaceId)) byWorkspace.set(t.workspaceId, [])
    byWorkspace.get(t.workspaceId).push(t)
  }
  for (const [, users] of byWorkspace) {
    if (users.length >= 2) return users.slice(0, 2)
  }
  return null
}

/** Um workspace do grupo "estresse", usado pelos cenários c2/c5 (achado #1). */
export function estresseTenant() {
  const candidatos = tenants.filter((t) => t.group === 'estresse')
  if (candidatos.length === 0) return null
  const tenant = candidatos[Math.floor(Math.random() * candidatos.length)]
  const token = tokens.find((t) => t.workspaceId === tenant.workspaceId)
  return token ? { tenant, token } : null
}
