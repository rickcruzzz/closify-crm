# Schema do Velo Funil — engenharia reversa via catálogo Postgres

**Fonte:** projeto Supabase `velofunil-sao-paulo` (`tmyeunithjqkbwvezyyn`, sa-east-1),
inspecionado em 18/08/2026 via `information_schema` e `pg_catalog`, sem
suposição — toda tabela, coluna, chave e enum abaixo veio de consulta real.
Migrations novas mudam este arquivo com o tempo; ao suspeitar de
desatualização, reconsulte o catálogo em vez de confiar cegamente nele (mesma
regra de `docs/estado-atual.md`).

**Reconferido em 02/09/2026, noite — duas tabelas novas, e a fonte mudou.**
Lido de `pg_catalog` e não do OpenAPI: **20 tabelas**, **34 RPCs do projeto**
(65 no catálogo, 31 são da extensão `pg_trgm`), **31 foreign keys**, **15
triggers**, **8 enums**, 67 arquivos de migration (a maior é `0068`).

As tabelas novas são `vigia_ultimo_aviso` (0062) e `notificacoes` (0066). A
mudança de fonte está explicada no "Resumo do catálogo", no fim — em resumo, o
OpenAPI responde "o que a API expõe" e o catálogo responde "o que o banco tem",
e para um diagrama de schema a segunda é a pergunta certa.

A tabela nova é **`feedback`** (0060), o canal de suporte do cliente, com os
anexos e o acompanhamento da 0061. Ela é a primeira tabela do projeto que
guarda texto escrito pelo cliente **sobre o produto**, e não sobre o negócio
dele — por isso não tem relação com `leads` nem com `deals`, e por isso o
`workspace_id` existe sem chave estrangeira: um relato precisa sobreviver à
exclusão da empresa que o escreveu, senão a fila perde justamente o caso que
motivou a saída.

As duas RPCs novas são de purga (`purge_old_error_logs`, `purge_old_feedback`),
chamadas pelo cron de limpeza. As foreign keys **não se mexeram**: seguem 17,
o mesmo número de 26/08.

**Reconferido em 29/08/2026 — estrutura IDÊNTICA, comportamento diferente.**
Lido do OpenAPI do PostgREST de produção: **17 tabelas**, **30 RPCs**, **17
foreign keys** — os três números exatamente iguais aos de 26/08. Nenhuma
tabela, coluna, chave ou enum mudou.

O que mudou foi o corpo de uma função. A **0057** reescreveu
`create_workspace_with_admin` para que o `insert` em `workspaces` **não grave
mais `trial_ate`**: empresa nova nasce no Free, e o reverse trial acabou para
quem chega a partir de agora. A assinatura da função é a mesma, então ela
continua exposta como RPC e a contagem não se mexe.

**É o terceiro caso da mesma classe neste documento** — 0055 reescreveu
`pro_vigente()` por dentro, 0056 criou uma `returns trigger` que o PostgREST
não expõe, e agora a 0057 troca o que uma RPC existente escreve. Três vezes o
catálogo estruturado ficou idêntico enquanto a regra de negócio mudava. É
exatamente por isso que este arquivo tem a seção **Regras que vivem em
trigger** e não se resume ao diagrama.

**A coluna `trial_ate` e a função `em_trial()` continuam existindo, e isso é
decisão.** Medido no dia: **10 empresas ainda dentro do prazo**, com
`trial_ate` intacto. Apagar a coluna cortaria o trial de quem leu a promessa
na tela de cadastro. A 0057 mexe só no `insert`; toda a lógica de vigência e
vencimento fica de pé enquanto houver alguém vivendo dentro dela.

**Reconferido em 26/08/2026 — três tabelas novas, e nenhuma RPC nova.** As
migrations 0054-0056 acrescentaram `assinatura_eventos` (0055) e o par
`conversas`/`mensagens` (0056), levando a contagem de **14 para 17 tabelas**, e
as foreign keys entre tabelas do `public` de **12 para 17**. Mais
`workspaces.aviso_trial_enviado_em` (0055) e um valor novo no enum
`activity_type` (`whatsapp`, 0054).

**O número de RPCs não mudou: continua 30.** É o detalhe que este documento
existe para expor. A 0055 criou tabela e reescreveu `pro_vigente()` **por
dentro** — restaurando a graça por forma de pagamento que a 0051 havia
revertido sem querer; a 0056 criou uma função `returns trigger`
(`checar_teto_de_mensagens`), que o PostgREST não expõe. **Quem monitorasse só
a lista de RPCs não teria detectado nenhuma das duas.** Ver **Regras que vivem
em trigger**, abaixo.

Conferido pelo documento OpenAPI que o PostgREST de produção serve — a mesma
fonte que o app consome —, não pela leitura das migrations. `tasks.type` foi
verificado e usa o **mesmo** `public.activity_type` de `activities.type`, então
o valor novo do enum vale para os dois.

**Reconferido em 24/08/2026 — coluna nova, RPC nova.** As migrations 0051-0053
(reverse trial) acrescentaram `workspaces.trial_ate` (`timestamptz`,
nullable) e a RPC `em_trial(workspace_id)`. Contagem de tabelas continua em
**14** — a 0051 não criou tabela —, mas RPCs subiram de 29 para **30**,
conferido pelo OpenAPI do PostgREST de produção, não pela leitura das
migrations. `pro_vigente()` já existia; o que mudou foi a lógica **dentro**
dela, invisível para quem só lista assinaturas de função — ver **Regras que
vivem em trigger**, abaixo, seção "reverse trial" acrescentada nesta data.

**Reconferido em 23/08/2026 — estrutura intacta, regra nova.** A migration
0050 não criou tabela, coluna nem enum: só uma função `returns trigger` e o
gatilho dela em `workspace_members`. Por isso o catálogo continuava idêntico
naquela data (14 tabelas, 29 RPCs, 12 FKs) enquanto o comportamento do banco
mudou. Função de trigger não aparece entre as RPCs porque o PostgREST não
expõe `returns trigger`, o que é o esperado.

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

**`schema.svg` está três tabelas e dois campos atrás do Mermaid abaixo, desde
26/08/2026** (faltam `conversas`, `mensagens`, `assinatura_eventos`,
`workspaces.trial_ate` e `workspaces.aviso_trial_enviado_em`). A distância
cresce a cada rodada porque a regeneração não roda nesta máquina:
`chrome-headless-shell` baixa mas falha ao subir no Windows local (dois erros
distintos de lançamento, sem sandbox funcional). Comando pra regenerar em
ambiente com Chromium headless de verdade (Linux/Mac, ou WSL):

```sh
npx -y @mermaid-js/mermaid-cli -i docs/schema.md -o docs/schema.svg -b transparent
```

O bloco Mermaid abaixo é a fonte verdadeira e já está correto — é ele que este
documento pede para editar e ler como texto, o SVG é conveniência visual.

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
        +timestamptz trial_ate "nullable, migration 0051"
        +timestamptz aviso_trial_enviado_em "nullable, migration 0055"
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
        +text last_error "nullable, migration 0034 — faltava neste diagrama"
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
        +text origem "publico|dashboard|global|webhook|whatsapp"
        +uuid workspace_id "sem FK, nullable"
        +uuid user_id "→ auth.users, sem FK, nullable"
        +timestamptz created_at
    }

    class notificacoes {
        +uuid id PK
        +uuid workspace_id FK "→ workspaces, CASCADE"
        +uuid user_id FK "→ auth.users, CASCADE, nullable = toda a empresa"
        +text tipo "check: pagamento_confirmado|pagamento_atrasado|plano_vencendo|trial_terminando"
        +text titulo "1..120"
        +text corpo "nullable, ate 400"
        +text href "nullable, check: comeca com /"
        +timestamptz criada_em
        +timestamptz lida_em "nullable"
    }

    class vigia_ultimo_aviso {
        +text chave PK "tipo do alerta, ou __ultima_varredura"
        +integer quantidade
        +timestamptz atualizado_em
    }

    class feedback {
        +uuid id PK
        +text tipo "problema|sugestao"
        +text mensagem
        +text rota "a tela de onde o relato saiu"
        +text plano "free|pro no momento do relato"
        +text user_agent "nullable"
        +uuid workspace_id "sem FK, nullable"
        +uuid user_id "→ auth.users, sem FK, nullable"
        +boolean interno "conta nossa, marcada e NAO escondida"
        +jsonb anexos "[{caminho, nome, tamanho}] no bucket anexos-feedback"
        +text status "aberto|em_andamento|resolvido|descartado"
        +text solucao "nullable, o que foi feito"
        +timestamptz resolvido_em "nullable"
        +timestamptz created_at
    }

    class conversas {
        +uuid id PK
        +uuid workspace_id FK
        +uuid lead_id FK
        +text canal "check: whatsapp"
        +timestamptz ultimo_recebido_em "nullable"
        +timestamptz ultimo_enviado_em "nullable"
        +timestamptz respondida_em "nullable, zera o relogio de espera"
        +uuid dono_id "→ auth.users, FK declarada, SET NULL"
        +timestamptz assumida_em "nullable"
        +timestamptz arquivada_em "nullable"
        +timestamptz created_at
    }

    class mensagens {
        +uuid id PK
        +uuid workspace_id FK
        +uuid conversa_id FK
        +text direcao "check: recebida, enviada"
        +text tipo "check: texto, audio, imagem, video, documento, figurinha, outro"
        +text texto "nullable"
        +text midia_chave "nullable"
        +text midia_mime "nullable"
        +int midia_segundos "nullable"
        +text external_id "nullable, unico por workspace quando nao nulo"
        +uuid enviada_por "→ auth.users, FK declarada, SET NULL"
        +text status "check: pendente, enviada, falhou"
        +text erro "nullable"
        +timestamptz created_at
    }

    class assinatura_eventos {
        +uuid id PK
        +uuid workspace_id FK
        +subscription_status de_status "nullable"
        +subscription_status para_status
        +text origem
        +text billing_type "nullable"
        +text asaas_event_id "nullable"
        +timestamptz criado_em
    }

    workspaces "1" --> "many" workspace_members : CASCADE
    workspaces "1" --> "many" leads : CASCADE
    workspaces "1" --> "many" deals : CASCADE
    workspaces "1" --> "many" activities : CASCADE
    workspaces "1" --> "many" tasks : CASCADE
    workspaces "1" --> "many" subscriptions : CASCADE
    workspaces "1" --> "many" workspace_invites : CASCADE
    workspaces "1" --> "many" integration_connections : CASCADE
    workspaces "1" --> "many" conversas : CASCADE
    workspaces "1" --> "many" mensagens : CASCADE
    workspaces "1" --> "many" assinatura_eventos : CASCADE
    workspaces "1" --> "many" notificacoes : CASCADE

    leads "1" --> "many" deals : SET NULL
    leads "1" --> "many" activities : CASCADE
    leads "1" --> "0..many" tasks : CASCADE

    deals "1" --> "0..many" tasks : CASCADE

    leads "1" --> "0..many" conversas : CASCADE
    conversas "1" --> "many" mensagens : CASCADE
```

*Tabelas soltas, sem FK para nenhuma outra do schema `public`:
`asaas_webhook_events` (dedupe de webhook do Asaas),
`whatsapp_webhook_events` (dedupe de webhook do Evolution, migration 0047),
`rate_limit_attempts` (controle de tentativas de login), `error_logs`
(captura de erro dos boundaries do produto, migration 0046) e **`feedback`**
(canal de suporte do cliente, migrations 0060 e 0061).

`feedback` é a única das cinco cuja ausência de FK é **decisão de produto, não
consequência técnica**: `workspace_id` e `user_id` existem na tabela sem chave
estrangeira de propósito, porque um relato precisa sobreviver à exclusão da
empresa que o escreveu. Com `on delete cascade`, apagar uma empresa levaria
junto exatamente o relato que explicaria por que ela foi embora.
`whatsapp_webhook_events` é a única das quatro que **nasce com purga**
(`purge_old_whatsapp_webhook_events()`, 7 dias, rodada por Vercel Cron): a
projeção de 240 mil eventos/dia com 400 clientes a levaria a 9,7 GB em 12
meses. A irmã do Asaas sobrevive sem limpeza só porque recebe poucas linhas
por mês. Aparecem no diagrama, sem linha de
relação — é o que o catálogo mostra, não omissão. `error_logs` também é
zero-policy (RLS ligada, só `service_role` acessa), mesmo padrão de
`asaas_webhook_events`.*

**`error_logs.origem` é texto livre, não enum, e os valores em uso divergem
por origem.** `reportarErro` (cliente) só emite `publico`, `dashboard` e
`global`; o servidor grava `webhook` e, desde 24/08, `whatsapp` — este último
quando uma mensagem recebida não completa o caminho até o funil e precisa
ficar recuperável. Não virou enum de propósito: é tabela de sistema, sem RLS
e sem consumidor no produto, e um enum obrigaria migration a cada origem
nova.

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
| `mensagens` | `checar_teto_de_mensagens` (**0056**, 26/08) | passar de 200 mil mensagens por empresa |

O teto de `mensagens` é defesa contra abuso, não limite de plano — mesma
doutrina do teto de 5.000 tarefas da 0029, e pelo mesmo motivo: cobrar por
mensagem recebida empurraria a pessoa de volta para o WhatsApp do celular, que
é exatamente o hábito que o produto existe para substituir.

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

### Reverse trial (0051-0053, 24/08 — encerrado pela 0057 em 29/08)

> **Empresa nova não nasce mais em trial.** A 0057 tirou `trial_ate` do
> `insert` de `create_workspace_with_admin`. Tudo o que esta seção descreve
> continua verdadeiro e ativo para as **10 empresas que ainda estão dentro do
> prazo** — a coluna, `em_trial()` e as triggers seguem no lugar. Quando a
> última vencer, elas passam a ser lógica adormecida, não removida.

`pro_vigente(workspace_id)` não ganhou coluna nem parâmetro — só passou a
consultar duas fontes em vez de uma: assinatura Asaas vigente **ou**
`workspaces.trial_ate > now()`. Invisível para quem lista apenas as
assinaturas de função no catálogo; só aparece lendo o corpo dela.

A trigger de limite de membros (0050, tabela acima) e a de criação de
workspace passaram a checar `pro_vigente() and not em_trial(workspace_id)`,
não `pro_vigente()` sozinho. A razão é um furo medido em produção antes da
correção, e ela vale para quem ainda está em avaliação: durante os 7 dias de
trial dava para criar 5 empresas ou convidar
10 colaboradores e **ficar com esse estoque depois do trial acabar**, porque
`pro_vigente()` incluía o trial e a trigger só olhava esse booleano. `em_trial`
isola o caso — o trial libera o *uso* de funcionalidades Pro, nunca a
*permanência* de estoque (empresas extras, colaboradores extras) além do
plano Free.

### A graça pós-vencimento, perdida e restaurada (0044 → 0051 → 0055)

O caso mais caro desta seção, e o que melhor justifica ela existir.

A **0044** fez a graça depois do vencimento depender da forma de pagamento:
1 dia no cartão (a cobrança é instantânea, atraso é inadimplência) e 3 nos
demais (Pix e boleto levam para compensar). A regra virou a função
`dias_de_graca(billing_type)`.

A **0051**, ao acrescentar o reverse trial, **reescreveu `pro_vigente()`
inteira** e voltou para a constante de 3 dias que a própria 0044 tinha marcado
como obsoleta. `dias_de_graca()` ficou órfã no banco: existia, e nenhuma
função, trigger, policy ou índice a chamava. Cinco arquivos TypeScript seguiam
descrevendo em comentário um comportamento que tinha deixado de existir.

Medido antes de corrigir, numa transação com `rollback`: cartão vencido há 2
dias devolvia `true` quando deveria devolver `false`. A **0055** restaurou a
chamada.

**Nada disso aparece no catálogo.** Nome, assinatura e tipo de retorno de
`pro_vigente()` foram idênticos nas três versões. Reescrever uma função inteira
para acrescentar uma cláusula não deixa rastro de que a outra metade regrediu —
e 16 funções deste banco já foram redefinidas mais de uma vez.

Ressalva honesta: o defeito era **latente**. As 14 assinaturas do banco têm
`ultimo_billing_type` nulo ou `UNDEFINED`, e `dias_de_graca` devolve 3 para os
dois. Nenhum cliente foi afetado — foi o momento mais barato possível para
consertar.

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
| `activity_type` | `ligacao`, `email`, `reuniao`, `nota`, `whatsapp` |
| `deal_stage` | `novo`, `contato_realizado`, `proposta_enviada`, `negociacao`, `fechado_ganho`, `fechado_perdido` |
| `integration_provider` | `google_calendar`, `gmail`, `whatsapp` |
| `integration_status` | `connected`, `error`, `disconnected` |
| `subscription_status` | `trialing`, `active`, `past_due`, `canceled` |
| `workspace_invite_status` | `pending`, `accepted`, `expired` |
| `workspace_plan` | `free`, `pro` |
| `workspace_role` | `admin`, `membro` |

`activity_type` ganhou `whatsapp` na migration 0054, e o valor vale para
**duas** colunas: `activities.type` e `tasks.type` compartilham o mesmo enum,
verificado no catálogo e não deduzido pelos valores coincidirem. Antes disso a
mensagem recebida era gravada como `nota` com o texto prefixado por
"WhatsApp: " — o prefixo virava parte do que o cliente escreveu para quem
exportasse, buscasse ou lesse por API.

**`conversas` e `mensagens` não usam enum nenhum.** `canal`, `direcao`, `tipo`
e `status` são `text` com `check constraint`. É escolha: são vocabulários que
ainda vão crescer (um canal novo, um tipo de mídia novo), e `alter type ... add
value` não roda dentro de transação no Postgres, enquanto trocar um `check`
roda. Enum se paga quando o conjunto está estável, que é o caso de
`deal_stage`.

## Resumo do catálogo

**Reconferido em 02/09/2026, noite, contra `pg_catalog` — não contra o
OpenAPI.** A troca de fonte é a correção mais importante desta revisão, e está
explicada no fim desta seção.

**20 tabelas** no schema `public`, todas com Row Level Security ligada
(conferido em `pg_class.relrowsecurity`, 20 de 20). O número já disse 12 (até
23/08), 14 (até 25/08), 17 (26/08) e 18 (01/09). Entraram desde então:
`vigia_ultimo_aviso` (0062, a memória do vigilante) e `notificacoes` (0066, o
sino de avisos dentro do produto).

**34 RPCs do projeto**, e aqui mora uma armadilha nova. O catálogo devolve
**65** funções, e **31 delas são da extensão `pg_trgm`** — `gin_*`, `gtrgm_*`,
`similarity*`, `word_similarity*`, `set_limit`, `show_trgm`. Elas vieram junto
com o índice de busca por nome de contato, são reais, estão no schema `public`,
e **não foram escritas aqui**. Contá-las infla o número em 91% e passa a medir
a extensão em vez do produto.

As do projeto que entraram desde 01/09: `excluir_empresa` (0064),
`purge_old_notificacoes` (0066), `purge_old_rate_limit_attempts` (0067) e
`vigiar_o_vigia` (0063, que roda por `pg_cron` e **não aparece no OpenAPI**,
porque o PostgREST só lista o que ele expõe).

**31 relações de foreign key** entre tabelas do schema, contra 17 na contagem
anterior. **A diferença não é crescimento, é método:** aquela vinha do OpenAPI,
que só enxerga o que está exposto na API; esta vem de `pg_constraint`, que
conta o que o banco de fato tem. É o mesmo erro que o cabeçalho do PRD cometeu
em 01/09 e que está registrado lá.

**15 triggers** e **8 enums**, os dois números medidos pela primeira vez neste
documento — antes as triggers só apareciam descritas em prosa, o que as tornava
impossíveis de conferir por contagem.

### Por que a fonte mudou de OpenAPI para `pg_catalog`

O OpenAPI do PostgREST responde "o que a API expõe". O catálogo responde "o que
o banco tem". As duas perguntas são legítimas e dão números diferentes, e usar
uma achando que é a outra já custou dois cabeçalhos errados neste projeto.

Para um diagrama de schema, a pergunta certa é a do banco: uma função
`returns trigger` não aparece no OpenAPI e continua governando limite de plano;
uma FK para `auth.users` não aparece e continua apagando linha em cascata.

Os comandos exatos estão no cabeçalho do [prd.md](prd.md), com o filtro de
`pg_trgm` escrito, para a próxima conferência não repetir a inflação.
