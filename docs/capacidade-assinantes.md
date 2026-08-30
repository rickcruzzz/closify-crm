# Quantos assinantes o Velo Funil aguenta

Diagnóstico pedido em 30/08/2026. Pergunta diferente da de capacidade
simultânea ([capacidade.md](capacidade.md)): aqui o que importa é **assinante
pagante em regime recorrente** — cobrança mensal, e-mail de aviso, cron diário.

Tudo abaixo foi medido contra produção. Onde não deu para medir, está dito.

---

## Resposta

**O primeiro teto real fica entre 1.500 e 2.500 assinantes, e ele não é o
banco nem a banda — é o cron diário de assinaturas.**

E antes dele há um teto de plano que pode chegar bem antes: o **Resend**.

---

## Os tetos, do mais próximo ao mais distante

| # | limite | teto | como foi medido |
|---|---|---|---|
| 1 | **Resend** (e-mails/mês) | **1.200 ou 20.000** | conta abaixo; plano não verificado |
| 2 | **Cron de assinaturas** | **~2.500** | medido em produção |
| 3 | **Banco** (8 GB do Pro) | ~5.000 clientes-ano | largura real por linha |
| 4 | **Banda** (1 TB da Vercel) | >50.000 | 1,9 KB por navegação |
| 5 | **Concorrência** | não verificável | suíte k6 nunca executada |

---

## 1. O teto que chega primeiro: Resend

O código dispara e-mail por assinante em cinco momentos: cobrança gerada,
pagamento confirmado, e os avisos D-4 a D-1 de quem não pagou.

```
~2,5 e-mails por assinante/mes, em regime

  100 assinantes =    250/mes  (~8/dia)
  500 assinantes =  1.250/mes  (~42/dia)
1.000 assinantes =  2.500/mes  (~83/dia)
2.000 assinantes =  5.000/mes  (~167/dia)
```

**Se a conta do Resend for a gratuita**, o teto é 3.000/mês e **100/dia**. O
limite diário morde primeiro: ~1.200 assinantes já encostam nos 100/dia, e um
mês com muitos vencimentos no mesmo dia estoura antes disso.

**Se for o plano pago**, são 50.000/mês e o teto sobe para além de 20.000
assinantes — deixa de ser problema.

**Não consegui verificar o plano** — a API do Resend não expõe essa
informação. O domínio está `verified`, o que não diz nada sobre o plano. **É o
número mais importante deste documento e o único que não está medido.**

## 2. O cron de assinaturas — medido em produção

`/api/cron/reconciliar-assinaturas` roda 1x/dia e percorre **três laços em
série**, cada iteração com chamada HTTP externa:

```
laco 1  reconciliar   1 chamada ao Asaas por assinatura suspeita
laco 2  avisar        1 Asaas + 1 Resend por assinatura vencendo
laco 3  trial         1 Resend por empresa em trial
```

Latências medidas hoje:

```
Asaas    241ms   (359, 267, 178, 160 — 4 chamadas)
Resend   458ms   (692, 402, 281 — 3 chamadas)
```

Execução real, agora, contra produção:

```
GET /api/cron/reconciliar-assinaturas
  HTTP 200 em 1908ms
  verificadas 6, divergentes 0, avisos 0 enviados,
  trial: 6 candidatas, 6 puladas
```

12 candidatas em 1,9s — melhor que a projeção, porque quem já foi avisado hoje
é pulado antes de qualquer chamada externa.

**A projeção de pior caso** (ninguém avisado ainda, 10% suspeitas + 10%
vencendo + 5% em trial):

```
  500 assinantes ->  58s   cabe
1.000 assinantes -> 117s   cabe
2.000 assinantes -> 234s   cabe
2.500 assinantes -> 293s   no limite
3.000 assinantes -> 351s   ESTOURA
```

**O teto da função é 300s** (`functionDefaultTimeout: 300` na config do
projeto, com Fluid Compute ligado).

### O detalhe frágil, CORRIGIDO nesta rodada

`reconciliar-assinaturas` **não declarava `maxDuration`** — herdava o padrão da
plataforma, enquanto `limpar-eventos`, ao lado, declara `60` e justifica no
comentário.

Herdar funcionava. Mas o padrão é configuração de projeto, e configuração muda
— inclusive por engano, e sem ninguém relacionar a mudança com um cron que
passou a morrer no meio. **Um cron que morre no meio deixa metade dos
assinantes sem reconciliar e sem aviso, em silêncio, e só volta no dia
seguinte.**

Agora declara `export const maxDuration = 300`, com a medição e o motivo
escritos ao lado.

## 3. Banco — 8 GB do Supabase Pro

Largura **real** por linha, medida com `pg_column_size` (não o tamanho da
tabela dividido, que com 64 linhas é quase todo overhead de índice):

```
contato   152 bytes      negocio  151 bytes
atividade 128 bytes      tarefa   160 bytes
```

Um cliente ativo, projetado a 1 ano (500 contatos, 300 negócios, 2.000
atividades, 1.000 tarefas): **537 KB de dados**, ~1,6 MB com índices.

```
8 GB / 1,6 MB = ~5.000 clientes-ano
```

Hoje: **14,5 MB, 39 empresas, 380 KB por empresa.**

`error_logs` era a única tabela de sistema sem purga e passou a ter (migration
0059, 30/08). Era o vazamento que faria essa conta envelhecer mal.

## 4. Banda — não é gargalo

```
1.863 bytes de API por navegacao no Funil (medido)
1.000 clientes x 50 navegacoes/dia x 30 dias = ~3 GB/mes
teto da Vercel Pro: 1 TB
```

0,3% do limite. JS e CSS vêm do CDN e são cacheados por versão.

## 5. Concorrência — não verificável hoje

`max_connections = 60` no Postgres (medido), mas isso limita o pool do
PostgREST, não clientes: o app fala HTTP com o PostgREST, que compartilha
conexões.

A suíte que responderia isso está em `scripts/load-test/k6/` com perfil de
1.000 VUs e **nunca foi executada**. Ver [capacidade.md](capacidade.md) para
por que a medição de máquina local não substitui.

---

## O que fazer, na ordem, e o custo

```
1. descobrir o plano do Resend          5 minutos, e o teto mais proximo
2. paralelizar os lacos do cron         so se passar de 2.000 assinantes
3. rodar a suite k6                     so quando concorrencia importar
```

(declarar `maxDuration` era o item 2 e foi feito nesta rodada)

Os itens 2 e 3 são para um problema que ainda não existe.

---

## A ressalva que vale mais que os números

Este diagnóstico dimensiona para **1.000+ assinantes**. A base hoje tem **39
empresas e zero clientes externos pagantes** — as duas assinaturas ativas são
a conta de teste do dono e a cortesia do Google Review.

Nenhum dos tetos acima é o que impede vender — e **também não há retenção
ruim medida**, ao contrário do que a primeira versão deste documento afirmava.
Das 39 empresas, 33 são teste ou conta interna pela função oficial, e as 6
restantes têm zero contato cada uma. Não existe cliente externo para medir
nada (correção de 30/08, ver `dor-de-mercado.md`).

O que falta é tráfego pago, que ainda não rodou.

Dimensionar para 2.500 assinantes é resolver um problema 60× maior que o
maior número que este produto já teve.

---

## Comandos e arquivos desta medição

```
GET https://www.velofunil.com.br/api/cron/reconciliar-assinaturas   1908ms
GET https://www.velofunil.com.br/api/cron/limpar-eventos            7504ms
GET api.asaas.com/v3/subscriptions        4 chamadas, media 241ms
GET api.resend.com/domains                3 chamadas, media 458ms
select avg(pg_column_size(x)) por tabela  152/151/128/160 bytes
select pg_database_size()                 14,5 MB
vercel.json                               2 crons, sem `functions`
app/api/cron/reconciliar-assinaturas/     3 lacos em serie; maxDuration declarado aqui
```
