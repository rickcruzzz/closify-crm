// Race #4, versão mínima do mesmo achado do race3, sem lote: dois INSERTs
// de UMA linha cada, duas transações totalmente separadas, workspace Free
// exatamente em 49/50. O comentário da migration 0023 descreve isto
// literalmente: sob READ COMMITTED, as duas transações podem ler
// count=49 antes de qualquer commit e ambas passarem, terminando em 51/50.
// Isola a mesma brecha do race3 sem a variável de "lote", pra não confundir
// "trigger falha com lote" com "trigger falha mesmo linha a linha".
import { check } from 'k6'
import { pgGet, pgPost } from '../lib/pgrest.js'
import { adminPost, adminDelete, adminCreateUser, adminDeleteUser, loginAs, randomPassword } from '../lib/admin.js'
import { raceAttempts, raceViolations } from '../lib/metrics.js'

const FREE_LEAD_LIMIT = 50
const JA_EXISTENTES = 49

export const options = {
  scenarios: {
    race4: { executor: 'per-vu-iterations', vus: 2, iterations: 1, maxDuration: '30s' },
  },
}

function lead(workspaceId, ownerId, tag) {
  return {
    workspace_id: workspaceId,
    owner_id: ownerId,
    name: `Race4 ${tag}`,
    email: `race4.${tag}.${Date.now()}@velofunil-loadtest.local`,
    phone: '11900000000',
    company: 'Race4 Fixture',
    status: 'novo',
    value: 100,
  }
}

export function setup() {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`
  const email = `race4.admin.${suffix}@velofunil-loadtest.local`
  const senha = randomPassword()

  const user = adminCreateUser(email, senha)
  const workspace = adminPost('/workspaces', {
    name: `Race4 Fixture ${suffix}`,
    plan: 'free',
    created_by: user.id,
  }).json()[0]
  adminPost('/workspace_members', { workspace_id: workspace.id, user_id: user.id, role: 'admin' })

  const preCarga = Array.from({ length: JA_EXISTENTES }, (_, i) => lead(workspace.id, user.id, `pre${i}`))
  const res = adminPost('/leads', preCarga)
  if (res.status >= 300) throw new Error(`pré-carga de ${JA_EXISTENTES} leads falhou: ${res.body}`)

  const session = loginAs(email, senha)
  console.log(`race4: workspace ${workspace.id} com ${JA_EXISTENTES}/${FREE_LEAD_LIMIT} leads, 2 inserts de 1 linha concorrentes`)

  return { workspaceId: workspace.id, userId: user.id, token: { accessToken: session.access_token } }
}

export default function (data) {
  const res = pgPost('/leads', data.token, lead(data.workspaceId, data.userId, `vu${__VU}`))
  raceAttempts.add(1)
  check(res, { 'aceito (201) ou rejeitado pelo trigger (400)': (r) => r.status === 201 || r.status === 400 })
}

export function teardown(data) {
  const res = pgGet(`/leads?workspace_id=eq.${data.workspaceId}&select=id`, data.token)
  const total = res.json().length

  console.log(`\n=== RACE4, resultado ===`)
  console.log(`  workspace   : ${data.workspaceId}`)
  console.log(`  leads finais: ${total} (teto Free: ${FREE_LEAD_LIMIT})`)

  if (total > FREE_LEAD_LIMIT) {
    raceViolations.add(1)
    console.log(`  VIOLADO: ${total}/${FREE_LEAD_LIMIT}, os dois inserts de 1 linha passaram juntos.`)
  } else {
    console.log(`  Não violado nesta execução (probabilística, rodar de novo pode variar).`)
  }

  adminDeleteUser(data.userId)
  adminDelete(`/workspaces?id=eq.${data.workspaceId}`)
  console.log(`  fixture limpo (workspace e usuário removidos).`)
}
