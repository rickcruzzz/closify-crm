# Calendário de publicação, 3 semanas

O perfil tem **10 mil seguidores e zero posts**. Isso muda a estratégia: não é
construir audiência, é ativar audiência que já existe e nunca viu nada.

## A ordem é por temperatura, não por preferência

```
semana 1   DOR      a pessoa reconhece o problema como dela
semana 2   CAUSA    ela entende por que as tentativas anteriores falharam
semana 3   OFERTA   ela sabe o que custa
```

**Preço na primeira semana queima audiência.** Quem ainda não nomeou o problema
lê "R$ 49" como propaganda e passa. Depois de duas semanas vendo a própria dor
descrita, o mesmo card vira resposta.

Esta é a razão de `feed-5-preco-por-empresa` fechar o ciclo em vez de abrir,
mesmo sendo a peça com o argumento comercial mais forte.

## A grade

| | seg | qua | sex | dom |
|---|---|---|---|---|
| **S1** | `carrossel-2-carteira` | `feed-9-onde-a-venda-acontece` | `feed-1-janela-de-5-minutos` | `feed-2-media-do-mercado` |
| **S2** | `carrossel-1-pedagio` | `feed-11-o-whatsapp-nao-e-o-problema` | `feed-7-memoria-mente` | `feed-4-morre-calado` |
| **S3** | `feed-8-conta-por-vendedor` | `feed-3-pedagio-de-digitacao` | `feed-6-implantacao-que-falha` | `feed-5-preco-por-empresa` |

**Carrossel na segunda**, de propósito: ele é o formato de maior alcance e
salvamento, e abrir a semana com ele dá ao algoritmo o sinal mais forte
enquanto a audiência está mais ativa.

**Quatro posts por semana**, não sete. Uma conta que nunca postou e despeja
conteúdo diário parece automatizada. E o estoque de 21 peças a 4/semana dura
cinco semanas, tempo de ver o que funciona antes de precisar produzir mais.

## Stories: apoio diário, não conteúdo novo

As ~25 peças de `marketing/instagram/` (demo, dicas, planos, perguntas) entram
como Stories **no dia seguinte** ao post de feed do mesmo tema. Elas já estão
organizadas em 4 destaques (`destaques.json`), que ficam fixos no perfil e são
a primeira coisa que alguém abre ao chegar de um post.

Um Story por dia é suficiente. Sequência inteira de 5 telas de uma vez tem
queda de retenção brutal a partir da terceira.

## O que medir, e quando decidir

Nas primeiras duas semanas, o número que importa **não** é seguidor nem
curtida:

```
salvamentos     a pessoa vai voltar, o sinal mais forte de que acertou o tema
compartilhamen. ela reconheceu o problema como sendo de alguem que conhece
cliques no link a unica metrica que vira cadastro
comentarios     pesam na distribuicao e dizem QUAL dor e a real
```

**Só depois de 8 posts** dá para dizer qual eixo converte. Antes disso a
variação é ruído, a Meta pede ~50 conversões semanais do evento otimizado
para sair da fase de aprendizado, e o orgânico segue lógica parecida.

## A ligação com o tráfego pago

Este calendário existe também para **não pagar por aprendizado que sai de
graça**. As peças que mais salvarem e comentarem são as que viram criativo de
anúncio, com dado real de qual mensagem funciona, em vez de chute.

A campanha atual da conta é `OUTCOME_TRAFFIC`, pausada, R$ 30/dia. Objetivo de
tráfego otimiza por clique e não usa o pixel para conversão; para aquisição de
SaaS o certo é `OUTCOME_SALES` otimizando por `Lead` no começo. Isso fica para
depois destas três semanas.

## Antes do primeiro post

```
[ ] bio do perfil conferida contra lib/dono/perfil-instagram.ts
[ ] link da bio com www e UTM (sem www custa 980ms, medido em 25/08)
[ ] 4 destaques publicados, para quem chegar de um post ter onde entrar
[ ] conta profissional, para os numeros acima existirem
```

O primeiro item não é formalidade: a bio **já esteve errada** por meses,
anunciando "grátis até 300 contatos" quando o Free era 50, e ninguém percebeu
porque nada no projeto lia o perfil.
