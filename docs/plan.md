# Plano de Execução — Velo Funil

Plano dividido em milestones incrementais, do setup ao deploy, seguindo a
diretriz do [CLAUDE.md](../CLAUDE.md) e do [PRD](prd.md): construir a
**interface primeiro** (com dados mockados) e o **backend depois** (persistindo
tudo no Supabase e integrando Asaas). Cada milestone tem branch própria,
objetivo, lista de entregas e commit final.

---

## M0 — Setup do Projeto

**Branch:** `chore/setup-projeto`

**Objetivo:** Inicializar o projeto Next.js com a stack e a estrutura de pastas
definidas no CLAUDE.md, e validar o pipeline de deploy com uma página placeholder.

**Entregas:**

- [x] Criar projeto Next.js 14 (App Router) com TypeScript
- [x] Configurar Tailwind CSS
- [x] Instalar e configurar shadcn/ui
- [x] Criar estrutura de pastas (`app`, `components`, `lib`, `hooks`, `types`, `supabase`, `docs`)
- [x] Configurar ESLint/Prettier
- [x] Configurar tema dark/light (padrão escuro)
- [ ] Conectar repositório à Vercel e validar deploy inicial (pendente — requer login manual na Vercel)

**Commit final:** `chore: setup inicial do projeto Next.js com Tailwind, shadcn/ui e estrutura de pastas`

---

## M1 — Design System e Layout Base (UI)

**Branch:** `feature/ui-design-system`

**Objetivo:** Construir o design system e o layout compartilhado do dashboard,
sem dados reais, seguindo a identidade visual do PRD.

**Entregas:**

- [x] Tokens de cor e tipografia (dark/light) conforme identidade visual
- [x] Layout do dashboard (sidebar, topbar, navegação)
- [x] Componentes base via shadcn/ui (botões, inputs, cards, badges, modais)
- [x] Toggle de tema claro/escuro
- [x] Páginas de erro/404 genéricas

**Commit final:** `feat(ui): layout base do dashboard e design system`

---

## M2 — UI: Landing Page

**Branch:** `feature/ui-landing-page`

**Objetivo:** Construir a landing page pública para apresentar o produto e
converter visitantes.

**Entregas:**

- [x] Hero com o posicionamento "Simples como planilha, premium como software líder"
- [x] Seção de funcionalidades principais
- [x] Seção de planos (Free vs Pro)
- [x] Seção de CTA / cadastro
- [x] Footer
- [x] Responsividade mobile

**Commit final:** `feat(ui): landing page pública`

---

## M3 — UI: Autenticação e Onboarding

**Branch:** `feature/ui-auth`

**Objetivo:** Construir as telas de autenticação e o fluxo de onboarding,
ainda sem integração real (estado local/mock).

**Entregas:**

- [x] Tela de login (e-mail/senha + Google)
- [x] Tela de cadastro
- [ ] Tela de recuperação de senha
- [ ] Tela de magic link
- [x] Fluxo de onboarding (criar workspace — cadastro de primeiro lead ainda pendente)

**Commit final:** `feat(ui): telas de autenticação e onboarding`

---

## M4 — UI: Pipeline Kanban

**Branch:** `feature/ui-kanban`

**Objetivo:** Construir o pipeline Kanban visual com drag-and-drop usando
dados mockados.

**Entregas:**

- [x] Colunas das etapas (Novo Lead, Contato Realizado, Proposta Enviada, Negociação, Fechado Ganho, Fechado Perdido)
- [x] Cards de negócio (valor, lead, responsável, prazo)
- [x] Drag-and-drop entre colunas com `@dnd-kit` (estado local)
- [x] Painel/modal de detalhe do negócio
- [x] Estados vazios e skeletons de loading

**Commit final:** `feat(ui): pipeline kanban com drag-and-drop`

---

## M5 — UI: Leads e Contatos

**Branch:** `feature/ui-leads`

**Objetivo:** Construir listagem, busca/filtros e detalhe de leads com
timeline de atividades, usando dados mockados.

**Entregas:**

- [x] Listagem de leads
- [x] Busca e filtros (nome, empresa, status — e-mail/responsável/data pendentes)
- [x] Formulário de cadastro/edição de lead (com exclusão)
- [x] Página de detalhe do lead
- [x] Timeline de atividades (ligação, e-mail, reunião, nota) — visual apenas

**Commit final:** `feat(ui): listagem, filtros e detalhe de leads`

---

## M6 — UI: Dashboard de Métricas

**Branch:** `feature/ui-dashboard`

**Objetivo:** Construir o dashboard de métricas com gráfico de funil usando
Recharts e dados mockados.

**Entregas:**

- [x] Cards: Total de Leads, Negócios Abertos, Valor do Pipeline, Taxa de Conversão
- [x] Gráfico de funil (Recharts)
- [ ] Filtro de período

**Commit final:** `feat(ui): dashboard de métricas e gráfico de funil`

---

## M7 — UI: Configurações, Multi-empresa e Billing

**Branch:** `feature/ui-settings`

**Objetivo:** Construir as telas de configurações de workspace, colaboradores/
permissões e plano/billing, ainda com dados mockados.

**Entregas:**

- [ ] Tela de configurações do workspace
- [ ] Convite e listagem de colaboradores (papéis Admin/Membro)
- [ ] Tela de plano (Free vs Pro) com CTA de upgrade
- [ ] Seletor de troca entre workspaces

**Commit final:** `feat(ui): configurações, colaboradores e billing (mock)`

---

## M8 — Backend: Supabase, Schema e RLS

**Branch:** `feature/backend-supabase-setup`

**Objetivo:** Configurar o projeto Supabase, modelar o schema multi-tenant e
as políticas de RLS que vão sustentar todo o backend.

**Entregas:**

- [x] Criar projeto Supabase e variáveis de ambiente
- [x] Migrations: workspaces, workspace_members (papéis), leads, deals, activities, subscriptions
- [x] Políticas RLS por `workspace_id`
- [x] Clients Supabase (browser/server) em `lib/supabase`
- [x] Seed de dados de teste

**Commit final:** `feat(backend): schema, migrations e RLS do Supabase`

---

## M9 — Backend: Autenticação Real

**Branch:** `feature/backend-auth`

**Objetivo:** Substituir o mock de autenticação pela integração real com
Supabase Auth e Resend.

**Entregas:**

- [x] Login e cadastro com Supabase Auth
- [x] Google OAuth
- [ ] Magic link
- [ ] Recuperação de senha com e-mail via Resend
- [x] Middleware de proteção de rotas autenticadas
- [x] Onboarding criando o workspace de fato no banco (workspace + membro admin, com policy de bootstrap corrigida — ver migrations 0004/0005)

**Commit final:** `feat(backend): autenticação real com Supabase Auth` ([PR #11](https://github.com/rickcruzzz/closify-crm/pull/11))

---

## M10 — Backend: Pipeline Kanban

**Branch:** `feature/backend-kanban`

**Objetivo:** Persistir o pipeline Kanban no banco via Server Actions,
substituindo os dados mockados da M4.

**Entregas:**

- [x] Server Actions de CRUD de negócios (deals) — criação e mudança de etapa; edição/exclusão completas ainda pendentes
- [x] Persistência da etapa/posição ao arrastar o card
- [x] Vínculo real negócio–lead–responsável
- [ ] Atualização otimista no drag-and-drop (persiste, mas sem otimismo — aguarda round-trip do servidor)

**Commit final:** `feat(backend): persistência real do pipeline kanban`

---

## M11 — Backend: Leads, Contatos e Atividades

**Branch:** `feature/backend-leads`

**Objetivo:** Persistir leads/contatos e a timeline de atividades no banco,
com busca e filtros reais.

**Entregas:**

- [x] Server Actions de CRUD de leads/contatos
- [x] Busca e filtros via query no Supabase
- [x] Server Actions de registro de atividades
- [x] Timeline real vinculada ao lead

**Commit final:** `feat(backend): persistência de leads, contatos e atividades`

---

## M12 — Backend: Dashboard de Métricas

**Branch:** `feature/backend-dashboard`

**Objetivo:** Calcular as métricas do dashboard a partir de dados reais do banco.

**Entregas:**

- [ ] Queries agregadas de métricas por workspace
- [ ] Dados reais no gráfico de funil
- [ ] Filtro de período conectado às queries

**Commit final:** `feat(backend): métricas reais do dashboard`

---

## M13 — Backend: Multi-empresa, Convites e Permissões

**Branch:** `feature/backend-multi-empresa`

**Objetivo:** Implementar convite de colaboradores, papéis e troca de
workspace, com enforcement real de permissões.

**Entregas:**

- [x] Convite de colaborador via Resend
- [x] Aceite de convite e vínculo ao workspace
- [x] Enforcement de permissões Admin/Membro nas Server Actions
- [ ] Troca de workspace ativo persistida (fora de escopo desta rodada — usuário com múltiplos workspaces ainda não tem switch funcional)

**Commit final:** `feat(backend): multi-empresa, convites e permissões`

---

## M14 — Backend: Billing com Asaas

**Branch:** `feature/backend-billing-asaas`

**Objetivo:** Integrar o Asaas para monetização do plano Pro e enforcement
dos limites do plano Free.

**Entregas:**

- [x] Criação de cliente e assinatura via API do Asaas
- [x] Webhook de ativação/cancelamento de assinatura
- [x] Enforcement dos limites do Free (2 colaboradores, 50 leads)
- [x] Tela de billing conectada ao status real do plano ([PR #19](https://github.com/rickcruzzz/closify-crm/pull/19))

**Commit final:** `feat(backend): billing recorrente via Asaas`

---

## M15 — Integração da Landing Page

**Branch:** `feature/backend-landing-integration`

**Objetivo:** Conectar os formulários da landing page ao fluxo real de
criação de conta.

**Entregas:**

- [ ] CTA da landing leva ao cadastro real
- [ ] Tracking de conversão (PostHog)

**Commit final:** `feat: integração da landing page ao fluxo de cadastro`

---

## M16 — Qualidade, Analytics e Observabilidade

**Branch:** `chore/quality-analytics`

**Objetivo:** Fechar lacunas de observabilidade e qualidade antes do deploy final.

**Entregas:**

- [ ] PostHog configurado com eventos-chave
- [ ] Vercel Analytics configurado
- [ ] Tratamento de erros global (error boundaries, toasts)
- [ ] Testes dos fluxos críticos (auth, kanban, billing)

**Commit final:** `chore: analytics, observabilidade e testes básicos`

---

## M17 — Deploy de Produção

**Branch:** `feat/deploy` (o plano previa `chore/deploy-producao`)

**Objetivo:** Configurar o ambiente de produção completo e publicar a versão final.

**Entregas:**

- [x] Variáveis de ambiente de produção — documentadas em `.env.example`
      (versionado; o `.gitignore` já reservava `!.env.example`, mas o arquivo
      nunca tinha sido criado). O código lê 8 variáveis; `ASAAS_API_URL` é
      opcional e cai no padrão de produção do Asaas quando ausente.
      **PostHog não entra aqui** — não há nenhuma referência a PostHog no
      código; a integração é da M16, ainda pendente.
- [ ] Domínio customizado configurado
- [ ] **Conta Asaas com `bankAccountInfo: PENDING`** — verificado em
      `GET /myAccount/status` em 08/08/2026. `commercialInfo`, `documentation`
      e `general` estão `APPROVED`; só a conta bancária não. Sem ela o cliente
      paga e o valor fica retido no saldo do Asaas, sem transferir. É o maior
      bloqueio real para monetizar, e só se resolve no painel.
- [ ] **Nenhuma compra real jamais ocorreu** — `customers: 0`,
      `subscriptions: 0`, `payments: 0` na conta do Asaas. O caminho
      checkout → pagamento → webhook → Pro nunca rodou com dinheiro de
      verdade. Dá para validar sem cobrança apontando `ASAAS_API_URL` para
      `https://api-sandbox.asaas.com/v3` com uma chave de sandbox.
- [ ] **Workspace "Agência Nova Era" tem Pro vitalício de graça** — veio do
      `0002_seed.sql`, que rodou em produção: `plan: pro` com subscription
      `active` e `asaas_subscription_id` nulo. Nenhum evento do Asaas
      consegue rebaixá-lo, porque não há id para casar no `where`.
- [ ] **Banco de produção com dados de teste** — 17 workspaces, dos quais ~10
      são lixo de debug ("Debug sem select", "Verify fix", "Workspace Teste
      E2E", ",k jk", "kjjj"...). Limpeza é destrutiva e precisa de revisão
      caso a caso antes.
- [x] Checklist de segurança revisado (RLS, chaves não expostas) — auditoria
      completa, migrations `0012` e `0013` aplicadas e verificadas contra o
      banco real
- [x] Deploy em produção no ar — <https://closify-crm-dr3t.vercel.app>
      responde 200 com os 5 headers de segurança aplicados e sem
      `X-Powered-By`. Falta apenas subir o conteúdo da M18 (PR #22).

**Verificação da aula 5.3 (08/08/2026) — tudo somente leitura:**

- [x] **Migrations já estavam todas aplicadas em produção; nada a aplicar.**
      Conferido pelo spec OpenAPI do PostgREST com a service key: as 8 tabelas
      existem com as colunas esperadas, e as 6 RPCs de aplicação
      (`accept_workspace_invite`, `create_workspace_with_admin`,
      `get_dashboard_counts`, `get_invite_by_token`, `get_open_pipeline_value`,
      `get_workspace_member_names`) respondem. Zero drift — o buraco da `0009`
      que a `0013` fechou continua fechado.
- [x] **Os `revoke ... from anon` da `0013` funcionam de fato.** Testado com a
      anon key sem sessão: `get_dashboard_counts`, `get_open_pipeline_value`,
      `create_workspace_with_admin` e `accept_workspace_invite` devolvem 401
      `permission denied for function`; `get_workspace_member_names` devolve 404. As duas deixadas abertas de propósito se comportam como projetado —
      `workspace_has_no_members` devolve `false` (guard interno de `auth.uid()`)
      e `get_invite_by_token` devolve `[]`.
      As funções de escrita puderam ser testadas com segurança porque ambas
      abortam (`not_authenticated` / `Convite inválido`) antes de qualquer
      `insert`.
- [x] **RLS bloqueia leitura anônima nas 8 tabelas** — todas devolvem
      `200 []`, ou seja, policy ativa em vez de tabela aberta.
- [x] **Build local limpo** — `next lint` sem avisos e `next build` gerando as
      20 rotas, com `.next` apagado antes para não mascarar erro em cache.
- [x] Supabase Auth: e-mail + Google ativos, `disable_signup: false`,
      `mailer_autoconfirm: false` (confirmação de e-mail exigida).

**Auditoria de segurança — pendências que exigem decisão/ação externa:**

- [x] **Rotação de secrets concluída (07/08/2026)** — `ASAAS_WEBHOOK_TOKEN`,
      `SUPABASE_SERVICE_ROLE_KEY`, `ASAAS_API_KEY` e `RESEND_API_KEY` trocadas,
      antigas revogadas, tudo verificado contra as APIs reais e o webhook em
      produção respondendo 200. - `SUPABASE_SERVICE_ROLE_KEY` migrada do JWT legado (`eyJ...`) para o
      formato novo (`sb_secret_...`). - Aprendizado: **criar chave nova não revoga a antiga** no Supabase — a
      revogação é passo separado e explícito. - Armadilha: a _publishable key_ e a _secret key_ ficam na mesma tela; a
      secret nasce oculta e exige "Reveal". Colar a publishable no lugar da
      service role derruba o webhook com 500 (RLS sem policy barra a escrita).
- [ ] Next.js 14.2.35 tem advisories _high_; correção só no 16.3.0 (upgrade de
      major, breaking). `npm audit` em 08/08/2026: **7 vulnerabilidades (6
      high, 1 moderate)**, todas no `next` e no `postcss` que ele empacota —
      SSRF em rewrites, exposição de endpoints de Server Function, payload
      ilimitado de Server Action no runtime Edge, e leitura arbitrária de
      arquivo via `sourceMappingURL` no postcss. Nenhuma tem correção sem o
      salto de major.
- [x] **Rate limiting implementado** em `signIn`, `inviteMember` e aceite de
      convite (migration `0015`). Não precisou de Upstash nem Vercel KV: uma
      tabela no Postgres resolve neste volume e sobrevive a restart de função,
      coisa que contador em memória não faz. Contagem e inserção na mesma
      transação, senão duas requisições simultâneas passariam as duas.
      Limites por ameaça: login 8/15min por e-mail, convite 20/hora por
      workspace, aceite 15/15min por usuário. **Falha aberta** de propósito —
      limitador indisponível não pode virar tranca no login de todo mundo.
- [ ] Ligar _leaked password protection_ no Supabase Auth (hoje senha só exige
      `min(8)`, aceita `12345678`)
- [ ] Configurar Resend como SMTP customizado no Supabase Auth — segue sendo o
      gargalo real de entrega de e-mail
- [x] **CSP em Report-Only** no `next.config`. A abordagem canônica (nonce +
      `strict-dynamic`) foi implementada e medida: **28 a 32 violações por
      página**, todos os chunks do próprio Next, porque as páginas públicas
      são estáticas e não há requisição para carimbar nonce. Ativá-la
      derrubaria o app. Nonce exigiria tornar tudo dinâmico, anulando o ganho
      de TTFB. A política final dá **1 violação por página** (um `eval` de
      dependência, documentado no config).

**Auditoria de UI/UX (08/08/2026):** conduzida com as regras do skill
`ui-ux-pro-max` e medida ao vivo com Playwright em 375/768/1440, nos dois
temas. Entregue em `afd3356` (rotas públicas) e `8f15915` (área logada).

- Traços removidos de todo texto de interface.
- Texto abaixo de 12px: 14 na landing e 9 na área logada, ambos zerados.
- **Login, cadastro e recuperação não tinham `<h1>`** — `CardTitle` renderiza
  `<div>`, então a hierarquia de cabeçalhos quebrava para leitor de tela.
- Botões de fechar anunciavam "Close" num app `lang="pt-BR"`.
- Violações WCAG 2.2 de alvo de toque na área logada: mobile 6 → 1, desktop
  10 → 1. O restante é o skip link `sr-only`, correto por design.
- **Contraste: zero violações antes e depois.** A primeira medição acusou 106
  e era artefato — o Tailwind v4 emite `oklch()` e o parser esperava `rgb()`,
  então toda razão dava 1:1. Refeita com canvas. Nenhuma cor foi alterada,
  porque nenhuma precisava.
- `Input`, `Select`, `Textarea` e `Button` sobem para 44px abaixo de `md`.
  Isso contraria a convenção de não editar `components/ui` à mão, e foi
  deliberado: a altura vive na variante, então corrigir por uso significaria
  repetir a regra em dezenas de lugares e deixar todo uso novo nascer errado.

**Limpeza de dados de teste:** preparada em `0016_limpeza_dados_de_teste.sql`,
dividida em três níveis de risco e **não executada** — apagar é irreversível.
Nível 1 são 5 workspaces órfãos sem membro nem dado, inalcançáveis pela
interface. O arquivo também documenta o Pro vitalício herdado do seed.

**Achado colateral da auditoria:** a migration `0009` nunca havia sido aplicada,
e `getDashboardMetrics` engolia o erro com `?? 0` — o card "Valor do Pipeline"
mostrava R$ 0 para todos os workspaces. Corrigido na `0013`. Vale conferir
drift de schema sempre que aplicar migration pelo SQL Editor.

**Teste de fluxo em produção (08/08/2026):** a formação pedia esse teste com
Stripe (`pipeflow.vercel.app`, evento de teste pelo Stripe Dashboard,
`STRIPE_WEBHOOK_SECRET`). Traduzido para Asaas e para a URL real do Closify.

Aprovado:

- [x] Fluxo público em 375 / 768 / 1440 contra a produção: landing, login,
      cadastro, esqueci-senha, convite inválido e 404. Todos 200 (404 devolve
      404 de verdade), zero erro de JS, `<title>` correto em cada rota.
- [x] Webhook de produção exercitado ponta a ponta, com token válido e um id
      de assinatura propositalmente inexistente — nenhum plano podia mudar: - evento válido → `200 {"received":true}` - replay do mesmo `event_id` → `200 {"duplicate":true}` (**a
      idempotência foi confirmada no ambiente real, não só por leitura de
      código**) - evento sem assinatura vinculada → 200 - evento não mapeado → 200 (não gera tempestade de retry) - JSON inválido → 400 - token errado → 401
- [x] Depois do teste: 17 workspaces com os mesmos planos de antes (1 `pro`,
      16 `free`), nenhuma referência órfã entre `leads`, `deals`,
      `activities`, `workspace_members` e `workspace_invites`. A linha de
      dedupe criada pelo teste foi apagada.

Não executado, e por quê:

- [ ] Fluxo autenticado (Dashboard → Pipeline → Leads → Settings → Billing):
      exige credenciais de um usuário de teste, que não temos.
- [ ] Checkout real → webhook → Pro ativado: cria cliente, assinatura e
      cobrança **de verdade** no Asaas. Precisa de decisão explícita e, de
      preferência, de uma chave de sandbox (`ASAAS_API_URL` já aceita
      `https://api-sandbox.asaas.com/v3`).
- [ ] Logs do Vercel (aba Functions): o projeto não está linkado à CLI
      (`.vercel` ausente) e não há token. A verificação foi feita pelo par
      resposta HTTP + estado do banco, que é evidência mais forte que o log.

**Achado do teste — o que está em produção está atrasado.** A landing em
produção ainda estoura a viewport em 375px (`scrollWidth` 476 contra 375),
que é exatamente o bug corrigido na M18. Confirma que `main` está em
`ad00773` e que os três commits da branch `feat/deploy` (M18, `.env.example`
e o hardening do webhook) ainda não subiram — o PR #22 segue aberto.

**Deploy executado (08/08/2026), nesta ordem:**

1. `0014` aplicada no SQL Editor.
2. Verificada contra o banco real antes de qualquer código depender dela:
   `apply_asaas_subscription_status` devolve `false` para assinatura
   inexistente (caminho correto — o handler trata como "não é nossa" e
   responde 200); `purge_old_asaas_webhook_events` devolve `0`; e **anon
   recebe `42501 permission denied` nas duas**, ou seja, o `revoke` pegou de
   verdade desta vez, ao contrário do que a `0013` documenta.
3. PR #22 mergeado em `main` (`40f23c7`) e deploy automático da Vercel.

Confirmado em produção depois do deploy:

- Landing não estoura mais em 375px (era `scrollWidth` 476 contra 375).
- Webhook responde `{"received":true,"matched":false}` — o campo `matched` só
  existe no handler novo, então é a prova de que o código subiu.
- Replay do mesmo `event_id` segue devolvendo `{"duplicate":true}`.
- Token errado segue em 401.
- Dados intactos: 1 `pro`, 16 `free`. Linha de dedupe do teste removida.

Não verificado: o `revoke` do role `authenticated` (exigiria JWT de usuário
logado) e a existência física do índice único (exigiria inserir linha
duplicada em produção). Ambos foram criados pelo mesmo script que rodou sem
erro — se houvesse duplicata, o `create unique index` teria falhado ali.

**Como reconferir o drift sem CLI:** o projeto não usa a CLI do Supabase e as
migrations são aplicadas à mão pelo SQL Editor, então não existe tabela de
controle de versão de migration. O caminho que funciona é bater o schema real
contra os arquivos: `GET {SUPABASE_URL}/rest/v1/` com a service key e o header
`Accept: application/openapi+json` devolve tabelas, colunas e RPCs expostas.
Comparar com o que os arquivos de `supabase/migrations/` criam acusa qualquer
migration esquecida.

**Commit final:** `chore: deploy de produção do Closify CRM`

---

## M18 — Responsividade e Polish Visual

**Branch:** `feat/deploy`

**Objetivo:** Fechar as quebras de layout em mobile/tablet e elevar o
acabamento visual ao nível prometido pela identidade ("premium como software
líder"), sem alterar comportamento de dados.

**Baseline já existente** (não refazer): `focus-visible` em todos os
componentes shadcn, `prefers-reduced-motion` em `app/globals.css`, sidebar
`hidden md:block` com `MobileSidebar`, `Table` já embrulhado em
`overflow-x-auto`, toasts via sonner, `metric-cards` e `features-section` com
grids responsivos.

**Entregas — responsividade:**

- [x] `kanban-column.tsx` — `h-[calc(100vh-14rem)]` virou altura em `dvh` com
      offset por breakpoint. `100vh` quebrava em iOS/Android (barra de URL) e
      o offset fixo de 14rem não cobria o mobile
- [x] `kanban-board.tsx` — faixa de scroll horizontal com bleed até a borda da
      viewport (`-mx-4 px-4`) e `scroll-snap` por coluna abaixo de `sm`
- [x] Tabelas de 5+ colunas viram lista de cards abaixo de `lg`
      (`leads-page-client`, `upcoming-deals-table`)
- [x] `members-card.tsx` e `billing/page.tsx` — `CardHeader` de `flex-row`
      fixo para `flex-col sm:flex-row`
- [x] `funnel-chart.tsx` — altura e largura do eixo Y responsivas via
      `useMediaQuery` (novo hook em `hooks/use-media-query.ts`)
- [x] Barras de filtro de kanban e leads empilham até `lg`
- [x] `min-h-screen` → `min-h-dvh` em todas as rotas de tela cheia
- [x] `pricing-section.tsx` — `overflow-x-clip` no brilho decorativo de
      `w-[36rem]`, que gerava scroll horizontal na landing em 375px

**Entregas — polish visual e acessibilidade:**

- [x] `deal-card.tsx` — título virou `<button>` focável (o dnd-kit ocupa
      Enter/Espaço no card para o drag, então abrir o detalhe precisava do
      próprio alvo); adicionado `hover` com transição
- [x] `PageHeader` ganhou slots `actions` e `className`, usados no detalhe do
      lead

**Entregas — loading e estados vazios:**

- [x] `loading.tsx` novos em `settings`, `settings/billing`, `leads/[id]` e
      `convite/[token]`
- [x] Estados vazios auditados — já cobertos por `EmptyState` em kanban,
      leads, funil, negócios do prazo, colaboradores e timeline

**Verificação:** medido com Playwright em 375 / 768 / 1440 (dark mode) sobre
uma rota de preview temporária com dados sintéticos de texto longo. Resultado
final: `document.scrollWidth === clientWidth` nos três tamanhos em landing,
login, cadastro, kanban, leads e dashboard; zero erro de JS; colunas do kanban
alinhadas ao gutter da página. `next lint` e `next build` limpos.

**Achado durante o teste:** o breakpoint da troca tabela↔cards não podia ser
`md` — em 768px o sidebar já está visível e consome 256px, deixando ~430px de
conteúdo. Por isso a troca (e o empilhamento das barras de filtro) acontece em
`lg`, não em `md`.

**Fora de escopo:** mudanças de dados, Server Actions, schema ou billing.
Auditoria de contraste WCAG AA e verificação de foco preso em Dialog/Sheet
ficaram pendentes — precisam de ferramenta de auditoria (axe) rodando contra
sessão autenticada real.

**Commit final:** `feat(ui): responsividade e polish visual`

---

## M19 — Senha forte, importação de CSV e rebrand Velo Funil

**Branch:** `feat/senha-forte`

**Objetivo:** Fechar o que impedia a publicação: o fluxo de redefinição de
senha estava quebrado, a captação de leads dependia de digitação manual e o
produto ainda se chamava Closify em todas as telas.

**Entregas — correção do reset de senha:**

- [x] `redefinir-senha/page.tsx` — o `resetPasswordSchema` passou a exigir
      `confirmPassword`, mas a tela nunca foi atualizada: o `zodResolver`
      falhava num campo que não existia, o erro não tinha onde aparecer e o
      submit nunca disparava. O botão "Salvar nova senha" era inerte, sem
      nenhuma mensagem. Corrigido com os dois campos via `PasswordField`
- [x] Rate limit `reset-password` (5/hora por e-mail) em
      `requestPasswordReset` — o envio era ilimitado, o que transformava nosso
      Resend em canhão contra a caixa de entrada de terceiros. Ao estourar,
      retorna o MESMO sucesso do caminho normal para não virar oráculo de
      enumeração de contas
- [x] `updatePassword` chama `signOut({ scope: 'others' })` — trocar a senha
      não derrubava sessão nenhuma, então quem redefinia por suspeita de
      invasão continuava com o invasor logado nos outros aparelhos. `others`
      e não `global`, para preservar a sessão que redireciona ao dashboard
- [x] `updatePassword` limpa as tentativas de `signin` após o sucesso
- [x] `/redefinir-senha` no matcher do middleware (refresh de cookie da sessão
      de recuperação). Continua fora de `isProtectedPath` de propósito
- [x] `password-strength.ts` — o detector de sequência óbvia derrubava para
      "fraca" qualquer senha contendo `12345` em qualquer posição:
      `Kmtbvn123456` (12 caracteres, 3 classes) recebia nota pior que
      `Xyzqwr12` (8 caracteres). Passou a medir a PROPORÇÃO do padrão sobre o
      total, e a exigir as 4 classes para "forte" quando há padrão previsível

**Entregas — senha forte no cadastro:**

- [x] `lib/password-strength.ts` — `avaliarSenha` (fraca/média/forte) e
      `gerarSenhaForte` com `crypto.getRandomValues`, alfabeto sem caracteres
      ambíguos (`l`, `I`, `O`, `0`, `1`) porque a pessoa lê da tela para anotar
- [x] `components/auth/password-field.tsx` — campo com mostrar/ocultar, copiar,
      "Sugerir senha forte" e barra de força com `aria-live="polite"` (cor
      sozinha não comunica)
- [x] `confirmPassword` com `.refine` apontando o erro para o campo de
      confirmação, não para o formulário

**Entregas — importação de leads por CSV:**

- [x] `lib/leads/csv.ts` — parser sem dependência nova: detecta separador
      (`;` do Excel pt-BR, `,`, tab), consome BOM, respeita aspas com quebra de
      linha dentro e casa o cabeçalho por apelido sem acento/caixa
- [x] `parseValorBRL` resolve `R$ 1.234,56`, `1.200` (milhar) e `1234.56`
      (decimal en) pelo tamanho do último grupo
- [x] `importLeadsFromCsv` — teto de 512 KB e 1.000 linhas, dedupe dentro do
      arquivo e contra os e-mails já no workspace, erro por linha em vez de
      abortar o arquivo inteiro
- [x] `remainingLeadSlots` em `lib/limits.ts` — `canAddLead` só responde sobre
      UMA linha, então um CSV de 300 leads passaria por cima do teto Free
- [x] `ImportLeadsDialog` com modelo para baixar e lista das linhas rejeitadas

**Entregas — rebrand Velo Funil:**

- [x] `LogoMark` redesenhado: três camadas convergentes que formam funil, V e
      etapas do pipeline. A primeira versão (barras retas) lia como o ícone
      genérico de filtro — descartada após comparar variantes em 64/32/16px
- [x] Acento cyan-teal em `--primary`/`--ring`, calibrado por contraste WCAG:
      claro `oklch(0.5 0.13 195)` (5.14 no botão), escuro `oklch(0.72 0.14 195)`
      (8.46). O primeiro candidato do tema claro dava 4.22 e reprovava em AA
- [x] Lockups duplicados de `(auth)/layout.tsx` e `convite/[token]/page.tsx`
      (que usavam `KanbanSquare`) trocados pelo componente `Logo`
- [x] `app/icon.tsx` gerado via `ImageResponse` com `runtime = 'edge'` — no
      runtime Node o `@vercel/og` estoura `Invalid URL` no prerender
- [x] Metadata, OG image, copy, e-mail de convite e descrição da fatura Asaas

**Verificação:** `tsc --noEmit`, `next lint` e `next build` limpos. Fluxo de
reset percorrido no browser: senhas divergentes mostram o erro no campo de
confirmação; senhas válidas disparam o submit e chegam ao dashboard (antes o
botão não fazia nada). Medidor conferido nos três níveis (vermelho 33% / âmbar
66% / verde 100%) e o botão de sugestão preenche os dois campos com 16
caracteres. Rate limit validado contra o banco real: 5 passam, a 6ª bloqueia.
Parser de CSV testado com vírgula, ponto e vírgula, BOM, aspas com quebra de
linha, cabeçalho inválido, duplicata, valor lixo e valor negativo.

**Fora de escopo:** domínio próprio e remetente de e-mail profissional (o
código já lê de `NEXT_PUBLIC_APP_URL`; o remetente é uma string em
`lib/workspace/actions.ts`). Suíte de testes automatizada continua pendente da
M16 — a causa deste bug (schema mudou, tela não) é exatamente o que um teste de
schema pegaria. `Input` cru do login não virou `PasswordField`.

**Commit final:** `fix(auth): corrige redefinição de senha e endurece o fluxo de recuperação`
