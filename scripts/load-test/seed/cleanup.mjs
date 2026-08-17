// Apaga tudo que seed.mjs criou no projeto de STAGING, a partir de
// tenants.json. Mesmo padrão de limpeza do __e2efim.mjs: sempre no finally,
// nunca deixa dado de teste para trás.
//
// Uso: node --env-file=scripts/load-test/.env.staging scripts/load-test/seed/cleanup.mjs
import { readFileSync, existsSync, unlinkSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const tenantsPath = new URL('./tenants.json', import.meta.url)
if (!existsSync(tenantsPath)) {
  console.log('Nenhum tenants.json encontrado, nada para limpar.')
  process.exit(0)
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
const tenants = JSON.parse(readFileSync(tenantsPath, 'utf8'))

async function withConcurrency(items, limit, fn) {
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}

async function main() {
  console.log(`Limpando ${tenants.length} workspaces e seus usuários...`)

  // `on delete cascade` (workspace_members, leads, deals, activities) cuida
  // do resto, só workspace e usuários precisam de delete explícito aqui.
  await withConcurrency(tenants, 10, async (tenant, i) => {
    const { error } = await admin.from('workspaces').delete().eq('id', tenant.workspaceId)
    if (error) console.error(`  falha ao apagar workspace ${tenant.workspaceId}:`, error.message)

    for (const user of tenant.users) {
      const { error: userError } = await admin.auth.admin.deleteUser(user.id)
      if (userError) {
        console.error(`  falha ao apagar usuário ${user.email}:`, userError.message)
      }
    }

    if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${tenants.length} workspaces limpos`)
  })

  unlinkSync(tenantsPath)
  const tokensPath = new URL('../auth/tokens.json', import.meta.url)
  if (existsSync(tokensPath)) unlinkSync(tokensPath)

  console.log('\n=== LIMPEZA CONCLUÍDA ===')
  console.log('tenants.json e tokens.json removidos.')
}

main().catch((err) => {
  console.error('\nCLEANUP FALHOU (parcialmente executado):', err.message)
  console.error('Rode de novo, deletes são idempotentes (erro em já-apagado é esperado).')
  process.exit(1)
})
