// Trilha B, cookie de sessão real batendo em /dashboard. Mede o custo real
// do middleware (auth.getUser() sempre revalida contra o Auth server) mais as
// 5-7 idas ao Postgres que getDashboardMetrics/getFunnelCounts/getUpcomingDeals
// disparam por carregamento (achado #3 e #1 da auditoria).
import http from 'k6/http'
import { check, sleep } from 'k6'
import { BASE_URL, currentProfile, thinkTime } from '../lib/config.js'
import { randomToken } from '../lib/tenants.js'
import { authPageDuration } from '../lib/metrics.js'

export const options = {
  ...currentProfile(),
  thresholds: {
    http_req_duration: ['p(95)<800', 'p(99)<1500'],
    http_req_failed: ['rate<0.01'],
  },
}

export default function () {
  const token = randomToken()
  const res = http.get(`${BASE_URL}/dashboard`, {
    headers: { Cookie: token.cookieHeader },
    tags: { page: 'dashboard' },
  })

  check(res, {
    'status 200': (r) => r.status === 200,
    'não caiu no login': (r) => !r.url.includes('/login'),
  })
  authPageDuration.add(res.timings.duration, { page: 'dashboard' })

  sleep(thinkTime())
}
