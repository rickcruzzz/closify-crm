# Google Ads: o plano B que não depende da Meta

Escrito em 03/09/2026, com a campanha do Meta montada e **travada por uma
restrição de Fraude e Decepção no perfil pessoal do dono**, aplicada em
06/07/2026 e confirmada pelo suporte. Meta Pay desativado bloqueia a criação de
anúncio em qualquer conta, com qualquer meio de pagamento.

Google Ads é outra plataforma, outra conta e outro sistema de cobrança. **Não
herda esse bloqueio.**

---

## Por que busca converte melhor que feed, aqui

A diferença não é de canal, é de **intenção**.

```
feed do Instagram   a pessoa esta vendo memes; o anuncio INTERROMPE
busca do Google     a pessoa DIGITOU "crm para pequena empresa"
```

Quem digita já decidiu que tem o problema e está procurando solução. Não
precisa ser convencido de que precisa de um CRM — precisa escolher qual.

Isso muda o cálculo com orçamento pequeno. A Meta pede ~50 conversões por
semana para sair do aprendizado, e R$ 25/dia não chega perto disso. **A busca
não tem fase de aprendizado dessa natureza**: uma palavra-chave certa com CPC
de R$ 2 já entrega cliques qualificados no primeiro dia.

---

## O ângulo que este produto tem, e que a busca premia

O argumento mais forte do Velo Funil é o mesmo do anúncio da Meta, e na busca
ele fica ainda mais afiado porque a pessoa **já está comparando preço**:

```
mercado    cobra POR USUARIO — mediana de R$ 60/mes cada
aqui       R$ 49/mes pela empresa inteira, 1 ou 20 pessoas
5 pessoas  R$ 300/mes contra R$ 49/mes
```

Um concorrente não copia isso sem mudar o próprio modelo de receita. É o tipo
de diferença que sustenta anúncio de busca, porque responde exatamente à
comparação que a pessoa está fazendo naquele segundo.

---

## Estrutura proposta

Três grupos de anúncios, separados por **intenção** e não por tema — o que
determina o texto do anúncio é o que a pessoa quer, não a palavra em si.

### Grupo 1 — Preço (a intenção mais quente)

Quem busca por preço já entendeu que precisa e está escolhendo. É onde o
diferencial deste produto responde direto.

```
crm barato
crm mais barato
crm preco
quanto custa um crm
crm sem cobrar por usuario
crm preco fixo
crm que nao cobra por vendedor
```

### Grupo 2 — Porte (a intenção mais volumosa)

```
crm para pequena empresa
crm para pequenos negocios
melhor crm para pequena empresa
crm para microempresa
crm simples
crm facil de usar
sistema de vendas para pequena empresa
```

### Grupo 3 — Substituição de planilha (a dor específica)

Conecta com a peça `a3_objecao_planilha` e com o recurso de importação, que já
existe e funciona.

```
planilha de vendas
controle de clientes planilha
substituir planilha por crm
como organizar clientes
controle de vendas excel
```

**Negativas desde o dia 1**, senão o orçamento vaza:

```
gratis        quem quer so o gratis nao assina o Pro
curso         "curso de crm"
o que e       intencao informacional, nao de compra
salario       "salario analista de crm"
vaga          "vaga crm"
significado
download      procura software instalado, nao SaaS
excel         so no grupo 3, e mesmo la com cuidado
```

---

## Os textos, e a regra que governa

Anúncio de busca tem **títulos de 30 caracteres** e **descrições de 90**. A
disciplina é a mesma da arte: nada que não se possa conferir.

### Títulos (30 caracteres cada)

```
CRM por R$ 49 a empresa toda
Nao cobramos por vendedor
CRM simples, sem treinamento
Sua planilha vira funil
Comece gratis, sem cartao
CRM para pequena empresa
Preco fixo, quantas pessoas
Importe sua planilha hoje
```

### Descrições (90 caracteres)

```
Um preco para a empresa inteira. Com 1 ou com 20 pessoas, sao R$ 49 por mes.
Traga sua planilha do jeito que esta. O funil monta sozinho, em um minuto.
Gratis ate 50 contatos, sem cartao. O Pro custa R$ 49/mes e cancela sem multa.
Agenda do Google e Gmail conectados. Voce nao aprende ferramenta nova.
```

**O que NÃO entra**, e é a mesma decisão travada do resto do projeto: prova
social inventada. Nada de "mais de X empresas" enquanto não houver cliente
externo pagante. O que substitui é o que se confere — preço de tabela pública
do mercado e o que o produto de fato faz.

---

## Medição: CONSTRUÍDA em 04/09

**Sem conversão configurada, a campanha é dinheiro no escuro.** É o mesmo erro
que a campanha `OUTCOME_TRAFFIC` da Meta cometia — otimizar por clique não usa
o sinal que importa.

Esta seção era uma lista do que precisava existir. Passou a descrever o que
existe:

```
lib/analytics/google-ads-id.ts       higieniza o AW- e o rotulo
lib/analytics/conversao-google.ts    a decisao de disparar, testavel sem DOM
lib/analytics/superficie-publica.ts  onde pode existir rastreador
components/analytics/google-ads.tsx  a tag, com as 4 cercas do Meta Pixel
supabase/migrations/0071_gclid…      guarda o id de clique
components/landing/usar-destino…     leva a origem adiante nos CTAs
```

### A armadilha que quase engoliu tudo: a CSP

`next.config.mjs:57` liberava `connect.facebook.net` e mais nada. O script da
tag vem de `www.googletagmanager.com`, e **a CSP é bloqueio de verdade desde 27/08** —
o navegador recusaria o script em silêncio.

O estrago seria: campanha rodando, dinheiro saindo, **zero conversão no
painel**. Erro de configuração com aparência de anúncio ruim, e a decisão
seguinte seria pausar a campanha que funciona.

Nenhum dos quatro portões alcança isso: eles leem o código que GERA o header,
nunca o que é SERVIDO — e os dois já discordaram aqui por 61 linhas, no
`robots.txt` reescrito pelo Cloudflare. Por isso a conferência entrou em
`scripts/marketing/auditar-descoberta.mjs`, que lê por HTTP.

### O ponto de conversão: `/bem-vindo`, e por que só ele serve

Rastreado no código, não suposto:

```
cadastro por e-mail   lib/supabase/actions.ts:137,155,215 -> /verifique-email
                      confirmar/page.tsx:82               -> /bem-vindo
entrada pelo Google   app/auth/callback/route.ts:55       -> /bem-vindo
```

Disparar em `/verifique-email` perderia **toda conta criada pelo Google**, que é
o caminho de menor atrito e o mais provável em tráfego pago. É a única rota da
área logada onde a tag entra — a do Meta continua fora dela inteira, porque as
conversões da Meta nascem no servidor e não precisam da exceção.

**Conta criada, e não "virou Pro".** Com 2 a 9 conversões por mês nenhum lance
automático funciona (o Smart Bidding pede 15 a 30), então a conversão não serve
para o algoritmo lançar: serve para o relatório dizer qual palavra trouxe
cadastro. Lance fica em **CPC manual**.

### Consentimento e política, fechados junto

A cerca é a mesma do pixel, e o precedente é caro: a Conversions API enviava
dado de quem clicou "Recusar" porque a decisão vive em `localStorage` e o
servidor não lê `localStorage`. Aqui a tag é do navegador, e as três condições
(aceite, `gtag` presente, ainda não contado) são função pura com teste.

**A política foi junto, não depois.** O Google Ads entrou em `SUBOPERADORES` em
entrada SEPARADA da do login com Google — login é execução de contrato, medição
depende de consentimento, e uma linha misturada diria ao titular que ele não
pode recusar o que pode. A seção 3 nomeava só a Meta e passou a nomear as duas.

A finalidade declarada no banner ("medir de onde vêm as visitas") **não muda**,
então o consentimento de quem já respondeu continua válido.

### O `gclid`, guardado hoje pelo que ele vai responder amanhã

O relatório do Google sabe quem clicou e quem se cadastrou. Quem **pagou**
acontece dias depois no Asaas, fora do alcance de qualquer tag. O caminho
oficial é a importação de conversão offline, e ela exige exatamente um dado: o
`gclid` daquele clique.

A importação **não** entra agora (OAuth, developer token e aprovação do Google,
semanas). Mas ela é impossível sem histórico, e histórico não se cria depois:
cada dia rodando sem a coluna é um dia de cliques que nunca poderão ser
reconciliados com o dinheiro que trouxeram.

### O eco, e o segundo botão que quase ficou de fora

O anúncio leva a `/quanto-custa-um-crm`, não a `/cadastro`. `ecoDaPeca` lê
`utm_content` da URL, então o CTA precisa levar a origem adiante — senão o
"grátis, sem cartão" some diante dos quatro campos.

**Corrigir só o CTA do corpo não bastava.** Medido no navegador: a mesma página
tem DOIS botões "Começar grátis" — o do texto e o da `PublicNavbar` —, e qual
promessa a pessoa veria dependia de qual dos dois idênticos ela clicasse. A
regra virou um hook usado pelos dois.

Só `g1_preco` tem eco, porque só ele vai ao ar. Eco para grupo que não existe
seria código morto com aparência de recurso — a razão que já recusou o tipo
`whatsapp_caiu` nas notificações.

---

## Orçamento e expectativa, sem otimismo

> **Corrigido em 03/09.** A primeira versão desta seção estimou CPC de R$ 2 a
> R$ 6, **sem base** — foi chute meu. O dado publicado para software e SaaS no
> Brasil em 2026 é de **R$ 4 a R$ 15**, e o orçamento mínimo que o setor
> pratica na fase de aprendizado é de **R$ 2.500 a R$ 4.000/mês**.
>
> Isso muda a conclusão, não só o número.

```
CPC real (software/SaaS, BR)   R$ 4 a R$ 15
R$ 25/dia = R$ 750/mes         1,7 a 6 cliques/dia
conversao de cadastro          2% a 5%
                               -> 1 cadastro a cada 3 a 10 dias
minimo praticado no setor      R$ 2.500 a R$ 4.000/mes
```

**O orçamento está de 3 a 5 vezes abaixo do que o setor pratica.** Google Ads
tem intenção melhor que o feed, e clique mais caro — com verba pequena as duas
coisas se cancelam. Não é o atalho que resolve o bloqueio da Meta.

O gargalo não é o canal: é o orçamento contra o custo da categoria. CRM tem LTV
alto, então RD Station, Pipedrive e Agendor pagam caro pelo clique e dominam o
leilão das palavras óbvias. Não se ganha esse leilão com R$ 25/dia.

### O que muda a conta: só cauda longa

A única forma de R$ 750/mês render em busca é **não disputar o que é caro**:

```
CARO, nao disputar        BARATO, e e onde este produto ganha
crm                        crm que nao cobra por usuario
melhor crm                 crm com preco fixo por empresa
crm para empresas          crm que importa planilha de excel
sistema de vendas          crm sem cobrar por vendedor
```

A coluna da direita tem pouco volume — talvez 50 buscas/mês cada. Mas quem
digita aquilo procura exatamente o que este produto faz, e o clique sai por
R$ 1 a R$ 3 em vez de R$ 12. **Pouco volume com alta precisão** é o único
desenho que cabe nesse orçamento.

Isso reordena os grupos propostos acima: o **Grupo 1 (preço)** vira o
principal, e as palavras genéricas do Grupo 2 (`crm simples`, `crm para
pequena empresa`) passam a ser as mais caras e as menos indicadas para começar.

**O número que decide tudo, e que ainda não existe:** quantos cadastros viram
pagantes. Nunca houve cliente externo neste produto. Até esse número aparecer,
qualquer projeção de CAC é chute — e é justamente por isso que vale rodar
mesmo pequeno.

---

## O que falta, e é do dono

O código está pronto e provado. O que falta não tem linha de código nenhuma.

- [ ] **Conta no Google Ads**, em <https://ads.google.com>, com método de
      pagamento. Não é o mesmo sistema da Meta, então o bloqueio de lá não
      afeta este.
- [ ] **Criar a ação de conversão** (Ferramentas → Conversões → Site → "Enviar
      formulário"). Dela saem **dois** valores.
- [ ] **Colar os dois na Vercel**, em `production` e `preview`:

      NEXT_PUBLIC_GOOGLE_ADS_ID                  AW-123456789
      NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL    AbC-dEfG_hIj

      **Sem o segundo, a tag carrega e nenhuma conversão é contada.** É a falha
      mais silenciosa daqui, e por isso o componente exige os dois para
      desenhar qualquer coisa.

      São `NEXT_PUBLIC_` porque a tag roda no navegador — não são segredo, e o
      valor aparece no HTML por desenho, como o do pixel da Meta.

- [ ] **Criar a campanha** com a estrutura acima: um grupo só, CPC manual,
      Rede de Pesquisa apenas, correspondência de frase ou exata.

### E a ordem importa

Colar as variáveis **antes** de promover o deploy que traz a CSP nova faz a tag
tentar carregar contra a política antiga e ser recusada em silêncio. Depois de
promover, `node scripts/marketing/auditar-descoberta.mjs` diz se o header
chegou — hoje ele reprova de propósito, porque produção ainda serve a CSP sem o
`googletagmanager`.

**A primeira coisa a olhar não é venda, é CPC real.** Se as palavras saírem a
R$ 2-3, o desenho funciona e volume é questão de tempo. Se saírem a R$ 10, o
leilão recusou o argumento e a decisão é parar — não aumentar.
