# Schema do Velo Funil — engenharia reversa via catálogo Postgres

**Fonte:** projeto Supabase `velofunil-sao-paulo` (`tmyeunithjqkbwvezyyn`, sa-east-1),
inspecionado em 18/08/2026 via `information_schema` e `pg_catalog`, sem
suposição — toda tabela, coluna, chave e enum abaixo veio de consulta real.
Migrations novas mudam este arquivo com o tempo; ao suspeitar de
desatualização, reconsulte o catálogo em vez de confiar cegamente nele (mesma
regra de `docs/estado-atual.md`).

<!-- contagem: banco.tabelas=25 banco.rpcs_do_projeto=40 banco.foreign_keys=39 banco.triggers=17 banco.enums=8 -->
**Estrutura reconferida em 18/09/2026.** Lida de `pg_catalog` e não do OpenAPI:
**25 tabelas**, **40 RPCs do projeto**, **39 foreign keys**, **17 triggers**,
**8 enums** — mais **16 funções de trigger**, que não são RPC e por isso contam
à parte.

## As 0096 e 0097, e só UMA delas moveu a contagem de tabelas

    0096   bucket `avatares` + duas COLUNAS em `leads`      tabelas: parado
    0097   tabela `whatsapp_reserva` + `puxar_da_reserva`   tabelas: 24 -> 25

A 0096 guarda a foto de perfil de quem escreve pelo WhatsApp. Ela não cria
tabela: acrescenta `foto_path` e `foto_verificada_em` a `leads`, mais um bucket
no Storage. Bucket **não** entra em `banco.tabelas`, que conta `pg_class`.

A 0097 é a reserva de instâncias já compradas, e ela move três números de uma
vez: a tabela, a foreign key para `workspaces` e a RPC `puxar_da_reserva`.

**As duas colunas da 0096 são separadas de propósito**, e é a parte que merece
ficar escrita: `foto_path` nulo não distingue *"ainda não perguntamos"* de
*"perguntamos e essa pessoa não tem foto"*. Sem `foto_verificada_em`, a
varredura repetiria a mesma busca a cada hora, para sempre, para toda a metade
da população que esconde a imagem de quem não é contato.

## As 0089 e 0090 ENTRARAM, e o +2 de RPC não é uma só

Aplicadas em 16/09 pela Management API, com 24 provas contra produção e tudo o
que elas criaram desfeito por `rollback`.

    tabelas       23 -> 24   `whatsapp_instances` (0090)
    foreign keys  37 -> 38   `whatsapp_instances.workspace_id`
    triggers      16 -> 17   `whatsapp_instances_exige_max` (0090)
    fn de trigger 15 -> 16   `checar_max_para_conectar` (0090)
    enums          8 ->  8   NENHUM. `workspace_plan` continua com dois
                             valores, e é o ponto inteiro do desenho do Max
    RPCs          36 -> 38   DUAS, e só UMA é destas migrations

**A segunda RPC é `get_funnel_performance`, da 0088**, que subiu hoje de manhã.
O carimbo dizia 36 desde antes dela e **ninguém foi avisado** — ver abaixo.

### E a 0091 entrou depois, sem mover NENHUMA das seis

Ela acrescenta `whatsapp_instances.sem_max_desde` e um índice parcial, e é o que
impede instância de empresa que parou de pagar continuar faturando para sempre.
Coluna e índice não entram em nenhuma das seis contagens, e é por isso que elas
ficaram paradas: o carimbo mede objetos, não mudanças.

**E ela expôs uma propriedade do grant de coluna da 0090 que vale registrar.**
`revoke select` na tabela inteira mais `grant select (11 colunas)` significa que
**toda coluna nova nasce FORA do grant**: `sem_max_desde` não é legível por
`authenticated`, sem ninguém ter decidido isso.

É o lado seguro de errar, e é o oposto do que um `grant select` amplo faria — lá
a coluna nova nasceria pública. Conferido depois de aplicar: o SELECT continua
exatamente nas mesmas 11 colunas.

### O conferidor passava limpo sobre os carimbos de banco

`scripts/ci/conferir-documentos.mjs` sem `.env.local` **pula as seis métricas de
catálogo e sai com código 0**. Ele as imprime como não conferidas, e a linha
some no meio da saída.

Achado em 16/09 ao aplicar a 0089: o número real era 37 e o documento dizia 36,
por uma migration inteira. É exatamente a classe de defeito que este script
existe para fechar — em 04/09 ele *"passava limpo sobre os arquivos que continham
os erros"* —, aparecendo de novo por outra porta.

**A regra que fica: `node --env-file=.env.local scripts/ci/conferir-documentos.mjs`.**
Sem a credencial ele confere caminho e carimbo de repositório, e é cego para o
banco.

**As duas tabelas novas são da PROSPECÇÃO do dono, não do produto** — RLS
ligada e **zero policy**, alcançáveis só por `service_role`, mesmo padrão de
`error_logs` e `descadastro_de_prospeccao`.

`prospeccao_prospect` (0084) guarda o prospect abordado e o que aconteceu
depois. As duas chaves dela — `lead_id` e `workspace_id` — são anuláveis,
porque a esmagadora maioria dos prospects nunca vira nem contato.

`prospeccao_interacao` (0086) guarda **uma linha por resposta classificada**:
intenção, objeção, temperatura, confiança, modelo e versão do prompt. As três
chaves dela são `prospect_id`, `conversa_id` e `mensagem_id` — e a última é
**UNIQUE**, o que a torna a idempotência de toda a Fase 2: rodar o
classificador duas vezes sobre a mesma fila não faz a mesma resposta contar
duas vezes na estatística.

**Guardar o modelo e a versão do prompt não é enfeite de auditoria.** Sem os
dois, uma queda de qualidade depois de trocar de modelo fica indistinguível de
*"os prospects pioraram"* — e a segunda conclusão manda mexer no lugar errado.

**E uma RPC SUMIU, o que é raro o bastante para merecer a linha.**
`purge_old_sinais_de_mercado` purgava `sinal_de_mercado`, que a 0075 removeu em
08/09. A função ficou, o cron diário continuou chamando, e
`/api/cron/limpar-eventos` devolvia `ok: false` desde então com
`42P01: relation "public.sinal_de_mercado" does not exist`. As outras seis
purgas rodavam normalmente — o `supabase-js` devolve `{data, error}` em vez de
lançar —, e foi por isso que ninguém notou. Apagada pela 0085.

**O recorte de "RPC" ficou explícito em 11/09, e o número mudou por isso.** O
documento dizia 34 e o método era "65 no catálogo menos 31 do `pg_trgm`".
Remedido em 12/09: o catálogo tem **82** funções em `public`, **31** pertencem a
extensões (conferido por `pg_depend`, não por prefixo de nome), sobram **51** do
projeto — das quais **15 retornam `trigger`** e não são chamáveis. As 36 são as
chamáveis.

**Desde 11/09 estas contagens são conferidas por máquina.** O carimbo acima é
lido por `scripts/ci/conferir-documentos.mjs`, que as compara com
`scripts/ci/contagens.mjs`. Antes disso nada as conferia — e o `prd.md` passou
três dias afirmando 20 tabelas depois que a 0080 criou a 21ª.

**A 32ª foreign key é a da 0076**, `deals.orcamento_tarefa_id → tasks`, e ela é
a primeira deste schema a fechar um CICLO — ver a seção própria abaixo. As três
`check` novas também são dela. A 0077 substitui a função
`checar_referencia_de_negocio` e **não** cria trigger nova.

**A 16ª trigger é `checar_limite_de_orcamentos`, da 0079** (10/09), em `deals`.
É a quarta trava de limite de plano do schema e segue as duas propriedades das
outras três — lê `pro_vigente()` e nunca `workspaces.plan`, e serializa por
workspace com `for update` na linha da empresa, pela mesma razão da 0026.

O que ela tem de próprio é **quando** morde. As três anteriores contam linhas de
um tipo e recusam a partir do teto; esta só conta orçamento **aberto**
(`stage not in ('fechado_ganho','fechado_perdido')`) e só dispara quando
`orcamento_validade` **nasce** — editar a data de um orçamento existente não
consome vaga. Sem a primeira condição o limite viraria contador vitalício; sem a
segunda, empresa que passasse do teto ficaria impedida de corrigir o que já tem.

Ela é a primeira trava deste schema que existe por razão de **conversão** e não
de custo: paywall no momento em que a pessoa sente o valor converte 8-12%,
contra 3-4% de limite arbitrário — e as outras três são todas arbitrárias no
sentido técnico do termo.

<!-- contagem: migrations.arquivos=98 migrations.maior=0099 -->
**98 arquivos de migration, e a maior é `0099`** (remedido em 25/09; o `0049`
não existe, removido em 22/08). Os dois números vêm sempre juntos: a contagem
sozinha convida a inferir `0098`.

**A 0099 abre `whatsapp_instances.provider` para `'evolution'`, e não cria
objeto nenhum.** Ela troca um `check`, troca o `unique` de `instance_id` por um
índice em `(provider, instance_id)`, e é isso. `banco.tabelas` não se moveu, e é
ele que responde essa pergunta — a distinção que os oito saltos de nós sem
arquivo existem para manter.

**As duas ENTRARAM em 16/09**, e as contagens de catálogo acima se moveram
junto — ver a seção logo abaixo do carimbo, no topo deste arquivo.

A previsão escrita aqui antes de aplicar acertou quatro das cinco linhas e
errou uma: dizia `rpcs 36 -> 37`, e o real foi **38**. A diferença não era da
0089 — era a 0088, aplicada horas antes, cujo carimbo ninguém atualizou porque
o conferidor rodava sem credencial e é cego para o banco nesse modo.

Arquivo escrito e objeto existindo continuam sendo perguntas diferentes, e é
por isso que o carimbo as separa.

**A 0072 acrescentou duas tabelas e a 0075 as REMOVEU**, em 08/09:
`enriquecimento_de_lead` e `sinal_de_mercado` viveram dois dias e nunca
receberam uma linha. A pesquisa de mercado do lado do cliente saiu inteira — o
motivo não foi custo, e sim carregar um suboperador fora do Brasil na Política
de Privacidade por um caminho que ninguém percorreu uma vez. **A contagem de
tabelas volta ao que era.**

A prospecção do dono não usava nenhuma das duas e continua inteira.

**A 0074 acrescentou `notificacoes.dispensada_em`** e, mais importante,
**fechou uma promessa que a 0066 escrevia em texto e não impunha**: o comentário
dela dizia "o único campo que muda é `lida_em`", mas RLS restringe LINHA e não
COLUNA, e não havia `grant update (coluna)`. Medido antes de aplicar, um membro
autenticado alcançava `titulo`, `corpo`, `href`, `tipo`, `user_id` e
`workspace_id` por `PATCH` no PostgREST — a 0066 recusa `insert` porque "aviso
forjável é aviso de cobrança forjável", e o `update` aberto chegava quase lá por
outra porta. Agora são duas colunas: `lida_em` e `dispensada_em`.

**A 0073 acrescentou `sinal_de_mercado` ao `check` de `notificacoes.tipo`, e a
0075 o tirou de volta.** A ida e a volta existem como migration própria porque a
0066 escreveu, em texto, que mexer na lista de tipos passa a exigir migration —
é o que transforma "entrou na lista" em decisão, nas duas direções. As policies
da 0066 seguem intactas, inclusive a ausência de `insert` para `authenticated`.

Conferido depois de aplicar, nos dois sentidos: `insert` com o tipo antigo toma
`400` pelo `notificacoes_tipo_check`, e um tipo válido continua passando com
`201`.

**Três migrations entraram depois da leitura de 02/09** e as colunas delas estão
no diagrama abaixo: `workspaces.utm_content` (0069), `subscriptions.ciclo`
(0070) e `workspaces.gclid` (0071). Nenhuma cria tabela, função ou chave — é o
quinto caso da mesma classe já registrada aqui: a estrutura fica parada enquanto
a regra de negócio anda. **A 0076 quebrou esse padrão**, e por isso a estrutura
acima foi remedida.

## A 0076 fechou o primeiro CICLO de foreign key deste schema

`deals` e `tasks` passaram a se referenciar nos **dois sentidos**:

```
tasks.deal_id              -> deals    on delete CASCADE
deals.orcamento_tarefa_id  -> tasks    on delete SET NULL
```

Ciclo de chave estrangeira é legal no Postgres desde que as duas pontas sejam
`nullable`, e as duas são. Mas ele merece parágrafo próprio porque a pergunta
que ele levanta — *"apagar um negócio trava?"* — não se responde lendo o
diagrama. **Foi exercitada contra produção**: o `delete` do negócio que aponta
para a tarefa que aponta para ele passa, sem travar.

**Os dois `on delete` são opostos de propósito, e a assimetria é a decisão.**
Apagar o negócio leva as tarefas dele junto (`cascade`), porque tarefa de
negócio que não existe mais é fila com lixo dentro. Apagar o LEMBRETE não pode
levar o orçamento: quem apaga a tarefa em `/hoje` está dizendo *"não me cobra
disso"*, não *"apague meu orçamento"* — então o elo solta (`set null`) e o
orçamento sobrevive. Provado nos dois sentidos.

**Por que um elo direto, e não achar a tarefa pelo título.** A alternativa era
procurar a tarefa chamada "Cobrar retorno do orçamento". Isso quebra no instante
em que alguém a renomeia na tela, e aí registrar o orçamento de novo criaria uma
SEGUNDA cobrança para o mesmo negócio — a classe de defeito que o
`reactStrictMode` do Next 14 (que invoca a action duas vezes em desenvolvimento)
revela em uma tarde e produção revela em silêncio.

## A 0078 fez o Pro cobrir cinco empresas do mesmo dono

`pro_vigente()` consultava a assinatura DAQUELA empresa. Como toda empresa
nova nasce Free (0057), quem pagava criava a segunda e batia num teto de 50
contatos — dentro de um plano já comprado. E a tela dizia "Empresas
ilimitadas" em três lugares.

A função ganhou um terceiro caminho: a assinatura viva de **qualquer empresa
do mesmo `created_by`**. Segue o DONO e não a associação de admin, senão
aceitar um convite viraria upgrade das empresas de quem aceitou.

O teto de cinco mora na CRIAÇÃO, em `criar_workspace_com_admin`, e não em
`pro_vigente`: duas regras contando a mesma coisa acabam discordando, e é
assim que um limite vira decorativo.

E a mesma migration consertou um defeito antigo dessa função de criação: ela
lia `w.plan = 'pro'`, a COLUNA, quando a regra escrita deste projeto é que
plano se lê pela função. Um Pro vencido continuava liberando empresa nova.

    antes   empresa do mesmo dono, sem assinatura propria   pro_vigente false
    depois                                                  pro_vigente TRUE
    controle  empresa cujo dono nao tem assinatura nenhuma  pro_vigente false

**E a 0077 fechou o buraco que a FK não cobre.** Chave estrangeira garante que a
tarefa EXISTE, não que ela é da mesma empresa: medido antes de aplicar, um
`update` pondo a tarefa da empresa B no negócio da empresa A era **aceito**.
É a terceira aparição da mesma classe — a 0038 nasceu para fechá-la em
`lead_id`, a auditoria de 18/08 a achou de novo em `tasks.assignee_id`. Depois
da 0077 o mesmo `update` toma `42501`, e o `insert` equivalente também.

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
chamadas pelo cron de limpeza. As foreign keys **não se mexeram** — mas o
número aqui dizia **17** enquanto o "Resumo do catálogo", no fim deste mesmo
documento, dizia **31**, e as duas linhas foram escritas na mesma revisão de
02/09.

**Não são duas medições: são dois métodos.** 17 é o que o OpenAPI expõe, 31 é o
que `pg_constraint` conta. A segunda é a certa para um diagrama de schema, e é a
que vale — **31**. A linha ficou aqui contando o número antigo porque quem
corrigiu o fim do documento não voltou ao começo, e quem lê o cabeçalho para de
ler antes do resumo.

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
        +text utm_source "nullable, migration 0041"
        +text utm_medium "nullable, migration 0041"
        +text utm_campaign "nullable, migration 0041"
        +text utm_content "nullable, migration 0069 — qual PECA trouxe"
        +text gclid "nullable, migration 0071 — id do clique no Google Ads"
        +text fbc "nullable, migration 0042 — clique de anuncio do Meta"
        +text fbp "nullable, migration 0042"
        +boolean consentimento_analitico "nullable, migration 0065 — LGPD"
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
        +text foto_path "0096, no bucket avatares"
        +timestamptz foto_verificada_em "0096"
    }

    class whatsapp_reserva {
        +uuid id PK
        +text provider "check zapi"
        +text instance_id UK
        +text token_cifrado
        +text observacao
        +timestamptz created_at
        +timestamptz usada_em "nulo = livre"
        +uuid usada_por FK "→ workspaces, on delete set null"
    }

    class prospeccao_prospect {
        +uuid id PK
        +text dominio UK
        +text telefone_ultimos8
        +text nome
        +text vertical
        +int pontos
        +text mensagem_enviada
        +timestamptz enviado_em
        +timestamptz respondido_em
        +text estagio "OPTED_OUT e terminal"
        +text intencao "0086"
        +text objecao
        +text temperatura
        +int mensagens_recebidas
        +bool precisa_humano
        +timestamptz classificado_em
        +timestamptz automacao_detectada_em
        +int respostas_automaticas
        +uuid lead_id FK "→ leads, set null"
        +uuid workspace_id FK "→ workspaces, set null"
        +timestamptz created_at
        +timestamptz updated_at
    }

    class prospeccao_interacao {
        +uuid id PK
        +uuid prospect_id FK "→ prospeccao_prospect, set null"
        +uuid conversa_id FK "→ conversas, CASCADE"
        +uuid mensagem_id FK UK "→ mensagens, CASCADE"
        +text intencao
        +text objecao
        +text objecao_texto
        +text temperatura
        +text estagio_antes
        +text estagio_depois
        +numeric confianca
        +bool precisa_humano
        +text motivo_humano
        +text resumo
        +text modelo
        +text versao_do_prompt
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
        +date orcamento_validade "nullable, 0076"
        +text orcamento_descricao "nullable, teto 2000"
        +uuid orcamento_tarefa_id "FK tasks, nullable, 0076"
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
        +text ciclo "MONTHLY|YEARLY, migration 0070 — decide 30 dias ou 1 ano"
        +text plano "pro|max, migration 0089 — decide DIREITO, nao duracao"
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
        +text tipo "check: pagamento_confirmado|pagamento_atrasado|plano_vencendo|trial_terminando|convite_instagram|dica_de_uso"
        +text titulo "1..120"
        +text corpo "nullable, ate 400"
        +text href "nullable, check: comeca com /"
        +timestamptz criada_em
        +timestamptz lida_em "nullable"
    }

    class descadastro_de_prospeccao {
        +uuid id PK
        +text email_hash UNIQUE "sha256 — o e-mail NAO e guardado"
        +text dominio "nullable"
        +text origem "nullable"
        +timestamptz created_at
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
        +text status "check: pendente, enviada, entregue, lida, falhou (0090)"
        +text erro "nullable"
        +timestamptz created_at
    }

    class whatsapp_instances {
        +uuid id PK
        +uuid workspace_id FK "UNIQUE, uma conexao por empresa"
        +text provider "check: zapi"
        +text instance_id "UNIQUE, id no provedor"
        +text token_cifrado "NUNCA sai para o navegador"
        +text segredo_do_webhook "UNIQUE, resolve a empresa na entrada do webhook"
        +text telefone "nullable, so depois do QR lido"
        +text status "check: ausente, conectando, conectado, desconectado, erro"
        +text ultimo_erro "nullable, motivo CRU do provedor"
        +timestamptz conectada_em "nullable"
        +timestamptz desconectada_em "nullable"
        +timestamptz vista_em "nullable, prova de vida"
        +timestamptz created_at
        +timestamptz updated_at
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
    workspaces "1" --> "1" whatsapp_instances : CASCADE
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
    deals "0..1" --> "0..1" tasks : SET NULL orcamento_tarefa_id

    leads "1" --> "0..many" conversas : CASCADE
    conversas "1" --> "many" mensagens : CASCADE
    leads "1" --> "0..1" prospeccao_prospect : SET NULL
    workspaces "1" --> "0..many" prospeccao_prospect : SET NULL
    prospeccao_prospect "1" --> "0..many" prospeccao_interacao : SET NULL
    conversas "1" --> "0..many" prospeccao_interacao : CASCADE
    mensagens "1" --> "0..1" prospeccao_interacao : CASCADE
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
| `leads` | `validar_limite_de_leads` (0023, corrigida na 0026, teto refeito na 0052) | 51º contato num workspace Free, e o número sai de `FREE_LEAD_LIMIT` |
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

Duas propriedades das quatro triggers de limite (a quarta é a
`checar_limite_de_orcamentos`, da 0079), iguais por decisão e não por acaso:
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

**21 tabelas** no schema `public`, todas com Row Level Security ligada
(conferido em `pg_class.relrowsecurity`, 21 de 21). O número já disse 12 (até
23/08), 14 (até 25/08), 17 (26/08), 18 (01/09) e 20 (até 09/09). Entraram desde
então: `vigia_ultimo_aviso` (0062, a memória do vigilante), `notificacoes`
(0066, o sino de avisos dentro do produto) e `descadastro_de_prospeccao`
(0082).

A 0082 é a terceira tabela de SISTEMA — RLS ligada e zero policy, como
`error_logs` e `asaas_webhook_events`. Ela guarda quem pediu para não receber
e-mail de prospecção, e existe como tabela, e não como o arquivo
`nao-perturbe.txt`, por dois motivos que o arquivo não atende: quem escreve é
um estranho clicando num link em produção, onde não há disco; e é obrigação
legal (Art. 18, § 2º), que precisa sobreviver a deploy e a auditoria.

**O e-mail é guardado em hash, nunca em texto.** Uma lista de descadastro
legível seria uma lista de endereços válidos — o ativo mais valioso para quem
a obtivesse, criado justamente para atender à LGPD.

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

**16 triggers** e **8 enums**, os dois números medidos pela primeira vez neste
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
