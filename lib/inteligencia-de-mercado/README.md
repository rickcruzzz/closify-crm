# Inteligência de mercado (Exa)

Enriquece um lead com **sinais públicos verificáveis** sobre a empresa dele —
reclamação, contratação, captação — cada um com link para a fonte.

## A fronteira

Nada de fora importa de um caminho interno daqui. A superfície pública é o
`index.ts`, e só ela. Os `ports/` são o contrato com o resto do produto; os
`adapters/` são os únicos arquivos deste módulo que conhecem o projeto.

O módulo **não** importa `LeadRow` de `lib/leads/queries.ts` de propósito: se
importasse, mudar uma coluna do CRM quebraria a inteligência de mercado, e as
duas passariam a ser uma coisa só.

## Três decisões que vieram de medição, não de opinião

**1. Não restringir a busca ao site da empresa.** A primeira versão mandava
`includeDomains: [dominio]`. Medido em 06/09/2026: 6 trechos do site
institucional da RD Station produziram **zero** sinais, e a mesma pergunta sem
filtro trouxe duas reclamações no Reclame Aqui. Ninguém publica a própria dor no
próprio site.

**2. A palavra da pergunta não é prova.** A consulta perguntava "quais os
gargalos?", o Exa destacava o trecho contendo "gargalo", e o classificador
declarava `dor/alta`. **O sinal era a pergunta ecoando de volta** — 5 falsos
positivos numa única busca. Por isso `classificarSinal` recebe a consulta e
desqualifica como evidência tudo que apareceu nela.

**3. Só `alta` é gravado.** Fechada a circularidade, sobraram 3 sinais `media`,
e os três eram ruído ("acesse a nova edição dos panoramas"). "Desafio" e
"dificuldade" são vocabulário padrão de marketing. Vale a regra do sino de
02/09: *fila com lixo dentro ensina a ignorar a fila inteira*.

**4. Nome E domínio juntos; segmento fora.** A/B contra a API real, mesma
pergunta em quatro formas: `dominio + segmento do usuario` deu **0** sinais, só
domínio **1**, só nome **1**, e `NOME (dominio)` deu **2**. O nome é como as
pessoas escrevem no Reclame Aqui; o domínio desambigua a homônima.

O `segmento` saiu porque descrevia a **empresa errada** — é o segmento de quem
USA o CRM, não o do lead pesquisado. Dizia ao Exa que a RD Station é "do setor de
Tecnologia" porque quem perguntou era de tecnologia. Custou os dois sinais
inteiros.

**5. O domínio sai do e-mail, e provedor pessoal é recusado.** O CRM não tem
campo de site — conferido no catálogo. Em B2B o e-mail corporativo é o domínio.
Sem a lista de provedores pessoais, `joao@gmail.com` viraria uma busca sobre **o
Gmail**, com resultado plausível e alheio ao lead.

## O que este módulo não faz, e não vai fazer

**Não minera contatos de terceiros para injetar no funil do cliente.** Foi pedido
como gatilho de FOMO — leads borrados com "achamos 7 clientes prontos para
comprar de você". Recusado por três razões independentes: é dado pessoal de
quem não consentiu (LGPD), afirma o que nenhuma busca sustenta, e contamina o
funil, que é a promessa central do produto. O substituto honesto é número
agregado: *"12 buscas com intenção de compra no seu nicho esta semana"*.

**Não parafraseia.** O `resumo` é recorte do próprio highlight. Paráfrase
introduziria uma afirmação que ninguém escreveu, sobre uma empresa real.

**Não grava sinal sem `fonte_url`.** Insight sem link é opinião da máquina.

## Custo

US$ 0,007 por busca neural, medido no `costDollars` da resposta real. O teto
mensal por workspace vive em `dominio/orcamento.ts` e **para** quando estoura —
não degrada.

## Estado

Pronto e provado ponta a ponta contra produção: `dominio/**` (35 testes),
`exa/**`, `ports/**`, `adapters/**`, `servico.ts`, a migration 0072 com RLS
(14 de 14) e o cron `/api/cron/enriquecer-leads`, a cada 15 minutos.

A prova da fila, com três leads descartáveis: o corporativo achou uma reclamação
no Reclame Aqui e custou 5 centavos; o `@gmail.com` não virou busca (custo zero);
o lead sem dados saiu da fila em vez de voltar para sempre; e a segunda passagem
processou zero.

Falta: o aviso no sino (o tipo `sinal_de_mercado` precisa entrar no `check` da
0066), a tela que mostra os sinais, e o Exa entrar na Política de Privacidade
como suboperador.
