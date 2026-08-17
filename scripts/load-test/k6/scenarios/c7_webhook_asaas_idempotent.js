// Trilha C, bate direto no /api/webhooks/asaas real (é seguro: o handler
// nunca chama a Asaas de volta, confirmado lendo app/api/webhooks/asaas/route.ts
// por inteiro, token validado, insert de dedupe, RPC transacional, no máximo
// 3 queries por evento). subscription_id sintético não bate com nenhuma
// assinatura real semeada, a resposta esperada é 200 { matched: false },
// que já exercita o caminho inteiro (token → parse → dedupe → RPC).
//
// Exige ASAAS_WEBHOOK_TOKEN via -e (o mesmo valor de scripts/load-test/.env.staging).
import http from 'k6/http'
import { check, sleep } from 'k6'
import { BASE_URL, currentProfile, thinkTime } from '../lib/config.js'

const WEBHOOK_TOKEN = __ENV.ASAAS_WEBHOOK_TOKEN
if (!WEBHOOK_TOKEN) {
  throw new Error('ASAAS_WEBHOOK_TOKEN não definido. Passe com -e ASAAS_WEBHOOK_TOKEN=...')
}

export const options = {
  ...currentProfile(),
  thresholds: {
    http_req_duration: ['p(95)<300', 'p(99)<600'],
    http_req_failed: ['rate<0.01'],
  },
}

const EVENTOS = ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'PAYMENT_OVERDUE']

export default function () {
  const eventId = `k6-${__VU}-${__ITER}-${Date.now()}`
  const evento = EVENTOS[Math.floor(Math.random() * EVENTOS.length)]

  const payload = {
    id: eventId,
    event: evento,
    payment: {
      id: `pay_k6_${eventId}`,
      subscription: `sub_k6_${__VU}_${__ITER}`,
    },
  }

  const res = http.post(`${BASE_URL}/api/webhooks/asaas`, JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json', 'asaas-access-token': WEBHOOK_TOKEN },
    tags: { name: 'webhook_asaas' },
  })

  check(res, { '200': (r) => r.status === 200 })

  sleep(thinkTime(0.2, 0.5)) // webhook não tem think time humano, mas evita rajada em loop fechado
}
