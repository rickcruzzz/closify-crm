// Race #2 — teto de membros do Free: accept_workspace_invite (migration
// 0011/0012) trava com `SELECT ... FOR UPDATE` só a linha do PRÓPRIO
// convite. O teto de 2 membros é `SELECT count(*)` sem lock — dois convites
// DIFERENTES do mesmo workspace, aceitos por dois usuários diferentes ao
// mesmo tempo, podem ambos ler count=1 (abaixo do teto) e ambos passar.
//
// Fixture isolado (service_role só aqui, em setup/teardown — nunca na
// corrida em si, que usa os JWTs reais dos 2 usuários novos): pega um
// workspace Free do grupo "solo" (1 membro, teto 2) já semeado, cria 2
// usuários novos e 2 convites pendentes pra eles.
import { check } from 'k6'
import { rpc, pgGet } from '../lib/pgrest.js'
import { adminPost, adminDelete, adminCreateUser, adminDeleteUser, loginAs, randomPassword } from '../lib/admin.js'
import { tenants } from '../lib/tenants.js'
import { raceAttempts, raceViolations } from '../lib/metrics.js'

const FREE_MEMBER_LIMIT = 2

export const options = {
  scenarios: {
    race2: { executor: 'per-vu-iterations', vus: 2, iterations: 1, maxDuration: '30s' },
  },
}

export function setup() {
  const solo = tenants.find((t) => t.group === 'solo' && t.plan === 'free')
  if (!solo) throw new Error('Nenhum workspace do grupo "solo" em tenants.json — rode o seed primeiro')

  const adminUserId = solo.users[0].id
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`
  const emailA = `race2.a.${suffix}@velofunil-loadtest.local`
  const emailB = `race2.b.${suffix}@velofunil-loadtest.local`
  const senha = randomPassword()

  const userA = adminCreateUser(emailA, senha)
  const userB = adminCreateUser(emailB, senha)

  const inviteA = adminPost('/workspace_invites', {
    workspace_id: solo.workspaceId,
    email: emailA,
    role: 'membro',
    invited_by: adminUserId,
  }).json()[0]
  const inviteB = adminPost('/workspace_invites', {
    workspace_id: solo.workspaceId,
    email: emailB,
    role: 'membro',
    invited_by: adminUserId,
  }).json()[0]

  const sessionA = loginAs(emailA, senha)
  const sessionB = loginAs(emailB, senha)

  console.log(`race2: workspace ${solo.workspaceId} (1/${FREE_MEMBER_LIMIT} membros), 2 convites concorrentes`)

  return {
    workspaceId: solo.workspaceId,
    a: { userId: userA.id, inviteId: inviteA.id, inviteToken: inviteA.token, token: { accessToken: sessionA.access_token } },
    b: { userId: userB.id, inviteId: inviteB.id, inviteToken: inviteB.token, token: { accessToken: sessionB.access_token } },
  }
}

export default function (data) {
  const mine = __VU === 1 ? data.a : data.b
  const res = rpc('accept_workspace_invite', mine.token, { invite_token: mine.inviteToken })
  raceAttempts.add(1)
  check(res, { 'aceito (200) ou rejeitado com erro claro (400)': (r) => r.status === 200 || r.status === 400 })
}

export function teardown(data) {
  const membersRes = pgGet(`/workspace_members?workspace_id=eq.${data.workspaceId}&select=user_id`, data.a.token)
  const total = membersRes.json().length

  console.log(`\n=== RACE2 — resultado ===`)
  console.log(`  workspace     : ${data.workspaceId}`)
  console.log(`  membros finais: ${total} (teto Free: ${FREE_MEMBER_LIMIT})`)

  if (total > FREE_MEMBER_LIMIT) {
    raceViolations.add(1)
    console.log(`  VIOLADO: workspace Free terminou com ${total} membros, overshoot de ${total - FREE_MEMBER_LIMIT}.`)
  } else {
    console.log(`  Não violado nesta execução (a corrida é probabilística — rodar de novo pode variar).`)
  }

  // limpeza: cascade em workspace_members ao apagar os usuários novos; a
  // invite acompanha se ainda existir.
  adminDeleteUser(data.a.userId)
  adminDeleteUser(data.b.userId)
  adminDelete(`/workspace_invites?id=eq.${data.a.inviteId}`)
  adminDelete(`/workspace_invites?id=eq.${data.b.inviteId}`)
  console.log(`  fixture limpo (2 usuários e 2 convites removidos).`)
}
