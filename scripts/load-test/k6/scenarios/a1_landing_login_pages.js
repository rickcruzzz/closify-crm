// Trilha A, HTTP anônimo, sem sessão. Mede o custo puro de Next.js servindo
// HTML sob carga, fora do matcher do middleware (landing/login ficam de fora
// dele de propósito, ver middleware.ts, regressão de ~275ms de TTFB medida
// quando o matcher cobria `/`).
import http from 'k6/http'
import { check, sleep } from 'k6'
import { BASE_URL, currentProfile, thinkTime } from '../lib/config.js'
import { anonPageDuration } from '../lib/metrics.js'

export const options = {
  ...currentProfile(),
  thresholds: {
    http_req_duration: ['p(95)<800', 'p(99)<1500'],
    http_req_failed: ['rate<0.01'],
  },
}

const PAGINAS = ['/', '/login', '/cadastro']

export default function () {
  const path = PAGINAS[Math.floor(Math.random() * PAGINAS.length)]
  const res = http.get(`${BASE_URL}${path}`, { tags: { page: path } })

  check(res, { 'status 200': (r) => r.status === 200 })
  anonPageDuration.add(res.timings.duration, { page: path })

  sleep(thinkTime())
}
