# Velo Funil

CRM SaaS multi-empresa para PMEs de serviço no Brasil (agências, consultorias,
clínicas, imobiliárias pequenas, software houses), com pipeline de vendas
visual em Kanban, feito para substituir a planilha em um dia. PRD completo em
[docs/prd.md](docs/prd.md).

Projeto ainda greenfield — nenhum scaffold de código existe ainda. Este
arquivo orienta como estruturar e construir o projeto a partir do zero.

## Stack Técnica

- **Frontend:** Next.js 14 (App Router), React 18, TypeScript 5, Tailwind CSS, shadcn/ui
- **Kanban/gráficos:** `@dnd-kit` (drag-and-drop), Recharts (funil e métricas)
- **Backend:** Next.js API Routes + Server Actions, runtime Node.js
- **Dados/Auth:** Supabase (PostgreSQL + RLS + Auth + Storage)
- **E-mail:** Resend (recuperação de senha, convites, onboarding, notificações)
- **Pagamento:** Asaas — clientes, assinaturas recorrentes, webhooks, Pix/boleto/cartão
- **Deploy:** Vercel
- **Analytics:** PostHog + Vercel Analytics
- **Automação futura:** n8n, WhatsApp Business API, Notion API, Linear API

> **Importante:** este projeto usa **Asaas**, não Stripe, para pagamentos —
> mesmo que existam agente/skill de Stripe configurados neste repo
> (`.claude/agents/payment-integration.md`, `.claude/skills/stripe-integration`),
> eles não se aplicam à parte de billing do Velo Funil.

## Estrutura de Pastas

Convenção proposta para o scaffold Next.js App Router, organizada por domínio:

```
app/
  (auth)/              # login, cadastro, recuperação de senha, magic link
  (dashboard)/
    kanban/            # pipeline de vendas
    leads/             # listagem, busca, detalhe/timeline
    dashboard/         # métricas e gráfico de funil
    settings/          # workspace, colaboradores, permissões, billing
  api/
    webhooks/asaas/    # ativação de plano via webhook
components/
  ui/                  # shadcn/ui (não editar diretamente, apenas via CLI)
  kanban/
  leads/
  dashboard/
lib/
  supabase/            # client, server, middleware
  asaas/
  resend/
hooks/
types/
supabase/
  migrations/
docs/
  prd.md
```

Convenções:

- Mutações passam por **Server Actions**; API Routes só para webhooks/integrações externas.
- Isolamento multi-tenant via **RLS no Supabase**, sempre por `workspace_id`/`company_id`.
- Componentes shadcn/ui vivem em `components/ui` e são gerados via CLI, não editados à mão.
- Papéis de usuário: `admin` e `membro`, checados tanto em RLS quanto na UI.

## Identidade Visual

- **Modo escuro como padrão**, com opção de alternar para modo claro.
- Alto contraste, poucos elementos por tela, cards bem definidos, transições sutis.
- Referências: acabamento premium do **Linear**, fluidez de Kanban do **Pipedrive**,
  credibilidade do **HubSpot**, clareza de freemium do **Calendly**, e adaptação
  ao mercado brasileiro de PMEs no estilo **DataCrazy**.
- Posicionamento: _"Simples como planilha, premium como software líder."_

## Processo de Desenvolvimento

Construir em milestones incrementais e testáveis, priorizando o core antes do
resto: **auth → kanban → leads → dashboard → multi-empresa/permissões →
billing (Asaas) → integrações**. Testar cada milestone antes de avançar.
