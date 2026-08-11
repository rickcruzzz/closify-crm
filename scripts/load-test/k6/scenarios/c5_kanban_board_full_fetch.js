// Trilha C — getBoardDeals: busca o board inteiro sem paginação, deliberado
// (dnd-kit precisa de tudo em memória, ver lib/deals/queries.ts:24-28).
// Quantifica "cresce sem limite" contra os workspaces do grupo "estresse".
import { check, sleep } from 'k6'
import { currentProfile, thinkTime } from '../lib/config.js'
import { estresseTenant } from '../lib/tenants.js'
import { pgGet, rpc } from '../lib/pgrest.js'
import { kanbanBoardFetchDuration } from '../lib/metrics.js'

export const options = {
  ...currentProfile(),
  thresholds: {
    http_req_failed: ['rate<0.01'],
  },
}

const SELECT = 'id,title,lead_id,value,stage,due_date,created_at,owner_id'

export default function () {
  const picked = estresseTenant()
  if (!picked) {
    console.error('Nenhum workspace do grupo "estresse" encontrado')
    return
  }
  const { token } = picked

  const deals = pgGet(
    `/deals?workspace_id=eq.${token.workspaceId}&select=${SELECT}&order=created_at.desc`,
    token,
    { tags: { query: 'kanban_board_full_fetch' } },
  )
  check(deals, { '200': (r) => r.status === 200 })
  kanbanBoardFetchDuration.add(deals.timings.duration)

  // getBoardDeals resolve nomes de owner em lote via RPC depois do select —
  // reproduz o segundo round-trip real, não só o maior.
  const owners = rpc(
    'get_workspace_member_names',
    token,
    { target_workspace_id: token.workspaceId, target_user_ids: [token.id] },
    { tags: { query: 'kanban_owner_names' } },
  )
  check(owners, { 'owners 200': (r) => r.status === 200 })

  sleep(thinkTime())
}
