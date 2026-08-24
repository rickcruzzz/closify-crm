// Mede a estabilidade REAL da sessão de WhatsApp, em série temporal.
//
// Uma leitura isolada diria "conectado" ou "caído" e as duas seriam verdade
// em momentos diferentes. Só a série separa oscilação de queda definitiva —
// e é a série que decide se a integração pode ser vendida.
import { createClient } from '@supabase/supabase-js'

const URL = process.env.EVOLUTION_API_URL
const KEY = process.env.EVOLUTION_API_KEY
const MINUTOS = Number(process.argv[2] ?? 6)
const INTERVALO = 10000

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

// O token por instância fica cifrado no banco — o mesmo caminho que as Server
// Actions e o webhook usam. Sem ele, /instance/status não responde pela
// instância certa.
const { data: conexao } = await admin
  .from('integration_connections')
  .select('workspace_id, external_id, status, access_token_enc')
  .eq('provider', 'whatsapp')
  .eq('status', 'connected')
  .maybeSingle()

if (!conexao) {
  console.log('nenhuma conexão marcada como `connected` no banco — nada a medir')
  process.exit(0)
}

console.log('instância:', conexao.external_id)
console.log(`medindo por ${MINUTOS} min, a cada ${INTERVALO / 1000}s\n`)

// O token POR INSTÂNCIA, lido de /instance/all com a chave global. É ele que
// /instance/status exige — a chave global ali devolve dados de outra coisa.
const todas = await (await fetch(`${URL}/instance/all`, { headers: { apikey: KEY } })).json()
const arrTodas = Array.isArray(todas) ? todas : (todas.data ?? [])
const minha = arrTodas.find((i) => (i.id ?? i.name) === conexao.external_id)
if (!minha) { console.log('instância não existe no servidor'); process.exit(1) }
const TOKEN = minha.token

async function estado() {
  // `/instance/status` com o token DA INSTÂNCIA: é a rota que o produto usa
  // (`obterEstado` em lib/integrations/evolution/api.ts) e a única que devolve
  // `LoggedIn`. Em `/instance/all` esse campo não existe — medir por lá dá
  // `null` sempre e faz uma sessão saudável parecer morta.
  try {
    const r = await fetch(`${URL}/instance/status`, {
      headers: { apikey: TOKEN },
      signal: AbortSignal.timeout(15000),
    })
    if (!r.ok) return { erro: `HTTP ${r.status}` }
    const j = await r.json()
    return { connected: j?.data?.Connected ?? null, loggedIn: j?.data?.LoggedIn ?? null }
  } catch (e) {
    return { erro: e.message }
  }
}

const primeira = await estado()
console.log('campos que a API devolve:', primeira.bruto ?? '(erro)')
console.log('')

const amostras = []
const fim = Date.now() + MINUTOS * 60 * 1000

while (Date.now() < fim) {
  const s = await estado()
  amostras.push(s)
  const hora = new Date().toISOString().slice(11, 19)
  console.log(
    `${hora}  Connected=${String(s.connected).padEnd(5)}  LoggedIn=${String(s.loggedIn).padEnd(5)}  ${s.erro ?? ''}`,
  )
  await new Promise((r) => setTimeout(r, INTERVALO))
}

const n = amostras.length
const conectado = amostras.filter((a) => a.connected === true).length
const logado = amostras.filter((a) => a.loggedIn === true).length
const erros = amostras.filter((a) => a.erro).length

console.log('\n' + '='.repeat(50))
console.log(`amostras: ${n}`)
console.log(`Connected=true: ${conectado} (${((conectado / n) * 100).toFixed(0)}%)`)
console.log(`LoggedIn=true:  ${logado} (${((logado / n) * 100).toFixed(0)}%)`)
console.log(`erros de rede:  ${erros}`)
