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

- [ ] Criação de cliente e assinatura via API do Asaas
- [ ] Webhook de ativação/cancelamento de assinatura
- [ ] Enforcement dos limites do Free (2 colaboradores, 50 leads)
- [ ] Tela de billing conectada ao status real do plano

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

**Branch:** `chore/deploy-producao`

**Objetivo:** Configurar o ambiente de produção completo e publicar a versão final.

**Entregas:**

- [ ] Variáveis de ambiente de produção (Supabase, Resend, Asaas, PostHog)
- [ ] Domínio customizado configurado
- [ ] Checklist de segurança revisado (RLS, chaves não expostas)
- [ ] Deploy final em produção

**Commit final:** `chore: deploy de produção do Closify CRM`
