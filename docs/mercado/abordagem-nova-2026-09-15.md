# A abordagem nova, decidida em 15/09 e ainda NAO implementada

Este documento e uma PROPOSTA. `montarAbordagem` continua com a versao
antiga, e o que esta aqui foi decidido com o dono nesta data mas nao virou
codigo. Ele existe para a decisao nao se perder entre sessoes.

## O diagnostico: 98 enviadas, 0 contas criadas

A mensagem antiga termina em **link de cadastro**. Ela pede a um estranho que
crie conta, senha, empresa e passe pelo onboarding, na primeira mensagem.

Cold outreach nao converte pedindo conversao. Converte pedindo **resposta**. A
escada e resposta, conversa, cadastro. A antiga pulava dois degraus.

Os outros tres defeitos:

    a pergunta nao doi     "quem lembra de dar o retorno?" ele responde
                           "eu lembro" na cabeca e segue
    vira pitch na 3a linha preco, sem cobrar por usuario, sem cartao, sem
                           fidelidade, CSV. Cinco objecoes respondidas antes
                           de existir desejo. Denuncia vendedor
    preco antes do valor   R$ 97 aparece antes de ele querer qualquer coisa

E a ultima linha, "pode ignorar", fecha sugerindo ignorar, no lugar onde
deveria estar o pedido.

## O achado que corrige a leitura de "zero respostas"

Do comentario em `app/api/webhooks/evolution/route.ts`:

> 18 das 47 empresas responderam em 15 segundos de media. Nenhuma era pessoa,
> eram chatbots de atendimento.

Houve resposta. Nenhuma humana. "A mensagem nao engaja" manda reescrever a
copy; "o nicho e todo automatizado" manda rever a lista. `ehRespostaAutomatica`
separa os dois.

## O posicionamento

Nao se vende organizacao, que e melhoria e nao tem urgencia. Vende-se
**dinheiro que ja e dele e ele vai perder**.

> O cliente que sumiu nao desistiu de comprar. Ele comprou de quem voltou.

Ele nega "voce e desorganizado". Nao nega "seu concorrente foi mais rapido no
retorno", porque esse publico pede tres orcamentos e ja ganhou assim.

A palavra e **VOLTOU**: a unica acao do funil que ele controla sozinho, e
gratis, e ele nao faz.

## Toque 1, dia 0

    Oi, {nome}. Nao e pedido de orcamento, e uma ideia rapida.

    Passei os ultimos meses estudando como a pequena empresa
    brasileira perde venda, e o padrao que mais apareceu foi esse:
    o cliente que pede orcamento e some quase nunca desistiu de
    comprar. Ele comprou de quem voltou a falar com ele.

    Faz a conta: quanto vale um orcamento medio de voces?
    Multiplica pelos que estao sem resposta hoje.

    Deu um numero alto? Se nao for o caso, me diz que eu paro
    por aqui.

### Por que cada pedaco

**"Nao e pedido de orcamento"** desarma o mal-entendido mais caro: o dono le
"orcamento" e acha que e cliente comprando. Ele responde animado, descobre que
e venda, e vai em "Bloquear e denunciar". E no painel isso contaria como
`REPLIED`, ou seja, a estatistica melhora enquanto o numero piora.

**"Passei os ultimos meses estudando"** resolve os dois gatilhos que faltavam:
autoridade (ele nao sabe quem escreve) e reciprocidade (a mensagem pedia antes
de dar). E e verdade: 27 nichos medidos, 25 geradores auditados, 61
concorrentes lidos.

**A conta e ELE quem faz.** Numero proprio nao se discute, e numero afirmado
por desconhecido nao se acredita. Efeito IKEA mais compromisso.

**"Deu um numero alto?"** e melhor que "faz sentido pra voces?": pressupoe que
ele fez a conta, e sim ou nao, e nao pergunta nada sobre o produto. Nao se
pergunta "quanto deu?" porque dono de PME nao manda faturamento para
desconhecido.

**Sem preco, sem link, sem marca, sem emoji, sem travessao.** A abertura pelo
motivo `pede orcamento` do CSV passa no teste de remocao: tire a frase e o
resto perde o pe. "Vi o site de voces em {cidade}" nao passa.

## Toque 2, dia 3

    {nome}, o dado que me fez construir isso: olhei 25 sistemas de
    orcamento brasileiros. Todos guardam a validade. Nenhum avisa
    antes de vencer.

    O retorno fica na cabeca de alguem, sempre.

    Vale te mostrar em 2 minutos?

Angulo novo, nao repeticao. O toque 1 falou da dor dele, o 2 fala do mercado. O
dado e medido (22/25 geram PDF, 12/25 guardam validade, 0/25 avisam) e e o
unico territorio sem dono: "preco fixo sem cobrar por usuario" ja tem sete
brasileiros.

## Toque 3, dia 7

    Vou encerrar por aqui pra nao ficar insistindo.

    Se nao for o momento, e so me dizer.
    Se for, me responde que te mostro em 2 minutos.

Duas saidas, as duas de uma palavra, a mais facil primeiro. Dar permissao
explicita de encerrar e o que faz responder.

## A escada depois da resposta

Quando ele responde que sim, em tres baloes separados. Tres baloes leem como
pessoa digitando; um balao longo le como modelo colado.

    balao 1   "Funciona assim: voce salva o orcamento com o valor e a
              validade, e dois dias antes de vencer ele aparece na sua tela
              de hoje, dizendo pra quem voltar." + PRINT da /hoje
    balao 2   www.velofunil.com.br
    balao 3   "Me avisa quando entrar que eu te falo exatamente onde por o
              primeiro orcamento."

O balao 3 e a peca inteira: transforma link de saida em compromisso marcado.

Depois que ele entra, pedir um orcamento REAL, nao exemplo. E anotar a data de
validade: dois dias antes, mandar "Apareceu o aviso do {cliente}?". Esse e o
degrau que vende, porque ele viu funcionar com dado dele.

## O que o print precisa mostrar

Dado plausivel do nicho, nunca dado de teste. `Marcenaria Silva / R$ 8.400 /
vence em 2 dias` faz ele reconhecer o proprio negocio. `Teste Teste / R$ 1,00`
le como demonstracao, e demonstracao nao prova nada.

## O que NAO pode ser dito, em nenhum toque

    "o sistema cobra por voce"    FALSO. Ele cria a tarefa, quem liga e voce
    "voce vai vender X% mais"     nao ha cliente medido
    "empresas como a sua usam"    zero cliente externo, linha travada
    "sempre"                      "na maioria das vezes" e o honesto

## Por que nao ha teste A/B

740 restantes dao 370 por variante, e isso so detecta diferenca de 4 pontos
percentuais sobre uma base de 4%, ou seja, so acusa se a variante DOBRAR.
Detectar 50% de ganho pediria ~1.500 por variante.

O que da para medir e **antes e depois**: 0 de 98 contra X de 740. Sair de zero
para qualquer coisa e conclusao. A/B do fechamento entra quando a lista for de
3.000, e `--universo` e o caminho.

Metricas: primaria e taxa de resposta (`estagio = REPLIED`); secundaria e a
intencao ja classificada; **guarda e opt-out e bloqueio**, e acima de 5% a
rodada para independente do que a primaria mostrar.
