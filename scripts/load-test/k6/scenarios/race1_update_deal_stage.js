// Race #1 — kanban: updateDealStage (lib/deals/actions.ts:96) faz um UPDATE
// incondicional (sem WHERE stage=esperado, sem coluna de versão, sem lock).
// Diferente de race2-5, aqui NÃO existe um teto sendo violado — é
// demonstração de ausência de controle de concorrência: N VUs escrevem
// estágios diferentes no MESMO deal ao mesmo tempo, e quem o Postgres
// serializar por último vence, silenciosamente, sem avisar quem perdeu (sem
// Realtime no board). O "veredito" aqui é descritivo, não pass/fail.
import { check } from 'k6'
import { pgGet, pgPatch } from '../lib/pgrest.js'
import { randomToken } from '../lib/tenants.js'
import { raceAttempts } from '../lib/metrics.js'

const CONCORRENCIA = Number(__ENV.RACE_VUS ?? 8)

export const options = {
  scenarios: {
    race1: {
      // per-vu-iterations com iterations:1 garante exatamente 1 escrita por
      // VU, todas largando juntas — shared-iterations não garante 1:1 (um VU
      // rápido pode consumir 2 iterações e deixar outro com 0).
      executor: 'per-vu-iterations',
      vus: CONCORRENCIA,
      iterations: 1,
      maxDuration: '30s',
    },
  },
}

const STAGES = [
  'novo',
  'contato_realizado',
  'proposta_enviada',
  'negociacao',
  'fechado_ganho',
  'fechado_perdido',
]

export function setup() {
  const token = randomToken()
  const res = pgGet(`/deals?workspace_id=eq.${token.workspaceId}&select=id&limit=1`, token)
  const deals = res.json()
  if (!deals || deals.length === 0) {
    throw new Error('Nenhum deal encontrado no workspace sorteado — o seed rodou?')
  }
  console.log(`race1: alvo deal ${deals[0].id} no workspace ${token.workspaceId}`)
  return { token, dealId: deals[0].id }
}

export default function (data) {
  const stage = STAGES[__VU % STAGES.length]
  const res = pgPatch(`/deals?id=eq.${data.dealId}`, data.token, { stage }, { tags: { stage } })
  raceAttempts.add(1)
  check(res, { '204': (r) => r.status === 204 })
}

export function teardown(data) {
  const res = pgGet(`/deals?id=eq.${data.dealId}&select=stage`, data.token)
  const final = res.json()[0]
  console.log(`\n=== RACE1 — resultado ===`)
  console.log(`  deal        : ${data.dealId}`)
  console.log(`  estágio final: ${final ? final.stage : '(não encontrado)'}`)
  console.log(
    `  ${CONCORRENCIA} VUs escreveram estágios diferentes simultaneamente; um deles venceu`,
  )
  console.log(`  sem erro, sem lock — confirma last-write-wins silencioso (achado #4a).`)
}
