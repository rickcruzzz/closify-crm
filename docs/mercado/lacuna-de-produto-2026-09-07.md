# O que o mercado anuncia, o que temos, e onde está o dinheiro (07/09/2026)

Pedido do dono: *"análise completa usando o Exa, analisando a fundo nosso SaaS
pra deixar extremamente lucrativo no curto e longo prazo. Na real, o que
precisamos adicionar? Se já adicionamos, dor real?"*

Método: 61 domínios de CRM brasileiro lidos pelo Exa (18 chamadas, US$ 0,37) e
cruzados com o que existe **no código**, conferido por busca no repositório e
não de memória.

---

## O que isto mede, e o que não mede

```
MEDE      o que o concorrente ANUNCIA na propria pagina
NAO MEDE  o que o cliente USA, e muito menos o que ele PAGA para ter
```

Recurso anunciado por 80% do mercado é **aposta de mesa**: não ganha venda,
mas a ausência aparece em toda comparação. Recurso anunciado por 10% é ou nicho
ou modismo. A leitura certa é essa, e não "todo mundo tem, logo precisamos".

---

## A medição

| recurso | anunciado por | temos? |
|---|---:|---|
| funil / kanban | 84% (51/61) | **sim** |
| relatórios / dashboard | 84% (51/61) | **sim** |
| automação de fluxo | 77% (47/61) | não |
| campos personalizados | 75% (46/61) | não |
| IA / assistente | 72% (44/61) | não, por decisão |
| e-mail dentro do CRM | 69% (42/61) | **sim** (Gmail, Pro) |
| WhatsApp | 67% (41/61) | **parcial** — só o link `wa.me` |
| API / integrações | 59% (36/61) | parcial (Google, sem API pública) |
| **proposta / orçamento** | **59% (36/61)** | **não** |
| importação de planilha | 57% (35/61) | **sim** (e exportação) |
| agenda / calendário | 54% (33/61) | **sim** |
| app no celular | 34% (21/61) | não (é responsivo) |
| telefonia / VoIP | 15% (9/61) | não |
| múltiplos funis | 11% (7/61) | não |
| metas / comissão | 8% (5/61) | não |
| assinatura eletrônica | 3% (2/61) | não |

Conferido no repositório: `comissao` aparece em **0 arquivos**, `automacao` em
**0**, `pipeline_id` em **0**. E `proposta` existe **só como nome de etapa** —
`DealStage` tem `proposta_enviada`, e não há nenhuma função que gere uma.

### Um aviso sobre esta tabela

A primeira rodada devolveu `integracao e-mail 0/52` e `app mobile 1/52`. Zero de
52 para e-mail num mercado de CRM é impossível: eram **regex minhas boas demais**,
exigindo uma formulação exata. Foram corrigidas e o texto ficou em cache, para
reclassificar não custar de novo.

Registro porque o defeito é o mais caro deste projeto: número plausível com
conclusão errada. Publicar "ninguém oferece e-mail" teria orientado a decisão
seguinte para o buraco.

---

## O achado que vale mais que a tabela

**O objeto que o nosso ICP manipula o dia inteiro não existe no produto.**

Os cinco nichos da prospecção foram escolhidos em 07/09 por uma regra escrita
antes de olhar o resultado, e o critério principal era **`ORCAMENTO >= 2`** —
quantos sites do nicho pedem orçamento. Dedetização, marcenaria, comunicação
visual, locação e eventos entraram porque **vendem por orçamento**.

E a mensagem de abordagem que sai para eles diz, com estas palavras:

> *"Quando você manda um orçamento e o cliente não responde, quem lembra de
> cobrar de volta?"*

Duas medições independentes apontam para o mesmo objeto — a régua de nicho e o
59% do mercado — e o produto tem, para ele, **o nome de uma etapa do Kanban**.

Isso não quer dizer "construa um gerador de PDF". Quer dizer que o negócio
deveria carregar o que um orçamento carrega: **valor, validade e o que foi
proposto** — e que "orçamento vencendo em 2 dias" é uma tarefa que o produto
já sabe fazer e não faz.

---

## O problema estrutural de lucro, que nenhum recurso resolve

R$ 49 pela empresa inteira é o diferencial **e** o teto.

```
receita por cliente     R$ 49/mes, com 1 ou com 20 pessoas
expansao por assento    nao existe, por construcao
expansao por uso        nao existe hoje
```

Todo CRM que cobra por usuário cresce sem vender de novo: o cliente contrata,
a fatura sobe. Aqui não. **Cada real a mais precisa vir de um cliente novo** —
e isso torna o custo de aquisição a única alavanca que importa.

A conta que decide, com os números reais do projeto:

```
R$ 49/mes x 12 meses de retencao   =  R$ 588 de receita bruta por cliente
saudavel a 3:1                     =  CAC precisa ficar abaixo de ~R$ 190
CPC medido no Google Ads           =  teto de R$ 3,00
                                      logo: ate ~60 cliques por cliente pago
```

Sessenta cliques por venda é folgado — **se** a taxa de conversão existir. Ela é
justamente o que não está provado.

### A saída que não quebra a promessa

Expansão por **uso**, nunca por assento. E ela já existe meio construída: a
pesquisa de mercado (0072) consome API paga e tem teto de R$ 30/mês por empresa
em `dominio/orcamento.ts`.

```
o que NAO fazer   cobrar por usuario. Destroi o unico argumento que temos
o que cabe        um teto de pesquisas no Pro, e pacote adicional para quem
                  passar. Quem usa mais, paga mais — e ninguem paga por
                  contratar alguem
```

O plano anual (R$ 490, já existe) é a outra alavanca, e a mais barata: ele não
aumenta a receita por cliente, mas trava 12 meses de retenção — que é o número
que a conta de LTV assume e que este produto nunca mediu.

---

## A ordem, e o motivo de cada posição

```
1. orcamento no negocio      valor + validade + o que foi proposto, e a
                             tarefa de retorno nascendo dele. Duas medicoes
                             independentes apontam para ca, e o produto ja
                             tem tarefa e prazo — falta o objeto
2. campos personalizados     75% do mercado, e `deal_stage` e ENUM em 9
                             arquivos. E a mudanca grande que a fila tecnica
                             ja registra e adia por falta de cliente pagante
3. WhatsApp de verdade       67% anuncia; temos o link `wa.me`. A ponte saiu
                             em 28/08 por problema de fornecedor, nao de
                             decisao — voltar exige API oficial aprovada
4. automacao de fluxo        77%, e e o mais caro de construir. So depois de
                             haver cliente que descreva o fluxo dele
```

### O que NÃO entra, com o motivo

```
IA / assistente          72% anuncia, e com 50 leads e ruido caro. A decisao
                         travada continua valendo: o funil ja pontua sozinho
app no celular           34%, e o produto e responsivo. App e loja, review e
                         duas bases de codigo para um ganho de conveniencia
telefonia / VoIP         15%. Nicho, e depende de operadora
metas / comissao         8%
assinatura eletronica    3%
```

---

## O que continua NÃO PROVADO

```
a taxa de conversao        zero cliente externo. A conta de CAC acima e
                           aritmetica sobre um numero que nao existe
a retencao de 12 meses     idem
se orcamento no produto    e a aposta mais bem fundamentada que este
faz alguem pagar           documento tem, e continua sendo aposta
```

A tabela ordena o que construir. **Quem decide é a primeira conversa** — e há
253 contatos esperando, cada um com a mensagem pronta.


---

# Segunda rodada: a anatomia do orçamento, e o que o grátis vale (07/09, madrugada)

Mais 12 chamadas, US$ 0,26. Duas perguntas que a primeira rodada deixou em
aberto: **que forma teria o orçamento**, e **o nosso plano grátis diferencia
alguma coisa**.

## O que compõe um "orçamento" nos concorrentes que o anunciam

Em 56 domínios lidos:

```
43%  PDF
27%  aprovacao online do cliente
23%  itens / catalogo de produtos
16%  modelo / template
14%  envio por link ou e-mail
13%  assinatura eletronica
 4%  VALIDADE / vencimento
 0%  AVISO de que o cliente visualizou
```

### A lacuna dentro da lacuna

Os dois últimos são quase inexistentes — e são exatamente o que este produto
já sabe fazer.

O Velo Funil não é um gerador de documento: é um **relógio**. O h1 da landing
diz isso desde sempre — *"A planilha organiza. Ela não avisa quem está
esperando."* Tarefa, prazo e a tela `/hoje` são o motor que já existe.

```
o que 43% do mercado faz    virar o orcamento em PDF bonito
o que 4% faz                dar VALIDADE a ele
o que 0% faz                avisar quando ela esta acabando
```

**A forma certa do recurso aqui não é "gerar proposta". É "o orçamento tem
prazo, e o sistema cobra o retorno".** O PDF entra depois, porque 43% do
mercado tem e a ausência aparece na comparação — e o projeto já carrega
`jspdf` e `html2canvas-pro`, usados no "Exportar relatório".

**Ressalva de método:** os 56 domínios não são todos ferramentas de proposta —
há artigo e página institucional na amostra. Os 4% e os 0% são **indício forte
de ausência, não censo**. Antes de construir, vale abrir três concorrentes que
anunciam proposta e conferir à mão.

## O plano grátis não diferencia — e um pedaço dele sim

Restringindo a busca aos 19 concorrentes com página de preço já mapeada:

```
12/19  tem plano gratuito de verdade
 5/19  so oferece teste por N dias
 3/19  diz "sem cartao"
janelas de teste citadas: 7 dias (4) · 15 dias (1)
```

**Grátis é aposta de mesa.** Dizer "temos plano grátis" não distingue nada:
dois terços têm. A landing e o `/cadastro` gastam a linha mais nobre com isso.

**"Sem cartão" é o que é raro** — 3 de 19. E nós já dizemos, no sub-hero e nas
três linhas do `/cadastro`. Essa parte está certa e não deve ser tocada.

O que muda: **o grátis deixa de ser argumento e vira remoção de atrito.** O
argumento continua sendo a conta por equipe (R$ 45/usuário × 5 = R$ 225 contra
R$ 49) e a porta de saída.

---

# A decisão, com o que construir e o que ajustar

## Adicionar, na ordem

```
1. ORCAMENTO COM PRAZO no negocio
   valor + validade + o que foi proposto. Ao salvar, nasce a tarefa de
   retorno; ao vencer, aparece em /hoje.
   POR QUE: duas medicoes independentes apontam para o objeto (a regua de
   nicho e os 59% do mercado), e a parte que ninguem faz — validade (4%) e
   aviso (0%) — e exatamente o motor que ja existe aqui

2. PDF do orcamento
   43% do mercado tem. `jspdf` ja esta no projeto, usado no relatorio do
   dashboard. E tirar uma objecao de comparacao por pouco trabalho

3. CAMPOS PERSONALIZADOS
   75% anuncia, e `deal_stage` e ENUM em 9 arquivos de codigo. A fila
   tecnica ja registra isso e adia por falta de cliente pagante — continua
   certo adiar, e passa a ser o proximo depois do orcamento
```

## Ajustar

```
a copy do gratis     para de carregar peso. 12/19 tem gratis; o que e raro
                     e "sem cartao" (3/19), e isso ja esta dito
o argumento central  a conta por EQUIPE, nao "o mais barato" — que a
                     amostra de 18 desmentiu (avaly R$ 45, agencianooma
                     R$ 47, idealsales R$ 50)
a pagina de          de 6 para 18 concorrentes, com data de leitura
comparacao
```

## Não construir agora, e o motivo

```
IA / assistente         72% anuncia. Com 50 leads e ruido caro, e a decisao
                        travada continua valendo
assinatura eletronica   13% no mercado, e depende de terceiro (Clicksign,
                        Autentique). Entra junto do orcamento so se um
                        cliente pedir
aprovacao online        27%. Bonito, e exige pagina publica do orcamento —
                        superficie nova, com seguranca propria
app no celular          34%, e o produto e responsivo
```

---

## O que ISTO ainda não prova

A tabela diz o que o mercado anuncia e o que o produto não tem. **Não diz que
alguém pagaria por isso.**

A aposta do orçamento é a mais bem fundamentada que este documento consegue
montar — duas medições independentes, e um motor já pronto. Continua sendo
aposta até a primeira pessoa dizer, ao telefone, *"eu perco venda porque mando
orçamento e esqueço de cobrar"*.

E há 253 contatos com a mensagem pronta que fazem exatamente essa pergunta.
