// Trilha C, achado #2: busca de leads usa ILIKE com wildcard à esquerda via
// PostgREST .or(), e não está confirmado se o índice trigram
// (leads_name_trgm_idx) é de fato usado. Este cenário mede a latência sob
// carga; diagnostics/explain-search.mjs confirma via EXPLAIN ANALYZE se o
// índice entra no plano. Os dois juntos fecham a dúvida com evidência.
import { check, sleep } from 'k6'
import { currentProfile, thinkTime } from '../lib/config.js'
import { estresseTenant, randomToken } from '../lib/tenants.js'
import { pgGet } from '../lib/pgrest.js'
import { leadsSearchIlikeDuration } from '../lib/metrics.js'

export const options = {
  ...currentProfile(),
  thresholds: {
    http_req_failed: ['rate<0.01'],
  },
}

const SELECT = 'id,name,email,phone,company,status,value,owner_id,created_at'
const TERMOS = ['ana', 'silva', 'nexo', 'prisma', 'costa', 'vetor']

export default function () {
  // prioriza os workspaces "estresse", busca em 50 leads não prova nada
  // sobre uso de índice, busca em milhares prova.
  const picked = estresseTenant()
  const token = picked ? picked.token : randomToken()
  const termo = TERMOS[Math.floor(Math.random() * TERMOS.length)]

  const filtro = encodeURIComponent(`(name.ilike.*${termo}*,company.ilike.*${termo}*)`)
  const res = pgGet(
    `/leads?workspace_id=eq.${token.workspaceId}&select=${SELECT}&or=${filtro}`,
    token,
    { tags: { query: 'leads_search_ilike' } },
  )

  check(res, { '200': (r) => r.status === 200 })
  leadsSearchIlikeDuration.add(res.timings.duration)

  sleep(thinkTime())
}
