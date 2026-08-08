# Plano de Execução — Closify CRM

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

- [ ] Variáveis de ambiente de produção (Supabase, Resend, Asaas, PostHog)
- [ ] Domínio customizado configurado
- [x] Checklist de segurança revisado (RLS, chaves não expostas) — auditoria
      completa, migrations `0012` e `0013` aplicadas e verificadas contra o
      banco real
- [ ] Deploy final em produção

**Auditoria de segurança — pendências que exigem decisão/ação externa:**

- [x] **Rotação de secrets concluída (07/08/2026)** — `ASAAS_WEBHOOK_TOKEN`,
      `SUPABASE_SERVICE_ROLE_KEY`, `ASAAS_API_KEY` e `RESEND_API_KEY` trocadas,
      antigas revogadas, tudo verificado contra as APIs reais e o webhook em
      produção respondendo 200.
      - `SUPABASE_SERVICE_ROLE_KEY` migrada do JWT legado (`eyJ...`) para o
        formato novo (`sb_secret_...`).
      - Aprendizado: **criar chave nova não revoga a antiga** no Supabase — a
        revogação é passo separado e explícito.
      - Armadilha: a *publishable key* e a *secret key* ficam na mesma tela; a
        secret nasce oculta e exige "Reveal". Colar a publishable no lugar da
        service role derruba o webhook com 500 (RLS sem policy barra a escrita).
- [ ] Next.js 14.2.35 tem advisories *high*; correção só no 16.3.0 (upgrade de
      major, breaking)
- [ ] Rate limiting em `signIn`, `inviteMember` e aceite de convite (precisa de
      Upstash/Vercel KV)
- [ ] Ligar *leaked password protection* no Supabase Auth (hoje senha só exige
      `min(8)`, aceita `12345678`)
- [ ] Configurar Resend como SMTP customizado no Supabase Auth — segue sendo o
      gargalo real de entrega de e-mail
- [ ] CSP (exige nonce via middleware no Next 14; começar em `Report-Only`)

**Achado colateral da auditoria:** a migration `0009` nunca havia sido aplicada,
e `getDashboardMetrics` engolia o erro com `?? 0` — o card "Valor do Pipeline"
mostrava R$ 0 para todos os workspaces. Corrigido na `0013`. Vale conferir
drift de schema sempre que aplicar migration pelo SQL Editor.

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
