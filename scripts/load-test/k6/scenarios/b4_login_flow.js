// Trilha B — login real (POST no GoTrue REST, mesmo endpoint que
// supabase.auth.signInWithPassword chama por baixo) seguido do carregamento
// da home autenticada. Cada iteração sorteia um usuário DISTINTO — o rate
// limit de login do app (lib/rate-limit.ts, 8 tentativas/15min por e-mail) é
// checado dentro da Server Action signIn, que este cenário não usa
// diretamente, mas reusar o mesmo usuário em loop fechado não é
// comportamento humano de qualquer forma e polui a métrica.
import http from 'k6/http'
import encoding from 'k6/encoding'
import { check, sleep } from 'k6'
import { SUPABASE_URL, SUPABASE_ANON_KEY, BASE_URL, currentProfile, thinkTime } from '../lib/config.js'
import { tenants } from '../lib/tenants.js'

export const options = {
  ...currentProfile(),
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    http_req_failed: ['rate<0.01'],
  },
}

const projectRef = SUPABASE_URL.replace(/^https?:\/\//, '').split('.')[0]
const storageKey = `sb-${projectRef}-auth-token`
const MAX_CHUNK_SIZE = 3180

// Mesmo algoritmo de auth/mint-tokens.mjs, reimplementado com k6/encoding
// porque este cenário loga em runtime (não usa tokens.json pré-mintado) —
// ver o comentário longo em mint-tokens.mjs para a fonte do algoritmo.
function buildCookieHeader(session) {
  const encoded = 'base64-' + encoding.b64encode(JSON.stringify(session), 'rawurl')
  if (encoded.length <= MAX_CHUNK_SIZE) return `${storageKey}=${encoded}`
  const parts = []
  for (let i = 0; i < encoded.length; i += MAX_CHUNK_SIZE) {
    parts.push(encoded.slice(i, i + MAX_CHUNK_SIZE))
  }
  return parts.map((chunk, i) => `${storageKey}.${i}=${chunk}`).join('; ')
}

function randomUser() {
  const tenant = tenants[Math.floor(Math.random() * tenants.length)]
  return tenant.users[Math.floor(Math.random() * tenant.users.length)]
}

export default function () {
  const user = randomUser()

  const loginRes = http.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email: user.email, password: user.password }),
    {
      headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      tags: { step: 'login' },
    },
  )

  const ok = check(loginRes, { 'login 200': (r) => r.status === 200 })
  if (!ok) {
    sleep(thinkTime())
    return
  }

  sleep(thinkTime(0.5, 1.5)) // tempo entre "entrar" e a home carregar

  const session = loginRes.json()
  const homeRes = http.get(`${BASE_URL}/`, {
    headers: { Cookie: buildCookieHeader(session) },
    tags: { step: 'home-pos-login' },
  })
  check(homeRes, { 'home 200': (r) => r.status === 200 })

  sleep(thinkTime())
}
