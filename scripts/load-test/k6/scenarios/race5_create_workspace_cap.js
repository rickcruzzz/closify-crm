// Race #5, teto de 1 workspace-como-admin no Free: create_workspace_with_admin
// (migration 0018) conta workspaces onde o usuário é admin e insere workspace
// + membership na mesma função/transação, atômico POR CHAMADA, mas sem lock
// entre chamadas concorrentes. Duas abas clicando "criar empresa" ao mesmo
// tempo (ou um duplo-clique que o debounce do botão não pegou) podem, em
// teoria, ler o mesmo count e ambas passarem.
import { check } from 'k6'
import { rpc, pgGet } from '../lib/pgrest.js'
import { adminDelete, adminCreateUser, adminDeleteUser, loginAs, randomPassword } from '../lib/admin.js'
import { raceAttempts, raceViolations } from '../lib/metrics.js'

const FREE_WORKSPACE_LIMIT = 1

export const options = {
  scenarios: {
    race5: { executor: 'per-vu-iterations', vus: 2, iterations: 1, maxDuration: '30s' },
  },
}

export function setup() {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`
  const email = `race5.${suffix}@velofunil-loadtest.local`
  const senha = randomPassword()

  const user = adminCreateUser(email, senha)
  const session = loginAs(email, senha)

  console.log(`race5: usuário novo ${user.id}, 0 workspaces, 2 create_workspace_with_admin concorrentes`)

  return { userId: user.id, token: { accessToken: session.access_token } }
}

export default function (data) {
  const res = rpc('create_workspace_with_admin', data.token, { workspace_name: `Race5 VU${__VU}` })
  raceAttempts.add(1)
  check(res, { 'criado (200/201) ou rejeitado pelo teto (400)': (r) => r.status < 300 || r.status === 400 })
}

export function teardown(data) {
  const res = pgGet(`/workspace_members?user_id=eq.${data.userId}&role=eq.admin&select=workspace_id`, data.token)
  const workspaceIds = res.json().map((m) => m.workspace_id)

  console.log(`\n=== RACE5, resultado ===`)
  console.log(`  usuário             : ${data.userId}`)
  console.log(`  workspaces como admin: ${workspaceIds.length} (teto Free: ${FREE_WORKSPACE_LIMIT})`)

  if (workspaceIds.length > FREE_WORKSPACE_LIMIT) {
    raceViolations.add(1)
    console.log(`  VIOLADO: ${workspaceIds.length} workspaces criados quando só 1 deveria ser permitido.`)
  } else {
    console.log(`  Não violado nesta execução (probabilística, rodar de novo pode variar).`)
  }

  for (const id of workspaceIds) adminDelete(`/workspaces?id=eq.${id}`)
  adminDeleteUser(data.userId)
  console.log(`  fixture limpo (${workspaceIds.length} workspace(s) e usuário removidos).`)
}
