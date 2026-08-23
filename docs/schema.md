# Schema do Velo Funil — engenharia reversa via catálogo Postgres

**Fonte:** projeto Supabase `velofunil-sao-paulo` (`tmyeunithjqkbwvezyyn`, sa-east-1),
inspecionado em 18/08/2026 via `information_schema` e `pg_catalog`, sem
suposição — toda tabela, coluna, chave e enum abaixo veio de consulta real.
Migrations novas mudam este arquivo com o tempo; ao suspeitar de
desatualização, reconsulte o catálogo em vez de confiar cegamente nele (mesma
regra de `docs/estado-atual.md`).

**Reconferido em 23/08/2026 — estrutura intacta, regra nova.** A migration
0050 não criou tabela, coluna nem enum: só uma função `returns trigger` e o
gatilho dela em `workspace_members`. Por isso o catálogo continua idêntico
(14 tabelas, 29 RPCs, 12 FKs, reconferidos nesta data pelo OpenAPI do
PostgREST de produção) enquanto o comportamento do banco mudou — ver
**Regras que vivem em trigger**, abaixo. Função de trigger não aparece entre
as RPCs porque o PostgREST não expõe `returns trigger`, o que é o esperado.

**Reconferido em 22/08/2026 — mudou.** A migration 0047 (WhatsApp pelo
Evolution) acrescentou a **14ª tabela**, `whatsapp_webhook_events`, mais um
índice funcional em `leads` e três funções. Conferido contra o banco real, não
contra a migration: o documento OpenAPI do PostgREST em produção lista hoje 14
tabelas e 29 RPCs, entre elas `encontrar_lead_por_telefone`,
`telefone_normalizado` e `purge_old_whatsapp_webhook_events`.

O índice novo é **funcional e parcial**, o que não aparece numa listagem de
colunas e por isso fica registrado aqui:

```sql
create index leads_telefone_ultimos8_idx
  on public.leads (workspace_id, right(regexp_replace(phone, '\D', '', 'g'), 8))
  where phone is not null;
```

Ele existe porque casar telefone de mensagem recebida varria todos os leads do
workspace e comparava em JavaScript — com 3.000 leads, cada "oi" custava 3.000
linhas. O risco aceito está no comentário da própria migration: dois leads com
os mesmos 8 dígitos finais em DDDs diferentes colidem; é raro, e anexar ao lead
errado é reparável, ao contrário de perder a mensagem.

**Registro anterior, de 20/08/2026, mantido:** A Central do Dono (`/dono`,
rota local) foi construída sobre o schema existente e **não criou nem alterou
nenhuma tabela, coluna ou enum** — ela só lê, e escreve pelas mesmas portas
que o produto já usava (`subscriptions`, `workspaces.plan`, a RPC
`apply_asaas_subscription_status` via `lib/asaas/aplicar-evento.ts`).
Confirmado por dois caminhos: `git diff` em `supabase/` vazio, e a lista de
tabelas expostas pelo PostgREST em produção continua nas mesmas 13
(`activities`, `asaas_webhook_events`, `deals`, `error_logs`,
`integration_connections`, `leads`, `onboarding_state`,
`rate_limit_attempts`, `subscriptions`, `tasks`, `workspace_invites`,
`workspace_members`, `workspaces`). Registrado em vez de assumido.

**Nota de metodologia.** Extraído com a ferramenta MCP Supabase
(`execute_sql`, contra o projeto de produção), 4 consultas: colunas
(`information_schema.columns`), chaves primárias e estrangeiras
(`information_schema.table_constraints` + `constraint_column_usage` +
`referential_constraints`) e enums (`pg_type`/`pg_enum`).

## Diagrama de classes

Versão renderizada, imagem única com todas as tabelas, chaves e legendas:
[schema.svg](schema.svg).

Mesmo diagrama em Mermaid, editável e legível como texto puro:

```mermaid
classDiagram
    class workspaces {
        +uuid id PK
        +text name
        +workspace_plan plan
        +text segmento
        +text modelo_venda
        +text tamanho_equipe
        +text cnpj
        +text logo_url
        +uuid created_by "→ auth.users, sem FK"
        +timestamptz created_at
    }

    class workspace_members {
        +uuid workspace_id PK, FK
        +uuid user_id PK "→ auth.users, sem FK"
        +workspace_role role
        +timestamptz created_at
    }

    class leads {
        +uuid id PK
        +uuid workspace_id FK
        +uuid owner_id "→ auth.users, sem FK"
        +text name
        +text email
        +text phone
        +text company
        +deal_stage status
        +numeric value
        +timestamptz created_at
    }

    class deals {
        +uuid id PK
        +uuid workspace_id FK
        +uuid lead_id FK "nullable"
        +uuid owner_id "→ auth.users, sem FK"
        +text title
        +numeric value
        +deal_stage stage
        +date due_date
        +timestamptz stage_changed_at
        +timestamptz created_at
        +timestamptz updated_at
    }

    class activities {
        +uuid id PK
        +uuid workspace_id FK
        +uuid lead_id FK
        +uuid author_id "→ auth.users, sem FK"
        +activity_type type
        +text description
        +integration_provider integration_provider "nullable"
        +timestamptz created_at
    }

    class tasks {
        +uuid id PK
        +uuid workspace_id FK
        +uuid lead_id FK "nullable"
        +uuid deal_id FK "nullable"
        +uuid assignee_id "→ auth.users, sem FK, nullable"
        +uuid created_by "→ auth.users, sem FK, nullable"
        +text title
        +activity_type type
        +timestamptz due_at
        +timestamptz done_at "nullable"
        +timestamptz created_at
    }

    class subscriptions {
        +uuid id PK
        +uuid workspace_id FK
        +text asaas_customer_id
        +text asaas_subscription_id
        +subscription_status status
        +timestamptz current_period_end
        +text ultimo_billing_type
        +timestamptz aviso_vencimento_enviado_em
        +timestamptz created_at
    }

    class workspace_invites {
        +uuid id PK
        +uuid workspace_id FK
        +text email
        +workspace_role role
        +uuid token
        +workspace_invite_status status
        +uuid invited_by "→ auth.users, sem FK"
        +timestamptz created_at
        +timestamptz expires_at
    }

    class integration_connections {
        +uuid id PK
        +uuid workspace_id FK
        +integration_provider provider
        +integration_status status
        +text account_label
        +text external_id
        +text[] scopes
        +bytea access_token_enc
        +bytea refresh_token_enc
        +timestamptz token_expires_at
        +timestamptz last_synced_at
        +uuid connected_by "→ auth.users, sem FK"
        +timestamptz created_at
    }

    class onboarding_state {
        +uuid user_id PK "→ auth.users, sem FK"
        +text status
        +text etapa
        +text tour_status
        +bool checklist_oculto
        +jsonb respostas
        +timestamptz created_at
    }

    class asaas_webhook_events {
        +text event_id PK
        +text event_type
        +timestamptz processed_at
    }

    class whatsapp_webhook_events {
        +text event_id PK
        +timestamptz processed_at
    }

    class rate_limit_attempts {
        +text chave PK
        +timestamptz ocorrido_em PK
    }

    class error_logs {
        +uuid id PK
        +text message
        +text digest "nullable"
        +text stack "nullable"
        +text url "nullable"
        +text origem
        +uuid workspace_id "sem FK, nullable"
        +uuid user_id "→ auth.users, sem FK, nullable"
        +timestamptz created_at
    }

    workspaces "1" --> "many" workspace_members : CASCADE
    workspaces "1" --> "many" leads : CASCADE
    workspaces "1" --> "many" deals : CASCADE
    workspaces "1" --> "many" activities : CASCADE
    workspaces "1" --> "many" tasks : CASCADE
    workspaces "1" --> "many" subscriptions : CASCADE
    workspaces "1" --> "many" workspace_invites : CASCADE
    workspaces "1" --> "many" integration_connections : CASCADE

    leads "1" --> "many" deals : SET NULL
    leads "1" --> "many" activities : CASCADE
    leads "1" --> "0..many" tasks : CASCADE

    deals "1" --> "0..many" tasks : CASCADE
```

*Tabelas soltas, sem FK para nenhuma outra do schema `public`:
`asaas_webhook_events` (dedupe de webhook do Asaas),
`whatsapp_webhook_events` (dedupe de webhook do Evolution, migration 0047),
`rate_limit_attempts` (controle de tentativas de login) e `error_logs`
(captura de erro dos boundaries do produto, migration 0046).
`whatsapp_webhook_events` é a única das quatro que **nasce com purga**
(`purge_old_whatsapp_webhook_events()`, 7 dias, rodada por Vercel Cron): a
projeção de 240 mil eventos/dia com 400 clientes a levaria a 9,7 GB em 12
meses. A irmã do Asaas sobrevive sem limpeza só porque recebe poucas linhas
por mês. Aparecem no diagrama, sem linha de
relação — é o que o catálogo mostra, não omissão. `error_logs` também é
zero-policy (RLS ligada, só `service_role` acessa), mesmo padrão de
`asaas_webhook_events`.*

## Regras que vivem em trigger, não em coluna

Uma listagem de colunas, chaves e enums — que é o que este documento extrai —
**não mostra nenhuma regra de negócio**. Elas ficam registradas aqui porque são
invisíveis para quem inspeciona o catálogo do jeito normal, e porque este
projeto já pagou cinco vezes a lição de descobrir isso tarde.

| Tabela | Trigger | O que impede |
|---|---|---|
| `leads` | `validar_limite_de_leads` (0023, corrigida na 0026) | 301º contato num workspace Free |
| `workspace_members` | `validar_limite_de_membros` (**0050**, 23/08) | 3º colaborador num workspace Free |
| `deals`, `tasks` | validação de alvo (0038) | `lead_id`/`deal_id` de outra empresa |

A **0050** é a mais recente e nasceu de um furo medido em produção: a trava de
2 membros existia, mas só dentro da RPC `accept_workspace_invite` — e ninguém é
obrigado a passar por convite. A policy de INSERT permite que um admin escreva
direto na tabela, e a chave pública do Supabase está no HTML por design.
Testado com sessão autenticada real de uma conta Free: **6 membros inseridos
numa empresa cujo teto é 2**, sem convite, sem e-mail, sem tocar em Server
Action nenhuma.

A variação da lição, que vale registrar: a regra não estava numa Server Action
— estava numa **RPC**, que já é melhor. Só que uma RPC protege *um* caminho até
a tabela. Trigger protege todos.

Duas propriedades das três triggers, iguais por decisão e não por acaso:
lêem `pro_vigente()` e nunca a coluna `workspaces.plan` (doutrina travada desde
a 0027 — a coluna é o último valor gravado e não sabe que o período pago
venceu), e liberam quando `auth.uid()` é nulo, que é o caminho da service role:
webhook, job de reconciliação e script de manutenção não são o abuso que elas
combatem.

## Achado da inspeção: colunas que apontam para `auth.users` sem FK declarada

`deals.owner_id`, `leads.owner_id`, `tasks.assignee_id`, `tasks.created_by`,
`activities.author_id`, `workspace_invites.invited_by`,
`workspace_members.user_id`, `onboarding_state.user_id`,
`integration_connections.connected_by`, `workspaces.created_by` — todas
`uuid`, nenhuma com `FOREIGN KEY` no catálogo (confirmado pela consulta a
`referential_constraints`, que só retornou relações dentro do schema
`public`). Padrão esperado no Supabase: `auth.users` vive em outro schema,
gerenciado pelo GoTrue, e o projeto não declara FK cross-schema. A
integridade referencial para essas colunas é garantida pela aplicação
(Server Actions), não pelo banco.

## Legenda dos enums (`pg_enum`, valores reais e ordem de definição)

| Enum | Valores |
|---|---|
| `activity_type` | `ligacao`, `email`, `reuniao`, `nota` |
| `deal_stage` | `novo`, `contato_realizado`, `proposta_enviada`, `negociacao`, `fechado_ganho`, `fechado_perdido` |
| `integration_provider` | `google_calendar`, `gmail`, `whatsapp` |
| `integration_status` | `connected`, `error`, `disconnected` |
| `subscription_status` | `trialing`, `active`, `past_due`, `canceled` |
| `workspace_invite_status` | `pending`, `accepted`, `expired` |
| `workspace_plan` | `free`, `pro` |
| `workspace_role` | `admin`, `membro` |

## Resumo do catálogo

**14 tabelas** no schema `public`, todas com Row Level Security ligada
(`rls_enabled: true` em `list_tables`, confirmado, não suposto). Este número
dizia 12 até 23/08/2026 — ficou para trás quando a 0046 (`error_logs`) e a
0047 (`whatsapp_webhook_events`) entraram. Reconferido lendo o documento
OpenAPI que o PostgREST de produção serve, que é a mesma fonte que o app
consome: 14 definições e 29 RPCs. 12
relações de foreign key entre tabelas do schema (reconferidas na mesma
leitura, este número continua certo); a maioria com `ON DELETE
CASCADE` a partir de `workspaces`, exceto `deals.lead_id` (`SET NULL` — um
negócio sobrevive à exclusão do lead vinculado).
