// Trilha C, checkout (lib/asaas/actions.ts:createCheckout), com um limite
// honesto: a escrita final (`upsert` em subscriptions) só existe via
// createAdminClient() porque a tabela não tem policy de insert/update pro
// client (migration 0003, de propósito, "subscriptions só deve ser escrito
// por webhook/service role"). O pedido original foi explícito: nenhum
// cenário que simula cliente final usa service_role. Então este cenário mede
// só o que É de fato alcançável como usuário real:
//   1. as leituras da Server Action (RPC is_workspace_admin, select
//      workspace, select subscription existente) via PostgREST com JWT real;
//   2. a cadeia de 3 chamadas HTTP síncronas ao Asaas, aqui, ao stub, que é
//      onde a Server Action fica presa esperando rede externa.
// Não mede o upsert em si. Isso é uma lacuna documentada, não escondida,
// ver docs/load-test/plano-de-teste.md.
//
// Baixa concorrência de propósito: ninguém faz checkout em massa ao mesmo
// tempo, simular 1000 simultâneos aqui não seria um cenário real.
import { check, sleep } from 'k6'
import { thinkTime } from '../lib/config.js'
import { tokens } from '../lib/tenants.js'
import { pgGet, rpc } from '../lib/pgrest.js'
import http from 'k6/http'

const STUB_URL = __ENV.ASAAS_STUB_URL
if (!STUB_URL) {
  throw new Error('ASAAS_STUB_URL não definido. Passe com -e ASAAS_STUB_URL=http://localhost:4040')
}

export const options = {
  vus: Number(__ENV.CHECKOUT_VUS ?? 20),
  duration: __ENV.CHECKOUT_DURATION ?? '1m',
  thresholds: {
    http_req_failed: ['rate<0.01'],
  },
}

export default function () {
  const token = tokens[Math.floor(Math.random() * tokens.length)]

  const isAdmin = rpc(
    'is_workspace_admin',
    token,
    { target_workspace_id: token.workspaceId },
    { tags: { step: 'is_workspace_admin' } },
  )
  const workspace = pgGet(`/workspaces?select=name&id=eq.${token.workspaceId}&limit=1`, token, {
    tags: { step: 'select_workspace' },
  })
  const subscription = pgGet(
    `/subscriptions?select=asaas_customer_id,asaas_subscription_id,status&workspace_id=eq.${token.workspaceId}&limit=1`,
    token,
    { tags: { step: 'select_subscription' } },
  )

  check(isAdmin, { 'is_workspace_admin 200': (r) => r.status === 200 })
  check(workspace, { 'workspace 200': (r) => r.status === 200 })
  check(subscription, { 'subscription 200': (r) => r.status === 200 })

  const customer = http.post(
    `${STUB_URL}/customers`,
    JSON.stringify({ name: 'K6 Load Test', email: token.email, cpfCnpj: '00000000000' }),
    { headers: { 'Content-Type': 'application/json' }, tags: { step: 'asaas_customer' } },
  )
  check(customer, { 'customer 200': (r) => r.status === 200 })

  const sub = http.post(
    `${STUB_URL}/subscriptions`,
    JSON.stringify({ customer: customer.json('id'), billingType: 'UNDEFINED', value: 49 }),
    { headers: { 'Content-Type': 'application/json' }, tags: { step: 'asaas_subscription' } },
  )
  check(sub, { 'subscription-asaas 200': (r) => r.status === 200 })

  const payment = http.get(`${STUB_URL}/payments?subscription=${sub.json('id')}&limit=1`, {
    tags: { step: 'asaas_payment' },
  })
  check(payment, { 'payment 200': (r) => r.status === 200 })

  sleep(thinkTime(2, 5)) // checkout tem think time maior, pessoa lendo o formulário de CPF/CNPJ
}
