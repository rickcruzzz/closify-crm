// Métricas nomeadas por achado da auditoria, o relatório final cita o
// número exato ("getFunnelCounts levou Xms a mais que a RPC agregada"), não
// "ficou lento". Trend(name, true) usa unidade de tempo automática no summary.
import { Trend, Counter } from 'k6/metrics'

// achado #1, lib/dashboard/queries.ts:55, busca tudo e agrega em JS
export const funnelCountsRawDuration = new Trend('funnel_counts_raw_duration', true)
export const funnelCountsRpcDuration = new Trend('funnel_counts_rpc_duration', true)

// achado #2, ILIKE com wildcard à esquerda, uso do índice trigram incerto
export const leadsSearchIlikeDuration = new Trend('leads_search_ilike_duration', true)

// achado #3, auth.getUser() no middleware + de novo na Server Action
export const middlewareAuthcheckOverhead = new Trend('middleware_authcheck_overhead', true)
export const anonPageDuration = new Trend('anon_page_duration', true)
export const authPageDuration = new Trend('auth_page_duration', true)

// achado #4, as 5 race conditions (contadores de violação, não latência)
export const raceViolations = new Counter('race_violations_total')
export const raceAttempts = new Counter('race_attempts_total')

// achado #5, cadeias seriais longas por Server Action, medidas via soma das
// queries isoladas na Trilha C
export const createLeadChainDuration = new Trend('create_lead_chain_duration', true)

// board do kanban sem paginação (cresce sem limite)
export const kanbanBoardFetchDuration = new Trend('kanban_board_fetch_duration', true)
