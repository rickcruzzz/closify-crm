# Auditoria: o Plano Max, o Asaas e a Z-API

Feita em 16/09/2026, antes de qualquer linha de codigo, a pedido do dono. A
regra do pedido e a regra deste projeto: **auditar, desenhar, implementar,
testar, auditar de novo**.

O achado que muda o desenho inteiro cabe numa linha: **tres das quatro tabelas
pedidas ja existem, estao em producao, e sao melhores do que a proposta.**

---

## 1. O nome errado, e ele aparece 20 vezes no pedido

Nao existe `company_id` neste banco. Conferido no catalogo: **nenhuma coluna
com esse nome**. O isolamento e por `workspace_id`, e os dois helpers de RLS
sao `is_workspace_member(uuid)` e `is_workspace_admin(uuid)`.

Nao e preciosismo de nomenclatura. Uma tabela nova com `company_id` teria que
inventar um segundo helper, e a partir dai existiriam **duas definicoes de
"a empresa de quem pede"** — que e como um limite vira decorativo.

---

## 2. As tabelas pedidas contra as tabelas que existem

| pedido no brief          | ja existe          | desde | veredito  |
| ------------------------ | ------------------ | ----- | --------- |
| `whatsapp_conversations` | `public.conversas` | 0056  | NAO criar |
| `whatsapp_messages`      | `public.mensagens` | 0056  | NAO criar |
| `whatsapp_webhook_events`| mesmo nome, existe | 0047  | NAO criar |
| `whatsapp_instances`     | nao existe         | —     | **criar** |

### 2.1 `conversas` (0056) ja tem tudo que o brief pede, e mais

    pedido            existe como
    company_id        workspace_id  -> FK + RLS
    lead_id           lead_id       -> FK
    phone             derivado de leads.phone (uma fonte, nao duas)
    status            arquivada_em
    unread_count      respondida_em  <- ver abaixo
    assigned_user_id  dono_id + assumida_em
    last_message_at   ultimo_recebido_em + ultimo_enviado_em
    instance_id       nao tem, e e a unica coisa a acrescentar

**`respondida_em` no lugar de `unread_count` e decisao medida, nao omissao.**
O comentario da propria migration registra o porque:

> Todo concorrente ordena por mensagem mais recente, que e a ordem certa para
> CONVERSAR. A ordem certa para NAO PERDER VENDA e quem espera ha mais tempo.

`unread_count` responde "quantas nao li". `respondida_em is null` responde
"este cliente esta esperando ha 40 minutos". Num CRM cuja promessa e nao perder
venda por esquecimento, a segunda pergunta e a que importa. Trocar seria
regressao de produto disfarcada de campo novo.

A tabela ja tem `unique (workspace_id, lead_id, canal)`, que e o que permite
`upsert` sem ler antes, e o indice parcial `conversas_espera_idx` na ordem
exata em que a tela filtra.

### 2.2 `mensagens` (0056) ja resolve a idempotencia da secao 17

    unique index mensagens_external_id_unico
      on public.mensagens (workspace_id, external_id)
      where external_id is not null

E o `provider_message_id` do brief, com o escopo certo (por empresa) e parcial,
porque mensagem ENVIADA nasce antes de o provedor devolver o id.

Tem tambem `tipo` com sete valores (`texto`, `audio`, `imagem`, `video`,
`documento`, `figurinha`, `outro`), `midia_chave/mime/segundos`, `direcao`,
`status`, `erro`, `enviada_por`, e um teto de 200.000 por empresa em trigger.

**O `audio` nao e enfeite:** esta escrito na migration que o Brasil manda 4x
mais audio que qualquer outro pais. Caixa de entrada so-texto esta quebrada
para o publico deste produto.

### 2.3 `whatsapp_webhook_events` (0047) ja existe COM purga

    create table public.whatsapp_webhook_events (
      event_id text primary key,
      processed_at timestamptz not null default now()
    )

RLS ligada com **zero policy** — tabela de sistema, alcancavel so pela service
role. A purga de 7 dias (`purge_old_whatsapp_webhook_events`) ja esta agendada
no cron `/api/cron/limpar-eventos`.

O brief pede `company_id`, `instance_id`, `event_type` e `payload` nela.
**Guardar payload de webhook de WhatsApp e guardar conteudo de conversa de
terceiro numa tabela sem RLS**, com titular que nunca concordou com nada. Sob
LGPD isso e tratamento sem base legal declarada, e o produto ja pagou esse erro
uma vez (a Meta recebendo dado de quem clicou "Recusar", 02/09). A tabela fica
como esta: so o id, so para dedupe.

### 2.4 O custo de ignorar isto

Criar as tabelas do brief produz **uma segunda caixa de entrada**. Leem as
atuais, hoje:

    app/(dashboard)/conversas/page.tsx     a tela
    components/conversas/conversas-client  a lista e o painel
    lib/conversas/queries.ts               4 consultas
    lib/conversas/actions.ts               enviar, assumir, arquivar
    lib/conversas/ordenar.ts               a regra de quem espera, com teste
    contador da barra lateral              em toda navegacao
    prospeccao_interacao.conversa_id       FK, migration 0086
    migration 0087                         join public.conversas

Oito consumidores. Nenhum migraria sozinho.

---

## 3. O pipeline de RECEBER ja existe e esta provado em producao

`app/api/webhooks/evolution/route.ts`, 496 linhas, **20 de 20 contra producao
em 12/09**. Faz exatamente o que a secao 14 do brief descreve:

    webhook -> normaliza payload -> dedupe -> resolve empresa
            -> encontrar_lead_por_telefone (RPC) -> cria lead se nao achar
            -> upsert conversa -> insert mensagem -> avisa

O casamento de telefone ja e resolvido no banco, com indice funcional:

    create index leads_telefone_ultimos8_idx
      on public.leads (workspace_id, right(regexp_replace(phone,'\D','','g'), 8))

Os ultimos 8 digitos, porque `leads.phone` foi digitado a mao ou importado de
planilha em qualquer formato. O codigo antigo trazia TODOS os leads e comparava
em JavaScript, O(n) por mensagem recebida.

**A rota da Z-API nao e um pipeline novo. E o mesmo pipeline com outro
normalizador de payload e outra resolucao de empresa.**

### A diferenca que importa, e ela e de seguranca

A rota da Evolution resolve a empresa **pelo NOME, no servidor**, porque
prospeccao nao e multiempresa. O comentario dela registra por que a rota
anterior foi REMOVIDA em 28/08 (`c52a718`):

> o `EVOLUTION_WEBHOOK_SECRET` e unico para todas as empresas, entao quem o
> conhecesse injetaria mensagem falsa no funil de qualquer uma sabendo o UUID
> dela

A Z-API e multiempresa de verdade, e **nao assina o webhook**. O payload carrega
`instanceId` em texto puro. Resolver a empresa pelo `instanceId` do corpo repete
o defeito de 28/08 com outro nome: quem descobrir o `instanceId` de um cliente
injeta mensagem no funil dele.

**A saida e o segredo POR INSTANCIA na URL**, com a empresa resolvida a partir
do segredo e nunca do payload:

    /api/webhooks/zapi/receive/<segredo-aleatorio-por-instancia>

Nao e a URL de 28/08. La o segredo era global e o `workspaceId` estava na URL,
ou seja **havia o que forjar**. Aqui o segredo E a identidade: nao existe campo
de empresa na requisicao. Quem nao tem o segredo nao alcanca empresa nenhuma, e
quem tem o de uma empresa nao alcanca a outra.

E o `instanceId` do payload continua sendo conferido contra o da instancia
achada pelo segredo. Divergiu, responde 200 e ignora — nunca 500, que e a licao
da fila do Asaas.

---

## 4. A camada de provedor que o brief pede JA EXISTE

`lib/conversas/remetente.ts` e literalmente o `WhatsAppProvider` da secao 4:

    export type Remetente = {
      nome: string
      tetoPorHora(conectadoEm: string | null): number | null
      explicacaoDoTeto(conectadoEm: string | null): string
      enviarTexto(workspaceId, numero, texto): Promise<ResultadoDoEnvio>
    }

    export function escolherRemetente(workspaceId: string): Remetente

O parametro `workspaceId` **ja esta na assinatura e ainda nao e lido**, com o
motivo escrito no codigo: quando a escolha passar a ser por empresa,
acrescentar o parametro depois obrigaria a tocar em todo chamador.

O mapeamento do brief para o que existe:

    WhatsAppService   lib/conversas/actions.ts   regra de produto, nao muda
    WhatsAppProvider  Remetente                  a interface, ja escrita
    ZApiProvider      falta                      o unico arquivo novo

E as regras de produto ja estao do lado certo da fronteira: quem pode enviar,
teto de 4096 caracteres, gravar `pendente` ANTES de sair, marcar
`enviada`/`falhou` depois, concluir a tarefa de resposta, espelhar em
`activities`.

---

## 5. O Asaas: idempotente, provado, e cego para PLANO

`lib/asaas/aplicar-evento.ts` (414 linhas) ja faz os dez passos da secao 5:

    1  valida asaas-access-token     timingSafeEqual
    2  valida payload                json + campos
    3  persiste evento               asaas_webhook_events
    4  idempotencia                  pelo id do evento, dedupe gravada
    5  identifica subscription       body.subscription.id ?? payment.subscription
    6  localiza empresa              pela subscription no banco
    7  atualiza subscription         RPC apply_asaas_subscription_status
    8  libera/bloqueia               workspaces.plan pela RPC
    9  responde 2xx                  200 ate para evento nao mapeado
    10 nao duplica                   resultado.duplicate

Os conjuntos de evento ja sao exatamente os que o brief pede:

    active    PAYMENT_CONFIRMED, PAYMENT_RECEIVED
    past_due  PAYMENT_OVERDUE
    canceled  SUBSCRIPTION_DELETED, SUBSCRIPTION_INACTIVATED,
              PAYMENT_DELETED, PAYMENT_REFUNDED

**O que falta e a dimensao de PLANO.** O checkout cria um produto so, a
`PRO_PLAN_PRICE`. `subscriptions` nao tem coluna de plano. A validade sai da
0044, num `case` sobre `ciclo`.

E a doutrina que nao se negocia, travada desde a 0027 e repetida em seis
migrations: **regra de plano le a FUNCAO, nunca a coluna `workspaces.plan`.** A
coluna e o ultimo valor gravado e nao sabe que o tempo passou.

---

## 6. O Max nao cabe onde o brief o poe, e a correcao e barata

    create type public.workspace_plan as enum ('free', 'pro');

Dois valores. E `pro_vigente(uuid)` devolve **boolean**, lida por sete lugares:

    0027  trigger que sincroniza workspaces.plan
    0028  aceite de convite
    0037  integration_connections, TRES policies
    0050  limite de membros
    0052  limite de contatos
    0078  a regra das cinco empresas
    0079  limite de orcamentos

Dois desenhos possiveis:

**A. `max` como terceiro valor do enum** — obriga a rever os sete, porque cada
um pergunta "e pro?" e passa a precisar de "e pro OU max?".

**B. `subscriptions.plano` + funcao nova** — `pro_vigente` nao muda uma linha,
os sete consumidores nao mudam, e nasce `whatsapp_vigente(uuid)` ao lado.

**B, e o proprio brief escreve B** na secao 6:

> subscription.status = active AND subscription.plan = max

### A armadilha de dinheiro que o desenho B esconde

`pro_vigente` tem TRES ramos, e o terceiro (0078) diz: **assinatura viva de
qualquer empresa do mesmo dono cobre ate cinco empresas.**

Se `whatsapp_vigente` copiar esse ramo, uma assinatura Max de R$ 250 libera
WhatsApp para **cinco empresas** — e cada uma precisa da propria instancia
Z-API paga. Receita fixa contra custo que multiplica por cinco.

`whatsapp_vigente` fica com **o ramo 1 apenas**: a assinatura DESTA empresa. O
Max e por empresa porque o preco foi anunciado por empresa, e o WhatsApp e o
unico recurso deste produto cujo custo marginal nao e zero.

O resto do Max ("tudo do Pro") continua saindo de `pro_vigente`, com os tres
ramos, como hoje.

---

## 7. `FASE_DO_WHATSAPP` e o interruptor global, e esta em `'migrando'`

`lib/integrations/whatsapp-estado.ts` e lido por tres superficies (tela de
Integracoes, vigia, tela de Conversas) e hoje devolve:

    podeConectarWhatsapp()  false
    podeEnviarWhatsapp()    false
    escolherRemetente()     emMigracao, teto 0, todo envio recusado

Enquanto essa constante for `'migrando'`, **nada do que for construido envia uma
mensagem**. Ela precisa ganhar a fase `'zapi'`, e as duas funcoes precisam
passar a responder por empresa e nao globalmente — porque durante a entrada do
Max havera empresa conectada e empresa nao conectada ao mesmo tempo.

---

## 8. Credenciais: zero, e uma reusavel

Conferido no `.env.example`. **Nenhuma variavel da Z-API existe.** Precisam
nascer tres:

    ZAPI_CLIENT_TOKEN    por CONTA, nao por instancia. E o cabecalho
                         `Client-Token` que a Z-API valida em toda chamada
    ZAPI_PARTNER_TOKEN   `Authorization: Bearer <token>`, cria instancia
    ZAPI_WEBHOOK_BASE    a URL publica que recebe. A Z-API RECUSA webhook que
                         nao seja HTTPS, entao localhost nao recebe nada

**`INTEGRATIONS_ENCRYPTION_KEY` ja existe** e e a chave que cifra o token do
Google na 0034. O token POR INSTANCIA da Z-API e segredo do mesmo tipo e usa a
mesma chave e o mesmo padrao.

E o padrao carrega uma armadilha ja paga, registrada no `estado-atual`:

> `revoke select (coluna) ... from authenticated` sozinho **nao bloqueia
> nada**. O Supabase concede `select` na TABELA INTEIRA por default privilege,
> e revogar uma coluna nao subtrai de um grant mais amplo ja concedido.

A forma que funciona: revogar `select` da tabela inteira e conceder de volta so
nas colunas seguras.

---

## 9. O contrato da Z-API, lido na documentacao oficial

Nada abaixo e suposicao. Cada linha saiu de `developer.z-api.io` em 16/09.

    base      https://api.z-api.io/instances/{id}/token/{token}/{endpoint}
    cabecalho Client-Token: <token de seguranca da CONTA>

    POST  .../send-text
          body     { phone, message, delayMessage?, delayTyping? }
          resposta { zaapId, messageId, id }
          phone    DDI+DDD+numero, so digitos

    GET   .../status
          resposta { connected, error, smartphoneConnected }

    GET   .../qr-code/image     base64, ou um objeto `challenge` (Passkey)

    partner  POST com Authorization: Bearer <Partner-Token>
             body     { name, ...webhooks }
             resposta { id, token, due }
             trial de 2 dias; sem assinatura a instancia e apagada

### Os webhooks, com o payload exato

`ReceivedCallback` (recebida, e tambem a nossa quando "notify sent by me" esta
ligado):

    instanceId, messageId, phone, fromMe, momment, status,
    chatName, senderName, isGroup, isNewsletter, type,
    text.message | audio.{audioUrl,mimeType,seconds,ptt} |
    image.{imageUrl,mimeType,caption}

`MessageStatusCallback`:

    instanceId, status, ids[], momment, phone, phoneDevice, isGroup, type
    status: SENT | RECEIVED | READ | READ_BY_ME | PLAYED

`DisconnectedCallback`:

    momment, error, disconnected, type, instanceId

Os tres exigem resposta **HTTP 200 com `{"value": true}`**.

### O que isso muda no mapeamento

    Z-API                    nosso banco
    messageId                mensagens.external_id   (unique ja existe)
    phone                    encontrar_lead_por_telefone
    fromMe=true              direcao 'enviada'
    audio/image/document     mensagens.tipo, ja tem os sete valores
    audioUrl                 midia_chave — REFERENCIADA, nao baixada
    MessageStatusCallback    mensagens.status

`mensagens.status` tem `check (status in ('pendente','enviada','falhou'))`. Os
estados da Z-API sao cinco. **Isso exige `alter table` no check**, ou o webhook
de status grava e toma `23514` em silencio — que e exatamente a classe de
defeito que a 0086 existe para evitar.

---

## 10. A dependencia que decide se o Max e vendavel

A secao 10 do brief exige que o cliente **nunca** veja `instanceId`, `instance
token` nem `Client-Token`. Isso so e possivel com a **Partner API**, porque e
ela que cria instancia por chamada.

Sem Partner token, a unica alternativa e o dono criar cada instancia a mao no
painel e colar as credenciais — o que o brief proibe em texto.

E a Partner tem condicao comercial **a partir de 10 instancias**. Hoje o produto
tem **zero clientes externos pagantes** (registrado na memoria do projeto: os
R$ 970 sao cobranca gerada e nao paga, os R$ 150 sao do tio do dono, o R$ 1 e
teste proprio).

Ou seja: a arquitetura inteira desta secao depende de um contrato comercial que
ainda nao existe, e cujo ponto de entrada e dez instancias pagas contra receita
externa zero.

**Isso nao bloqueia o resto.** Bloqueia so o passo "criar instancia sozinho".
Tudo o mais — direito ao recurso, provedor, webhooks, caixa de entrada, envio,
follow-up — e construivel e testavel com UMA instancia.

---

## 11. O que sobra para construir, em ordem

    1  migration   whatsapp_instances (workspace_id, segredo, token cifrado,
                   status, telefone, connected_at) + subscriptions.plano
                   + alter no check de mensagens.status
    2  entitlement whatsapp_vigente(uuid), ramo 1 so, e o leitor unico em TS
    3  provider    lib/conversas/remetente-zapi.ts implementando `Remetente`
    4  escolha     escolherRemetente passa a LER o workspaceId
    5  webhooks    /api/webhooks/zapi/{receive,status,disconnected}/[segredo]
    6  conexao     Server Action: cria instancia, configura webhooks, QR
    7  tela        Configuracoes > WhatsApp, com polling controlado
    8  caixa       /conversas ja existe; muda o gate e o painel lateral
    9  checkout    createCheckout passa a aceitar plano
    10 follow-up   em cima de `tasks`, que ja existe

Nenhum desses passos cria tabela de conversa, tabela de mensagem, tabela de
dedupe, segundo billing, segundo auth ou segundo tenant.

---

## 12. Riscos que ficam escritos

    Partner token       inexistente. Secoes 10 e 11 do brief dependem dele
    custo marginal      primeiro recurso do produto cujo custo cresce por
                        cliente. Preco por empresa e o que fecha a conta
    FASE_DO_WHATSAPP    interruptor global hoje; vira por empresa
    Z-API sem assinatura de webhook. O segredo por instancia na URL e a defesa
    HTTPS obrigatorio   localhost nao recebe webhook. Mesma limitacao ja
                        registrada para a Instantly
    numero do cliente   conexao nao oficial. Risco de bloqueio e do cliente, e
                        precisa estar escrito na tela antes do QR
    LGPD                conversa de terceiro entra no banco. A Politica de
                        Privacidade precisa declarar a Z-API como suboperador
                        JUNTO da entrega, nunca depois (licao de 03/09)
