# Velo Funil — auditoria de estado real

**Gerado em:** 12/09/2026
**Método:** inspeção do código e consulta ao catálogo real do Postgres e à API
do Asaas. Nada aqui foi deduzido de documentação — quando o documento e o
código divergiram, o código venceu, e a divergência está registrada.

**Convenções desta auditoria:**

- `IMPLEMENTADO` — existe, roda, com arquivo e linha citados
- `PARCIAL` — existe uma parte e falta outra, nomeada
- `NÃO IMPLEMENTADO` — não existe no código
- `NÃO FOI POSSÍVEL CONFIRMAR` — não consegui medir, e digo por quê

Nenhum valor de variável de ambiente, token ou chave aparece neste documento.
Apenas nomes.

---

## 1. Visão geral do produto

**O que é.** CRM SaaS multiempresa para PMEs de serviço no Brasil, com pipeline
Kanban. O recurso central é **orçamento com prazo**: ao salvar a validade de um
orçamento nasce uma tarefa de retorno dois dias antes de vencer.

**Público-alvo (medido, não suposto).** Cinco nichos aprovados por régua escrita
antes de olhar o resultado (`ORCAMENTO >= 2`, `FORTE >= 4`, `CONTATO >= 6`), em
`docs/mercado/nichos-medidos-2026-09-06.md`: dedetização, comunicação visual,
marcenaria, locação de equipamentos, eventos corporativos.

**Preços, lidos de `lib/plans.ts`:**

```
FREE_LEAD_LIMIT          50      contatos no plano gratuito
PRO_PLAN_PRICE           97      R$/mes, pela empresa inteira
PRO_ANUAL_MESES_COBRADOS 10      doze meses pelo preco de dez
PRO_ANUAL_PRICE          970     derivado: 97 x 10
```

> **Divergência encontrada:** `lib/plans.ts:230` comenta `/** R$ 490. Doze meses
> pelo preço de dez. */` sobre uma constante que hoje vale **970**. O comentário
> é do tempo em que o mensal era R$ 49. O cálculo está certo; o comentário
> mente. **NÃO CORRIGIDO** — fora do escopo desta auditoria.

**Estado de produção.** Em produção em `www.velofunil.com.br`. **Um** cliente
externo real (ver seção 10), **zero pagantes externos**.

**Stack, conferida no `package.json` e no código:**

```
frontend    Next.js 14.2.35 (App Router), React 18, TypeScript 5,
            Tailwind v4, shadcn/ui, @dnd-kit, Recharts
backend     Next.js API Routes + Server Actions, runtime nodejs
banco       Supabase PostgreSQL, regiao sa-east-1
auth        Supabase Auth (@supabase/ssr)
deploy      Vercel, regiao gru1, promocao MANUAL
e-mail      Resend
pagamento   Asaas (nao Stripe)
analytics   Vercel Analytics; Meta Pixel + CAPI; Google Ads gtag
```

---

## 2. Arquitetura atual

```
NAVEGADOR
  |
  +-- Server Components (app/)  --> Supabase (RLS por workspace_id)
  +-- Server Actions            --> mutacoes
  |
  +-- Meta Pixel (consentimento) / Google Ads gtag (so em /bem-vindo)

VERCEL CRON (vercel.json)
  |
  +-- /api/cron/vigia                    0 * * * *   (de hora em hora)
  |     +--> Asaas (assinaturas, cobrancas, webhooks)
  |     +--> Supabase (erros, suporte, trials)
  |     +--> Resend (e-mail)   +  Evolution API (WhatsApp)  [desde 12/09]
  |
  +-- /api/cron/reconciliar-assinaturas  0 12 * * *  (09:00 Sao Paulo)
  |     +--> Asaas --> aplicarEventoAsaas --> Supabase + Resend
  |
  +-- /api/cron/limpar-eventos           0 6 * * *   (03:00 Sao Paulo)

ASAAS --> POST /api/webhooks/asaas --> aplicarEventoAsaas
                                         +--> subscriptions, workspaces
                                         +--> Resend, notificacoes, Meta CAPI

OPERACAO LOCAL (nao roda na Vercel)
  scripts/inteligencia/prospectar.mjs      --> Exa API --> CSV + leads
  scripts/inteligencia/enviar-evolution.mjs --> Evolution API --> WhatsApp
  app/(dono)/**                            --> Central, 404 fora de localhost
```

**Storage:** Supabase Storage, bucket `logos` (logo da empresa no onboarding).

**LLM:** OpenAI, **apenas** em `app/api/sdr/responder/route.ts` e
`lib/sdr/midia.ts` (whisper-1 para áudio, gpt-4o-mini para imagem).

---

## 3. Banco de dados

Medido no catálogo (`pg_class`), não nas migrations. **21 tabelas em `public`**,
**todas com RLS ligada**.

> **Esta contagem é do momento da auditoria e já mudou: são 22 desde a 0084**,
> na mesma data. `prospeccao_prospect` entrou, e `whatsapp_webhook_events` e
> `descadastro_de_prospeccao` deixaram de estar "sem uso" — ver a seção 18. O
> resto da tabela abaixo continua valendo, e fica como fotografia de onde o
> sistema estava quando o diagnóstico foi feito.

| Tabela | Finalidade | Policies | Linhas | Usada pelo código |
|---|---|---:|---:|---|
| `workspaces` | empresa; 33 colunas, inclui UTM, `fbc`, `fbp`, `gclid`, consentimento | 3 | 49 | sim |
| `workspace_members` | vínculo usuário↔empresa, papel | 4 | 53 | sim |
| `workspace_invites` | convites, `pending/accepted/expired` | 3 | 8 | sim |
| `leads` | contatos | 4 | 624 | sim |
| `deals` | negócios; `orcamento_validade`, `orcamento_tarefa_id` | 4 | 309 | sim |
| `tasks` | tarefas e próxima ação | 4 | 62 | sim |
| `activities` | timeline do lead | 4 | 600 | sim |
| `conversas` | conversa de WhatsApp por lead | 3 | 6 | sim |
| `mensagens` | mensagens da conversa, com mídia | 3 | 10 | sim |
| `subscriptions` | assinatura; `ciclo`, `current_period_end` | 1 | 18 | sim |
| `assinatura_eventos` | trilha de mudança de status | 1 | 6 | sim |
| `asaas_webhook_events` | dedupe de webhook | 0 | 95 | sim |
| `whatsapp_webhook_events` | dedupe de webhook | 0 | 0 | **sem uso hoje** |
| `notificacoes` | sino dentro do produto | 2 | 53 | sim |
| `onboarding_state` | estado por **usuário**, não por empresa | 3 | 52 | sim |
| `integration_connections` | Google Calendar, Gmail, WhatsApp | 4 | 10 | sim |
| `error_logs` | erros de produção | 0 | 12 | sim |
| `feedback` | suporte | 0 | 27 | sim |
| `rate_limit_attempts` | limite por IP | 0 | 48 | sim |
| `vigia_ultimo_aviso` | memória do vigia | 0 | 5 | sim |
| `descadastro_de_prospeccao` | opt-out de prospecção | 0 | **0** | sim, sem uso |

**Enums (8):** `activity_type`, `deal_stage` (`novo`, `contato_realizado`,
`proposta_enviada`, `negociacao`, `fechado_ganho`, `fechado_perdido`),
`integration_provider`, `integration_status`, `subscription_status`,
`workspace_invite_status`, `workspace_plan`, `workspace_role`.

**NÃO EXISTEM** tabelas de: prospects, scoring, campanhas, agentes, intenção,
objeção, ranking de mensagem. **A prospecção inteira vive em arquivo** — CSV em
`docs/mercado/universo-*.csv` e `.dono-prospeccao.json`, por decisão registrada
em `lib/dono/silenciados.ts`.

---

## 4. Prospecção / Exa — IMPLEMENTADO, fora do produto

**Chamado em um único lugar:** `scripts/inteligencia/prospectar.mjs:147`. Não
há SDK — `fetch` direto para `https://api.exa.ai/`.

**Rotas usadas:**

| Rota | Onde | Parâmetros |
|---|---|---|
| `search` | `:193` `semear()` | `category: 'company'`, `type: 'auto'`, até 50 resultados |
| `search` | `:227` `buscarDecisor()` | `category: 'linkedin profile'`, 5 resultados |
| `findSimilar` | `:206` `expandir()` | 10 resultados, `excludeSourceDomain`, `excludeDomains` |
| `contents` | `:241` `detalhar()` | `text`, `extras.links=30`, `subpages: 2`, `livecrawl: 'preferred'` |

**Teto por FASE** (`:129-134`), não um balde único — decisão documentada: numa
rodada de 5 praças as sementes consumiam o orçamento e o `contents`, que é o que
vira contato, nunca rodava.

**Erros:** `401`/`402` sinalizam `CreditoAcabou` e **param a rodada com
relatório**, gravando o que já colheu. Demais erros lançam.

**Dedupe:** leitura paginada do domínio no Supabase, comparada em memória —
`.in()` do PostgREST quebra com listas longas (medido: 500 valores dão 400).

**Fluxo:** Exa → `pontuarProspect` → CSV (`--universo`) e/ou `leads` no banco
(`--topo=N`) → rota local `/dono/prospeccao/fila` → `enviar-evolution.mjs`.

**Concorrência:** nenhuma. Sequencial por construção.

---

## 5. Score — IMPLEMENTADO

`lib/inteligencia-de-mercado/dominio/prospeccao.ts`, função
`pontuarProspect(p: ProspectBruto): ProspectPontuado`.

**Pesos, lidos do código:**

```
CONTATO          WhatsApp direto            +3
                 telefone na pagina         +2
                 e-mail na pagina           +2
                 Instagram                  +1

PROPENSAO        tem equipe de vendas       +4
                 pede orcamento no site     +3
                 ja paga por software       +3
                 mais de uma unidade        +2
                 contrata vendedor no site  +2
                 agendamento no site        +1

OUTROS           dominio .com.br            +2
                 ja menciona um CRM         -3
                 parece diretorio           -5
                 dominio excluido           = 0 e nao qualificado
```

**Faixa real na fila de hoje:** 17 no topo, mediana 10. Distribuição:
3 com 17, 3 com 16, 4 com 14, 61 com 13, 53 com 12, 64 com 11, 130 com 10.

**Onde é salvo:** em lugar nenhum do banco. O score é calculado na rodada,
gravado no CSV do universo, e recalculado pela rota `/dono/prospeccao/fila`.

**Onde é consumido:** ordenação da fila de disparo e `--topo=N`.

---

## 6. Hermes — as doze perguntas

**O que existe:** `.claude/agents/hermes.md`, **99 linhas de Markdown**. É uma
definição de subagente do Claude Code, não código do produto.

```
frontmatter   name: hermes
              tools: Read, Grep, Glob, Bash, WebSearch, WebFetch
              model: opus
```

**Não existe nenhum módulo de código com esse nome** — nem em TypeScript, nem
em Python —, nem rota, tabela, fila ou processo. Buscada a palavra no
repositório inteiro, ela aparece em três arquivos: o `CLAUDE.md`, a definição
do agente, e o `package-lock.json`, onde `@prettier/plugin-hermes` é o parser
do React Native, **sem relação nenhuma** com este agente.

O próprio arquivo declara, em `Regras`: *"Nunca escreva funcionalidade. Você
mede. Corrigir é de outro."*

| | Pergunta | Status | Evidência |
|---|---|---|---|
| A | É apenas auditor? | **SIM, IMPLEMENTADO** | `hermes.md:62-75` define a entrega como relatório de quatro partes: veredito, evidência, o que derruba, não sabido |
| B | Participa da prospecção? | **NÃO IMPLEMENTADO** | `prospectar.mjs` não o invoca; nenhuma referência cruzada existe |
| C | Gera mensagens? | **NÃO IMPLEMENTADO** | quem gera é `abordagem.ts`, sem LLM |
| D | Envia mensagens? | **NÃO IMPLEMENTADO** | envio é `enviar-evolution.mjs`, chamado à mão |
| E | Recebe respostas? | **NÃO IMPLEMENTADO** | sem webhook, sem fila, sem processo |
| F | Entende respostas? | **NÃO IMPLEMENTADO** | — |
| G | Classifica intenção? | **NÃO IMPLEMENTADO** | não há tabela, campo ou função de intenção |
| H | Identifica objeções? | **NÃO IMPLEMENTADO** | — |
| I | Negocia? | **NÃO IMPLEMENTADO** | — |
| J | Conduz para checkout? | **NÃO IMPLEMENTADO** | — |
| K | Registra conversão? | **NÃO IMPLEMENTADO** | quem registra é o webhook do Asaas |
| L | Aprende com resultados? | **NÃO IMPLEMENTADO** | sem memória, sem estado, sem banco |

**Limites, guardrails, logs, observabilidade:** os do Claude Code. Nada próprio.

---

## 7. WhatsApp / disparo

**Duas coisas diferentes usam WhatsApp, e só uma é do produto.**

### 7.1 O produto NÃO envia WhatsApp — PARCIAL

`lib/integrations/whatsapp-estado.ts`:

```ts
export const FASE_DO_WHATSAPP: FaseDoWhatsapp = 'migrando'
```

`lib/conversas/remetente.ts` devolve sempre `emMigracao`, cujo
`enviarTexto()` retorna `{ ok: false }` e `tetoPorHora()` retorna `0`. A ponte
não oficial saiu em 28/08 e a Cloud API **nunca entrou** — não há uma linha de
`graph.facebook.com/.../messages` no repositório (buscado).

A tabela `whatsapp_webhook_events` existe com **zero linhas** e sem consumidor.

### 7.2 A prospecção envia — IMPLEMENTADO, local

`scripts/inteligencia/enviar-evolution.mjs`, Evolution API 2.3.7 na VPS.

```
mensagem     vem de `abordagem.ts` pela rota local /dono/prospeccao/fila
             (nenhuma copia do texto mora no script)
envio        POST /message/sendMedia (imagem + legenda, UM balao)
             ou /message/sendText quando nao ha arte
imagem       base64 do disco; validada pela ASSINATURA dos bytes
numero       vem do prospect; invalido e pulado e NAO conta no teto
```

**Travas, todas no código:**

```
--confirmar ausente   ensaio, e o padrao
--max=N               teto por rodada (30 por padrao)
intervalo             45s a 150s SORTEADO
--bloco=N             pausa de 25-40 min a cada N mensagens, sorteada
horario               9h-16h, seg a SABADO. Domingo nao
estado ANTES do sono  Ctrl+C nunca reenvia
3 falhas seguidas     param a rodada
dedupe por NUMERO     um telefone recebe uma vez, mesmo com dois dominios
--so-aprovados        filtra pelos cinco nichos da regua
conferirLink          aborta se o link da mensagem nao responder
nao-perturbe.txt      lido a cada rodada
```

**Botão interativo: NÃO FUNCIONA, medido em 12/09.** `sendButtons` devolve
HTTP 201 nos quatro formatos e **nenhum renderiza** — Baileys embrulha em
`viewOnceMessage` e o cliente oficial não desenha. Controle: `sendText` no
mesmo instante chegou normal.

**Recebimento, webhook de entrada, status de mensagem, retry: NÃO IMPLEMENTADO**
no caminho de prospecção. O script envia e não escuta.

### 7.3 O agente SDR — IMPLEMENTADO e DESLIGADO

`app/api/sdr/responder/route.ts` existe, com `lib/sdr/` completo: instruções,
blindagem contra injeção, memória de conversa, buffer, transcrição de áudio
(whisper-1) e descrição de imagem (gpt-4o-mini).

**Desligado por decisão do dono em 11/09.** A rota existe e não é chamada por
nada dentro do repositório — o gatilho era o n8n, fora daqui.

---

## 8. A máquina de vendas, etapa por etapa

| Etapa | Status | Implementação real | Arquivo / função | Gaps |
|---|---|---|---|---|
| EXA | IMPLEMENTADO | 4 rotas, teto por fase | `prospectar.mjs:147` `exa()` | roda à mão, local |
| SCORE | IMPLEMENTADO | 11 sinais com peso | `prospeccao.ts` `pontuarProspect` | não persistido no banco |
| HERMES AUDITA | NÃO IMPLEMENTADO | — | — | Hermes não participa |
| ABORDAGEM | IMPLEMENTADO | 10 modelos, 5 ganchos | `abordagem.ts` `montarAbordagem` | 788 textos "distintos", na prática dez |
| PROSPECT RESPONDE | NÃO IMPLEMENTADO | nada escuta | — | sem webhook de entrada |
| IA ENTENDE | PARCIAL | o SDR sabe, e está desligado | `api/sdr/responder` | sem gatilho |
| CLASSIFICA INTENÇÃO | NÃO IMPLEMENTADO | — | — | |
| IDENTIFICA OBJEÇÃO | NÃO IMPLEMENTADO | — | — | |
| ESCOLHE ESTRATÉGIA | NÃO IMPLEMENTADO | — | — | |
| RESPONDE | PARCIAL | SDR desligado | `lib/sdr/` | |
| NEGOCIA | NÃO IMPLEMENTADO | — | — | |
| CTA | IMPLEMENTADO | link `/wa` com UTM | `abordagem.ts:99` | |
| CHECKOUT | IMPLEMENTADO | Asaas | `asaas/actions.ts:102` | |
| PAGAMENTO | IMPLEMENTADO | webhook + cron | `aplicar-evento.ts` | |
| REGISTRO | PARCIAL | assinatura sim, prospect→cliente não | `subscriptions` | nada liga prospect a workspace |
| APRENDIZADO | PARCIAL | vocabulário, não conversão | `aprendizado.ts` | não aprende com quem paga |

---

## 9. Checkout / pagamento — IMPLEMENTADO

```
provedor      Asaas (v3)
criacao       lib/asaas/actions.ts:102  createCheckout()
ciclo         MONTHLY | YEARLY, gravado em subscriptions.ciclo
              escrito pelo NOSSO servidor, nunca derivado do payload
              (migration 0027 proibe em texto)
webhook       app/api/webhooks/asaas/route.ts, runtime nodejs
              autenticado por ASAAS_WEBHOOK_TOKEN, dedupe em
              asaas_webhook_events
aplicacao     lib/asaas/aplicar-evento.ts, reusado por webhook E cron
ativacao      RPC apply_asaas_subscription_status (migration 0044)
              validade: interval '30 days' ou '1 year' conforme ciclo
cancelamento  lib/asaas/actions.ts:439  cancelSubscription()
reconciliacao /api/cron/reconciliar-assinaturas, rede de seguranca
              para quando o webhook cai
estados       trialing | active | past_due | canceled
vinculo       subscriptions.workspace_id, e externalReference no Asaas
              no formato "<workspace>:<user>"
origem        workspaces.utm_source/medium/campaign/content, fbc, fbp, gclid
```

> **Fragilidade medida:** o webhook do Asaas ficou `interrupted` **quatro vezes
> em nove dias** (04, 06, 08 e 12/09). O `sendType` é `SEQUENTIALLY` por
> decisão — ordem importa em cobrança. A causa das interrupções **NÃO FOI
> POSSÍVEL CONFIRMAR**: a API não expõe a fila de eventos (`/webhooks/{id}/events`,
> `/webhook/events` e `/queue` devolvem 404), e o log só existe no painel.

**Vínculo prospect → cliente: NÃO IMPLEMENTADO.** Nada liga um domínio da fila
de prospecção a um `workspace` criado depois. A única ponte possível hoje é o
`utm_campaign=prospeccao_2026_09` do link `/wa`.

---

## 10. Conversão — onde cada evento é registrado

| Evento | Status | Onde |
|---|---|---|
| prospect descoberto | IMPLEMENTADO | CSV `docs/mercado/universo-*.csv` |
| prospect contatado | IMPLEMENTADO | `.dono-prospeccao.json` (arquivo local) |
| prospect respondeu | **NÃO IMPLEMENTADO** | nada escuta o WhatsApp da prospecção |
| interesse | **NÃO IMPLEMENTADO** | — |
| visita ao site | PARCIAL | `utm-capture.tsx` → `workspaces.utm_*` no cadastro |
| conta criada | IMPLEMENTADO | `workspaces`, + Meta `CompleteRegistration`, + Google Ads em `/bem-vindo` |
| ativação | IMPLEMENTADO | `lib/dono/ativacao.ts`, 6 degraus: `criou_conta`, `concluiu_onboarding`, `primeiro_contato`, `primeiro_negocio`, `conectou_canal`, `virou_pro` |
| checkout | IMPLEMENTADO | `subscriptions` + `assinatura_eventos` |
| pagamento | IMPLEMENTADO | webhook → `aplicar-evento.ts` → Meta `Purchase` (só CAPI) |
| cliente Pro | IMPLEMENTADO | `pro_vigente()`, nunca a coluna `plan` |

**O buraco é entre "contatado" e "conta criada".** Não há registro de resposta,
e a única ligação é a UTM — que, medida no único cliente externo real, **veio
vazia**: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `gclid`,
`fbc` e `fbp` todos nulos no Portal da Cidade.

---

## 11. Analytics / aprendizado

| Item | Status | Onde |
|---|---|---|
| eventos de produto | IMPLEMENTADO | `lib/analytics/ativacao.ts` |
| métricas de campanha | IMPLEMENTADO | `lib/dono/atribuicao.ts`, cruza UTM com empresas |
| taxa de resposta | **NÃO IMPLEMENTADO** | `conversas.respondida_em` existe e serve à caixa de entrada do produto, não à prospecção |
| taxa de checkout | PARCIAL | dá para derivar de `subscriptions`; não há tela |
| taxa de pagamento | IMPLEMENTADO | `lib/dono/receita.ts` |
| objeções | **NÃO IMPLEMENTADO** | — |
| intenção | **NÃO IMPLEMENTADO** | — |
| A/B testing | **NÃO IMPLEMENTADO** | — |
| ranking de mensagens | **NÃO IMPLEMENTADO** | `/dono/mensagens` AGRUPA por modelo, não ranqueia por resultado |
| ranking de segmentos | PARCIAL | a régua de nichos é manual, medida uma vez em 06/09 |
| aprendizado por conversão | **NÃO IMPLEMENTADO** | `aprendizado.ts` aprende VOCABULÁRIO do site, não o que converte |

---

## 12. Mapa dos arquivos relevantes

```
app/
  (dashboard)/     hoje, kanban, leads, dashboard, calendario, conversas,
                   perfil, settings
  (dono)/          Central — 404 fora de localhost
  (conteudo)/      paginas de SEO
  (legal)/         privacidade, termos
  api/
    webhooks/asaas/route.ts         entrada do dinheiro
    cron/vigia/route.ts             alarme, de hora em hora
    cron/reconciliar-assinaturas/   rede de seguranca do webhook
    cron/limpar-eventos/
    sdr/responder/route.ts          agente SDR — DESLIGADO
    log-erro/route.ts

lib/
  asaas/           client, actions, aplicar-evento, status-real, queries
  dono/            central, pendencias, vigia, dinheiro, dinheiro-do-vigia,
                   receita, ativacao, atribuicao, contas-internas,
                   aviso-whatsapp (+ -envio), prateleira, meta-ads,
                   google-ads-queries
  inteligencia-de-mercado/dominio/
                   prospeccao.ts   (score)
                   abordagem.ts    (texto, NAO envia)
                   aprendizado.ts  (vocabulario)
                   decisor.ts      (medido e RECUSADO)
  sdr/             instrucoes, blindagem, conversa, midia
  conversas/       remetente (emMigracao), actions, queries
  analytics/       ativacao, consentimento, meta-conversions
  integrations/    whatsapp-estado, google, crypto
  emails/          layout + 8 templates
  plans.ts         preco e limites, fonte unica

scripts/
  inteligencia/    prospectar.mjs (Exa), enviar-evolution.mjs (disparo),
                   enviar-whatsapp.mjs (Playwright, anterior),
                   nao-perturbe.txt
  ci/              contagens, conferir-documentos, build-de-conferencia
  marketing/       geradores de arte em Python
  local/           evolution-estado.mjs

supabase/migrations/   81 arquivos

.claude/agents/hermes.md   99 linhas de Markdown, sem codigo
```

---

## 13. Fluxo real, passo a passo

| # | Passo | Existe? | Onde |
|---|---|---|---|
| 1 | Exa encontra empresa | **SIM** | `prospectar.mjs` `semear()` |
| 2 | resultado é salvo | **SIM** | CSV do universo + `leads` |
| 3 | score é calculado | **SIM** | `pontuarProspect` |
| 4 | Hermes entra | **NÃO** | não participa |
| 5 | empresa é selecionada | **SIM** | ordenação por pontos + `--so-aprovados` |
| 6 | mensagem é criada | **SIM** | `montarAbordagem` |
| 7 | mensagem é enviada | **SIM**, à mão | `enviar-evolution.mjs --confirmar` |
| 8 | prospect responde | chega no WhatsApp do dono | fora do sistema |
| 9 | resposta chega ao sistema | **NÃO** | nada escuta |
| 10 | IA processa | **NÃO** (SDR existe, desligado) | |
| 11 | resposta é gerada | **NÃO** | |
| 12 | checkout | **SIM**, se a pessoa entrar sozinha | `createCheckout` |
| 13 | pagamento | **SIM** | webhook + cron |
| 14 | CRM atualizado | **SIM** | `aplicar-evento.ts` |

**O fluxo quebra no passo 8-9.** Do disparo até a resposta, não há sistema: a
mensagem chega no celular do dono e a conversa acontece fora do produto.

---

## 14. Gargalos encontrados no código

> **Atualização de 12/09, manhã:** os itens 1, 3, 7 e 9 foram FECHADOS na mesma
> data — ver a seção 18 no fim do documento. O resto continua aberto, e o
> estado de cada um está marcado abaixo.

### CRÍTICO

1. ~~**Nada captura a resposta do prospect.**~~ **FECHADO em 12/09.**
   `app/api/webhooks/evolution/route.ts` grava a resposta em
   `conversas`/`mensagens`, identifica o prospect pelo telefone e avisa o dono
   no WhatsApp. **A IA continua desligada** — captura não é resposta.
2. **Webhook do Asaas cai repetidamente** — 4 vezes em 9 dias, causa não
   determinada, e a API não expõe o log que a explicaria. **ABERTO.**

### ALTO

3. ~~**O opt-out da página não chega ao disparo.**~~ **FECHADO em 12/09, e o
   diagnóstico desta auditoria estava incompleto** — ver a seção 18.
4. **Prospect e cliente não se ligam.** **PARCIAL desde 12/09:**
   `prospeccao_prospect` tem `lead_id` e `workspace_id`, e o webhook os
   preenche quando a pessoa responde. O elo até `subscriptions` continua sem
   existir, então *"qual mensagem trouxe qual pagante"* ainda não tem resposta.
5. **O rastreamento de origem não capturou o único cliente real** — as oito
   colunas de UTM vieram nulas. **ABERTO.**
6. **O score não é persistido.** **PARCIAL desde 12/09:** `pontuar` agora é
   gravado em `prospeccao_prospect.pontos` no momento do envio. Medir se ele
   prevê conversão exige respostas acumuladas, que é o que a captura começa a
   produzir.

### MÉDIO

7. ~~**Estado da prospecção em arquivo local** (`.dono-prospeccao.json`).~~
   **PARCIAL em 12/09.** O arquivo continua sendo a verdade do que já saiu
   DESTA máquina, e é ele que impede o reenvio — não foi substituído. O que
   passou a existir no banco é o que ele não conseguia ser: alcançável do lado
   de lá, onde o webhook roda sem disco. 98 prospects já abordados foram
   gravados por `--sincronizar`.
8. **O SDR está construído e desligado** — custo de manutenção sem retorno.
   **ABERTO, e agora é decisão de fase:** ele é a Fase 3 do plano, e ligá-lo
   antes de haver amostra de respostas seria dar inteligência a um sistema que
   não enxerga nada.

### BAIXO

9. ~~`whatsapp_webhook_events` existe sem consumidor.~~ **FECHADO em 12/09:** é
   a primeira das duas camadas de dedupe do webhook novo. A segunda é o índice
   único `mensagens (workspace_id, external_id)` da 0056.
10. `lib/plans.ts:230` comenta R$ 490 sobre uma constante que vale 970.
    **ABERTO.**
11. `decisor.ts` permanece com testes, medido e recusado (0 de 6). **ABERTO.**
12. **NOVO, achado em 12/09 e já corrigido:** `purge_old_sinais_de_mercado`
    purgava uma tabela que a 0075 removeu em 08/09, e `/api/cron/limpar-eventos`
    devolvia `ok: false` todo dia desde então. A rota também destruturava SEIS
    nomes de SETE promessas, então o log acusava a purga errada. Fechado pela
    0085.

---

## 15. O que já está pronto para escalar

```
cron            3 na Vercel, com CRON_SECRET
idempotencia    asaas_webhook_events (dedupe por event_id)
                confirmarEnvio da prospeccao
                aviso_vencimento_enviado_em (um aviso por dia)
                .dono-prospeccao.json grava ANTES de dormir
rate limiting   lib/rate-limit.ts + rate_limit_attempts (30/h por IP)
retries         reconciliar-assinaturas e o cron do vigia
observabilidade error_logs + vigia (e-mail + WhatsApp desde 12/09)
                + vigiar_o_vigia por pg_cron, FORA da Vercel
banco           RLS nas 21 tabelas, indices, triggers de limite de plano
                que valem inclusive para service_role
webhooks        autenticados, dedupe, rede de seguranca diaria
```

**O que NÃO existe para escalar:** fila de trabalho (nem pgmq nem equivalente),
worker, concorrência controlada, backoff exponencial.

---

## 16. Intenção vs realidade

| Minha intenção | Realidade do código |
|---|---|
| Exa → score | **existe**, e roda à mão, local |
| → Hermes audita | **não existe.** Hermes é 99 linhas de Markdown, sem código |
| → abordagem personalizada | **existe**, e "personalizada" é o nome: 10 modelos, 5 ganchos, o que muda é o nome da empresa |
| → prospect responde | acontece no celular do dono, **fora do sistema** |
| → Hermes entende | **não existe** |
| → escolhe estratégia | **não existe** |
| → responde | o SDR saberia, e está **desligado** |
| → trata objeção | **não existe** |
| → conduz para checkout | o link leva; ninguém conduz |
| → registra resultado | registra PAGAMENTO, não registra o caminho |

---

## 17. Conclusão executiva

**1. O que já existe.** Uma máquina de DESCOBERTA e DISPARO completa e com
travas: Exa com teto por fase, score de 11 sinais, 837 prospects, mensagem por
nicho, disparo com dedupe por número, janela de horário, blocos com pausa
sorteada e conferência de link. E um produto em produção com auth, Kanban,
orçamento com prazo, billing pelo Asaas, RLS em 21 tabelas e um vigia que
avisa por e-mail e WhatsApp.

**2. O que está parcial.** O SDR (construído, desligado). O aprendizado (aprende
vocabulário, não conversão). A atribuição (existe, e não capturou o único
cliente real).

**3. O que não existe.** Tudo entre "mandei a mensagem" e "a pessoa respondeu":
captura de resposta, classificação de intenção, objeção, estratégia, negociação
e condução. E o Hermes, em qualquer papel que não seja auditar.

**4. O verdadeiro gargalo.** **Não é volume, é a resposta.** O disparo já está
pronto para 200/dia. O que não existe é o que acontece quando alguém responde —
e hoje isso é o dono improvisando no WhatsApp, sem registro. Segundo gargalo,
de outra natureza: o universo dos 5 nichos tem ~5.000 a 8.000 empresas, e a
meta de 200/dia por um mês consome ele inteiro. **Não há segunda passada**, pela
promessa de "não volto a procurar" na própria mensagem.

**5. O que seria mais valioso construir primeiro.** Registrar a resposta. Não
IA, não classificação — só saber **quem respondeu, quando e o quê**. Sem esse
dado, nenhuma das etapas seguintes pode ser medida, e o score não tem contra o
que aprender. É também o que transforma a taxa de resposta de suposição
(3,8-7,2% do setor) em número deste produto.

**6. Código duplicado / risco de recriar.** Três achados:

- A regra de "assinatura pagou?" existia em `dinheiro.ts` e **faltava** em
  `dinheiro-do-vigia.ts` e `pendencias.ts` — as três leituras divergiam.
  Corrigido em 12/09, hoje unificado em `receita.ts`.
- `abordagem.ts` já monta a mensagem. Qualquer gerador novo de texto duplica.
- `pontuarProspect` já pontua. Um "score de chance de pagar" seria uma segunda
  régua sobre o mesmo dado — e **sem um pagante externo, qualquer peso novo
  seria invenção**, não medição.

**7. O caminho mais curto até uma máquina funcional.**

```
1. capturar a resposta   webhook da Evolution -> conversas/mensagens, que JA
                         existem como tabela. E o menor passo com maior
                         retorno, e nao precisa de IA
2. ligar prospect a workspace   pelo telefone ou pela UTM de /wa, para
                         "qual mensagem trouxe pagante" ter resposta
3. so entao IA           com resposta registrada, o SDR (que ja existe) tem
                         o que ler, e o score tem contra o que aprender
```

A ordem importa: construir IA antes da captura seria dar inteligência a um
sistema que não enxerga nada.

---

## Anexo — cobertura desta auditoria

```
arquivos inspecionados   ~116 em lib/ nas areas auditadas
                         5 rotas de API
                         81 migrations (contadas, nao lidas uma a uma)
                         .claude/agents/hermes.md integral
fontes consultadas       catalogo do Postgres (pg_class, pg_enum,
                         information_schema)
                         API do Asaas (subscriptions, payments, webhooks)
                         API da Vercel (variaveis de ambiente, por NOME)
```

**Principais arquivos do fluxo Exa → Score → Hermes → WhatsApp → Checkout:**

```
scripts/inteligencia/prospectar.mjs                    Exa
lib/inteligencia-de-mercado/dominio/prospeccao.ts      score
lib/inteligencia-de-mercado/dominio/abordagem.ts       mensagem
scripts/inteligencia/enviar-evolution.mjs              disparo
.claude/agents/hermes.md                               Hermes (so auditoria)
lib/asaas/actions.ts                                   checkout
app/api/webhooks/asaas/route.ts                        pagamento
lib/asaas/aplicar-evento.ts                            efeito do pagamento
app/api/cron/reconciliar-assinaturas/route.ts          rede de seguranca
```

---

## 18. O que mudou em 12/09, manhã — a FASE 1

Esta seção é posterior à auditoria e registra o que ela provocou. Ela também
**corrige um diagnóstico dela**, o que vale mais do que a correção em si.

### O achado do opt-out estava incompleto, e a diferença é a decisão

A seção 14 registrou que o disparo não lê `descadastro_de_prospeccao`. A
leitura natural é *"basta mandá-lo ler"*. **Não bastava:**

```
a tabela            chave `email_hash`, sha256 de um token que por sua vez e
                    sha256 de "tempero:email"
a fila do disparo   casa por DOMINIO e por TELEFONE
a coluna `dominio`  existe desde a 0080 e NUNCA foi escrita — a pagina grava
                    so o hash, porque o token nao e reversivel
```

Não havia um campo em comum. Uma leitura acrescentada ao disparo filtraria
**zero linhas para sempre**, com o alarme calado parecendo resolvido — que é a
classe de defeito mais cara deste projeto.

E o canal que a tabela atendia nunca existiu: `tokenDeSaida()` não tem um único
chamador fora do teste, o e-mail frio nunca saiu. O opt-out que precisa
funcionar chega por WhatsApp, e para ele não havia nem coluna.
`nao-perturbe.txt`, o único que funcionava, tem **zero linhas** — é manual,
local, e nunca foi usado.

### O que foi construído

```
0083   a tabela ganha UMA chave que carrega o canal no valor
       (`email:` | `fone:` | `dominio:`), mais `telefone_ultimos8`
0084   `prospeccao_prospect` — o prospect abordado e o que houve depois
0085   apaga `purge_old_sinais_de_mercado`, orfa desde a 0075

app/api/webhooks/evolution/route.ts          a captura
lib/prospeccao/mensagem-recebida.ts          3 formatos de payload
lib/prospeccao/opt-out.ts                    reconhece o pedido de saida
lib/prospeccao/opt-out-queries.ts            grava e le, por qualquer canal
lib/prospeccao/empresas.ts                   onde grava, de onde le
app/(dono)/dono/prospeccao/enviado/route.ts  registra o envio no banco
```

### Por que reabrir um webhook que foi fechado de propósito

`c52a718` removeu a rota da Evolution em 28/08 porque o segredo era único para
todas as empresas: quem o conhecesse injetaria mensagem falsa no funil de
qualquer uma sabendo o UUID dela.

**A rota nova não reabre isso, e a diferença é estrutural: prospecção não é
multiempresa.** A empresa é resolvida no servidor, pelo nome, e nunca lida da
requisição. Não existe UUID no payload — não existe o que forjar. O segredo vai
no cabeçalho, não na URL que a Vercel registra em log.

### Provado contra produção, com controle

```
opt-out por DOMINIO      sumiu da fila, contador 0 -> 1
opt-out por TELEFONE     sumiu mesmo com dominio DIFERENTE
CONTROLE                 quem nao esta na tabela continua na fila
sem segredo / errado     401
evento de presenca       200 e ignorado (nao 500)
a NOSSA mensagem         ignorada
grupo                    ignorado
texto                    gravado, avisado no WhatsApp do dono
o MESMO evento de novo   ignorado, e 3 mensagens no banco (nao 4)
audio                    tipo=audio, midia REFERENCIADA e nao baixada
"nao quero"              opt-out gravado, NAO respondido, some da fila
```

20 de 20 no webhook, 6 de 6 no opt-out. 98 prospects já abordados foram
gravados no banco, com a data que o JSON guardou.

### O que continua valendo desta auditoria

O parágrafo mais importante dela não mudou: **o gargalo não é volume, é a
resposta** — e agora ele é mensurável em vez de suposto. As Fases 2 a 5
(classificação, resposta sugerida, automação, otimização) continuam por
construir, e a ordem continua sendo capture, meça, compare, só então otimize.

**E o Hermes continua sendo 99 linhas de Markdown.** Nada nesta rodada o
transformou em componente de software, e a seção 6 segue inteira.
