/**
 * Dispara o convite ao Instagram para todas as empresas.
 *
 *     node --env-file=.env.local scripts/notificacoes/convite-instagram.mjs
 *     node --env-file=.env.local scripts/notificacoes/convite-instagram.mjs --confirmar
 *
 * Sem `--confirmar` ele só conta e mostra o texto — nada é gravado. É o mesmo
 * desenho de `publicar-instagram.mjs`: disparo em massa que não se desfaz merece
 * um ensaio antes.
 *
 * ## Idempotente, e isso não é luxo
 *
 * Antes de gravar, ele pergunta quais empresas JÁ têm uma notificação deste
 * tipo e pula essas. Rodar duas vezes não duplica.
 *
 * Sem isso, a segunda execução poria dois convites idênticos no sino de todo
 * mundo — e o `reactStrictMode` deste projeto já ensinou em 08/09 que a
 * chamada dupla acontece sozinha quando menos se espera.
 *
 * ## O `href` é interno de propósito
 *
 * `/ir/instagram`, não `instagram.com`. O banco RECUSA URL absoluta em
 * `notificacoes.href` desde a 0066 — é vetor de phishing quem escreve a linha
 * poder escolher o destino. A rota traduz, com allowlist fechada.
 *
 * ## A ressalva
 *
 * Este é o único tipo de notificação que não é dinheiro nem prazo. A regra do
 * sino ("só entra o que já provou valer um e-mail") é contra ele. Foi decisão
 * do dono, tomada depois de a ressalva ser apresentada; o porquê inteiro está
 * na migration 0081.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const CONFIRMAR = process.argv.includes('--confirmar')

if (!url || !key) {
  console.error('\n  faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY\n')
  process.exit(1)
}

const h = { apikey: key, Authorization: `Bearer ${key}`, 'content-type': 'application/json' }

const AVISO = {
  tipo: 'convite_instagram',
  titulo: 'Acompanhe o Velo Funil no Instagram',
  corpo: 'Bastidores do produto, dicas de orçamento e o que vem por aí. @velofunil',
  href: '/ir/instagram',
}

async function main() {
  const empresas = await fetch(`${url}/rest/v1/workspaces?select=id,name`, { headers: h }).then((r) => r.json())

  // Quem já recebeu. `select` só do workspace_id: a lista pode crescer, e não
  // há razão para trazer o corpo de cada notificação para contar.
  const jaTem = await fetch(
    `${url}/rest/v1/notificacoes?select=workspace_id&tipo=eq.${AVISO.tipo}`,
    { headers: h },
  ).then((r) => r.json())
  const recebidos = new Set(jaTem.map((n) => n.workspace_id))

  const alvos = empresas.filter((e) => !recebidos.has(e.id))

  console.log('')
  console.log(`  empresas          : ${empresas.length}`)
  console.log(`  ja receberam      : ${recebidos.size}`)
  console.log(`  vao receber agora : ${alvos.length}`)
  console.log('')
  console.log('  ┌─ como aparece no sino ─────────────────────────────')
  console.log(`  │  ·  ${AVISO.titulo}`)
  console.log(`  │     ${AVISO.corpo}`)
  console.log(`  │     agora  ->  ${AVISO.href}`)
  console.log('  └────────────────────────────────────────────────────')
  console.log('')

  if (!alvos.length) {
    console.log('  nada a fazer.\n')
    return
  }

  if (!CONFIRMAR) {
    console.log('  ENSAIO — nada foi gravado. Use --confirmar para disparar.\n')
    return
  }

  // Em lote único: são dezenas de linhas, não milhares, e o PostgREST aceita
  // um array. Uma requisição por empresa seria o padrão que a dedupe da
  // importação de planilha já pagou para abandonar.
  const linhas = alvos.map((e) => ({ workspace_id: e.id, ...AVISO }))
  const r = await fetch(`${url}/rest/v1/notificacoes`, {
    method: 'POST',
    headers: { ...h, Prefer: 'return=representation' },
    body: JSON.stringify(linhas),
  })

  if (!r.ok) {
    console.error(`  FALHOU ${r.status}: ${(await r.text()).slice(0, 200)}\n`)
    process.exit(1)
  }

  const gravadas = await r.json()
  console.log(`  gravadas: ${gravadas.length}\n`)
}

main()
