// Trilha C, reproduz a cadeia de createLead (lib/leads/actions.ts:52) como
// chamadas PostgREST separadas: membership check → checagem de plano →
// contagem de leads (canAddLead) → insert. Medir cada perna isolada é MELHOR
// que medir a Server Action ponta a ponta pra diagnóstico: a soma mostra o
// total (create_lead_chain_duration) e cada tag em http_req_duration mostra
// qual perna pesa mais, achado #5 da auditoria (até 5 queries seriais).
//
// Usa só tokens de workspace Pro (sem teto de 50 leads), testar o limite do
// Free sob carga sustentada é o papel de race3/race4, não deste cenário de
// throughput geral.
import { check, sleep } from 'k6'
import { currentProfile, thinkTime } from '../lib/config.js'
import { tokens } from '../lib/tenants.js'
import { pgGet, pgHeadCount, pgPost } from '../lib/pgrest.js'
import { createLeadChainDuration } from '../lib/metrics.js'

const NOMES = ['Ana Silva', 'Bruno Costa', 'Carla Lima', 'Diego Alves', 'Elisa Ramos']
const EMPRESAS = ['Nexo', 'Vetor', 'Prisma', 'Orbita', 'Zenith']
function randomLeadName() {
  return NOMES[Math.floor(Math.random() * NOMES.length)]
}
function randomCompany() {
  return `${EMPRESAS[Math.floor(Math.random() * EMPRESAS.length)]} ${Math.floor(Math.random() * 999)}`
}

export const options = {
  ...currentProfile(),
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    http_req_failed: ['rate<0.01'],
  },
}

const proTokens = tokens.filter((t) => t.plan === 'pro')

export default function () {
  if (proTokens.length === 0) {
    console.error('Nenhum token de workspace Pro em tokens.json, c6 precisa de ao menos um.')
    return
  }
  const token = proTokens[Math.floor(Math.random() * proTokens.length)]
  const inicio = Date.now()

  const membership = pgGet(
    `/workspace_members?select=role&workspace_id=eq.${token.workspaceId}&user_id=eq.${token.id}&limit=1`,
    token,
    { tags: { step: 'membership_check' } },
  )
  const plano = pgGet(`/workspaces?select=plan&id=eq.${token.workspaceId}&limit=1`, token, {
    tags: { step: 'plan_check' },
  })
  const contagem = pgHeadCount(`/leads?workspace_id=eq.${token.workspaceId}&select=id`, token, {
    tags: { step: 'lead_count' },
  })

  const nome = randomLeadName()
  const insercao = pgPost(
    '/leads',
    token,
    {
      workspace_id: token.workspaceId,
      owner_id: token.id,
      name: nome,
      email: `${nome.toLowerCase().replace(/\s+/g, '.')}.${__VU}.${__ITER}@k6loadtest.local`,
      phone: '11900000000',
      company: randomCompany ? randomCompany() : 'K6 Load Test',
      status: 'novo',
      value: 1000,
    },
    { tags: { step: 'insert_lead' } },
  )

  check(membership, { 'membership 200': (r) => r.status === 200 })
  check(plano, { 'plano 200': (r) => r.status === 200 })
  check(contagem, { 'contagem 200': (r) => r.status === 200 })
  check(insercao, { 'insert 201': (r) => r.status === 201 })

  createLeadChainDuration.add(Date.now() - inicio)

  sleep(thinkTime())
}
