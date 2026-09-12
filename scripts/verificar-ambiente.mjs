/**
 * Confere se o ambiente local está completo e conectado.
 *
 * Existe porque um `.env.local` incompleto falha de formas confusas: o Asaas
 * responde 401 como se a chave estivesse errada, o Resend aceita a chave mas
 * recusa o envio por falta de domínio verificado, e nada disso aparece até
 * alguém tentar usar. Este script pergunta a cada serviço diretamente.
 *
 * Uso: node --env-file=.env.local scripts/verificar-ambiente.mjs
 *
 * Não escreve nada em lugar nenhum, só lê. Pode rodar à vontade.
 */

import { readFileSync } from 'node:fs'

const resultados = []
const ok = (nome, detalhe) => resultados.push({ nome, estado: 'ok', detalhe })
const falha = (nome, detalhe) => resultados.push({ nome, estado: 'falha', detalhe })

function exigir(nome) {
  const v = (process.env[nome] ?? '').trim()
  if (!v) {
    falha(nome, 'ausente ou vazia no .env.local')
    return null
  }
  return v
}

// --- Variáveis presentes ---
const SB = exigir('NEXT_PUBLIC_SUPABASE_URL')
const ANON =
  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim() ||
  (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '').trim()
if (!ANON) falha('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'ausente ou vazia no .env.local')
const SRV = exigir('SUPABASE_SERVICE_ROLE_KEY')
// A chave do Asaas costuma ser gravada com uma barra invertida antes do `$`,
// que o carregador de .env do Next interpreta e o `--env-file` do Node não.
const ASAAS = (exigir('ASAAS_API_KEY') ?? '').replace(/^\\/, '')
const WEBHOOK = exigir('ASAAS_WEBHOOK_TOKEN')

/**
 * ## A barra AUSENTE, que este script nao detectava — 12/09
 *
 * A linha acima trata a barra PRESENTE. O caso oposto passava limpo, e ele e
 * pior: a chave do Asaas comeca com `$aact_`, e o `dotenv-expand` que o
 * Next usa le isso como referencia a uma variavel inexistente e substitui por
 * **string vazia**.
 *
 * O `--env-file` do Node NAO expande. Ou seja: este script lia os 166
 * caracteres, respondia "tudo certo", e o app nao conseguia falar com o
 * gateway — a Central mostrando "Asaas fora do ar" e o vigia sem conferir
 * dinheiro, enquanto o verificador de ambiente concordava com o estado errado.
 *
 * Aconteceu entre 11/09 e 12/09 e custou uma investigacao inteira, justamente
 * porque o instrumento de diagnostico dizia que estava tudo bem.
 *
 * A conferencia NAO pode ser feita sobre o valor ja carregado — ele chega
 * normalizado pelos dois lados. Tem que ser sobre o texto cru do arquivo, que
 * e onde a barra existe ou nao.
 */
try {
  const cru = readFileSync('.env.local', 'utf-8')
  const linha = cru
    .split(String.fromCharCode(10))
    .find((l) => l.startsWith('ASAAS_API_KEY='))
  const valorCru = linha?.slice('ASAAS_API_KEY='.length) ?? ''
  if (valorCru.startsWith('$')) {
    falha(
      'ASAAS_API_KEY',
      'comeca com `$` SEM escape no .env.local. O Next usa dotenv-expand e ' +
        'transforma isso em string VAZIA: o app perde o Asaas e o `--env-file` ' +
        'do Node nao reproduz. Escreva `\$aact_...` no arquivo.',
    )
  } else if (valorCru.startsWith('\\$')) {
    ok('ASAAS_API_KEY', 'escapada como `\$aact_`, que e a forma que o Next entende')
  }
} catch {
  // Sem `.env.local` nao ha o que conferir: o `exigir()` acima ja reclama.
}

const RESEND = exigir('RESEND_API_KEY')
const APP_URL = exigir('NEXT_PUBLIC_APP_URL')

// --- Supabase ---
if (SB && ANON) {
  const r = await fetch(`${SB}/rest/v1/workspaces?select=id&limit=1`, {
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
  })
  r.ok
    ? ok('Supabase REST', `HTTP ${r.status}`)
    : falha('Supabase REST', `HTTP ${r.status}`)

  const a = await fetch(`${SB}/auth/v1/health`, { headers: { apikey: ANON } })
  a.ok
    ? ok('Supabase Auth', `HTTP ${a.status}`)
    : falha('Supabase Auth', `HTTP ${a.status}`)
}

if (SB && SRV) {
  const r = await fetch(`${SB}/rest/v1/workspaces?select=id&limit=1`, {
    headers: { apikey: SRV, Authorization: `Bearer ${SRV}` },
  })
  r.ok
    ? ok('Service role', `HTTP ${r.status}`)
    : falha('Service role', `HTTP ${r.status}`)
}

// --- Asaas ---
if (ASAAS) {
  const r = await fetch('https://api.asaas.com/v3/webhooks', {
    headers: { access_token: ASAAS },
  })
  if (!r.ok) {
    falha('Asaas API', `HTTP ${r.status}, chave inválida ou revogada`)
  } else {
    const j = await r.json()
    const w = j.data?.[0]
    ok('Asaas API', `HTTP ${r.status}`)
    if (!w) {
      falha('Asaas webhook', 'nenhum webhook cadastrado, pagamento não libera o Pro')
    } else {
      const problemas = []
      if (!w.url?.includes('velofunil.com.br')) problemas.push(`URL aponta para ${w.url}`)
      if (!w.hasAuthToken) problemas.push('sem token de autenticação')
      if (!w.enabled) problemas.push('desativado')
      if (w.interrupted) problemas.push('interrompido pelo Asaas')
      problemas.length
        ? falha('Asaas webhook', problemas.join('; '))
        : ok('Asaas webhook', `${w.url} · ${w.penalizedRequestsCount ?? 0} falhas`)
    }
  }
}

// --- Resend ---
if (RESEND) {
  const r = await fetch('https://api.resend.com/domains', {
    headers: { Authorization: `Bearer ${RESEND}` },
  })
  if (!r.ok) {
    falha('Resend', `HTTP ${r.status}, chave inválida`)
  } else {
    const j = await r.json()
    const d = (j.data ?? []).find((x) => x.name === 'velofunil.com.br')
    if (!d) {
      // Chave válida de uma conta sem o domínio é o caso mais traiçoeiro: a
      // API responde 200 e todo envio falha depois, por domínio não verificado.
      falha(
        'Resend',
        `chave válida, mas sem o domínio velofunil.com.br (${j.data?.length ?? 0} domínio(s)), todo envio falharia`,
      )
    } else {
      d.status === 'verified'
        ? ok('Resend', `velofunil.com.br verificado (${d.region})`)
        : falha('Resend', `domínio em estado "${d.status}"`)
    }
  }
}

// --- Webhook em produção ---
{
  const url = 'https://www.velofunil.com.br/api/webhooks/asaas'
  const corpo = JSON.stringify({ id: 'ping', event: 'PING' })
  const sem = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: corpo,
  })
  sem.status === 401
    ? ok('Webhook em produção', 'recusa requisição sem token (401)')
    : falha('Webhook em produção', `deveria dar 401 sem token, deu ${sem.status}`)

  if (WEBHOOK) {
    const com = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'asaas-access-token': WEBHOOK },
      body: corpo,
    })
    com.ok
      ? ok('Token do webhook', `aceito em produção (HTTP ${com.status})`)
      : falha('Token do webhook', `produção recusou o token local (HTTP ${com.status})`)
  }
}

// --- Site ---
{
  const r = await fetch(`https://www.velofunil.com.br/?nc=${Date.now()}`)
  r.ok
    ? ok('Site em produção', `HTTP ${r.status}`)
    : falha('Site em produção', `HTTP ${r.status}`)
}

// --- Relatório ---
console.log('')
for (const r of resultados) {
  console.log(
    `  ${r.estado === 'ok' ? 'OK  ' : 'FALHA'} ${r.nome.padEnd(22)} ${r.detalhe}`,
  )
}
const falhas = resultados.filter((r) => r.estado === 'falha')
console.log('')
console.log(
  falhas.length === 0
    ? `TUDO CONECTADO (${resultados.length}/${resultados.length})`
    : `${falhas.length} PROBLEMA(S) de ${resultados.length} verificações`,
)
console.log(`APP_URL configurada: ${APP_URL ?? '(ausente)'}`)
process.exit(falhas.length ? 1 : 0)
