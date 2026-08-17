// Trilha C, getLeadsPage: paginação cursor real (created_at+id, PAGE_SIZE=25,
// busca 26 pra detectar hasMore). Baseline "isso já está bem feito", pra
// contrastar com c4 (busca) e c5 (kanban sem paginação).
import { check, sleep } from 'k6'
import { currentProfile, thinkTime } from '../lib/config.js'
import { randomToken } from '../lib/tenants.js'
import { pgGet } from '../lib/pgrest.js'

export const options = {
  ...currentProfile(),
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
  },
}

const SELECT = 'id,name,email,phone,company,status,value,owner_id,created_at'

export default function () {
  const token = randomToken()
  const res = pgGet(
    `/leads?workspace_id=eq.${token.workspaceId}&select=${SELECT}&order=created_at.desc,id.desc&limit=26`,
    token,
    { tags: { query: 'leads_list_cursor' } },
  )
  check(res, { '200': (r) => r.status === 200 })
  sleep(thinkTime())
}
