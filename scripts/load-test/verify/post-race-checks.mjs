// Os 5 cenários race*.js já verificam e limpam o próprio fixture sozinhos,
// em teardown(), é lá que mora o veredito real de cada corrida ("VIOLADO"
// ou não), impresso no stdout do k6. Este script é só a rede de segurança:
// se um `k6 run` for interrompido (Ctrl+C, crash, timeout) antes do
// teardown rodar, o fixture (workspace + usuários com e-mail
// race{2,3,4,5}.*@velofunil-loadtest.local) fica órfão no staging. Varre e
// limpa isso, "nunca deixar dado de teste pra trás" vale mesmo quando o
// teste morre no meio.
//
// Uso: node --env-file=scripts/load-test/.env.staging scripts/load-test/verify/post-race-checks.mjs
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

async function main() {
  console.log('Varrendo fixtures órfãos de race2-5 (workspaces "RaceN Fixture ..." e usuários raceN.*)...')

  const { data: workspaces, error: wsError } = await admin
    .from('workspaces')
    .select('id, name')
    .or('name.ilike.Race2 Fixture%,name.ilike.Race3 Fixture%,name.ilike.Race4 Fixture%,name.ilike.Race5 VU%')

  if (wsError) throw new Error(`select workspaces falhou: ${wsError.message}`)

  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const orfaos = (users?.users ?? []).filter((u) => /^race[2345]\./.test(u.email ?? ''))

  if (workspaces.length === 0 && orfaos.length === 0) {
    console.log('Nada órfão encontrado. Todas as corridas limparam depois de si.')
    return
  }

  console.log(`Encontrados: ${workspaces.length} workspace(s), ${orfaos.length} usuário(s) órfão(s).`)

  for (const ws of workspaces) {
    const { error } = await admin.from('workspaces').delete().eq('id', ws.id)
    console.log(`  workspace "${ws.name}" (${ws.id}): ${error ? 'FALHOU, ' + error.message : 'removido'}`)
  }

  for (const u of orfaos) {
    const { error } = await admin.auth.admin.deleteUser(u.id)
    console.log(`  usuário ${u.email}: ${error ? 'FALHOU, ' + error.message : 'removido'}`)
  }

  console.log('\nVarredura concluída.')
}

main().catch((err) => {
  console.error('POST-RACE-CHECKS FALHOU:', err.message)
  process.exit(1)
})
