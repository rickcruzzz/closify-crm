// Stub HTTP puro (node:http, sem dependências) da API do Asaas — só os 4
// endpoints que lib/asaas/actions.ts realmente chama (confirmado lendo o
// arquivo, não suposto): POST /customers, PUT /customers/:id,
// POST /subscriptions, DELETE /subscriptions/:id, GET /payments.
//
// Existe porque o teste de carga não pode gerar tráfego real contra a API de
// pagamento de produção — nem em staging: ASAAS_API_KEY continua sendo a
// chave real (não existe "Asaas de staging" nesta conta). Apontar
// ASAAS_API_URL pra este servidor local intercepta as 3-4 chamadas HTTP
// síncronas que createCheckout/cancelSubscription fazem, sem tocar o Asaas de
// verdade.
//
// Uso: ASAAS_API_URL precisa apontar pra cá em .env.staging, ex:
//   ASAAS_API_URL=http://localhost:4040
//   ASAAS_API_KEY=stub-nao-precisa-ser-real
//
// Rodar: node scripts/load-test/asaas-stub/server.mjs
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'

const PORT = Number(process.env.ASAAS_STUB_PORT ?? 4040)
// Asaas real não responde instantâneo — simula pra não fingir que a cadeia
// síncrona de createCheckout (2-3 chamadas) é mais rápida do que é.
const LATENCY_MS = Number(process.env.ASAAS_STUB_LATENCY_MS ?? 150)

let requestCount = 0
const bySubscription = new Map() // subscriptionId -> paymentId, pra /payments devolver algo estável

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = ''
    req.on('data', (chunk) => (raw += chunk))
    req.on('end', () => resolve(raw))
  })
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

const server = createServer(async (req, res) => {
  requestCount++
  await sleep(LATENCY_MS)

  const url = new URL(req.url, `http://localhost:${PORT}`)
  const { pathname, searchParams } = url

  if (req.method === 'POST' && pathname === '/customers') {
    await readBody(req)
    return json(res, 200, { id: `cus_stub_${randomUUID()}` })
  }

  if (req.method === 'PUT' && pathname.startsWith('/customers/')) {
    await readBody(req)
    return json(res, 200, { id: pathname.split('/').pop() })
  }

  if (req.method === 'POST' && pathname === '/subscriptions') {
    await readBody(req)
    const id = `sub_stub_${randomUUID()}`
    bySubscription.set(id, `pay_stub_${randomUUID()}`)
    return json(res, 200, { id })
  }

  if (req.method === 'DELETE' && pathname.startsWith('/subscriptions/')) {
    const id = pathname.split('/').pop()
    bySubscription.delete(id)
    return json(res, 200, { id, deleted: true })
  }

  if (req.method === 'GET' && pathname === '/payments') {
    const subscriptionId = searchParams.get('subscription')
    const paymentId = bySubscription.get(subscriptionId) ?? `pay_stub_${randomUUID()}`
    return json(res, 200, {
      data: [
        {
          id: paymentId,
          invoiceUrl: `http://localhost:${PORT}/fake-invoice/${paymentId}`,
        },
      ],
    })
  }

  if (pathname.startsWith('/fake-invoice/')) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    return res.end('Fatura falsa do stub — só existe pra createCheckout ter URL válida.')
  }

  json(res, 404, { error: `Stub não implementa ${req.method} ${pathname}` })
})

server.listen(PORT, () => {
  console.log(`Stub do Asaas em http://localhost:${PORT} (latência ${LATENCY_MS}ms)`)
  console.log('Aponte ASAAS_API_URL pra esta URL em scripts/load-test/.env.staging')
})

process.on('SIGINT', () => {
  console.log(`\nStub encerrado. ${requestCount} requisições atendidas.`)
  process.exit(0)
})
