// Trilha C — achado #1, a prova numérica direta. No MESMO workspace do grupo
// "estresse" (3-8 mil deals), mede lado a lado:
//   - raw: select stage cru (o que getFunnelCounts faz, lib/dashboard/queries.ts:55)
//   - rpc: get_dashboard_counts (o padrão que o resto do dashboard já usa)
// Se a hipótese da auditoria estiver certa, funnel_counts_raw_duration >>
// funnel_counts_rpc_duration com a diferença crescendo com o volume de deals.
import { check, sleep } from 'k6'
import { currentProfile, thinkTime } from '../lib/config.js'
import { estresseTenant } from '../lib/tenants.js'
import { pgGet, rpc } from '../lib/pgrest.js'
import { funnelCountsRawDuration, funnelCountsRpcDuration } from '../lib/metrics.js'

export const options = {
  ...currentProfile(),
  thresholds: {
    // sem threshold de latência no "raw" — é esperado que ele estoure,
    // é o próprio objetivo do cenário medir quanto.
    http_req_failed: ['rate<0.01'],
  },
}

export default function () {
  const picked = estresseTenant()
  if (!picked) {
    console.error('Nenhum workspace do grupo "estresse" encontrado em tenants.json/tokens.json')
    return
  }
  const { token } = picked

  const raw = pgGet(`/deals?workspace_id=eq.${token.workspaceId}&select=stage`, token, {
    tags: { query: 'funnel_counts_raw' },
  })
  check(raw, { 'raw 200': (r) => r.status === 200 })
  funnelCountsRawDuration.add(raw.timings.duration)

  const agregada = rpc(
    'get_dashboard_counts',
    token,
    { target_workspace_id: token.workspaceId },
    { tags: { query: 'funnel_counts_rpc' } },
  )
  check(agregada, { 'rpc 200': (r) => r.status === 200 })
  funnelCountsRpcDuration.add(agregada.timings.duration)

  sleep(thinkTime())
}
