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

## Medição: o que precisa existir antes de gastar

**Sem conversão configurada, a campanha é dinheiro no escuro.** É o mesmo erro
que a campanha `OUTCOME_TRAFFIC` da Meta cometia — otimizar por clique não usa
o sinal que importa.

O que precisa entrar no site:

```
1. tag do Google (gtag.js)          uma vez, no layout raiz
2. conversao "cadastro concluido"   no mesmo ponto onde o `Lead` da Meta dispara
3. consentimento                    a MESMA cerca do pixel da Meta
```

O ponto 3 não é opcional e já tem precedente caro neste projeto: a Conversions
API enviava dado de quem clicou "Recusar" porque a decisão vive em
`localStorage` e o servidor não lê `localStorage`. A tag do Google entra pelo
mesmo caminho de `components/analytics/isolar-analytics.tsx`, com
`podeRastrear` decidindo — nunca antes do aceite.

**A Política de Privacidade já foi preparada para isso em 03/09**: a seção 3
deixou de negar cookie de publicidade e a lista de suboperadores passou a
declarar quem recebe dado. Adicionar o Google como destinatário de medição é
acrescentar uma linha em `SUBOPERADORES` — a finalidade declarada no banner
("medir de onde vêm as visitas") **não muda**, então o consentimento de quem já
respondeu continua válido e não é preciso refazer a pergunta.

---

## Orçamento e expectativa, sem otimismo

```
CPC estimado (CRM, Brasil)   R$ 2 a R$ 6
R$ 25/dia                    4 a 12 cliques/dia
conversao de cadastro        2% a 5% e a faixa comum de SaaS B2B
                             -> 0,1 a 0,6 cadastro/dia
```

Ou seja: **de um cadastro a cada dois dias até três por semana**, no começo.
Parece pouco, e é — mas é o mesmo patamar que a Meta entregaria com o mesmo
dinheiro, com a diferença de que aqui o clique vem de quem estava procurando.

**O número que decide tudo, e que ainda não existe:** quantos cadastros viram
pagantes. Nunca houve cliente externo neste produto. Até esse número aparecer,
qualquer projeção de CAC é chute — e é justamente por isso que vale rodar
mesmo pequeno.

---

## O que falta, e é do dono

- [ ] **Conta no Google Ads.** Leva minutos em <https://ads.google.com>. Se já
      existir uma, o ID de 10 dígitos (formato `123-456-7890`) é o que preciso.
- [ ] **Método de pagamento** na conta nova. Não é o mesmo sistema da Meta,
      então o bloqueio de lá não afeta este.

Com o ID em mãos, o que entra no código é a tag e a conversão; o resto —
campanha, grupos, palavras-chave, negativas e textos — está acima, pronto para
ser criado.
