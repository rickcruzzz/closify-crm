# Plano de teste de carga — Velo Funil

Entregável da FASE 2 do pedido de auditoria de capacidade (até 1000 usuários
simultâneos). FASE 1 (auditoria de código) foi feita lendo o repo inteiro —
camada de dados (`lib/**/actions.ts`, `lib/**/queries.ts`,
`app/api/webhooks/asaas/route.ts`), schema/RLS/índices (24 migrations) e
fluxos de concorrência. Os achados abaixo são fato verificado no código, não
hipótese — cada um cita arquivo:linha.

Scripts em `scripts/load-test/`, instruções de execução em
`scripts/load-test/README.md`.

## Ambiente

Staging: projeto Supabase novo, tier Free (mesmo tier que produção usa hoje —
o teto que aparecer é o teto real, não desvantagem do teste). App rodando
localmente via `next build && next start` (não `next dev`, que tem pico de
latência artificial por JIT de rota; não Vercel real — sem cold start
serverless nem CDN, declarado como limitação, não escondido). Billing via
stub local (`asaas-stub/server.mjs`) — o Asaas real nunca é chamado.

Sem Docker, sem k6 pré-instalado nesta máquina (verificado, não hipótese) —
k6 instala via `winget install k6`, sem admin.

## Hipóteses a testar, por achado da auditoria

| # | Achado | Onde | Cenário que prova |
|---|---|---|---|
| 1 | `getFunnelCounts` busca TODAS as linhas de `deals.stage` e agrega em JS, ao contrário do resto do dashboard (RPC agregada) | `lib/dashboard/queries.ts:55` | `c2_funnel_counts_raw_vs_rpc` — mede os dois lado a lado no mesmo workspace de 3-8 mil deals |
| 2 | Busca de leads usa `ILIKE` com wildcard à esquerda; uso do índice trigram não confirmado | `lib/leads/queries.ts` | `c4_leads_search_ilike` (latência sob carga) + `diagnostics/explain-search.mjs` (`EXPLAIN ANALYZE` real) |
| 3 | Middleware sempre revalida `auth.getUser()` contra o Auth server; Server Actions repetem a chamada | `lib/supabase/middleware.ts` | `b1`/`b2`/`b3` — cookie de sessão real em páginas protegidas |
| 4a | Kanban: `UPDATE` incondicional em `deals.stage`, sem versão/lock | `lib/deals/actions.ts:96` | `race1_update_deal_stage` |
| 4b | Convite: teto de 2 membros do Free é `count(*)` sem lock entre convites diferentes | migration 0011/0012 | `race2_accept_invite_member_cap` |
| 4c | Import de leads: duas transações concorrentes podem estourar o teto (lote) | `lib/leads/actions.ts:243` | `race3_csv_import_lead_cap` |
| 4d | Trigger de limite de leads: `count(*)` sem lock entre transações (linha a linha) | migration 0023 | `race4_lead_insert_trigger_cap` |
| 4e | `create_workspace_with_admin`: sem lock entre chamadas concorrentes do mesmo usuário | migration 0018 | `race5_create_workspace_cap` |
| 5 | Cadeias seriais longas por Server Action (`createLead` até 5 queries) | `lib/leads/actions.ts:52` | `c6_create_lead_chain` — cada perna medida separada |
| — | Kanban sem paginação (deliberado, dnd-kit precisa de tudo em memória) | `lib/deals/queries.ts:24-28` | `c5_kanban_board_full_fetch` contra workspaces de 2-6 mil deals |

## Por que 3 trilhas de autenticação, sem Trilha D

Decidido com o dono: **A** (HTTP anônimo) + **B** (cookie de sessão real,
login via GoTrue REST) + **C** (PostgREST/RPC direto com JWT de usuário
semeado) cobrem auth, páginas protegidas e a camada de banco/RLS onde vivem
os 5 riscos de corrida — sem adicionar rotas novas em `app/` só para o teste
(a opção "Trilha D", rotas espelhando Server Actions, foi descartada). Os
riscos de corrida são bugs de banco (falta de lock/versão), reproduzíveis
inteiramente via PostgREST — passar pela Server Action só adicionaria
roteamento do Next por cima, sem mudar se a corrida acontece ou não.

## Seed — multi-tenant, não 1000 usuários num workspace só

| Grupo | Workspaces | Users/ws | Plano | Leads/ws | Propósito |
|---|---|---|---|---|---|
| Solo | 700 | 1 | Free | 5–50 | volume realista, maioria do tráfego |
| Time pequeno | 120 | 2 (no teto) | Free | 5–50 | teto de 2 membros em uso normal |
| Time Pro | 20 | 3–6 | Pro | 100–800 | sem teto, times reais maiores |
| Estresse dirigido | 10 | 1–2 | Pro | 3.000–8.000 | prova os achados #1 e #5 na escala onde aparecem |

~850 workspaces, ~1000 usuários distintos, ~80-90 mil leads.

## Mapeamento dos 12 cenários originais

1. login e carregamento inicial → `b4_login_flow` + `a1`
2. abrir dashboard → `b1` + `c1` + `c2`
3. listar leads paginados → `c3` (+ `c4` busca)
4. mover lead entre colunas → `race1`
5. criar lead → `c6`
6. editar lead / 7. registrar atividade → variante de `c6`
8. convidar membro → `race2`
9. múltiplos workspaces simultâneos → garantido pela distribuição do seed em todos os `b*`/`c*`
10. mistura leitura/escrita → perfil `load` combinando `c1`/`c3` com `c6`/`race1`
11. pico repentino → perfil `spike`
12. sustentado/vazamento → perfil `soak`

## Perfis de carga (`k6/lib/config.js`)

- `smoke`: 2 VUs / 20s — roda em TODO cenário antes de qualquer carga real (fase 1 do `run-all.ps1`), aborta a suíte se algo básico falhar.
- `load`: rampa até 100 VUs, sustentado 5min.
- `stress`: rampa até 1000 VUs, sustentado 5min.
- `spike`: pico repentino a 1000 VUs por 1min.
- `soak`: 200 VUs sustentado por 30min — detecta degradação/vazamento.

## Critérios de saúde (do pedido original, mantidos)

p95 < 500ms saudável · p95 > 1000ms atenção · erro > 1% ruim · erro > 5%
quebra · recuperação após spike em menos de 30s (avaliado manualmente
olhando `results/raw/*spike*.log` — k6 não automatiza isso).

## Ordem de execução (prioriza evidência dos achados, não só rodar tudo às cegas)

1. Smoke em todos os cenários.
2. `c2` (achado #1) → `c4` + `explain-search.mjs` (achado #2) → `b1`/`b2`/`b3` (achado #3).
3. `race1`–`race5` (achado #4, correção não throughput).
4. `c5` (kanban sem paginação, escala).
5. Bateria geral: `a1`, `b4`, `c1`, `c3`, `c6` no perfil `load`/`stress`/`spike`/`soak`.
6. `c7` (webhook, só se `ASAAS_WEBHOOK_TOKEN` estiver setado).
7. `c8` isolado, poucos VUs (20-50) — checkout não é ação de alta concorrência realista.

## O que este teste não vai provar, rodando de máquina de dev solo

- CPU/rede local podem saturar antes da app — calibração (100→1000 VUs)
  roda antes da suíte, observando `dropped_iterations` do próprio k6.
- Sem Vercel real: sem cold start serverless, sem CDN/edge.
- Tier Free do Supabase tem teto próprio de infraestrutura — se aparecer
  antes do alvo, é rotulado como tal no relatório final, não como bug de
  código.
- Se a máquina não sustentar 1000 VUs limpo: reportar o teto real medido
  (decidido com o dono), não forçar o número nem migrar pra k6 Cloud.
