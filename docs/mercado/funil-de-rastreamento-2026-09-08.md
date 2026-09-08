# O funil de rastreamento, ponta a ponta (08/09/2026)

Pedido do dono: *"verificar nossas configurações, script, rastreamentos do
Google Ads, verificar rastreamento do pixel, API de conversão em pagamentos
também, entender o funil inteiro"* e *"verificar se o Asaas está no ar
funcionando com o projeto"*.

A pergunta chega num momento em que ela custa dinheiro: a campanha `g_preco`
está veiculando. Rastreamento quebrado agora não é dívida técnica — é gasto sem
medição, e a decisão seguinte seria pausar a campanha que funciona.

**Tudo abaixo foi lido em 08/09/2026**, contra produção. Cada seção separa o que
está `[MEDIDO]` do que está `[NÃO PROVADO]`, porque confundir os dois é a classe
de erro mais cara deste projeto.

---

## O funil inteiro, e quem mede cada degrau

```
                                    META          GOOGLE        BANCO
clique no anuncio                    —              —          gclid, utm_*
  |                                                            (utm-capture)
  v
chega em /quanto-custa-um-crm     PageView          —              —
  |                              (pixel)
  v
clica "Comecar gratis"               —              —              —
  |
  v
/cadastro, formulario             Lead            —                —
  |                            (pixel + CAPI)
  v
confirma e-mail -> /bem-vindo   CompleteRegistration  CONVERSAO   utm_*, gclid
  |                             (pixel + CAPI)     "Inscricao"   gravados no
  |                                                (gtag)        workspace
  v
cria o 1o contato               CustomizeProduct      —              —
  |                             (CAPI)
  v
clica em Assinar                InitiateCheckout      —              —
  |                             (CAPI)
  v
escolhe forma de pagamento      AddPaymentInfo        —              —
  |                             (CAPI)
  v
PAGA (webhook do Asaas)         Purchase           NADA           subscriptions
                                (CAPI)             <---- o buraco
```

**A Meta mede do clique ao pagamento. O Google mede até o cadastro e para ali.**

---

## [MEDIDO] A cadeia da Meta está inteira, e o pagamento está nela

Os eventos têm chamador vivo, conferido por importação e não por suposição:

| evento | quem dispara |
|---|---|
| `Purchase` | `lib/asaas/aplicar-evento.ts` — **o webhook do pagamento** |
| `CompleteRegistration` | `lib/onboarding/actions.ts` |
| `Lead` | `lib/supabase/actions.ts` |
| `CustomizeProduct` | `lib/analytics/ativacao.ts` |
| `InitiateCheckout` e `AddPaymentInfo` | `lib/asaas/actions.ts` |

**O pagamento dispara só a CAPI, nunca o pixel — e isso é correto.** O
`Purchase` nasce no webhook do Asaas, onde quem faz a requisição é o gateway.
Não existe navegador para o pixel disparar, e inventar um seria mentir sobre a
origem do evento.

---

## [MEDIDO] A tag do Google, e as quatro cercas

`components/analytics/google-ads.tsx:82` só liga a tag com as quatro
verdadeiras ao mesmo tempo:

```
sendTo existe          sem o AW- e o rotulo, nada carrega
nao e area privada     PREFIXOS_PRIVADOS, em superficie-publica.ts
e o dominio de producao
consentimento aceito   lido do navegador, e reavaliado quando muda
```

E a conversão tem dedupe por `localStorage` (`conversao-google.ts:141`): a mesma
pessoa não conta duas vezes. Isso importa porque
`app/(dashboard)/layout.tsx:74` devolve para `/bem-vindo` toda vez que alguém
volta com o onboarding pela metade — sem a marca, o custo por conversão
apareceria **menor do que é**.

Nada disso aparece no HTML servido, e não deveria: as duas tags carregam no
cliente, depois do consentimento.

---

## [MEDIDO] As credenciais em produção

Lido na API da Vercel, no projeto de produção:

```
NEXT_PUBLIC_META_PIXEL_ID                 production/preview
META_CONVERSIONS_API_TOKEN                production/preview
NEXT_PUBLIC_GOOGLE_ADS_ID                 production/preview
NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL   production/preview
ASAAS_API_KEY / ASAAS_WEBHOOK_TOKEN       production/preview
CRON_SECRET                               production/preview

META_TEST_EVENT_CODE                      AUSENTE   <- e esta CERTO
```

A ausência do último é desenho, não esquecimento: código de teste em produção
gravaria evento de ensaio no dataset real, e a Meta responde `events_received: 1`
do mesmo jeito — o erro seria silencioso.

---

## [MEDIDO] O Asaas está no ar, e havia uma coisa parada

```
API do Asaas          responde
endpoint de producao  sem token 401 | token certo, evento nao mapeado 200
webhook               enabled=true   interrupted=TRUE   <- estava PARADO
```

Religado nesta rodada (`PUT /webhooks/{id}`), conferido lendo de volta:
`interrupted=false`.

**É a terceira vez** — parou em 04/09, em 06/09 e agora. O endpoint está são o
tempo todo, então não é rota quebrada: é falha transitória que **não se recupera
sozinha**. Com `sendType: SEQUENTIALLY`, um evento travado bloqueia todos os
seguintes.

E importava mais desta vez, porque existe dinheiro pendente:

```
sub_lhl71qofd1x3ewsu   ACTIVE   R$ 49   MONTHLY   criada 06/09
pay_ack14g0fzwzl4tyx   R$ 49    vence 06/09
pay_5oirfvwg38atcf7q   R$ 49    vence 06/10
```

**Não é cliente.** O pagador é `cus_000197424656` — "pedro eee",
henriquestn24@gmail.com, conta do próprio dono, já nomeada no `estado-atual`
desde 19/08. **Continua zero cliente externo pagante**, e registrar isso como
venda seria o tipo de número plausível com conclusão errada que este projeto já
pagou caro.

---

## [MEDIDO] O developer token foi APROVADO

Informado pelo dono e provado contra a API. O token vive no `.env.local` e nunca
passou por conversa.

```
OAuth                      access_token obtido
listAccessibleCustomers    HTTP 200 -> customers/3129591084, /7841883291
consulta REAL a conta      HTTP 200 -> g_preco ENABLED, 38 impr, 2 cliq, R$ 4,77
```

Era `403 DEVELOPER_TOKEN_NOT_APPROVED` em 06/09. **Agora responde**, e o número
bate com o painel — o que também valida a leitura.

**O `login-customer-id` continua tendo que ficar de fora**, e agora está provado
em vez de previsto:

```
sem login-customer-id   HTTP 200
com login-customer-id   HTTP 403   (a conta tem acesso; a MCC nao)
```

Ele está preenchido no `.env.local`. Quem for escrever o cliente da API precisa
**omitir o cabeçalho**, não lê-lo da variável.

### O que a API mostrou, e uma correção do que eu disse ontem

```
URL final do anuncio  /quanto-custa-um-crm?utm_source=google&utm_medium=cpc
                      &utm_campaign=g_preco&utm_content=g1_preco      CERTA
acao de conversao     Inscricao | ENABLED | WEBPAGE | SIGNUP
                      contagem ONE_PER_CLICK | janela 30 dias
redes                 Pesquisa Google: true | parceiros: false | Display: false
orcamento             R$ 25,00/dia
```

**A correção:** eu disse ao dono que as impressões vinham de uma palavra só.
Com sete dias lidos por API, são **duas** — e a distribuição diz mais que o
total:

```
22 impr   0 cliq   "crm de vendas"          CTR 0%
16 impr   2 cliq   "quanto custa um crm"    CTR 12,5%
 0 impr            as outras cinco
```

O termo que **mais** aparece não levou clique nenhum; o que aparece menos levou
os dois. Faz sentido: `crm de vendas` é navegacional — quem digita já sabe o que
quer e procura marca. `quanto custa um crm` é a pergunta que o `h1` da nossa
página responde.

Com dois cliques isso é **indício, não prova**. Mas é o primeiro sinal de qual
metade da lista está pagando por si.

---

## Os três buracos

### 1. O `gclid` é gravado e NUNCA lido

```
capturado    components/landing/utm-capture.tsx
gravado      lib/onboarding/actions.ts:231
lido por     NINGUEM
no banco     0 de 44 workspaces tem gclid
```

**É a mesma família do defeito de 04/09**, quando o `utm_content` foi criado na
0069, capturado, gravado — e nenhuma tela lia, então os seis criativos
colapsavam num número só e o teste de seis argumentos rodaria sem concluir qual
vendeu.

A 0071 criou a coluna em 04/09 com o raciocínio certo escrito na própria
migration — *"cada dia sem a coluna é um dia de cliques que nunca poderão ser
reconciliados com o dinheiro"* — e a metade que **lê** nunca nasceu.

Os zero de 44 **não provam defeito**: a campanha tem 2 cliques e ninguém que
clicou criou conta ainda. Mas significam que o caminho nunca foi exercitado — e
caminho que nunca rodou não está certo, está não testado.

### 2. Não existe conversão do Google no PAGAMENTO

Confirmado por API: a única ação de conversão é `Inscrição`, tipo **`WEBPAGE`**.

**O Google otimiza por cadastro, não por receita.** A Meta recebe `Purchase` do
webhook do Asaas; o Google não recebe nada quando alguém paga.

O bloqueio deixou de ser o token. O que falta agora é construção, em três
partes:

```
1. acao de conversao do tipo UPLOAD_CLICKS   a atual e WEBPAGE, e WEBPAGE nao
                                             aceita importacao offline
2. o gclid sendo LIDO                        hoje ninguem le (buraco 1)
3. o envio quando o Asaas confirma           o mesmo gatilho que ja dispara o
                                             Purchase da Meta
```

### 3. Nada avisa quando a atribuição quebra em silêncio

Se um cadastro vier de anúncio **sem** `gclid` — bloqueador, redirect que come a
query, navegação em duas etapas — ele entra como orgânico e ninguém percebe.

A Central já tem exatamente esse alarme para campanha
(`comCampanhaNaoReconhecida`, 04/09), criado porque *"gastou e não trouxe
ninguém"* e *"trouxe e o relatório não achou"* são indistinguíveis na tela sem
ele. Falta o equivalente para o clique do Google.

---

## [NÃO PROVADO] O que este documento não pode afirmar

```
a tag DISPARA de verdade   exige navegador com consentimento aceito no dominio
                           de producao. Nao foi feito nesta rodada
o Purchase CHEGA na Meta   o metodo do projeto e token INVALIDO: a recusa alta
                           prova que a chamada aconteceu, porque sucesso seria
                           silencioso. E escrita a servico externo, fora do
                           escopo de leitura desta rodada
```

Isso precisa ficar dito porque a única conversão real já medida — em 05/09 —
chegou pelo caminho **reserva**: o `googleadservices.com` foi bloqueado pela CSP
e o `google.com/1p-conversion` salvou. O host entrou na CSP depois, mas o
episódio é a razão de nunca confundir *"está configurado"* com *"está
chegando"*.

---

## O que fazer, em ordem de retorno

```
1. ler o gclid na Central          o dado ja existe e ninguem ve. Mesma
                                   correcao que o utm_content recebeu em 04/09
2. o alarme de atribuicao cega     "veio de anuncio e nao tem gclid" —
                                   sem ele, o buraco 3 e invisivel
3. conversao offline               agora depende de nos, nao do Google.
   (pagamento -> Google Ads)       Exige criar a acao UPLOAD_CLICKS na conta
4. sitelinks e callouts            gratis, sobem CTR, e CTR baixa o CPC.
                                   Os textos ja estao escritos
5. vigiar o `interrupted`          o webhook parou tres vezes em cinco dias.
                                   O vigia tem a checagem; a memoria dele
                                   precisa expirar para reavisar
```

---

## O teto honesto

Este documento não conserta nada. Ele responde *"o funil está medindo?"* com um
sim parcial, e nomeia onde para.

**O que mudou hoje é de quem é a vez.** Até ontem o elo que falta dependia do
Google — token em análise, sem prazo firme. Com o token aprovado, ele passou a
depender de nós.
