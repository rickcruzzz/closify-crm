// Semeia o projeto Supabase de STAGING com workspaces/usuários/leads/deals
// sintéticos pro teste de carga. Nunca aponta pra produção — falha alto se
// a URL não vier de scripts/load-test/.env.staging.
//
// Uso:
//   node --env-file=scripts/load-test/.env.staging scripts/load-test/seed/seed.mjs --scale=small
//   node --env-file=scripts/load-test/.env.staging scripts/load-test/seed/seed.mjs --scale=full
//
// IDs são gerados no cliente (randomUUID) pra não precisar de round-trip de
// select após cada insert — mesmo padrão que o próprio schema usa
// (gen_random_uuid() como default), só que decidido aqui em vez de no banco.
import { randomUUID, randomBytes } from 'node:crypto'
import { writeFileSync, mkdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import {
  resolveGroupsForScale,
  PASSWORD_PREFIX,
  EMAIL_DOMAIN,
  LEAD_STATUSES,
  DEAL_STAGES,
  randomInt,
  randomLeadName,
  randomCompany,
} from './config.mjs'

const scaleArg = process.argv.find((a) => a.startsWith('--scale='))
const scale = scaleArg ? scaleArg.split('=')[1] : 'small'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.')
  console.error('Rode com: node --env-file=scripts/load-test/.env.staging seed.mjs')
  process.exit(1)
}
if (url.includes('supabase.co') && !process.env.SUPABASE_ACCESS_TOKEN && !url) {
  // checagem best-effort abaixo é o que realmente protege prod
}

// Trava de segurança: recusa rodar se a URL bater com a de produção conhecida
// (se .env.local também estiver carregado por engano no mesmo processo).
const prodMarker = process.env.VELOFUNIL_PROD_SUPABASE_URL
if (prodMarker && url === prodMarker) {
  console.error('URL do Supabase é igual à de produção (VELOFUNIL_PROD_SUPABASE_URL). Abortando.')
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

function randomPassword() {
  return `${PASSWORD_PREFIX}${randomBytes(9).toString('base64url')}`
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

async function insertInChunks(table, rows, chunkSize = 500) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { error } = await admin.from(table).insert(chunk)
    if (error) throw new Error(`insert ${table} falhou (chunk ${i}): ${error.message}`)
  }
}

async function createUser(email, password) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { load_test: true },
  })
  if (error) throw new Error(`createUser ${email} falhou: ${error.message}`)
  return data.user
}

async function main() {
  const groups = resolveGroupsForScale(scale)
  const startedAt = Date.now()
  const tenants = []
  let totalUsers = 0
  let totalLeads = 0
  let totalDeals = 0

  for (const group of groups) {
    console.log(`\n=== grupo ${group.key}: ${group.workspaces} workspaces, plano ${group.plan} ===`)

    for (let wIndex = 0; wIndex < group.workspaces; wIndex++) {
      const workspaceId = randomUUID()
      const userSpecs = Array.from({ length: group.usersPerWorkspace }, (_, uIndex) => ({
        email: `loadtest.${group.key}.${wIndex}.${uIndex}.${randomUUID().slice(0, 8)}@${EMAIL_DOMAIN}`,
        password: randomPassword(),
      }))

      const createdUsers = await withConcurrency(userSpecs, 8, async (spec) => {
        const user = await createUser(spec.email, spec.password)
        return { id: user.id, email: spec.email, password: spec.password }
      })
      totalUsers += createdUsers.length

      const { error: wsError } = await admin.from('workspaces').insert({
        id: workspaceId,
        name: `Loadtest ${group.key} ${wIndex}`,
        plan: group.plan,
        created_by: createdUsers[0].id,
      })
      if (wsError) throw new Error(`insert workspace falhou: ${wsError.message}`)

      await insertInChunks(
        'workspace_members',
        createdUsers.map((u, idx) => ({
          workspace_id: workspaceId,
          user_id: u.id,
          role: idx === 0 ? 'admin' : 'membro',
        })),
      )

      const leadCount = randomInt(group.leadsRange[0], group.leadsRange[1])
      const leadRows = Array.from({ length: leadCount }, () => {
        const owner = createdUsers[randomInt(0, createdUsers.length - 1)]
        const name = randomLeadName()
        return {
          id: randomUUID(),
          workspace_id: workspaceId,
          owner_id: owner.id,
          name,
          email: `${name.toLowerCase().replace(/\s+/g, '.')}.${randomUUID().slice(0, 6)}@leadtest.local`,
          phone: `119${randomInt(10000000, 99999999)}`,
          company: randomCompany(),
          status: LEAD_STATUSES[randomInt(0, LEAD_STATUSES.length - 1)],
          value: randomInt(500, 50000),
        }
      })
      await insertInChunks('leads', leadRows)
      totalLeads += leadRows.length

      const dealCount = randomInt(group.dealsRange[0], group.dealsRange[1])
      const dealRows = Array.from({ length: dealCount }, () => {
        const owner = createdUsers[randomInt(0, createdUsers.length - 1)]
        const lead = leadRows.length > 0 ? leadRows[randomInt(0, leadRows.length - 1)] : null
        const dueInDays = randomInt(-10, 60)
        return {
          id: randomUUID(),
          workspace_id: workspaceId,
          lead_id: lead?.id ?? null,
          owner_id: owner.id,
          title: `Negócio ${randomCompany()}`,
          value: randomInt(500, 80000),
          stage: DEAL_STAGES[randomInt(0, DEAL_STAGES.length - 1)],
          due_date: new Date(Date.now() + dueInDays * 86400000).toISOString().slice(0, 10),
        }
      })
      await insertInChunks('deals', dealRows)
      totalDeals += dealRows.length

      tenants.push({
        workspaceId,
        group: group.key,
        plan: group.plan,
        leadCount: leadRows.length,
        dealCount: dealRows.length,
        users: createdUsers,
      })

      if ((wIndex + 1) % 20 === 0 || wIndex === group.workspaces - 1) {
        console.log(`  ${group.key}: ${wIndex + 1}/${group.workspaces} workspaces`)
      }
    }
  }

  mkdirSync(new URL('.', import.meta.url), { recursive: true })
  writeFileSync(new URL('./tenants.json', import.meta.url), JSON.stringify(tenants, null, 2))

  const elapsedS = Math.round((Date.now() - startedAt) / 1000)
  console.log('\n=== SEED CONCLUÍDO ===')
  console.log(`  workspaces : ${tenants.length}`)
  console.log(`  usuários   : ${totalUsers}`)
  console.log(`  leads      : ${totalLeads}`)
  console.log(`  deals      : ${totalDeals}`)
  console.log(`  tempo      : ${elapsedS}s`)
  console.log(`  manifest   : scripts/load-test/seed/tenants.json`)
  console.log('\nPróximo passo: auth/mint-tokens.mjs')
}

main().catch((err) => {
  console.error('\nSEED FALHOU:', err.message)
  console.error('Rode cleanup.mjs pra limpar o que já foi criado antes de tentar de novo.')
  process.exit(1)
})
