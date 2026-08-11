// Race #3 — teto de leads sob IMPORTAÇÃO EM LOTE: o trigger
// checar_limite_de_leads (migration 0023) é `before insert for each row`, e
// DENTRO de uma única instrução/transação ele é seguro — cada linha vê o
// count já incluindo as linhas anteriores do mesmo lote. A brecha é ENTRE
// duas transações concorrentes: o próprio comentário do código
// (lib/leads/actions.ts:243-247) documenta que duas importações simultâneas
// no mesmo workspace podem ambas ler o mesmo count e ambas inserirem o que
// acham que cabe, estourando o teto.
//
// Fixture isolado num workspace Free NOVO, pré-carregado com 45/50 leads:
// 2 lotes concorrentes de 5 linhas cada — se o teto (50) segurar de verdade
// entre transações, só um lote deveria passar inteiro.
import { check } from 'k6'
import { pgGet, pgPost } from '../lib/pgrest.js'
import { adminPost, adminDelete, adminCreateUser, adminDeleteUser, loginAs, randomPassword } from '../lib/admin.js'
import { raceAttempts, raceViolations } from '../lib/metrics.js'

const FREE_LEAD_LIMIT = 50
const JA_EXISTENTES = 45
const LOTE = 5

export const options = {
  scenarios: {
    race3: { executor: 'per-vu-iterations', vus: 2, iterations: 1, maxDuration: '30s' },
  },
}

function leadsBatch(workspaceId, ownerId, quantidade, prefixo) {
  return Array.from({ length: quantidade }, (_, i) => ({
    workspace_id: workspaceId,
    owner_id: ownerId,
    name: `Race3 ${prefixo} ${i}`,
    email: `race3.${prefixo}.${i}.${Date.now()}@velofunil-loadtest.local`,
    phone: '11900000000',
    company: 'Race3 Fixture',
    status: 'novo',
    value: 100,
  }))
}

export function setup() {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`
  const email = `race3.admin.${suffix}@velofunil-loadtest.local`
  const senha = randomPassword()

  const user = adminCreateUser(email, senha)
  const workspace = adminPost('/workspaces', {
    name: `Race3 Fixture ${suffix}`,
    plan: 'free',
    created_by: user.id,
  }).json()[0]
  adminPost('/workspace_members', { workspace_id: workspace.id, user_id: user.id, role: 'admin' })

  const preCarga = adminPost('/leads', leadsBatch(workspace.id, user.id, JA_EXISTENTES, 'inicial'))
  if (preCarga.status >= 300) {
    throw new Error(`pré-carga de ${JA_EXISTENTES} leads falhou: ${preCarga.body}`)
  }

  const session = loginAs(email, senha)
  console.log(
    `race3: workspace ${workspace.id} com ${JA_EXISTENTES}/${FREE_LEAD_LIMIT} leads, 2 lotes de ${LOTE} concorrentes`,
  )

  return {
    workspaceId: workspace.id,
    userId: user.id,
    token: { accessToken: session.access_token },
  }
}

export default function (data) {
  const lote = leadsBatch(data.workspaceId, data.userId, LOTE, `vu${__VU}`)
  const res = pgPost('/leads', data.token, lote)
  raceAttempts.add(1)
  check(res, { 'lote aceito (201) ou rejeitado pelo trigger (400/23505)': (r) => r.status === 201 || r.status >= 400 })
}

export function teardown(data) {
  const res = pgGet(`/leads?workspace_id=eq.${data.workspaceId}&select=id`, data.token)
  const total = res.json().length

  console.log(`\n=== RACE3 — resultado ===`)
  console.log(`  workspace   : ${data.workspaceId}`)
  console.log(`  leads finais: ${total} (teto Free: ${FREE_LEAD_LIMIT})`)

  if (total > FREE_LEAD_LIMIT) {
    raceViolations.add(1)
    console.log(`  VIOLADO: overshoot de ${total - FREE_LEAD_LIMIT} leads acima do teto, entre lotes concorrentes.`)
  } else {
    console.log(`  Não violado nesta execução (probabilística — rodar de novo pode variar).`)
  }

  adminDeleteUser(data.userId)
  adminDelete(`/workspaces?id=eq.${data.workspaceId}`)
  console.log(`  fixture limpo (workspace e usuário removidos).`)
}
