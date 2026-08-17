// Faz login real (GoTrue REST) para cada usuário semeado e monta, em Node, o
// MESMO cookie que @supabase/ssr escreveria no browser, pra Trilha B (k6
// batendo em páginas protegidas com cookie de sessão real).
//
// Não é aproximação: reproduz bit a bit o algoritmo lido em
// node_modules/@supabase/ssr/src/{cookies,utils/{chunker,base64url}}.ts,
//   1. storageKey = `sb-${projectRef}-auth-token`, projectRef = primeiro
//      label do hostname da URL do Supabase (SupabaseClient.ts:327).
//   2. cookieEncoding é 'base64url' por padrão (o projeto não sobrescreve,
//      confirmado em lib/supabase/server.ts e middleware.ts).
//   3. valor = 'base64-' + base64url(JSON.stringify(session)), e
//      `stringToBase64URL` do pacote é bit-a-bit igual a
//      `Buffer.from(str).toString('base64url')` do Node (é o que o próprio
//      teste do pacote assume, base64url.test.ts:24).
//   4. se o valor codificado passar de 3180 chars (MAX_CHUNK_SIZE), quebra em
//      `sb-<ref>-auth-token.0`, `.1`, ..., como o alfabeto base64url não tem
//      caractere que precise de percent-encoding, o corte é uma fatia direta
//      da string, sem o vaivém de encodeURIComponent/decodeURIComponent que
//      o chunker faz para o caso genérico.
//
// Uso: node --env-file=scripts/load-test/.env.staging scripts/load-test/auth/mint-tokens.mjs
import { readFileSync, writeFileSync } from 'node:fs'

const MAX_CHUNK_SIZE = 3180
const BASE64_PREFIX = 'base64-'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.')
  process.exit(1)
}

const projectRef = new URL(url).hostname.split('.')[0]
const storageKey = `sb-${projectRef}-auth-token`

function buildCookieHeader(session) {
  const json = JSON.stringify(session)
  const encoded = BASE64_PREFIX + Buffer.from(json, 'utf8').toString('base64url')

  if (encoded.length <= MAX_CHUNK_SIZE) {
    return `${storageKey}=${encoded}`
  }

  const parts = []
  for (let i = 0; i < encoded.length; i += MAX_CHUNK_SIZE) {
    parts.push(encoded.slice(i, i + MAX_CHUNK_SIZE))
  }
  return parts.map((chunk, i) => `${storageKey}.${i}=${chunk}`).join('; ')
}

async function login(email, password) {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`login ${email} falhou (${res.status}): ${body.slice(0, 200)}`)
  }
  return res.json()
}

async function withConcurrency(items, limit, fn) {
  const results = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

async function main() {
  const tenants = JSON.parse(readFileSync(new URL('../seed/tenants.json', import.meta.url), 'utf8'))
  const allUsers = tenants.flatMap((t) =>
    t.users.map((u) => ({ ...u, workspaceId: t.workspaceId, group: t.group, plan: t.plan })),
  )

  console.log(`Logando ${allUsers.length} usuários (GoTrue REST, concorrência 10)...`)
  let falhas = 0

  const tokens = await withConcurrency(allUsers, 10, async (u, i) => {
    try {
      const session = await login(u.email, u.password)
      if ((i + 1) % 100 === 0) console.log(`  ${i + 1}/${allUsers.length}`)
      return {
        id: u.id,
        email: u.email,
        workspaceId: u.workspaceId,
        group: u.group,
        plan: u.plan,
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        cookieHeader: buildCookieHeader(session),
      }
    } catch (err) {
      falhas++
      console.error(`  ${err.message}`)
      return null
    }
  })

  const validos = tokens.filter(Boolean)
  writeFileSync(new URL('./tokens.json', import.meta.url), JSON.stringify(validos, null, 2))

  console.log('\n=== MINT-TOKENS CONCLUÍDO ===')
  console.log(`  sucesso : ${validos.length}`)
  console.log(`  falhas  : ${falhas}`)
  console.log(`  manifest: scripts/load-test/auth/tokens.json`)
  if (falhas > 0) {
    console.log('\nFalhas não travam o próximo passo, mas reduzem a amostra do k6.')
  }
  console.log('\nPróximo passo: auth/probe-cookie-format.mjs (valida ANTES de rodar carga)')
}

main().catch((err) => {
  console.error('\nMINT-TOKENS FALHOU:', err.message)
  process.exit(1)
})
