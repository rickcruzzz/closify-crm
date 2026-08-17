// Preflight OBRIGATÓRIO antes de qualquer carga da Trilha B: confirma que o
// cookie montado por mint-tokens.mjs é aceito de verdade pela app rodando
// localmente (next build && next start). Se isto falhar, os cenários b1-b4
// vão medir "sempre redirecionado pro /login", não o custo real das páginas,
// um resultado tecnicamente coletado e completamente inútil.
//
// Uso (com a app já rodando em outro terminal):
//   node --env-file=scripts/load-test/.env.staging scripts/load-test/auth/probe-cookie-format.mjs
import { readFileSync } from 'node:fs'

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

const tokensPath = new URL('./tokens.json', import.meta.url)
let tokens
try {
  tokens = JSON.parse(readFileSync(tokensPath, 'utf8'))
} catch {
  console.error('tokens.json não encontrado. Rode mint-tokens.mjs primeiro.')
  process.exit(1)
}

if (tokens.length === 0) {
  console.error('tokens.json está vazio, mint-tokens.mjs não logou ninguém.')
  process.exit(1)
}

const amostra = tokens[0]

async function main() {
  console.log(`Testando cookie de ${amostra.email} contra ${appUrl}/dashboard ...`)

  const res = await fetch(`${appUrl}/dashboard`, {
    headers: { Cookie: amostra.cookieHeader },
    redirect: 'follow',
  })

  const finalUrl = res.url
  const acabouNoDashboard = finalUrl.includes('/dashboard') || finalUrl.includes('/onboarding')
  const acabouNoLogin = finalUrl.includes('/login')

  console.log(`  status final : ${res.status}`)
  console.log(`  URL final    : ${finalUrl}`)

  if (acabouNoDashboard) {
    console.log('\n=== OK: cookie aceito, sessão reconhecida pelo middleware. ===')
    console.log('Trilha B liberada para carga.')
    return
  }

  if (acabouNoLogin) {
    console.error('\n=== FALHOU: middleware redirecionou pro /login. ===')
    console.error('O cookie NÃO foi aceito. Causas prováveis:')
    console.error('  - @supabase/ssr mudou de versão e o formato do cookie mudou')
    console.error('    (conferir node_modules/@supabase/ssr/src/cookies.ts de novo)')
    console.error('  - a app local não está rodando contra o MESMO projeto Supabase')
    console.error('    que gerou o token (.env.local usado no build != .env.staging)')
    console.error('  - o token expirou entre o mint-tokens.mjs e este teste')
    process.exit(1)
  }

  console.error(`\n=== INCONCLUSIVO: URL final inesperada (${finalUrl}). ===`)
  console.error('Investigar manualmente antes de confiar na Trilha B.')
  process.exit(1)
}

main().catch((err) => {
  console.error('\nPROBE FALHOU:', err.message)
  console.error('A app local está rodando (next build && next start)?')
  process.exit(1)
})
