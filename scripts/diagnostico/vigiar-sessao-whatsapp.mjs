/**
 * Vigia a estabilidade da sessão do WhatsApp e grava um CSV.
 *
 * Existe porque a pergunta "dá para vender WhatsApp?" não se responde com uma
 * leitura: medido em 23/08, a sessão ficava logada 63% do tempo, oscilando a
 * cada poucos segundos. Uma amostra isolada diria "conectado" ou "caído" e as
 * duas seriam verdade — só a série ao longo de horas separa oscilação passageira
 * de sessão que o WhatsApp está derrubando de propósito.
 *
 *   node --env-file=.env.local scripts/diagnostico/vigiar-sessao-whatsapp.mjs [horas]
 *
 * Grava `.diagnostico-whatsapp.csv` (fora do Git) com uma linha por amostra, e
 * imprime só as MUDANÇAS de estado — o resto é ruído e encheria o terminal.
 */
import { createClient } from '@supabase/supabase-js'
import { createDecipheriv } from 'node:crypto'
import { appendFileSync, existsSync, writeFileSync } from 'node:fs'

const HORAS = Number(process.argv[2] ?? 24)
const INTERVALO_MS = 30_000
const ARQUIVO = '.diagnostico-whatsapp.csv'
const PREFIXO_BYTEA = String.fromCharCode(92) + 'x'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const servidor = process.env.EVOLUTION_API_URL

function decifrar(valor) {
  const hex = valor.startsWith(PREFIXO_BYTEA) ? valor.slice(2) : valor
  const bytes = Buffer.from(hex, 'hex')
  const d = createDecipheriv('aes-256-gcm', Buffer.from(process.env.INTEGRATIONS_ENCRYPTION_KEY, 'hex'), bytes.subarray(0, 12))
  d.setAuthTag(bytes.subarray(12, 28))
  return Buffer.concat([d.update(bytes.subarray(28)), d.final()]).toString('utf8')
}

const { data: conexoes } = await supabase
  .from('integration_connections')
  .select('external_id, access_token_enc')
  .eq('provider', 'whatsapp')
  .order('updated_at', { ascending: false })
  .limit(1)

if (!conexoes?.length) {
  console.log('nenhuma conexão de WhatsApp no banco — nada a vigiar')
  process.exit(0)
}

const token = decifrar(conexoes[0].access_token_enc)
if (!existsSync(ARQUIVO)) writeFileSync(ARQUIVO, 'instante,connected,logged_in,latencia_ms\n', 'utf8')

const fim = Date.now() + HORAS * 3600_000
let anterior = ''
let amostras = 0
let logadas = 0

console.log(`vigiando ${conexoes[0].external_id.slice(0, 8)} por ${HORAS}h, amostra a cada ${INTERVALO_MS / 1000}s`)

while (Date.now() < fim) {
  const t = Date.now()
  let connected = null
  let loggedIn = null
  try {
    const r = await fetch(servidor + '/instance/status', { headers: { apikey: token }, cache: 'no-store' })
    const j = await r.json()
    connected = j?.data?.Connected ?? null
    loggedIn = j?.data?.LoggedIn ?? null
  } catch {
    // Falha de rede é dado, não erro: entra no CSV como célula vazia para a
    // série não ganhar um buraco silencioso.
  }
  const latencia = Date.now() - t
  const instante = new Date().toISOString()
  appendFileSync(ARQUIVO, `${instante},${connected ?? ''},${loggedIn ?? ''},${latencia}\n`, 'utf8')

  amostras += 1
  if (loggedIn === true) logadas += 1
  const estado = `Connected=${connected} LoggedIn=${loggedIn}`
  if (estado !== anterior) {
    console.log(`${instante.slice(11, 19)}  ${estado}  (logada em ${logadas}/${amostras} = ${Math.round((logadas / amostras) * 100)}%)`)
    anterior = estado
  }
  await new Promise((r) => setTimeout(r, INTERVALO_MS))
}

console.log(`\nfim: ${logadas}/${amostras} amostras logadas (${Math.round((logadas / amostras) * 100)}% do período)`)
