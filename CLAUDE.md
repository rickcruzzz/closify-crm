# Velo Funil

CRM SaaS multi-empresa para PMEs de serviço no Brasil (agências, consultorias,
clínicas, imobiliárias pequenas, software houses), com pipeline de vendas
visual em Kanban, feito para substituir a planilha em um dia. PRD completo em
[docs/prd.md](docs/prd.md). Diagrama de classes do schema (tabelas, chaves,
enums, gerado por inspeção real do catálogo Postgres, não suposto) em
[docs/schema.md](docs/schema.md). Estado real da esteira de testes (o que
roda, o que é manual, o que falta pro CI existir de verdade) em
[docs/testes.md](docs/testes.md).

**O produto está em produção** em <https://www.velofunil.com.br>, com auth,
Kanban, leads, dashboard, multi-empresa, billing pelo Asaas e e-mails
transacionais funcionando. Não é greenfield, não recrie nada do zero.

O estado atual do projeto, o que está pendente, as decisões que não devem ser
refeitas e as armadilhas já pagas, vem importado logo abaixo. É `@` e não link
markdown de propósito: o `@` embute o conteúdo do arquivo neste, e link
dependeria de alguém decidir abrir.

@docs/estado-atual.md

Depois disso, `git log` conta o resto: as mensagens de commit registram o
porquê de cada decisão e são a memória real daqui.

## Stack Técnica

- **Frontend:** Next.js 14 (App Router), React 18, TypeScript 5, Tailwind CSS, shadcn/ui
- **Kanban/gráficos:** `@dnd-kit` (drag-and-drop), Recharts (funil e métricas)
- **Backend:** Next.js API Routes + Server Actions, runtime Node.js
- **Dados/Auth:** Supabase (PostgreSQL + RLS + Auth + Storage)
- **E-mail:** Resend (recuperação de senha, convites, onboarding, notificações)
- **Pagamento:** Asaas, clientes, assinaturas recorrentes, webhooks, Pix/boleto/cartão
- **Deploy:** Vercel
- **Analytics:** Vercel Analytics. **PostHog não está instalado**, esta linha
  já afirmou os dois, conferido no `package.json` em 12/08/2026. Não existe
  nada medindo ativação: quantos que criam conta chegam ao primeiro lead é uma
  pergunta que hoje ninguém responde
- **Automação futura:** n8n, Notion API, Linear API

> **Importante:** este projeto usa **Asaas**, não Stripe, para pagamentos,
> mesmo que existam agente/skill de Stripe configurados neste repo
> (`.claude/agents/payment-integration.md`, `.claude/skills/stripe-integration`),
> eles não se aplicam à parte de billing do Velo Funil.

## Estrutura de Pastas

Estrutura em uso, organizada por domínio (já implementada, não é proposta):

```
app/
  (auth)/              # login, cadastro, recuperação de senha, boas-vindas
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

Os milestones **auth → kanban → leads → dashboard → multi-empresa/permissões →
billing (Asaas)** estão entregues e em produção. O que resta são integrações,
a próxima é importação de Excel/planilha.

### Verificar contra produção, não supor

O padrão daqui: nada é dado como funcionando sem prova. Script descartável em
Node lendo o ambiente (`node --env-file=.env.local`), exercitando o caminho
real, webhook, API do Supabase, envio de e-mail, e limpando o que criou num
`finally`. Vários defeitos desta base só apareceram assim, e pelo menos dois
alarmes falsos foram descartados pelo mesmo método.

Para regra de permissão e limite de plano, simular sessão real no Postgres
(`set local role authenticated` + `set local request.jwt.claims`) e **tentar a
escrita indevida**. Se passar, a regra não existe.

### Antes de encerrar qualquer mudança

`npx tsc --noEmit`, `npm run lint`, `npm test` e **`npm run build:check`**, os
quatro limpos. Testes cobrem lógica pura em `lib/**` (schemas, parsers,
formatadores); cada caso documenta o defeito que o motivou, e é assim que devem
continuar.

**Use `build:check`, não `build`, com o `npm run dev` de pé.** Os dois escrevem
na mesma pasta `.next` por padrão, e o build sobrescreve o mapa de chunks que o
servidor de desenvolvimento está usando: a partir daí toda rota morre com
`MODULE_NOT_FOUND` em `webpack-runtime.js`, sem nada estar errado no código. O
erro aponta para o arquivo da rota, então parece defeito do que você acabou de
escrever — e derrubou a Central do dono três vezes numa sessão só, sempre pelo
próprio gate. `build:check` escreve em `.next-check`
(`scripts/ci/build-de-conferencia.mjs`); `npm run build` continua indo para
`.next`, que é o que a Vercel espera.
