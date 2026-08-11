// Trilha C — o padrão BOM do dashboard: get_dashboard_counts e
// get_open_pipeline_value agregam no Postgres (RPC), não trazem linha por
// linha pro client. Baseline de comparação para c2 (achado #1).
import { check, sleep } from 'k6'
import { currentProfile, thinkTime } from '../lib/config.js'
import { randomToken } from '../lib/tenants.js'
import { rpc } from '../lib/pgrest.js'

export const options = {
  ...currentProfile(),
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
  },
}

export default function () {
  const token = randomToken()
  const args = { target_workspace_id: token.workspaceId }

  const counts = rpc('get_dashboard_counts', token, args, { tags: { rpc: 'get_dashboard_counts' } })
  const pipeline = rpc('get_open_pipeline_value', token, args, {
    tags: { rpc: 'get_open_pipeline_value' },
  })

  check(counts, { 'counts 200': (r) => r.status === 200 })
  check(pipeline, { 'pipeline 200': (r) => r.status === 200 })

  sleep(thinkTime())
}
