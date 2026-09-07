# Investigação comercial: o que ficou PROVADO, e o que continua não provado (07/09/2026)

Pedido do dono: *"faça uma investigação comercial de mercado pra alimentar
nosso sistema por trás, pra passar de 'não está provado' pra 'está provado' o
que dá certo e o que não dá"*.

Rodado com a API do Exa: **13 chamadas, US$ 0,19**. Este documento separa as
três coisas que costumam ser confundidas — **provado**, **indício** e **não
provado** — porque tratar as três como a mesma é a classe de erro mais cara
deste projeto.

---

## O que a ferramenta pode e não pode provar

```
PODE     preco publicado, modelo de cobranca, promessa de site,
         reclamacao publica registrada
NAO PODE se ISSO faz alguem comprar de NOS. Isso nao esta publicado em
         lugar nenhum — nasce da primeira conversa
```

O Exa devolve **o que está publicado**, não o que é verdade. Para pergunta de
decisão, o resultado é ponto de partida a conferir — do jeito que o Search
Console desmentiu duas suposições em 03/09.

---

## [PROVADO] O modelo de cobrança do mercado brasileiro

18 domínios com preço publicado, lidos em 07/09/2026.

```
modelo             dominios
por usuario              9
nao declarado            7
fixo por empresa         2
```

| domínio | modelo | preços publicados |
|---|---|---|
| avaly.io | por usuário | R$ 45 |
| crm.agencianooma.com.br | não declarado | R$ 47 · R$ 97 · R$ 197 |
| idealsales.com.br | por usuário | R$ 50 · R$ 100 · R$ 240 · R$ 300 |
| agendor.com.br | por usuário | R$ 0 · R$ 59 · R$ 83 · R$ 156 |
| propo.com.br | por usuário | R$ 60 · R$ 90 · R$ 180 · R$ 270 |
| clixx.com.br | fixo | R$ 65,70 |
| meets.com.br | não declarado | R$ 68 · R$ 396 · R$ 555 · R$ 650 |
| akiocrm.com | por usuário | R$ 69 · R$ 149 · R$ 267 |
| rdstation.com | por usuário | R$ 65,70 · R$ 73 · R$ 117,90 · R$ 131 |
| moskitcrm.com | por usuário | R$ 75,65 · R$ 89 · R$ 126,65 · R$ 152,15 |
| ploomes.com | por usuário | R$ 85 |
| nexxou.com | por usuário | R$ 97 · R$ 297 · R$ 397 · R$ 597 |
| trakium.chat | não declarado | R$ 89 · R$ 97 · R$ 197 · R$ 297 |
| upgestao.com.br | não declarado | R$ 297 · R$ 397 · R$ 697 · R$ 1.497 |
| bitrix24.com.br | fixo | R$ 279 · R$ 399 · R$ 799 · R$ 3.199 |
| datacrazy.io | não declarado | R$ 211,75 · R$ 246,20 · R$ 297 |
| leads360.com.br | não declarado | R$ 99 · R$ 149 · R$ 297 · R$ 797 |

### A correção que isto obriga, e ela é minha

Eu escrevi em 06/09, e repeti depois, que **"R$ 49 pela empresa toda é o mais
barato de toda a lista"**. Com 18 domínios em vez de 6, **é falso**:
`avaly.io` entra em R$ 45, `agencianooma` em R$ 47 e `idealsales` em R$ 50.

O que continua verdadeiro, e é outra frase:

```
com 1 pessoa    varios sao mais baratos que nos
com 3 pessoas   R$ 45/usuario = R$ 135. Nos: R$ 49
com 5 pessoas   R$ 45/usuario = R$ 225. Nos: R$ 49
```

**Não somos o mais barato. Somos o que não sobe.** É uma promessa diferente, e
mais defensável — porque a primeira era desmentida por uma página de preços.

### E o "preço fixo" é mais raro do que eu disse

Em 06/09 registrei sete players com preço fixo. Com amostra maior: **2 de 18
declaram fixo**, e um deles é o Bitrix24, que começa em R$ 279. Os sete de antes
vieram de uma busca que EU escrevi com as palavras "preço fixo" — a busca achou
quem usa a expressão, não a fatia do mercado.

Consulta enviesada devolve a resposta que a consulta plantou. É a mesma
armadilha do `classificarSinal` e da praça virando vocabulário.

---

## [INDÍCIO] O que se reclama dos CRMs grandes

11 páginas do Reclame Aqui lidas, contra RD Station, Agendor, Ploomes, Moskit,
Bitrix24, Pipedrive e Meets. Só **4 tinham relato em primeira pessoa** — o
resto é página de listagem, que repete rótulo sem ninguém ter escrito nada.

```
4  cancelamento / fidelidade
2  cobranca indevida
2  promessa de venda que nao se cumpriu
0  suporte que nao responde
0  dificuldade de uso
```

> "Cobrança indevida após cancelamento e encerramento de contratos."

**É indício, não prova.** Quatro relatos não medem um mercado; medem que a
queixa EXISTE e é sempre da mesma família. Chamar isso de "a objeção nº 1 do
mercado", como eu chamei em 06/09, foi ir além do dado.

O que ele sustenta com honestidade: **cancelamento e cobrança aparecem, uso e
suporte não aparecem.** Se a dor fosse "é difícil de usar", teria aparecido.

---

## [NÃO PROVADO] Tudo que decide receita

```
o Velo Funil converte?          zero cliente externo. Nada a medir
a copy de nao-aprisionamento
funciona?                       esta no ar desde hoje, sem trafego suficiente
prospeccao fria fecha venda?    253 contatos, zero ligacao feita
o sinal de mercado do Exa
faz alguem comprar?             nenhum cliente Pro usou o recurso
qual nicho paga?                a regua mede SITE, nao carteira
```

Nenhuma quantidade de pesquisa move esses cinco. Eles se movem com **conversa**,
e é por isso que a lista de 253 vale mais que a próxima rodada de Exa.

---

## O que muda na prática, e onde

1. **A página de comparação** passa de 6 para 18 concorrentes, com data de
   leitura — e a frase "o mais barato" sai, substituída pela conta por equipe,
   que é verdadeira e mais forte.
2. **A landing** para de prometer o que a amostra desmente.
3. **A FAQ** ganha a objeção que os relatos sustentam (cancelamento e cobrança),
   e não a que eu supus.

---

## O método, para a próxima rodada não repetir os erros desta

```
amostra pequena mente     6 dominios diziam "somos os mais caros do
                          segmento fixo"; 18 disseram outra coisa
consulta plantada mente   buscar "preco fixo" acha quem diz "preco fixo",
                          e nao a fatia do mercado que cobra assim
listagem nao e relato     7 das 11 paginas do Reclame Aqui nao tinham
                          ninguem falando em primeira pessoa
publicado != verdade      preco de tabela nao e preco praticado, e
                          desconto de vendedor nao esta em pagina nenhuma
```
