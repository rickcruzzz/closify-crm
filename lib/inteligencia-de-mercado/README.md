# Inteligência de mercado — o que sobrou, e por quê

**Este módulo foi cortado ao meio em 08/09/2026.** O que resta é `dominio/`, e
ele serve à **prospecção do dono**, não ao produto que o cliente usa.

Este arquivo descrevia a arquitetura removida até 11/09 — falava de `index.ts`,
`ports/`, `adapters/` e de "enriquecer um lead com sinais públicos". Nada disso
existe. Quem lesse iria procurar arquivos que saíram do repositório três dias
antes.

## O que existe hoje

```
dominio/prospeccao.ts   descobre e qualifica empresa por nicho e praça
dominio/abordagem.ts    monta o texto e o link wa.me — NÃO envia
dominio/aprendizado.ts  o corpus de vocabulário, acumulado por rodada
dominio/decisor.ts      tenta achar o decisor; medido e RECUSADO, ver abaixo
```

Quem consome, tudo do lado do dono:

```
lib/dono/prateleira.ts          e prateleira-queries.ts
lib/prospeccao/email-copy.ts    reusa `nomeCurto`
scripts/inteligencia/prospectar.mjs
```

## O que foi removido, e a decisão

Saíram `consulta.ts`, `dor.ts`, `sinais.ts`, `orcamento.ts`, `exa/`,
`adapters/`, `ports/`, `servico.ts`, `actions.ts`, `queries.ts`, o cron, o card
na tela do lead e as tabelas `enriquecimento_de_lead` e `sinal_de_mercado`
(0072/0073, derrubadas pela 0075).

**A máquina funcionava.** Foi exercitada ponta a ponta antes de sair:
`{"processados":1,"comSinal":1,"custoCentavos":5}`, com sinal real e fonte. A
remoção não é conserto de defeito — é decisão sobre um recurso que funciona e
**ninguém usou**: zero linhas nas duas tabelas desde que nasceram.

E o custo não era o dinheiro. O card obrigava a declarar o Exa como
suboperador **fora do Brasil** na Política de Privacidade — transferência
internacional de dado de titular, com base legal, para um caminho que ninguém
percorreu uma vez. Obrigação sem contrapartida.

**O corte foi limpo por construção:** nenhum arquivo do lado do dono importava
nada do lado do cliente, e `prospectar.mjs` tem o próprio `fetch` para
`api.exa.ai` — nem o cliente do Exa era compartilhado.

## O que foi medido e RECUSADO — não reconstruir

```
decisor por LinkedIn   0 de 6. A trava nao e culpada: o dado nao existe. Dono
                       de PME nao mantem perfil com a empresa no titulo
espiao de dor          31 chamadas, e NAO produz lead contatavel em pt-BR: a
                       SERP de "CRM preco" e conteudo de concorrente
includeText do Exa     aceito pela API e nao muda nada (25 contra 25)
subpages do Exa        pedido "contato", veio /lentes-de-contato-dental
```

`decisor.ts` continua no repositório com os testes: o código está certo e o
mundo é que não tem o dado. Refazê-lo daria o mesmo zero.

## A regra que governa `abordagem.ts`

**Ele devolve texto e um link `wa.me`. Não envia nada, e isso é decisão.**
Enviador automático é o que bane número, e o número aqui é o do dono — o
mesmo que atende o suporte do produto.

A linha de descarte sai na **primeira** mensagem e nunca é cortada (tem teste).
Ela transforma "não tenho interesse" em resposta em vez de denúncia, e
`scripts/inteligencia/nao-perturbe.txt` é lido a cada rodada — sem ele, a
promessa seria mentira na rodada seguinte.

O porquê inteiro está em [docs/mercado/limites-e-bloqueios.md](../../docs/mercado/limites-e-bloqueios.md).
