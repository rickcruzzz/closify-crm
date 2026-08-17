// Trilha B, cookie real batendo em /kanban. getBoardDeals carrega o board
// inteiro sem paginação (deliberado, dnd-kit precisa de tudo em memória),
// contra os workspaces do grupo "estresse" isso é o pior caso plausível.
import http from 'k6/http'
import { check, sleep } from 'k6'
import { BASE_URL, currentProfile, thinkTime } from '../lib/config.js'
import { randomToken, estresseTenant } from '../lib/tenants.js'
import { authPageDuration } from '../lib/metrics.js'

export const options = {
  ...currentProfile(),
  thresholds: {
    http_req_duration: ['p(95)<1500', 'p(99)<3000'],
    http_req_failed: ['rate<0.01'],
  },
}

export default function () {
  // metade das iterações contra um workspace normal, metade contra um do
  // grupo "estresse" (3-8 mil deals), mistura o caso comum com o pior caso.
  const useEstresse = Math.random() < 0.5
  const estresse = useEstresse ? estresseTenant() : null
  const token = estresse ? estresse.token : randomToken()

  const res = http.get(`${BASE_URL}/kanban`, {
    headers: { Cookie: token.cookieHeader },
    tags: { page: 'kanban', workspace: estresse ? 'estresse' : 'normal' },
  })

  check(res, {
    'status 200': (r) => r.status === 200,
    'não caiu no login': (r) => !r.url.includes('/login'),
  })
  authPageDuration.add(res.timings.duration, {
    page: 'kanban',
    workspace: estresse ? 'estresse' : 'normal',
  })

  sleep(thinkTime())
}
