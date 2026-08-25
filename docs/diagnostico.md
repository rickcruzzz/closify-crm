# Diagnóstico do sistema

Varredura de 25/08/2026. Procura as classes de defeito que **`tsc`, `lint`,
`test` e `build` não conseguem ver** — foram elas que produziram seis defeitos
reais em produção só na sessão que motivou este documento.

Cada achado carrega a prova que o sustenta. Achado sem prova não entrou. Achado
sem consequência descrita também não: lista com ruído é lista que ninguém lê,
lição já paga em `/dono/alertas`, onde 8 de 11 alertas eram lixo.

**Nada foi corrigido durante a varredura**, de propósito. Correção misturada
com diagnóstico esconde o que foi medido do que foi mudado.

## Resumo

| classe | achados | o pior deles |
|---|---|---|
| 1 · regressão silenciosa entre migrations | 1 | `pro_vigente` perdeu a graça por forma de pagamento |
| 2 · código escrito e nunca ligado | 7 | duas Server Actions vivas sem nenhum chamador |
| 3 · consulta que não lê a coluna da tela | 1 | a tela de cobrança não sabe quando o plano vence |
| 4 · falha silenciosa de leitura | 74 varridos, 1 grave | webhook pode duplicar contato |
| 5 · coleção sem teto (corte de 1.000 do PostgREST) | 18 varridos, 1 grave | histórico do contato cresce sem limite |
| 6 · documento que contradiz o sistema | 3 | `CRON_SECRET` listado como pendente há dias, e existe |
| 7 · mesma regra escrita em dois lugares | 2 | todo limite de plano vive em TS **e** no banco |

---

## Classe 1 — regressão silenciosa entre migrations

Reescrever uma função inteira para acrescentar uma cláusula é o padrão normal
deste projeto, e **não deixa nenhum rastro de que a outra metade regrediu**.

### 1.1 · `pro_vigente()` deixou de usar `dias_de_graca()` — CORRIGIR AGORA

**Prova**, lida do banco de produção (`tmyeunithjqkbwvezyyn`), não das migrations:

```sql
select proname,
       pg_get_functiondef(oid) like '%dias_de_graca%' as usa_dias_de_graca,
       pg_get_functiondef(oid) like '%dias_para_compensacao_bancaria%' as usa_compensacao
  from pg_proc ...

pro_vigente     usa_dias_de_graca = false   usa_compensacao = true
dias_de_graca   existe, e nenhuma função, trigger, policy ou índice a chama
```

A `0044` fez a tolerância pós-vencimento depender da forma de pagamento: **1
dia para cartão** (recusa é imediata) e **3 para o resto** (Pix e boleto levam
dias para compensar). A `0051`, ao acrescentar o trial, reescreveu
`pro_vigente()` inteira e voltou para `dias_para_compensacao_bancaria()`, a
constante de 3 dias que a própria 0044 marcou como OBSOLETA.

**O que quebra:** cartão recusado ganha **3 dias de Pro em vez de 1**. Duas
vezes mais tempo de serviço não pago, em todo cliente de cartão.

**Onde:** `supabase/migrations/0044_graca_por_forma_de_pagamento.sql:65,100-116`
contra `0051_trial_de_sete_dias.sql:77-101`.

### O que a varredura NÃO cobre, dito na cara

A comparação automática entre versões pega **chamada que sumiu** e **número que
mudou**. Não pega cláusula `where` removida, condição invertida nem mudança de
`security definer`. E a extração por expressão regular falhou em algumas
funções cujo corpo usa delimitador diferente de `$$`.

Isso significa que **classe 1 pode ter mais casos do que este um**. As 16
funções redefinidas mais de uma vez estão listadas abaixo, e as de dinheiro e
permissão merecem leitura humana das duas versões:

```
6x  apply_asaas_subscription_status   0014 0020 0021 0022 0027 0044
6x  checar_limite_de_leads            0023 0026 0027 0037 0040 0052
5x  create_workspace_with_admin       0007 0018 0038 0051 0053
5x  accept_workspace_invite           0011 0012 0028 0038 0039
4x  proteger_colunas_do_workspace     0019 0021 0022 0027
3x  pro_vigente                       0027 0044 0051   ← achado 1.1
```

---

## Classe 2 — código escrito e nunca ligado

Varredura: para cada `export` de `lib/**`, `app/**` e `hooks/**`, contagem de
referências em todo o repositório fora do próprio arquivo.
`433 arquivos varridos`.

### 2.1 · `enviarTexto` — LIGAR

`lib/integrations/evolution/api.ts:433`. `POST /send/text`, escrita e testada.
**Nenhum chamador em todo o repositório** (2 ocorrências: a definição e um
comentário no mesmo arquivo).

O produto recebe mensagem de WhatsApp e não tem como responder. Já é o passo 10
do plano vigente.

### 2.2 · `tierDaConexao` e `diasParaProximoTier` — LIGAR JUNTO

`lib/integrations/evolution/aquecimento.ts:72,83`. Têm teste, **nenhum
consumidor de produção**.

**O que quebra:** é o limite de envio por idade da conexão (10/h na primeira
semana, 20, depois 30). Sem ele ligado, o envio de 2.1 sairia **sem teto
nenhum**, que é o caminho mais rápido para a Meta banir o número. As duas coisas
têm que entrar na mesma rodada.

### 2.3 · `iniciarOnboarding` — Server Action viva, zero chamadores

`lib/onboarding/actions.ts:64`, arquivo com `'use server'` no topo.

O comentário dela, na linha 63, diz: *"Chamado pelo botão 'Começar
configuração'"*. **Nenhum botão a chama.** Uma ocorrência no repositório
inteiro: a própria definição.

Não é buraco de segurança — ela abre sessão (`abrirSessao()`) e só escreve na
linha do próprio usuário. Mas é **endpoint HTTP vivo que ninguém exercita**, com
um comentário afirmando um chamador inexistente.

### 2.4 · `updateWorkspaceName` — Server Action viva, zero chamadores

`lib/workspace/actions.ts:38`, também `'use server'`. Valida com Zod e exige
`requireAdmin()`, então está guardada. Sem nenhum chamador.

### 2.5 a 2.7 · mortos sem consequência

```
precisaDeOnboarding    lib/onboarding/estado.ts
limparWorkspaceAtivo   lib/workspace/ativo.ts
rotuloDoSegmento       lib/validations/onboarding.ts
ehProviderGoogle       lib/integrations/google.ts
lib/mock-data.ts       arquivo inteiro, 17 linhas, nunca importado
```

`lib/mock-data.ts` guarda três empresas fictícias de uma versão que não existe
mais. Uma delas se chama "Agência Nova Era", que **por coincidência é o nome de
um workspace real** no banco — o mesmo do alerta de domínio digitado errado.
Confusão esperando para acontecer numa busca futura.

### Ressalva do método

Também apareceram 25 exports usados **só pelos próprios testes**. A maioria é
função auxiliar exportada de propósito para ser testável, o que é padrão da
casa e não é defeito. Não entraram como achado.

---

## Classe 3 — consulta que não lê a coluna que a tela promete

### 3.1 · A tela de cobrança não sabe quando o plano vence

`lib/asaas/queries.ts:42` faz:

```ts
.select('status, asaas_subscription_id')
```

**`current_period_end` nunca é lido**, então nunca chega a
`SubscriptionCard`. O que a tela mostra é o vencimento da **fatura**, buscado no
Asaas (`components/settings/subscription-card.tsx:122,131`) — outra coisa:

```
vencimento da fatura   quando a cobrança precisa ser paga
current_period_end     até quando o Pro funciona          ← ninguém vê
```

Quem está em trial não vê data nenhuma: `workspaces.trial_ate` só aparece na
tarja do layout, a partir de 3 dias.

Já é o passo 5 do plano vigente.

---

## Classe 4 — falha silenciosa de leitura

`const { data } = await supabase...` sem pegar `error`. O PostgREST devolve o
erro no campo `error`; ignorá-lo faz `data` vir nulo e a leitura virar
**"0 linhas"** sem ninguém saber. Custou dois diagnósticos errados nesta base.

**74 ocorrências varridas.** A maioria **falha para o lado seguro** e por isso
não entrou: `pro_vigente` e `is_workspace_admin` com `data` nulo viram "não
pode", que é negar. Falha fechada não é defeito.

### 4.1 · O webhook do WhatsApp pode duplicar o contato

`app/api/webhooks/evolution/[workspaceId]/[segredo]/route.ts:489`:

```ts
const { data: encontrado } = await admin.rpc('encontrar_lead_por_telefone', {...})
```

**O que quebra:** se a RPC falhar por qualquer motivo, `encontrado` vem nulo, o
webhook conclui "número desconhecido" e **cria um contato novo para alguém que
já existe**. A pessoa passa a ter duas fichas, com o histórico partido entre as
duas, e nada registra que isso aconteceu.

É o caminho mais quente do produto, e o único onde uma leitura nula produz
**escrita errada** em vez de negação.

### 4.2 · Mesma rota, dois casos menores

```
route.ts:255   conexao        erro vira 404, e o Evolution desiste após 5 tentativas
route.ts:618   tarefaAberta   erro vira tarefa duplicada "Responder no WhatsApp"
```

---

## Classe 5 — coleção sem teto

O PostgREST corta em **1.000 linhas e não avisa**. Quem não põe `.limit()`
explícito mente em silêncio no dia em que o cliente crescer.

**18 ocorrências varridas.** As de `workspace_members` e `workspaces` são
naturalmente limitadas e não entraram. As com `.in(...)` já vêm de conjunto
fechado.

### 5.1 · O histórico do contato cresce sem limite, e piora com o WhatsApp

`lib/leads/queries.ts:126`:

```ts
.from('activities')
.select('id, type, description, created_at, author_id')
.eq('lead_id', leadId)
.order('created_at', { ascending: false })
```

Sem `.limit()` e sem paginação: **toda visita à ficha do contato carrega o
histórico inteiro** dele para a memória.

**Por que agora importa mais do que antes:** desde a migration `0054`, cada
mensagem de WhatsApp recebida vira uma linha em `activities`. Um cliente
conversador ao longo de meses chega perto do corte, e a tela passaria a esconder
as atividades mais antigas **sem dizer que escondeu**. A tela de Conversas do
plano vigente multiplica esse volume.

---

## Classe 6 — documento que contradiz o sistema

Nenhum portão do projeto lê documento. Afirmação escrita aqui envelhece sozinha.

### 6.1 · `CRON_SECRET` está listado como pendência e existe

`docs/estado-atual.md`, seção "Pendente do dono", afirma que a variável nunca
foi colada na Vercel e que o cron toma 401 todo dia em silêncio.

**Prova**, medida na API da Vercel em 25/08:

```
CRON_SECRET                 production/preview
NEXT_PUBLIC_META_PIXEL_ID   production/preview
EVOLUTION_API_URL           production/preview
EVOLUTION_WEBHOOK_SECRET    production/preview
META_ADS_TOKEN              NAO EXISTE   (correto, decisão de 25/08)
```

**O que quebra:** a pendência falsa desvia atenção de pendências reais, e uma
sessão futura pode "corrigir" algo que já funciona.

### 6.2 · A VPS do Evolution não existe mais no DNS

```
evolution-go-jinn.srv1919565.hstgr.cloud   ENOTFOUND
srv1919565.hstgr.cloud                     ENOTFOUND   (o host pai também)
www.velofunil.com.br                       resolve normal
```

Testado pelo resolvedor do sistema e pelo `8.8.8.8`. Nem o host pai resolve, o
que descarta "Evolution fora do ar" e aponta para a VPS removida, renomeada ou
com plano vencido.

**O que quebra:** o WhatsApp é o motivo nº 1 de abandono de CRM na PME
brasileira, com prazo medido de **uma semana**. Isso deixou de ser pendência de
infraestrutura e virou pendência de receita. **Ação do dono**, no painel da
Hostinger.

### 6.3 · Cinco comentários descrevem um comportamento que não existe

`dias_de_graca` está órfã no banco (achado 1.1), e **cinco arquivos a citam como
se estivesse ativa**:

```
app/api/webhooks/asaas/route.ts:29
lib/asaas/aplicar-evento.ts:42
lib/asaas/status-real.ts:30
lib/dono/queries.ts:75
types/supabase.ts:436
```

**O que quebra:** quem for mexer em cobrança lê cinco fontes concordando entre
si e conclui que a graça depende da forma de pagamento. Ela não depende.

---

## Classe 7 — mesma regra escrita em dois lugares

### 7.1 · Todo limite de plano vive em TypeScript **e** no banco

```
contatos Free    50   lib/plans.ts:28        0052:48
membros Free      2   lib/plans.ts:29        0048:36  0050:54  0053:165
empresas Free     1   lib/plans.ts:41        0053 (create_workspace_with_admin)
dias de trial     7   lib/plans/trial.ts:11  0051:136  0053:105
```

O banco é a regra que **vale** (trigger). O TypeScript é o que a tela
**promete**. Divergir não gera erro em lugar nenhum: só faz a tela mentir para
o cliente.

**Já quase aconteceu:** a `0040` permitia 300 contatos e a `0052` baixou para
50. O `lib/plans.ts` acompanhou — porque alguém lembrou, não porque algo cobrou.

O comentário de `lib/plans/trial.ts:10` admite a duplicação por escrito:
*"Espelha `dias_de_trial` da migration 0051"*.

### 7.2 · "Está acabando" tem três números diferentes

```
tela do trial       3 dias   lib/plans/trial.ts:26   AVISAR_A_PARTIR_DE
e-mail do Pro       2 dias   app/api/cron/reconciliar-assinaturas/route.ts:156
                             número cru, sem constante nomeada
plano aprovado      4 dias
```

**O que quebra:** a tarja avisa o cliente de trial faltando 3 dias; o e-mail de
Pro sai faltando 2; e nenhum dos dois sabe do outro. Um cliente pode ver a tela
dizendo uma coisa e receber e-mail dizendo outra.

O número do cron nem é constante — está escrito no meio da expressão
(`2 * 24 * 60 * 60 * 1000`), onde uma busca por nome não encontra.

---

## O que fazer com isto

| achado | quando | onde já está previsto |
|---|---|---|
| 1.1 `pro_vigente` sem `dias_de_graca` | **agora** | plano, passo 1 |
| 3.1 tela não mostra o vencimento | **agora** | plano, passo 5 |
| 7.2 três números para "está acabando" | **agora** | plano, passos 2 e 5 |
| 6.3 cinco comentários mentindo | **agora**, junto de 1.1 | — |
| 2.1 + 2.2 `enviarTexto` e aquecimento | próxima rodada | plano, passo 10 |
| 4.1 webhook duplicando contato | próxima rodada | — |
| 5.1 histórico sem teto | antes de Conversas ir ao ar | — |
| 6.1 `CRON_SECRET` falso pendente | junto da próxima escrita em docs | plano, passo 15 |
| 6.2 VPS fora do DNS | **ação do dono**, não é código | plano, bloqueio |
| 2.3 a 2.7 código morto | quando encostar no arquivo | — |
| 7.1 limites duplicados | só com teste que trave os dois | — |

**7.1 não tem correção barata**, e é honesto dizer: unificar exigiria a tela ler
o limite do banco a cada carregamento, pagando rede para saber um número que
muda uma vez por ano. O caminho proporcional é um teste que leia as duas fontes
e falhe quando divergirem — não existe hoje.
