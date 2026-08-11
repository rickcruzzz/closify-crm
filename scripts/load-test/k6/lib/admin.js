// Helpers com service_role — usados SÓ dentro de setup()/teardown() dos
// cenários race2-5, pra criar e apagar o fixture isolado de cada corrida
// (workspace + usuários novos, fora do manifest do seed geral). NUNCA usado
// em default(), que é onde a carga simulando usuário final acontece — o
// pedido original foi explícito: nenhum fluxo que simula cliente final usa
// service_role. Setup/teardown de fixture de teste não é tráfego simulado,
// é preparação de cenário, mesma categoria de seed/seed.mjs.
import http from 'k6/http'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js'

export const SERVICE_ROLE_KEY = __ENV.SUPABASE_SERVICE_ROLE_KEY

function requireServiceRole() {
  if (!SERVICE_ROLE_KEY) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY não definido. Cenários race2-5 precisam dele só em setup()/teardown() para criar e apagar o fixture isolado da corrida — passe com -e SUPABASE_SERVICE_ROLE_KEY=...',
    )
  }
}

function adminHeaders(extra = {}) {
  requireServiceRole()
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

export function adminGet(path, extra = {}) {
  return http.get(`${SUPABASE_URL}/rest/v1${path}`, { headers: adminHeaders(extra) })
}
export function adminPost(path, body, extra = {}) {
  return http.post(`${SUPABASE_URL}/rest/v1${path}`, JSON.stringify(body), {
    headers: adminHeaders({ Prefer: 'return=representation', ...extra }),
  })
}
export function adminDelete(path, extra = {}) {
  return http.request('DELETE', `${SUPABASE_URL}/rest/v1${path}`, null, {
    headers: adminHeaders(extra),
  })
}

/** Cria usuário via GoTrue Admin API — precisa de service_role, não de anon. */
export function adminCreateUser(email, password) {
  requireServiceRole()
  const res = http.post(
    `${SUPABASE_URL}/auth/v1/admin/users`,
    JSON.stringify({ email, password, email_confirm: true }),
    { headers: adminHeaders() },
  )
  if (res.status >= 300) {
    throw new Error(`adminCreateUser(${email}) falhou (${res.status}): ${res.body}`)
  }
  return res.json()
}

export function adminDeleteUser(userId) {
  requireServiceRole()
  return http.request('DELETE', `${SUPABASE_URL}/auth/v1/admin/users/${userId}`, null, {
    headers: adminHeaders(),
  })
}

/** Login real (anon key, JWT de usuário de verdade) — isto SIM é o que default() usa. */
export function loginAs(email, password) {
  const res = http.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email, password }),
    { headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' } },
  )
  if (res.status !== 200) {
    throw new Error(`loginAs(${email}) falhou (${res.status}): ${res.body}`)
  }
  return res.json()
}

export function randomPassword() {
  return `LoadTestRace#${Math.random().toString(36).slice(2)}${Date.now()}`
}
