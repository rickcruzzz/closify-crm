# Plano de conteúdo do feed — @velofunil

Feito em 31/08/2026. Cobre **feed** apenas (Stories e Reels ficam de fora), e
**sem nenhum tema de WhatsApp**, por decisão do dono nesta rodada.

---

## 1. Posicionamento atual, medido

O perfil tem **9.102 seguidores e ZERO posts**, medido no HTML público em
31/08. É a maior audiência própria do projeto, e a única que não custa mídia
paga.

Os dois números corrigem o que estava registrado. O `estado-atual.md` anotou
**3.555** em 25/08 — a base quase triplicou desde então e ninguém percebeu,
porque nada neste projeto lê o perfil. E o feed **nunca recebeu uma peça**: as
5 artes de 29/08 foram geradas e não subiram.

**Isso muda a aposta desta rodada.** Não é "mais um post" — é a estreia do
perfil para nove mil pessoas que seguiram e nunca viram nada. No Instagram a
primeira impressão é a GRADE, não o post: quem abre vê as primeiras nove
miniaturas de uma vez. Por isso a ordem do calendário abaixo importa mais do
que importaria num perfil já ativo.

O que o projeto já tem pronto e alinhado:

    lib/dono/perfil-instagram.ts   nome, bio, link e categoria derivados das
                                   MESMAS constantes da landing. Mudar o plano
                                   muda a bio junto, com teste travando isso.
    scripts/marketing/gerar-feed.py  gerador 1080x1350 com zona segura 3:4
    marketing/instagram/feed/      5 artes ja geradas em 29/08

**A tensão que este plano precisa resolver:** a landing foi repositionada em
24/08 para atacar o WhatsApp como inimigo (82% da PME brasileira vende por lá,
Sebrae). O feed herdou isso — **1 das 5 artes existentes é sobre WhatsApp** e,
por esta rodada, sai.

Sem WhatsApp, o eixo do conteúdo volta para onde a landing estava antes e onde
o produto continua forte: **a venda que morre por esquecimento, e o custo de
operar sem processo.**

## 2. Concorrência, e o que ela deixa livre

Os CRMs brasileiros que disputam a mesma PME:

| quem | preço público | como se posiciona |
|---|---|---|
| Agendor | ~R$ 53/usuário/mês | simples, consultivo, plano grátis |
| Ploomes | ~R$ 225/mês (3 usuários) | B2B complexo, CPQ, proposta e contrato |
| RD Station CRM | por usuário | ecossistema de marketing |
| Moskit | por usuário | integração nativa |

**Todos cobram por usuário.** É a única brecha estrutural de preço que o Velo
Funil tem, e ela vale conteúdo próprio: cinco pessoas a R$ 53 dão R$ 265/mês
contra R$ 49 pela empresa inteira.

O que a categoria publica hoje, e por que isso abre espaço:

- **Dica genérica de vendas** ("5 dicas para vender mais") — saturado, sem
  autoridade, indistinguível entre perfis.
- **Print de funcionalidade** — só interessa a quem já é cliente.
- **Depoimento de cliente** — o que mais converte, e o que **não podemos
  fazer**: a decisão contra prova social inventada está travada no projeto, e
  não há cliente externo.

**A lacuna:** ninguém publica **dado de mercado com fonte impressa na arte**.
É o único conteúdo que gera autoridade sem depender de cliente — e é
exatamente o formato que o gerador deste projeto já produz.

Formato: **carrossel e imagem única de dado**. Carrossel informativo é o que o
algoritmo recompensa em B2B (salvamento e compartilhamento), e é onde o feed
ainda tem alcance orgânico decente contra a queda para 1–4% em perfil
comercial.

## 3. O plano — 8 peças, 4 semanas, 2 por semana

Três pilares, alternando. Nenhum menciona WhatsApp.

### Pilar A — Dado com fonte (autoridade)

Formato já existente: número gigante + explicação + fonte na arte.

| # | número | frase | fonte |
|---|---|---|---|
| A1 | **21x** | mais chance de qualificar respondendo em 5 min | InsideSales/MIT |
| A2 | **42h** | é a média de primeira resposta do mercado | HBR, 2.241 empresas |
| A3 | **3,4h** | por semana só digitando no CRM | pesquisa de produtividade |
| A4 | **55%** | das implantações de CRM falham — 60% disso é adoção | dado publicado |

A3 e A4 são **novos** e carregam a dor central: o pedágio de digitação. A4 é a
mais forte para quem já tentou CRM e desistiu — público que a concorrência
ignora porque não sabe como falar dele.

### Pilar B — Declaração (o sinal que ninguém olha)

Sem número. Frase que nomeia o problema.

| # | frase |
|---|---|
| B1 | Negócio sem próximo passo morre calado *(já existe)* |
| B2 | O funil não mente. A memória mente. |

B2 é nova. Ataca o "eu guardo tudo na cabeça", que é a objeção real de quem
nunca usou CRM.

### Pilar C — A conta que ninguém faz (preço)

| # | número | frase |
|---|---|---|
| C1 | **R$ 49** | por mês, pela empresa inteira — não por vendedor *(já existe)* |
| C2 | **R$ 265** | é o que 5 pessoas custam num CRM por usuário |

C2 é a mesma conta pelo ângulo do concorrente. Preço de tabela pública é fato
verificável — por isso pode ser dito sem citar nome.

### Calendário

    semana 1    A3 (3,4h)      C2 (R$ 265)
    semana 2    A4 (55%)       B2 (memoria)
    semana 3    A1 (21x)       C1 (R$ 49)      <- A1 e C1 ja existem
    semana 4    A2 (42h)       B1 (morre calado)  <- as duas ja existem

Quatro peças novas (A3, A4, B2, C2), quatro já prontas. Começa pelas novas
porque são as que carregam a dor que a landing atual não cobre.

## 4. O que NÃO entra, e por quê

- **Nada de WhatsApp** — restrição desta rodada.
- **Sem depoimento, logo de cliente ou "+X empresas"** — decisão travada no
  projeto contra prova social inventada, e não há cliente externo.
- **Sem print do produto** por enquanto: print é o único artefato que não
  acompanha refatoração, e já mentiu duas vezes neste projeto (19/08 e 24/08).
  Entra quando houver rotina de recaptura.

## 5. Produção — o que funciona e o que não

Medido em 31/08, com as três ferramentas testadas:

    Canva MCP        conectado, mas 0 brand kits. Sem a identidade, o
                     gerador de IA improvisa: em 2 de 2 tentativas
                     introduziu icone dentro de letra, cortou o nome da
                     marca ("Velo", "veIo Funill") e corrompeu texto em
                     portugues.
    Replicate        expira em 300s. Mesmo comportamento de 20/08.
    Instagram API    0 contas ligadas a conta de anuncio. Publicacao por
                     API nao existe hoje.

**O caminho que produz a identidade correta é `scripts/marketing/gerar-feed.py`**
— determinístico, sem custo, com a zona segura 3:4 conferida, e onde a remoção
do selo do rodapé é uma linha.

A subida continua manual, pelo celular, como já é hoje.
