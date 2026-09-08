# Estado atual do Velo Funil

Documento de continuidade. É lido no começo de toda sessão (referenciado no
[CLAUDE.md](../CLAUDE.md)) para que uma conversa nova, ou outra conta, comece
sabendo o que já foi feito, o que foi decidido e onde estão as armadilhas.

**Atualizado em:** 08/09/2026 (a lista de 882 empresas virou fila de trabalho na
Central, com envio em um clique; e o clique que nao disparava nao dava erro
nenhum — duas causas empilhadas mais um defeito do proprio teste)

## O histórico de agosto mora em outro arquivo

As rodadas de agosto foram para [docs/historico-agosto.md](historico-agosto.md)
em 04/09, inteiras e sem resumo. Este documento é lido em toda sessão pelo `@`
do `CLAUDE.md`, e a 250 KB ele tinha parado de funcionar como memória: numa
mesma sessão eu propus construir uma coisa que já existia e estava descrita
aqui dentro.

O que ficou: **setembro** e as seções **perenes**. Elas são a lição destilada;
o arquivo guarda como cada uma foi aprendida.

**Um fato de agosto que precisa ficar aqui, porque é estado atual e não
história:** o produto **não tem WhatsApp**. A ponte saiu em 28/08 (`c52a718`)
porque a Evolution dava problema e a API oficial da Meta não foi aprovada. Hoje
`FASE_DO_WHATSAPP = 'migrando'` em `lib/integrations/whatsapp-estado.ts`, e o
que sobrou é o link `wa.me`. O porquê inteiro está no arquivo.

---
## A lista virou fila de trabalho, e o clique que nao disparava nao dava erro (08/09)

Pedido do dono: *"crie mais uma pagina de prospeccao de leads, apareca todas que
o Exa achou, filtra apenas os melhores, quando envia opcao de confirma e mover
pra confirmados"* — com a regra que governa tudo: *"deixe o jeito extremamente
mais rapido possivel de mandar, se nao precisa sair do sistema melhor ainda"*.

### O gargalo tinha mudado de lugar

510 mensagens prontas e **zero conversas**. Nao faltava lead; faltavam cinco
passos por empresa: trocar de empresa no seletor, Contatos, abrir o contato,
rolar a timeline, achar o link. Ninguem repete isso quinhentas vezes.

### O dado estava partido em tres, e nenhuma fonte era completa

    790  dominios no CSV do universo (docs/mercado/universo-*.csv, versionados)
    432  leads cujo dominio ESTA no CSV
     92  leads cujo dominio NAO esta em CSV nenhum   <- rodadas antes do --universo

Os 92 vieram de 06/09, antes de `--universo` existir. Ler so o CSV os perderia;
ler so o banco perderia 358. **O total distinto e 882, e ele so existe depois do
merge** — conferido na tela.

E a dedupe importa: o CSV tem **959 linhas para 790 dominios**. Noventa empresas
aparecem em dois nichos e 79 se repetem dentro de marcenaria, porque
`--universo` grava por praca e por variante sem deduplicar antes de escrever.
Mantem o MAIOR pontos, nunca a soma — somar transformaria repeticao em
evidencia, o erro que o corpus de vocabulario ja pagou em 07/09.

### Nenhuma migration, e isso e decisao

O primeiro instinto e criar tabela `prospect`. `lib/dono/silenciados.ts` ja
respondeu isso por escrito: *"criar tabela e migration para guardar 'nao quero
ver isso' acopla uma decisao pessoal ao schema que os clientes usam"*.

O dado de ORIGEM ja e duravel (CSV no Git, leads no banco). O que
`.dono-prospeccao.json` guarda e progresso de UMA maquina — e a prospecao deste
projeto ja guarda estado em arquivo em dois outros lugares (`nao-perturbe.txt` e
`.rodadas.json`).

### O defeito que custou a rodada: clique que nao dispara e nao reclama

`<Button render={<a href/>}>` com `onClick`. A aba abria, o link estava certo, e
a linha **nunca saia da fila**. Zero erro no console, zero exception, nada no
log do servidor.

Duas causas empilhadas, e a segunda so apareceu depois de corrigir a primeira:

    onClick no <a> de dentro     descartado no merge do Base UI
    nativeButton ausente         ele assume <button> nativo e nao liga o handler

O que provou onde estava: chamando `props.onClick` a mao pelo DOM, a acao
rodava. **O handler existia; o clique e que nao chegava nele.** A saida foi
ancora crua com `buttonVariants`, que `central-de-suporte.tsx` ja usava.

### E um defeito do meu TESTE que valia mais que o do codigo

Depois de corrigido, o teste continuava reprovando. `waitForSelector` volta com
o HTML do **servidor** — clicar ali dispara a navegacao nativa da ancora sem
passar por handler nenhum. A prova agora espera `__reactProps` aparecer no
elemento, que e esperar a HIDRATACAO e nao a marcacao.

**Duas medicoes falsas de causas diferentes produziram exatamente o mesmo
sintoma**, e a segunda so ficou visivel depois de a primeira sair.

### Dois dev servers na mesma pasta `.next`

No meio da investigacao, `npm run dev` avisou *"Port 3000 is in use, trying
3001"* e eu segui testando na 3000, que era outra instancia. O CLAUDE.md ja
documenta que duas coisas escrevendo em `.next` corrompem o mapa de chunks — foi
de la que veio um `SyntaxError` sem origem no codigo. Resolvido matando as duas,
apagando `.next` e subindo uma so.

### Provado no navegador, com controle em cada passo

    gate           Host nao-local -> 404 (nao 403)
    contagem       882 na tela = 790 do CSV + 92 so no banco
    nao perturbe   dominio no arquivo SOME da tela, e o contador aparece
    link           o `?text=` decodificado e IDENTICO ao da tela, 541 de 560,
                   e a linha de descarte e a ULTIMA
    um clique      abre aba, grava "enviado" com data, a linha sai de Novos
    desfazer       apaga a marca
    confirmar      cria o contato em "Prospeccao" com a nota na timeline,
                   e confirmar de novo NAO duplica
    teclado        J desce o foco, E envia sem tocar no mouse
    controle       digitar "exe" na busca nao dispara E nem X

A idempotencia de `confirmarEnvio` deixou de ser luxo no meio do caminho: o
`reactStrictMode` do Next 14 e ligado por padrao e **invoca a acao duas vezes em
desenvolvimento** — visto no toast duplicado. Sem a guarda, cada confirmacao
criaria dois contatos.

O contato de teste foi apagado num `finally`, e o `23505` que apareceu antes
disso era a dedupe por telefone da 0025 funcionando — dois sites do mesmo dono
compartilham numero.

1.232 testes.

**O teto honesto:** isto nao faz ninguem comprar. Tira o atrito de cinco passos
por empresa e transforma a lista num turno de trabalho. O numero que decide e
quantas conversas acontecem, e essa parte continua sendo do dono.

---

## O motor multiplica por duas dimensoes, e a copy escondia a saida (07/09, noite)

Pedido do dono: *"a quantidade de empresas espionadas esta sendo muito poucas,
precisamos de muitas informacoes pra alimentar"*, mais uma auditoria de
copywriter do que converte.

### Duas alavancas, e as duas multiplicam

    PRACAS      25 metropoles ordenadas por densidade de PME. `--pracas=N`
    variantes   3 consultas por nicho. "dedetizadora", "controle de pragas" e
                "sanitizacao" sao a MESMA empresa com tres nomes, e o Exa
                ancora na formulacao

Medido, mesmo nicho: **5 pracas com 1 consulta davam 90 unicos; 5 pracas com 3
consultas dao 387.**

### Tres limites que a escala teria exposto

**O teto era um balde so.** Search, findSimilar e contents contavam juntos:
numa rodada de 5 pracas as sementes consumiam quase os 40, e o `contents` — que
e o que transforma URL em prospect com contato — nunca rodava. A rodada gastava
o orcamento inteiro para produzir uma lista de links. Agora e um teto por FASE.

**O findSimilar era fixo em 2 por vertical**, independente das pracas. Com 25
pracas cobria 8% do que foi semeado, e e justamente ele que acha quem nao
escreve para buscador.

**A dedupe era 1-a-1**: uma requisicao ao Supabase por prospect. Trocada por
leitura paginada da coluna, comparada em memoria — o mesmo padrao que a
importacao de planilha adotou depois de medir que `.in()` quebra (500 valores
devolvem 400, 2.000 devolvem 414).

### Universo != fila, e a rodada sobrevive ao credito acabar

`--universo` grava todo dominio qualificado em CSV; `--topo=N` limita quantos
viram lead. Descobrir cinco mil e barato; gravar cinco mil que ninguem liga
transforma a fila em ruido.

401 e 402 sinalizam em vez de estourar: a rodada PARA com relatorio e grava o
que ja tinha. Perder a colheita porque o credito acabou no meio seria pagar duas
vezes pelo mesmo trabalho.

### O corpus acumula, e o primeiro acumulado achou um defeito MEU

`aprendizado-<data>.md` era sobrescrito: seis nichos no mesmo dia deixavam so o
ultimo. Agora e um mapa termo -> nicho -> sites, com o MAIOR por nicho e nunca a
soma — somar transformaria repeticao em evidencia.

Isso destrava a pergunta que uma rodada sozinha nao responde: **em quantos
NICHOS o termo aparece.** Em 1, e jargao do setor e vira copy do anuncio dele;
em 4+, e como a PME brasileira fala e vira copy da landing.

**E o defeito:** `rio de janeiro` era o termo que mais atravessava nichos. Claro
que era — a consulta tinha sido "... em Rio de Janeiro". A consulta circular
voltando por uma porta nova, porque a cidade e colada no `semear`, fora do texto
da consulta. As pracas passaram a entrar na desqualificacao, com controle.

### A copy: o argumento existia e estava ESCONDIDO

Eu ia registrar que o nao-aprisionamento nao aparecia em lugar nenhum. **Falso**
— ele esta em tres lugares da landing desde agosto. O problema era outro:

    "importar"    6 superficies, cada uma com frase propria
    "exportar"    1 lugar, item de lista sem frase nenhuma
    "fidelidade"  1 lugar no site inteiro: os Termos, a dois cliques

A assimetria dizia o contrario do que o produto faz: porta de entrada anunciada
seis vezes e porta de saida escondida e o desenho de quem quer prender.

E o raciocinio certo estava em COMENTARIO desde que o cartao de preco nasceu —
*"'Traga e leve seus contatos' responde a objecao de ficar preso antes de ela
ser feita"* — e a tela nunca disse.

Quatro cortes: tres linhas abaixo do formulario de `/cadastro` (das 7 chaves de
eco, so duas falavam de cancelamento; o padrao, nenhuma); a saida na DOBRA do
hero; `"Traga e leve seus contatos, em CSV"` no cartao Free; e a pergunta de
cancelamento nos DOIS `FAQPage` JSON-LD, que e o que um assistente de IA cita.

**Nada que o produto nao cumpra.** O Free existe, o cancelamento pela tela
existe, a exportacao saiu em 03/09.

### A pagina de comparacao, uma e nao sete

`/alternativa-ao-crm-que-cobra-por-usuario`, com o preco publico de seis
concorrentes e a DATA em que foi lido — preco de concorrente e o dado que
envelhece mais rapido do site. Tem secao de "quando trocar NAO compensa", no
molde honesto das outras duas paginas. Sete paginas finas competiriam entre si e
nenhuma ranquearia.

### Provado

    empresa separada   "Prospeccao" criada com Pro vigente. Controle negativo:
                       empresa Free e RECUSADA antes de gravar, com a mensagem
                       da trigger da 0026
    /cadastro          4 larguras, banner de consentimento ABERTO (533..659 em
                       390px), botao alcancado por `elementFromPoint` nas
                       quatro. Esta pagina ja teve esse defeito TRES vezes
    conferidor         documentos batem

1.209 testes.

---
## 257 leads reais no CRM, e o nicho foi escolhido por medicao (07/09)

Pedido do dono: *"encher o meu velo funil ao maximo de pagantes que a
tecnologia as integracoes com exa conseguir"*, com a ressalva *"sempre com
cautela, apenas nao tomar bloqueio"*.

    257 leads em "Orne"   245 com telefone | 244 com a mensagem na timeline
    cinco nichos          dedetizacao, comunicacao-visual, marcenaria,
                          locacao-equipamentos, eventos-corporativos
    custo do Exa          ~US$ 5 no total das rodadas de 06 e 07/09

### O nicho saiu de 27 medidos, e a regra derrubou o que eu tinha decidido

A regra foi escrita ANTES de olhar o resultado, e sai do que o produto faz:
`ORCAMENTO >= 2`, `FORTE >= 4`, `CONTATO >= 6`. Pedir orcamento cria negocio com
valor, prazo e decisao pendente — que e literalmente uma linha do Kanban.

**`agencia` e `imobiliaria` reprovaram**, e eu tinha decidido manter as duas uma
rodada antes. Agencia deu 3 FORTE e ZERO orcamento: ela vende por reuniao e
proposta por e-mail, nao por formulario.

**E `clinica` saiu por um defeito MEU.** Ela liderava a regua antiga, e liderava
pelo motivo errado: todo site de clinica diz "agende sua avaliacao", e eu lia
isso como "sente a dor de perder lead". Agendamento e a dor de uma AGENDA — que
este produto nao tem e que Simples Dental resolve por R$ 100-200/mes. Zero
pedidos de orcamento em dez sites. A regua lia "precisa de um concorrente meu"
como "precisa de mim".

A tabela inteira em [docs/mercado/nichos-medidos-2026-09-06.md](mercado/nichos-medidos-2026-09-06.md).

### Tres defeitos que so a PRIMEIRA GRAVACAO mostrou

Nenhum aparecia em ensaio. Todos existem so no caminho que escreve.

**Gravava na empresa errada, e ela nem podia receber.** `created_at.asc&limit=1`
apontava para "Agencia Nova Era": Free, `created_by` NULO. A trigger da 0026
recusa acima de 50 leads e **vale para o `service_role` tambem** — a rodada
morreria no meio com 42501, deixando parte gravada. `service_role` ignora RLS e
nao ignora trigger, e esse e o desenho certo.

**Tres tomaram 23514** (`leads_contato_minimo`): pontuados por dominio e
Instagram, sem nenhum jeito de falar com eles.

**Lixo que so aparece depois de gravado: 6 em 243.** Entraram `br.pinterest.com`,
`misterwhat.com.br` e QUATRO sindicatos. Corte por sufixo (`.org.br`, `.gov.br`)
e nao por lista — sindicato novo nasce toda semana. Os 6 foram apagados.

### O que fecha o ciclo, e sem ele a mensagem seria mentira

`scripts/inteligencia/nao-perturbe.txt` e lido a cada rodada. A promessa sai na
PRIMEIRA mensagem — *"me avisa que nao te procuro de novo"* — e a segunda
abordagem depois de um "nao" e o que vira denuncia de spam.

**O modulo NAO envia nada**, de proposito: devolve texto e um link `wa.me`.
Enviador automatico e o que bane numero, e o numero aqui e o do dono.

**E nunca disparar e-mail frio de `velofunil.com.br`.** Esse dominio manda
recuperacao de senha e convite pelo Resend: campanha fria com reclamacao alta
joga o dominio em filtro de spam, e a partir dai o cliente que esqueceu a senha
nao entra mais no produto. O estrago nao aparece como bloqueio — aparece como
suporte, semanas depois. Regras inteiras em
[docs/mercado/limites-e-bloqueios.md](mercado/limites-e-bloqueios.md).

### O caminho de PRODUTO tambem fechou

A fila da 0072 existia desde 06/09 e ficaria vazia para sempre: nada tinha como
por um lead dentro dela pela tela. `lib/inteligencia-de-mercado/actions.ts`
marca `pendente` e RETORNA — nao chama o Exa, porque chamada externa dentro do
clique transforma indisponibilidade de terceiro em erro na cara do cliente.
Gate por `pro_vigente()`, 20/hora por usuario, sem lote.

A 0073 pos `sinal_de_mercado` no sino, com gravidade `media`: `alta` pinta o
ponto vermelho e so pode querer dizer "vai custar dinheiro". E o Exa entrou na
Politica de Privacidade JUNTO da acao que torna o caminho alcancavel — declarar
depois de comecar a tratar e o erro que a Meta ja custou aqui.

### O que foi construido, medido e RECUSADO — nao reconstruir

    decisor por LinkedIn   0 de 6. A trava nao e culpada: o dado nao existe.
                           Dono de PME nao mantem perfil com a empresa no
                           titulo. `--decisores` fica em 0
    espiao de dor          31 chamadas. NAO produz lead contatavel em pt-BR: a
                           SERP de "CRM preco" e conteudo de concorrente. Vale
                           como copy — a objecao real e "e se eu quiser sair?",
                           nao preco
    includeText do Exa     aceito pela API e nao muda nada (25 vs 25)
    subpages do Exa        pedi "contato", veio /lentes-de-contato-dental

**E "preco fixo, sem cobrar por usuario" JA ESTA TOMADO** por sete brasileiros
(nexxou, dunahub, akiocrm, atennde, nttecnologia, unicocrm, crmsimples). O que
sobra e um NUMERO: R$ 49 pela empresa toda contra R$ 97 do mais proximo. Com a
ressalva que impede decisao errada: pagina publicada nao e empresa com cliente.

1.201 testes.

---
## O instrumento do erro nunca reportou, e o motivo era a linha que o fazia "funcionar" (06/09)

Dois prints de producao: `/kanban` trocado por *"Nao foi possivel carregar esta
tela"*, com o toast **"Negocio movido para Negociacao - Sem proximo passo
marcado"** ainda por cima. O `error_logs` mostra que nao e a primeira vez:

    05/09 23:42  React #185                                       stack VAZIO
    02/09 04:15  React #185                                       stack VAZIO
    02/09 04:12  React #185                                       stack VAZIO
    27/08 20:45  "Cannot read properties of undefined (reading 'call')"  x4

React #185 e *Maximum update depth exceeded*, laco de `setState`.

### `componentDidCatch` roda no COMMIT, e o relance no render impede o commit

`CapturaDeComponente` e a unica classe do projeto e existe para uma coisa:
`info.componentStack` so existe la. Ela se anulava sozinha:

    render() { if (this.state.erro) throw this.state.erro; ... }

O React agenda `componentDidCatch` como **callback da update de erro**, e
callback de update e chamado no commit. Relancar no render descarta a fila
junto com a subarvore: o callback nunca acontece, o erro sobe para o `error.tsx`
do segmento e ele reporta **sem** arvore.

**A prova estava na CONTAGEM, nao no conteudo.** Se os dois caminhos
reportassem, cada incidente gravaria DUAS linhas — uma com arvore, uma sem.
Havia UMA, sem. Inclusive depois de 02/09, quando o boundary foi movido para
dentro da pagina: mudar de lugar nunca podia resolver, porque o defeito era o
relance.

Agora sao duas fases: renderiza `null` (commita, `componentDidCatch` roda,
arvore capturada), marca `reportado` e so entao relanca. A tela que a pessoa ve
continua sendo a do `error.tsx`.

**Provado no navegador, nos dois sentidos.** Componente descartavel lancando sob
o boundary, lendo o corpo do POST para `/api/log-erro`:

    duas fases   componentStack PREENCHIDO, "at QuebraDeProva" no topo
    uma fase     a chave componentStack nem existe no corpo   <- controle
    contagem     UM POST nos dois, nunca dois

### E o controle achou um segundo defeito: 400 descarta a linha inteira

Com a arvore preenchida, a rota respondeu **400**. `payloadSchema` valida
`componentStack` em 8000 caracteres e **recusa**, nao corta — e uma arvore real
do App Router passa disso com folga. O relato mais valioso era justamente o que
sempre seria recusado.

`cortarParaCaber` corta no CLIENTE, **preservando o comeco**: tanto no stack
quanto na arvore, o quadro que nomeia quem quebrou vem PRIMEIRO; o que se perde
sao os wrappers do framework, iguais em todo erro. Depois disso o mesmo teste
devolve 204 — recusado so pela regra de ruido de `localhost`, que e correta.

### O laco: NAO foi reproduzido, e isso fica registrado assim

`onDragOver` escrevia estado que realimentava a propria deteccao de colisao —
o padrao `rectIntersection` decide pelo RETANGULO do card, que muda quando o
card entra na outra coluna. E a guarda tinha dois furos independentes: lia
`deals`, que dentro do lote do React ainda e o valor anterior, e so barrava o
alvo IGUAL ao atual, nunca a alternancia `A -> B -> A`.

Trocado por `pointerWithin` com `closestCorners` de reserva (o ponteiro nao se
move quando a lista se reorganiza, entao o ciclo se abre; a reserva existe
porque arrasto por TECLADO nao tem ponteiro) mais guarda por `ref`, que e
sincrona. Os dois furos tem teste.

**Medido, o codigo novo e o antigo dao o MESMO numero:** 60 alternancias entre
duas colunas em 2s, 3.275 mutacoes de DOM nos dois, zero React #185. **Nao
reproduzi o laco**, entao a correcao e endurecimento de uma familia conhecida,
nao causa provada. O que muda de verdade e o instrumento: a proxima ocorrencia
NOMEIA o componente.

### O que foi reproduzido e corrigido: Escape deixava o card na coluna errada

`onDragCancel` nao existia. A/B com a mesma pagina e o mesmo gesto:

    HEAD      arrastado ate B -> Escape -> o card FICA em B, e nada foi gravado
    corrigido arrastado ate B -> Escape -> o card VOLTA para a origem

Soltar fora de qualquer coluna tinha o mesmo buraco, e agora desfaz junto.

1.085 testes.

**A outra familia era o erro de 27/08** — `__webpack_require__` recebendo
fabrica indefinida, aba com os chunks da versao antiga depois de uma promocao.
Nenhuma correcao daquela rodada o alcancava. **Fechada em 06/09, ver a secao
propria abaixo.**

---
## O OAuth do Google Ads esta pronto, e sobra UM bloqueio (06/09)

A cadeia inteira foi montada e provada. O que impede a API de responder agora e
so o nivel do developer token — que e analise do Google.

    listAccessibleCustomers   HTTP 200
                              customers/7841883291  <- a conta da campanha
                              customers/3129591084

### O caminho, e por que cada peca existiu

`jonatqpedro` ve a conta de anuncio e a MCC, mas o Google respondeu *"Tente de
novo em 6 dias"* ao consentimento — atraso de seguranca da conta. `henriquestn24`
e dono do projeto no Cloud, mas nao via a conta de anuncio. **Cada um tinha
metade.**

Resolvido dando ao `henriquestn24` acesso **Padrao** (nao Adm.) a conta
`784-188-3291`: Padrao ja cobre relatorio e importacao de conversao offline, que
e tudo que a API vai fazer; Adm. acrescentaria poder sobre usuarios e
faturamento, que nao e preciso. Menor privilegio que resolve.

### Tres armadilhas de transporte, e nenhuma era o que parecia

    1a tentativa   "entrei no site"        o `npm run dev` tomou a porta 3000 e a
                                           propria rota do produto engoliu o code
    2a tentativa   redirect_uri_mismatch   URI novo (8787) ainda nao propagado
    3a tentativa   response_type ausente   a URL de sete parametros chegou
                                           TRUNCADA na colagem
    4a tentativa   Google 500              janela ANONIMA: sem sessao, ele exigiu
                                           login e a propria tela dele quebrou

A correcao que fechou as duas ultimas foi um atalho `localhost:3000/ir` no
capturador, que responde 302 para a URL completa — **nada para copiar, nada para
truncar**.

**E uma verificacao minha nao provou nada, denunciada pelo proprio controle:**
testei os `redirect_uri` chamando o endpoint de autorizacao e os tres devolveram
302, inclusive um endereco NUNCA registrado. O Google so valida o `redirect_uri`
depois de autenticar. Sem o controle, eu teria lido os 302 como "esta tudo certo,
e so propagacao" e mandado esperar horas a toa.

### O que a API responde hoje, e o que isso prova

    login-customer-id = MCC 5346290307   403  USER_PERMISSION_DENIED
    login-customer-id = a propria conta  403  DEVELOPER_TOKEN_NOT_APPROVED
    sem login-customer-id                403  DEVELOPER_TOKEN_NOT_APPROVED

A diferenca entre a primeira linha e as outras duas e a prova de que a cadeia de
permissao esta sa: sem o cabecalho da MCC a chamada **passa** pela checagem de
permissao e so entao esbarra no nivel do token.

**Consequencia pratica para quando o token for aprovado:** o
`GOOGLE_ADS_LOGIN_CUSTOMER_ID=5346290307` do `.env.local` **nao deve ser
enviado** com este refresh token — o `henriquestn24` tem acesso a conta, nao a
MCC. Ou se omite o cabecalho, ou se da a ele acesso a MCC tambem.

**A versao da API e a v22.** As anteriores (v16 a v21) devolvem 404 — foram
aposentadas.

---
## O Pix resolveu o cartao, e a campanha continua parada por outro motivo (06/09)

Tres coisas medidas no painel, com o navegador dirigido. Nenhuma delas era o
que estava registrado.

### 1. Pix funciona, e o cartao deixou de ser bloqueio

    Voce tem credito              R$ 50,00
    Ultimo pagamento              5 de set.  R$ 50,00  Pagamento manual  Pix
    Proximo pagamento automatico  Sem pagamentos futuros
    Custo liquido (setembro)      R$ 0,00

A documentacao oficial explica por que deu certo sem trocar nada na conta: Pix
existe so como **pagamento manual**, e a conta esta em automatico — mas *"voce
pode aplicar pagamentos manuais mesmo que tenha definido a configuracao de
pagamentos automaticos"*. Migrar de automatico para manual e que o Brasil nao
permite; **adicionar fundos**, sim.

### 2. E mesmo com credito, a campanha nao pode veicular

    campanha g_preco   R$ 25,00/dia   Qualificada
    anuncio            "Quanto custa um CRM? | R$ 49 pela empresa toda"  Qualificada
    palavras-chave     UMA

E a unica que existe e:

    "crm barato para pequena empresa"   Corresp. de frase
    Nao qualificada — Baixo volume de pesquisas

**Campanha qualificada + anuncio qualificado + zero palavra-chave qualificada =
zero impressao.** Conferido que nao e filtro escondendo: zero chips na tela e
uma linha so no DOM. O `docs/google-ads.md` registra SEIS termos; cinco nao
existem na conta. Ha um "Rascunho em andamento: 1" na tela de campanhas, e a
hipotese e que as seis foram configuradas num rascunho nunca aplicado.

**Esse e o unico bloqueio que custa dinheiro hoje**, e nao depende de API nem
de aprovacao de ninguem.

### 3. O gargalo da API e o NIVEL do token, nao o OAuth

    Seu token de desenvolvedor esta atualmente ativado para Acesso a conta de teste.
    Nivel de acesso: Conta de teste

Token de conta de teste **nao le conta de producao**. Nem com OAuth perfeito,
nem com a MCC vinculada. Pedido de Acesso Basico enviado em 06/09 pelo
formulario oficial (`support.google.com/adspolicy/contact/new_token_application`),
com recibo por e-mail e prazo declarado de **cinco dias uteis**.

**Uma armadilha de leitura que fica registrada:** a Central de API continua
mostrando "Conta de teste" e o botao "Solicitar acesso basico" MESMO com pedido
em analise — ela reflete o nivel concedido, nao o pedido. Concluir "nunca foi
enviado" a partir do botao e erro, e eu cometi esse erro antes de enviar.

### Dois bloqueios do OAuth, os dois medidos

**O projeto do Cloud nao e da conta do Ads.** O `GOOGLE_OAUTH_CLIENT_ID` comeca
com `472861929986`, e logado como `jonatqpedro` o Console responde:

    Voce precisa de acesso adicional a projeto: 472861929986
    resourcemanager.projects.get (ausente)

O projeto e do `henriquestn24`. O mesmo vale para `gen-lang-client-0317261117`.
Fica em aberto se a Google Ads API esta sequer habilitada nele — nao da para
conferir sem o login do dono do projeto.

**E o atraso de seguranca esta ativo**, palavra por palavra do Google ao tentar
o consentimento:

    Tente de novo em 6 dias
    ...ha um atraso de seguranca antes que voce possa usar novas chaves de acesso.

Dizia 6 dias em 05/09 e diz 6 dias em 06/09. Ou o contador e grosseiro, ou
reinicia — nao tratar 11/09 como data firme.

**O caminho que pula o atraso**, se houver pressa: dar acesso de administrador
da conta `784-188-3291` ao `henriquestn24`, que ja e dono do projeto do Cloud, e
fazer o consentimento por ele. Nao foi feito — conceder acesso administrativo e
poder de gastar em nome do dono.

---
## O webhook do Asaas parou de novo, o vigia avisou, e ninguem leu (06/09)

Varredura pedida pelo dono — *"verifique a fundo se tem algo que voce consegue
resolver"*. O achado mais caro nao estava em codigo.

    webhook   Velo Funil - assinaturas
    enabled   true
    interrupted  TRUE        <- dinheiro que ENTRA nao chega ao produto
    penalizedRequestsCount  3
    sendType  SEQUENTIALLY   <- um evento travado bloqueia TODOS os seguintes

**E o vigia de 04/09 funcionou.** A memoria em `vigia_ultimo_aviso` prova:

    webhook-do-asaas-parado-velo-funil-assinaturas   1   06/09 03:00Z
    __ultima_varredura                                   06/09 06:00Z

Ele detectou, mandou o e-mail as 00h locais e continuou varrendo de hora em
hora. O que falhou foi o degrau seguinte, que e humano: ninguem abriu.

**Religado por API** (`PUT /webhooks/{id}`, `interrupted: false`), confirmado
lendo de volta. E o endpoint estava SAO o tempo todo, medido contra producao:

    sem token                      401
    token certo, evento nao mapeado  200

Ou seja, nao foi rota quebrada — foi falha transitoria, provavelmente durante
uma das promocoes de hoje, exatamente a classe que a secao de 04/09 ja descreve:
*"a raiz nao e o gatilho, e a permanencia"*.

**Nenhum dinheiro se perdeu:** a conta tem UMA cobranca na historia inteira
(R$ 1, RECEIVED em 31/08) e zero pendente ou vencida.

### Duas pendencias do dono eram falsas, e as duas foram fechadas

    "1 assinatura ativa no Asaas sem Pro liberado"   subscriptions = 0
    "2 cobrancas de R$ 49 em aberto (Fani Mayara)"   PENDING = 0, OVERDUE = 0

Pendencia falsa desvia atencao das reais, e esta e a terceira vez que isso
acontece neste documento — depois do `CRON_SECRET` em 25/08 e do "conjunto
otimiza por clique" em 04/09.

### O que fica em aberto, e nao e ruido

O banco tem **8 workspaces em `plan = 'pro'`** e **3 linhas `subscriptions`
com `status = 'active'`**, todas com `asaas_subscription_id` **nulo** — nenhuma
nasceu de pagamento. Uma delas vale ate **2027-02-16** com `ciclo MONTHLY`, o
que so pode ter vindo de concessao manual. Sao contas do dono, entao nao ha
dinheiro envolvido; fica anotado porque qualquer contagem de receita futura vai
tropecar nelas.

---
## A aba velha se recupera sozinha, e duas coisas que este documento afirmava eram falsas (06/09)

Continuacao da rodada acima, feita sem depender do dono. O erro de 27/08 no
`/kanban` — quatro ocorrencias de `Cannot read properties of undefined (reading
'call')` — e `__webpack_require__` recebendo `undefined` no lugar da fabrica do
modulo: a aba tem o mapa de chunks da versao anterior e pede um arquivo que a
promocao apagou. **Nada esta errado no codigo, e recarregar resolve** — mas quem
ve a tela de erro conclui que o produto quebrou.

### Duas afirmacoes deste documento nao eram mais verdade

**1. `skewProtectionBoundaryAt` nao definido, logo sem protecao.** Falso. Medido
na API da Vercel e no HTML servido:

    skewProtectionMaxAge   43200   (12 horas)
    HTML de producao       ?dpl=dpl_CSCss4fY36Bw6Ziii2TkBn7dcqZb

A protecao ESTA ligada, e o Next 14 pendura `?dpl=` nos assets, o que faz a
Vercel servir o chunk da versao certa. `skewProtectionBoundaryAt` e outro campo
— e o corte manual, nao o interruptor.

**O buraco que sobra e a JANELA.** Doze horas cobrem quem recarrega no mesmo
dia; aba deixada aberta na sexta e retomada na segunda esta fora. Um CRM e
exatamente o tipo de produto que se deixa aberto.

**2. `POST /promote` devolve 422, e por isso a promocao e manual.** Continua
verdade — e o caminho de como eu me enganei fica registrado, porque a armadilha
e boa.

Primeiro teste: promover o deployment que JA estava em producao. Devolveu
**409**, *"already the current production deployment"*. Li isso como a API
aceitando a chamada, e escrevi que a promocao tinha deixado de exigir o clique.
**Errado.** O 409 so provou que o endpoint valida o id; nao provou que ele
promoveria qualquer coisa.

O teste que valia foi o A/B com o MESMO commit, mudando so o alvo:

    alvo=production, READY   ->  201   promoveu
    alvo=staging,    READY   ->  422   recusou

**O gate cria os deployments com alvo `staging`** (e por isso que produzem
`aliasAssigned` proprio sem tocar em producao), e e exatamente essa classe que a
API recusa. O clique no painel continua sendo o unico caminho para promover o
que o gate testou.

**A licao e a mesma de sempre aqui:** um resultado que confirma o que eu queria
concluir, obtido num caso que nao e o caso de interesse. O 409 veio de um
deployment de producao; a pergunta era sobre um de staging.

### O que foi construido

`ehErroDeChunk` reconhece a familia por seis assinaturas, incluindo a variante
do Safari (`undefined is not an object (evaluating 'n.call')`). A terceira e
ampla o bastante para casar com um `TypeError` de verdade — por isso a
recuperacao **nunca** depende so dela.

`deveRecarregar` limita a UMA recarga por janela de 10 minutos, com a marca em
`sessionStorage`. **A trava e a peca que impede a pior falha possivel:** erro
que sobrevive ao reload viraria recarregar-quebrar-recarregar, e a pessoa nao
conseguiria nem ler a mensagem nem sair da tela. Com a trava, o pior caso e
"recarregou uma vez a toa".

`sessionStorage` e nao `localStorage`, de proposito: a marca precisa morrer com
a aba, senao a proxima sessao comeca com a trava armada e engole justamente a
recarga que resolveria.

Chamada nos TRES boundaries, sempre DEPOIS de `reportarErro` — o relato
sobrevive a navegacao pelo `keepalive`, mas so se ja tiver saido.

### Provado no navegador, com controle

    chunk, 1a vez        navegacoes=4  marca GRAVADA   -> recarregou
    chunk, 2a vez        navegacoes=2  marca GRAVADA   -> a trava barrou
    React #185 (controle) navegacoes=2  marca NENHUMA  -> nao recarregou

O controle e o que separa "recupera de aba velha" de "recarrega em qualquer
erro". React #185 e laco de `setState`: recarregar nao resolve e apagaria o
rastro do defeito que a rodada de 06/09 existe para nomear.

1.096 testes.

---
## A conversao chegou pelo caminho RESERVA, e recusar nao apagava nada (05/09)

Duas coisas que so apareceram exercitando o caminho real, com a medicao ja no
ar e provada.

### A prova ponta a ponta, que faltava

Conta descartavel pre-confirmada pela API admin, login em producao, ate
`/bem-vindo`. A conversao disparou e chegou:

    POST www.google.com/pagead/1p-conversion/18431107276/
         en=conversion
         label=L3G3CPfg3O4cEMzB0dRE
         gclaw=TESTE_PROVA_123        <- o gclid da URL, colado na conversao
         302 -> www.google.com.br/... -> 200

**O `gclid` atribuido e a metade que faltava:** prova que clique e conversao se
ligam, e nao so que a tag dispara.

Segunda visita a `/bem-vindo`: `gtag` carregado e **zero requisicoes de
conversao**. A dedupe segura. Conta apagada num `finally`, confirmado 404.

**Um desvio a registrar:** login por e-mail de conta ja confirmada cai em
`/onboarding`, nao em `/bem-vindo`. Nao e defeito — o cadastro REAL passa por
`/confirmar` -> `/bem-vindo`, e quem volta depois ja converteu na primeira
passagem. Mas foi preciso navegar direto para exercitar o disparo.

### A conversao chegou pelo caminho RESERVA, e ninguem teria notado

O console contava outra historia que a prova sozinha nao contava:

    BLOQUEADO  www.googleadservices.com/pagead/conversion/...&en=conversion
               &label=L3G3CPfg...                             connect-src
    PASSOU     www.google.com/pagead/1p-conversion/...        302 -> 200

O `gtag` tenta o `googleadservices.com` PRIMEIRO e cai para o
`google.com/1p-conversion` quando falha. **A conversao chegou pelo segundo.**

Isso NAO e a mesma coisa que as duas violacoes do Meta Pixel, que foram medidas
e provadas inofensivas — la nenhum evento se perdia. Aqui o evento so sobreviveu
porque existe fallback, e depender de fallback de terceiro para a UNICA metrica
que a campanha produz e fragilidade: no dia em que o Google mudar a ordem, as
conversoes somem sem nada falhar.

O host entrou na CSP e no portao. **Dois ficaram de fora, de proposito:**
`googleads.g.doubleclick.net` em `script-src` (o `gtag` tentou carregar o ping
de configuracao como SCRIPT, `fmt=4`, foi recusado e refez como imagem,
`fmt=3` -> 200; abrir `script-src` para host de anuncio e permitir execucao de
codigo arbitrario vindo dele) e `ad.doubleclick.net` (coleta de remarketing,
que este projeto nao faz).

### Recusar o banner nao apagava o que ja estava gravado

Medido no mesmo navegador: trocar para "recusado" impede rastreamento NOVO — a
tag nao carrega, provado nos dois sentidos — e deixava vivos:

    _fbp   _gcl_au   _gcl_aw

`banner-consentimento.tsx` nao apagava cookie nenhum. **Nao era regressao da tag
do Google:** o `_fbp` se comportava assim desde que o banner nasceu, em 23/08.
Mesma familia do buraco de 02/09 — consentimento respeitado num lugar e ignorado
em outro.

O alcance e estreito e vale dizer: quem nunca aceitou nunca teve cookie, e o
cookie parado nao e enviado a lugar nenhum depois que o script para de carregar.
Mas e um identificador que a pessoa pediu para nao ter.

**O escopo foi o que fez a primeira tentativa falhar.** Apagar com `Path=/` e sem
`Domain` nao tocou nos `_gcl_*`: o `_fbp` nasce no host, o `_gcl_au` nasce no
dominio registravel para valer em qualquer subdominio. Quase registrei "nao da
para apagar" quando o que faltava era o escopo. `dominiosParaApagar` tenta do
host ate o dominio registravel, com e sem ponto — dominio que nao serve o
navegador recusa sozinho, entao gerar demais custa uma linha ignorada e
adivinhar de menos deixa o cookie vivo.

**Por prefixo, nao por lista fechada:** o Google acrescenta variantes de
`_gcl_*` conforme o produto, e lista escrita a mao envelheceria em silencio.
Tem teste travando que o cookie de sessao do Supabase e o proprio consentimento
NAO sao tocados — o controle que separa "apaguei o rastreamento" de "desloguei
a pessoa".

1.072 testes.

---
## Google Ads: a medicao inteira, e a CSP que a mataria em silencio (04/09)

Pedido do dono, depois de o Meta Pay seguir bloqueado: *"vamos de uma vez por
todas investir em google ads, tenho paciencia, tenho condicoes de pagar 25 todo
dia"*. Google Ads e outra plataforma, outra conta e outro sistema de cobranca —
**nao herda o bloqueio da Meta**.

`docs/google-ads.md` ja tinha estrutura, palavras e textos desde 03/09. Faltava
o codigo, e ele tinha uma armadilha que nenhum dos quatro portoes ve.

### `script-src` liberava so o Facebook, e a CSP e bloqueio desde 27/08

    next.config.mjs:57   script-src 'self' 'unsafe-inline' https://connect.facebook.net
    o script da tag      https://www.googletagmanager.com   <- fora da lista

O navegador **recusaria em silencio**: sem erro na tela, sem teste falhando. O
estrago seria campanha rodando, dinheiro saindo e **zero conversao no painel** —
erro de configuracao com aparencia de anuncio ruim, e a decisao seguinte seria
pausar a campanha que funciona.

Mesma classe do `robots.txt` do Cloudflare com 76 linhas contra 15 no codigo, da
logo do Storage bloqueada por esta mesma CSP e do pixel com quebra de linha na
Vercel. Por isso a conferencia entrou em `auditar-descoberta.mjs`, que le o
header **da resposta real**, e nao o codigo que o gera.

**O controle negativo rodou de graca:** contra producao, que ainda serve a CSP
antiga, o portao reprova nos quatro hosts e nomeia o efeito de cada um.

### O ponto de conversao e `/bem-vindo`, e e o unico que serve

Rastreado no codigo, nao suposto:

    cadastro por e-mail   actions.ts:137,155,215 -> /verifique-email
                          confirmar/page.tsx:82  -> /bem-vindo
    entrada pelo Google   callback/route.ts:55   -> /bem-vindo

Disparar em `/verifique-email` perderia **toda conta criada pelo Google**, que e
o caminho de menor atrito e o mais provavel em trafego pago.

E ele exige uma excecao na area logada — a **unica**. Faz sentido: a conversao
da Meta nasce no servidor (CAPI) e por isso o pixel fica fora da area logada
inteira; a do Google nasce no navegador. `PREFIXOS_PRIVADOS` e
`DOMINIO_DE_PRODUCAO` sairam do `meta-pixel.tsx` para
`lib/analytics/superficie-publica.ts`: duas copias da mesma lista divergem, e o
comentario original ja registra que `/hoje` e `/calendario` faltavam nela.

**Dispara uma vez por conta.** `app/(dashboard)/layout.tsx:74` devolve para
`/bem-vindo` toda vez que alguem volta com o onboarding pela metade; sem a
marca, a mesma pessoa contaria varias vezes e o custo por conversao apareceria
**menor do que e**.

**E a conversao e "conta criada", nao "virou Pro":** com 2 a 9 conversoes por
mes nenhum lance automatico funciona (o Smart Bidding pede 15 a 30). Ela nao
serve para o algoritmo lancar, serve para o relatorio dizer qual palavra trouxe
cadastro. Lance fica em CPC manual.

### O teste achou um defeito MEU, e o navegador achou outro

`google-ads-id.ts` copiava a limpeza de `pixel-id.ts`, que remove espaco em
qualquer posicao. La e inofensivo — o resultado ainda tem que ser so digitos.
Aqui o rotulo aceita letras, e `AbC dEf` virava `AbCdEf`: **um rotulo valido e
diferente do colado**, que faria a tag carregar, a chamada sair e o Google nao
achar a acao de conversao. Passou a recusar em vez de adivinhar.

E medindo no navegador apareceu o segundo: `/quanto-custa-um-crm` tem **DOIS**
botoes "Comecar gratis" — o do corpo e o da `PublicNavbar`. Eu tinha corrigido
so o primeiro, entao qual promessa a pessoa via em `/cadastro` dependia de qual
dos dois identicos ela clicasse. A regra virou `useDestinoComOrigem`, usada
pelos dois.

### O `gclid` entra hoje pelo que ele responde amanha

O relatorio do Google sabe quem clicou e quem se cadastrou. Quem **pagou**
acontece dias depois no Asaas. A ponte oficial e a importacao de conversao
offline, que exige exatamente o `gclid` daquele clique.

A importacao **nao** entra agora (OAuth, developer token, semanas). Mas ela e
impossivel sem historico, e historico nao se cria depois: cada dia sem a coluna
e um dia de cliques que nunca poderao ser reconciliados com o dinheiro.

E a 0069 ja tinha ensinado isso com outro nome, um dia antes.

### A politica foi junto, nao depois

Entrada **separada** da do "Google" que ja existia: login e execucao de
contrato, medicao depende de consentimento, e uma linha misturada diria ao
titular que ele nao pode recusar o que pode. A secao 3 nomeava so a Meta e
passou a nomear as duas, descrevendo o que cada uma recebe — a Meta leva dado de
contato com hash, o Google leva o id do clique e o fato da conta ter nascido.

O erro que isso evita e recente: o consentimento foi construido em 02/09 e a
politica so acompanhou em 03/09, um dia inteiro afirmando o contrario do codigo.

### Provado, e o que fica em aberto

    CSP        o portao reprova contra producao (4 hosts), e o config novo passa
    CTA        os DOIS botoes levam a origem; `token=segredo` descartado
    eco        /cadastro mostra "Comece gratis, sem cartao" com o g1_preco
    negativo   sem query, nenhum `?` pendurado nos links
    tag        NAO carrega em localhost (dominio errado, sem ID) — cerca ok
    0071       aplicada em producao, controle negativo toma 42703

1.066 testes. **A tag nunca carregou de verdade**, porque o `AW-` ainda nao
existe: depende da conta do dono. O caminho do navegador ate o Google e o unico
trecho nao exercitado, e so a primeira conversao real fecha isso.

**Um so grupo de anuncio, e um so eco.** R$ 25/dia repartido em tres da R$ 8
cada, sem nenhum juntar cliques suficientes para dizer coisa alguma. Eco para
grupo que nao existe seria codigo morto com aparencia de recurso — a razao que
ja recusou `whatsapp_caiu`.

**A conta honesta, sem otimismo:** R$ 750/mes da 60 a 180 cliques e 2 a 9
cadastros. Quantos viram pagantes e um numero que este produto nunca teve. O
minimo praticado pelo setor e 3 a 5 vezes maior — cauda longa, correspondencia
exata e pagina de conteudo casando com a busca sao a unica forma de o valor
caber, porque atacam o CPC em vez do volume. **A primeira coisa a olhar nao e
venda, e CPC real.**

---
## Seis anuncios, seis promessas, e uma porta que nao repetia nenhuma (04/09)

Auditoria de copy antes de subir, lendo o texto REAL dos criativos na API da
Meta. As pecas sao boas: especificas, na linguagem do cliente, uma mecanica
psicologica cada. **E as tres afirmacoes de fato tem fonte** — conferido:

    "42 horas"          HBR, 2.241 empresas   plano-de-conteudo-instagram.md
    "R$ 300 por mes"    mediana R$ 60/usuario  google-ads.md
    "gratis ate 50"     FREE_LEAD_LIMIT = 50   lib/plans.ts

O problema estava no DESTINO. Os seis apontam para `/cadastro`, que dizia uma
coisa so — "Criar conta / Comece a organizar seu funil de vendas hoje" — e mais
quatro campos, 926px de altura:

    "R$ 49 pela empresa inteira"   a pagina nao mencionava preco
    "traga sua planilha"           nao mencionava importacao
    "gratis ate 50, sem cartao"    nao mencionava gratis nem cartao
    "Veja o funil por dentro"      nao mostrava nada, pedia cadastro

`lib/marketing/eco-da-peca.ts` resolve com UMA porta: o titulo e a descricao
saem do `utm_content`, no SERVIDOR (`searchParams`, sem hook), entao a promessa
vem no primeiro byte. Seis landings seriam seis coisas para manter e fariam o
teste comparar pagina junto com argumento.

**Duas regras governam o texto.** Nada de prometer o que o Free nao entrega —
`a6_google` vende Agenda e Gmail, que sao Pro, e o eco DIZ isso. E todo eco
repete o removedor de atrito, porque a pessoa esta diante de quatro campos e ali
"gratis, sem cartao" vale mais que beneficio. Numeros vindos de `lib/plans.ts`.

`chaveDeUtm` saiu de `lib/dono/` para `lib/marketing/utm.ts`: duas superficies
leem `utm_content` agora, e uma e publica enquanto a Central devolve 404 em
producao.

### A landing foi auditada e NAO e o gargalo

11.241px no telefone, 8 secoes. O que ela ja faz certo, medido:

    h1        "A planilha organiza. Ela nao avisa quem esta esperando."
              (o prefixo de SEO e `sr-only`, invisivel — conferido)
    sub-hero  "Gratis ate 50 contatos, sem cartao" JA no topo
    barra     50 contatos / 2 min / R$ 49 / dados em Sao Paulo
    CTA fixo  "Comecar gratis" sempre disponivel
    FAQ       as 6 objecoes reais, inclusive "e gratis mesmo?"

**Zero prova social, e esta certo assim.** Nao ha cliente externo, entao nao ha
nada honesto a acrescentar. A barra de numeros e a secao de garantias sao o
substituto correto, e ja existem.

**O que fica em aberto:** a FAQ e a garantia moram a ~10.000px de onde a decisao
acontece. Quem chega de anuncio cai em `/cadastro`, que nao tem nenhuma das
duas. Levar duas ou tres perguntas para baixo do formulario e a proxima
melhoria de conversao, e nao foi feita.

---
## Duas investigacoes de raiz, e uma delas me desmentiu (04/09)

### O banner NAO cobre o botao Entrar. A suspeita era minha, e era falsa.

Levantei a hipotese porque o login por Playwright so passou depois de
responder o banner. Medido com `elementFromPoint`, o metodo do proprio projeto,
em quatro larguras e com a pagina **rolada ate o fim**:

    390x659   /login  botao 376..420  banner 533..659  ALCANCA
    390x659   /cadastro 413..457      banner 533..659  ALCANCA
    700x800   /login  botao 422..466  banner 650..800  ALCANCA
    700x800   /cadastro 520..564      banner 650..800  ALCANCA

**A primeira medicao deu falso positivo** e quase virou achado: eu rolava com
`scrollTo` e lia a posicao no mesmo `evaluate`, sem esperar aplicar. Media a
pagina NAO rolada. `scroll 0/150` estava no proprio resultado dizendo isso, e
eu quase nao olhei.

E o A/B fechou: mesma conta, mesmo tempo, mudando so responder ou nao o banner.

    banner ABERTO      botao alcanca | cookie de sessao true | -> /onboarding
    banner RESPONDIDO  botao alcanca | cookie de sessao true | -> /onboarding

**Identico.** A causa da falha original era primeira compilacao do `npm run
dev` — o `playwright.config.ts` documenta `timeout: 120_000` exatamente por
isso, e eu esperei 9 segundos.

O reparo de 02/09 (`--altura-do-banner` reservando espaco no `body`) esta
intacto nas quatro larguras.

### O webhook do Asaas: o endpoint estava sao o tempo todo

O que a medicao descartou, um a um:

    token           producao aceita o do .env.local -> 200, mesmo segredo
    rota            209ms sem correspondencia, 369ms ativando o Pro
    evento estranho 106 eventos assinados; a rota devolve 200 no que nao mapeia
    500             so em erro de banco (dedupe ou RPC)

**Nao determinei o gatilho exato das 4 penalizacoes.** A ultima entrega foi em
**30/08 as 23:18**, numa rajada de 5 cancelamentos em 24 segundos; depois,
cinco dias de silencio. O Vercel MCP esta desconectado e nao deu para datar o
deploy da janela. Fica registrado como nao sabido, em vez de suposto.

### E a raiz nao e o gatilho — e a permanencia

Falha transitoria e inevitavel: deploy, banco fora do ar, rede. O defeito e que
a fila **nao se recupera sozinha e nao avisa**. Uma vez interrompida, fica
assim ate alguem consultar a API — e de fora, fila parada e "ninguem pagou" sao
o mesmo silencio.

`sendType: SEQUENTIALLY` multiplica: um evento travado bloqueia todos os
seguintes. **Fica assim de proposito.** `NON_SEQUENTIALLY` traria problema pior
num sistema de cobranca — `canceled` aplicado depois de `active`, fora de
ordem. Ordem importa aqui; o que faltava era o alarme.

`webhooksInterrompidos()` entrou no vigia de hora em hora, como alerta de
**dinheiro**, acima de cobranca vencida: cobranca vencida e dinheiro que nao
entrou; webhook parado e dinheiro que ENTROU e o produto nao soube.

Provado nos dois sentidos contra o Asaas real: com a fila sa o vigia cala; eu
interrompo de proposito e ele detecta e nomeia qual parou; religado no
`finally`. 1.013 testes.

**A rede de seguranca sempre funcionou** — o cron diario aplicou os pagamentos
do mesmo jeito, e foi por ele que a prova do plano anual passou. O que estava
morto era o caminho rapido, e quem paga por Pix as 9h esperava o dia seguinte.

---
## 20 afirmacoes erradas em 6 documentos, e o conferidor passava limpo (04/09)

Auditoria a pedido do dono. O achado maior nao e a lista: e que
`conferir-documentos.mjs` **passava limpo sobre os arquivos que continham os
erros**. Ele confere se CAMINHO citado existe, e o cabecalho dele declara a
lacuna desde que nasceu — *"Nao pega afirmacao errada em prosa"* —, citando o
caso historico do PRD que afirmou 687 testes e 17 tabelas quando eram 774 e 18.

**A classe era conhecida, documentada, e aconteceu de novo.**

### O mais grave nao era numero

`CLAUDE.md:56` afirmava *"nao existe nada medindo ativacao"*. Existe desde
31/08, em DOIS arquivos. **E o proprio erro que fez `capacidades.md` nascer**,
repetido dentro do arquivo lido no comeco de toda sessao.

### O que era reescrita, e nao renumeracao

`CLAUDE.md:207` dizia *"Oito nos apontam para nome de PACOTE (`next`,
`jspdf`)"*. Hoje ha ZERO nos de pacote: sao 103 sem `source_file`, a maioria
objetos do banco. Trocar 8 por 103 mantendo a explicacao deixaria o texto
numericamente certo e semanticamente falso — pior do que estava.

### O carimbo, conferido nos DOIS sentidos

    <!-- contagem: grafo.nos>=4000 migrations.arquivos=69 -->

A metrica bate com o carimbo, **e** o valor aparece na prosa das 12 linhas
seguintes. Sem a segunda metade o carimbo e enfeite: alguem edita o numero na
FRASE, esquece o comentario, e o script aprova um comentario verdadeiro acima
de uma frase mentirosa.

**PISO onde o crescimento e rotineiro, EXATO onde a mudanca deve provocar
revisao.** O grafo se reconstroi a cada commit — esta rodada o moveu de 4.279
para 4.293 —, entao valor exato viraria ruido diario; o piso so falha quando o
grafo ENCOLHE, que e o acidente que importa. Migration continua exata de
proposito: quando uma entra, o PRD e o schema DEVEM ser reconsiderados.

### Os controles negativos acharam QUATRO defeitos MEUS

Escrevi cinco casos, rodei, e quatro reprovaram — no meu codigo:

    CARIMBO = /([^>]+?)/   nao podia conter `>`, e o operador `>=` TEM um.
                           NENHUM carimbo de piso era lido, sem aviso.
    chave [a-z_.]          `e2e.specs` tem digito -> "carimbo ilegivel"
    graphify-out/graph.json  citado nos docs e em pasta gitignorada
    e2e.specs carimbado 12 linhas longe da frase dele

O primeiro e da mesma familia que o mecanismo existe para curar: conferidor
passando limpo sobre o que nao conseguiu ler. Sem os cinco casos, os quatro
teriam ido para producao com o script imprimindo "documentos batem".

### E o `.yml` era defeito do conferidor, nao do documento

`docs/testes.md` afirmava por 16 dias que o workflow de CI **nao estava no
repositorio**, contradizendo o diagrama do proprio arquivo. Esta versionado
desde 19/08. O script nunca poderia te-lo achado: `.yml` estava fora das
extensoes conferidas, e `listarArquivos` pulava toda pasta comecada com ponto.

### O grafo: codigo em dia, documentos PENDENTES

`graphify-out/graph.json` esta atualizado para o lado de CODIGO — 4.293 nos,
reconstruido pelo hook de post-commit. E o que responde "quem chama X".

**A reindexacao SEMANTICA dos 10 documentos nao foi concluida:** os quatro
subagentes bateram no limite de sessao e nenhum escreveu seu bloco. Nada se
perdeu — o manifesto so e salvo no fim, entao os 10 continuam na fila do
proximo `/graphify . --update`.

O que sobreviveu da tentativa: `marketing/marca/` entrou no `.graphifyignore`.
Oito SVGs de logo exigiam extracao com visao a cada rodada para responder
exatamente nada sobre onde o preco e lido — mesma razao que ja excluia o
binario de marketing. Os geradores continuam dentro, porque sao codigo.

---
## O plano anual, e o `interval '30 days'` que o teria matado (04/09)

Pedido do dono: vender porta a porta em Salvador. A conta que motiva:

    1 visita               ~1h entre deslocamento, demo e retorno
    fechamento presencial  10% a 20%  ->  5 a 10 HORAS por cliente
    resultado a R$ 49      sete horas de trabalho por R$ 49

**R$ 490 a vista na mesma visita** e o que faz porta a porta fechar. E trava 12
meses de retencao, numero que este produto nunca teve.

### O ponto unico de falha, e ele nao estava em nenhum `.ts`

`0044:155-157`, dentro de `apply_asaas_subscription_status`:

    current_period_end = now() + interval '30 days'

Trinta dias literais, sem olhar o que foi pago. **E a UNICA fonte de validade
de acesso para pagamento real do sistema inteiro.** Quem pagasse R$ 490
receberia trinta dias.

`pro_vigente()` (0055) nao muda: ela compara `current_period_end + graca > now()`
e e cycle-agnostic. As quatro triggers de limite tambem nao — todas leem so
`pro_vigente()`. **O raio de explosao em SQL era uma expressao `CASE`.**

### O ciclo nasce no NOSSO servidor, nunca no webhook

A 0027 proibe em texto derivar validade do payload: *"deixaria alguem com o
token estender o proprio plano."* Entao `subscriptions.ciclo` (0070) e escrito
por `createCheckout`, e a RPC le a coluna. `aplicarEventoAsaas` e o webhook
**nao mudaram uma linha** — que e a prova de que a 0027 foi respeitada.

**A emenda que fecha a fuga de dinheiro:** `actions.ts:235` pula a criacao no
Asaas quando reusa assinatura viva. Gravar `ciclo` sempre deixaria a coluna
dizer YEARLY numa assinatura que cobra R$ 49 — pagaria 49, receberia um ano.
Por isso `ciclo` so entra no upsert quando `subscriptionFoiRecriada`. O guard
que recusa a troca e a educacao; **a condicao no upsert e a trava**.

### `interval '1 year'`, e nao `365 days`

O Asaas cobra o YEARLY na mesma data do calendario. Em ano bissexto, 365 dias
cortariam o acesso **um dia antes** da proxima cobranca — cliente cortado com o
dinheiro ja pago. E o default do desconhecido e o valor MENOR, ao contrario de
`dias_de_graca`: la a diferenca sao 2 dias, aqui sao **onze meses de produto de
graca**.

### Provado contra producao

    migration isolada   mensal via DEFAULT 30 dias | anual 365 | rollback pelo raise
    ponta a ponta       YEARLY no gateway, R$ 490 cobrados, banco == gateway
                        receiveInCash -> cron real -> 365 dias, pro_vigente=true
    seguranca           usuario logado tentando virar o proprio ciclo: NEGADO
    tela                mensal R$ 49/mes (padrao) | anual R$ 490/ano, 2 meses
                        gratis, economize R$ 98 — clique troca a selecao

1.009 testes. O mensal continua 30 dias, medido no mesmo lugar — sem esse
controle, um defeito que desse um ano para TODO MUNDO passaria feliz.

### O achado que nao era da rodada: o webhook do Asaas estava INTERROMPIDO

Descoberto porque a prova ponta a ponta nao recebia evento nenhum.
`interrupted: true`, com `sendType: SEQUENTIALLY` — **um evento travado bloqueia
todos os seguintes**. Pagamento confirmado nao chegava ao produto.

A rede de seguranca funcionou: o cron diario de reconciliacao aplicou o
pagamento do mesmo jeito, e foi por ele que a prova passou. Mas o caminho
rapido estava morto, e nada avisava.

**Religado** (`PUT /webhooks/{id}`, `interrupted: false`). Os 106 eventos ja
estavam assinados — a lista nunca foi o problema.

**Fica em aberto:** nada vigia esse estado. Um webhook interrompido e
indistinguivel de "ninguem pagou" ate alguem conferir na API.

### Duas coisas anotadas, nao resolvidas

**A suspeita do banner cobrindo o botao Entrar foi MEDIDA e e FALSA.** Ver a
secao propria abaixo — `elementFromPoint` em quatro larguras, com a pagina
rolada ate o fim, e um A/B do login com o banner aberto e respondido. O reparo
de 02/09 esta intacto. A falha original era primeira compilacao do servidor de
desenvolvimento, e eu esperei 9s onde o `playwright.config.ts` documenta 120.

**A Central conta todo Pro como R$ 49/mes** (`lib/dono/central.ts:95`,
`dono/anuncio/page.tsx`). Vai errar em silencio na primeira venda anual.
Obrigatorio antes do primeiro anual ser CONTADO, nao antes de ser vendido.

---
## O nome da campanha NUNCA vai bater com o `utm_campaign` (04/09)

Achado conferindo a outra ponta na API da Meta, logo depois da rodada abaixo.
Os seis criativos carregam `utm_content` certinho — essa metade estava boa. A
outra estava quebrada:

    nome da campanha na Meta   "Velo Funil — aquisicao (cadastro)"
    utm_campaign nas 6 URLs    "aquisicao_cadastro"

`cruzarCampanhasComClientes` casava por IGUALDADE. Todo cadastro dos seis
anuncios cairia em "sem campanha identificada", a tabela por peca apareceria
vazia, e a campanha mostraria gasto com zero resultado. **Atribuicao quebrada
com aparencia de anuncio ruim** — e a decisao seguinte seria pausar a campanha
que funciona.

**Nao e erro de digitacao, e estrutural.** Espaco, travessao e parentese nao
cabem numa URL, e nome de campanha existe para ser lido no painel. Os dois
nunca vao ser identicos por escrito. Casar por igualdade e frágil por
construcao: renomear a campanha no painel quebraria tudo em silencio.

### O casamento agora e por SEGMENTO, com trava de ambiguidade

`chaveDeUtm` reduz os dois lados a `velo-funil-aquisicao-cadastro` e
`aquisicao-cadastro`. Exato ganha; senao, contencao de sequencia CONTIGUA de
segmentos.

**Por segmento e nao por `includes` de texto:** `pro` e substring de
`producao`, e casar por pedaco de palavra atribuiria o cliente a campanha
errada — pior que nao atribuir, porque parece resultado.

**Ambiguidade nao vira palpite.** Duas campanhas casando devolve `null`, e a
empresa conta como "veio de anuncio, campanha desconhecida", que e exatamente o
que se sabe dela.

**E a resolucao passou a ser por EMPRESA, nao por campanha.** O filtro anterior
deixava a mesma empresa casar com duas, e as duas contariam o mesmo pagante
dividindo cada uma o proprio gasto por ele — a soma mostraria mais clientes do
que existem.

### O alarme que separa "campanha ruim" de "relatorio cego"

`comCampanhaNaoReconhecida`: a URL esta completa, o dado chegou inteiro, e
mesmo assim nao fecha. Sem esse numero, "gastou e nao trouxe ninguem" e "trouxe
e o relatorio nao achou" sao indistinguiveis na tela.

Sai por subtracao, sem precisar da lista de campanhas: toda empresa contada tem
`utmCampaign`, entao quem tem a marca e nao foi contado e quem nao casou.

### Provado, e um defeito novo achado na propria prova

Semeadas 5 empresas com o `utm_campaign` EXATO dos criativos reais mais uma
orfa. A campanha real passou a casar:

    a1_ancora_preco        2 cadastros   2 usaram   1 paga
    a3_objecao_planilha    1             0          0
    Peca nao identificada  1             0          0

Os tres alarmes aparecem distintos. 985 testes.

**Achado na prova:** com gasto ZERO e um pagante, `custoPorCliente` da 0 e a
tela dizia *"Cada cliente pagante custou R$ 0,00"* — aquisicao de graca por um
anuncio que nunca rodou. Aritmetica certa, afirmacao falsa. Linha de custo
agora exige `gasto > 0`.

---
## O `utm_content` era gravado e NUNCA lido (04/09)

A migration 0069 criou a coluna em 03/09, `utm-capture.tsx` captura, o
onboarding grava. Nada lia. E o buraco tinha tres degraus, nao um:

    dono/queries.ts:104   select(... utm_campaign, fbc ...)   nem SAIA do banco
    dono/tipos.ts         EmpresaNaCentral sem o campo
    atribuicao.ts:87      agrupava so por utm_campaign

Os seis criativos apontam para o mesmo `/cadastro` e so se distinguem por ele.
O relatorio dizia "a campanha custou R$ X por cliente" e **os seis colapsavam
num numero so** — o teste de seis argumentos rodaria e nao concluiria qual
vendeu.

### Nao ha custo por peca, e a AUSENCIA e a decisao

`meta-ads.ts:213` le os anuncios com `fields=id,adset_id,campaign_id`, **sem
`insights`**. A Meta devolve gasto por CAMPANHA. Dividir esse gasto entre as
pecas — por igual ou proporcional aos cadastros — produziria custo por cliente
com cara de medicao e origem em chute, e erraria justamente na peca que mais
importa, porque a Meta concentra orcamento em quem performa.

**As contagens sozinhas ja ordenam:** 20 cadastros com 1 ativacao perde para 4
cadastros com 3 ativacoes e 2 pagantes, sem saber quanto custou cada uma. O
campo entra quando o gasto por anuncio for lido de verdade, e nao antes.

### A ativacao nao precisou de coluna nova

`queries.ts:195` ja devolve `quantidadeDeContatos`. Ativou e `> 0` — a MESMA
definicao de `primeiro_contato` em `montarFunilDeAtivacao` e do
`CustomizeProduct` que a Meta recebe. Tres superficies, uma definicao.

Ele separa dois fracassos que parecem iguais no total: a peca que traz muita
gente e ninguem usa (promessa errada) e a que traz pouca e todas usam (publico
certo, alcance pequeno). E `custoPorAtivacao` da sinal enquanto `custoPorCliente`
ainda e `null`, que sao justamente os dias em que se decide manter ou pausar.

**Um degrau so, nao o funil de seis.** Com R$ 25/dia dividido em seis pecas,
cada uma tem 2 a 5 cadastros — e `maiorVazamento` ja se recusa a opinar abaixo
de 5 contas. Seis degraus sobre tres pessoas e ruido com aparencia de grafico.

### Quem chega sem `utm_content` aparece, e nao vira peca chamada "null"

Descartar faria a soma das pecas ficar menor que a da campanha sem nada
explicando na tela — e o gasto continuaria inteiro no denominador, deixando
toda peca melhor do que e. O balde e visivel, rotulado "Peca nao identificada",
e **desce sempre na ordenacao, mesmo quando lidera em cadastro e em pagante**:
ele nao e um criativo que venceu, e a medida do que a URL deixou de dizer.

`semPecaIdentificada` sai do `desempenho`, nao de `empresas`. **TODA conta
organica tem `utm_content` nulo** — contar na lista de empresas acusaria um
defeito de URL que nao existe. Numero plausivel, conclusao errada: a classe de
erro mais cara deste projeto. Tem teste travando.

### Provado contra producao, e a tela renderizada

8 de 8 no banco real, com 4 empresas descartaveis apagadas num `finally`. O
achado que justifica o script: se a 0069 nao estivesse aplicada la, o `select`
novo devolveria 400 e a **Central inteira** pararia de carregar — nenhum teste
pega isso. Controle negativo: coluna inventada toma `42703`.

E o caminho da TELA nunca tinha rodado. Semeadas 4 empresas com a campanha
real (`Velo Funil — aquisicao (cadastro)`) e pecas variadas:

    A1_Ancora_Preco        2 cadastros   2 usaram   1 paga
    a2_perda_memoria       1             0          0
    Peca nao identificada  1             0          0   <- por ultimo

Desktop 5 colunas, telefone 2, sem rolagem lateral da pagina; a tabela rola
dentro da propria caixa (326px de caixa, 352 de tabela). 977 testes.

**O resumo do topo so aparece com gasto > 0**, e a conta nunca gastou — entao
o bloco novo foi conferido forcando `jaGastou` num experimento revertido em
seguida. Decisao existente, nao defeito: painel de resultado sobre gasto zero
afirmaria resultado que nao houve.

---
## O PageSpeed do telefone, medido item por item (03/09, noite)

Sete apontamentos. **Tres eram defeito, quatro nao** — e o achado que justifica
a rodada nao estava no relatorio.

### O Cloudflare reescrevia o HTML que o React hidrata

Achado ao rastrear de onde vinha o `email-decode.min.js` que aparecia como
recurso bloqueante. O script era a ponta; o problema era o que ele desfaz.

    <button data-slot="dropdown-menu-trigger">
      <a href="/cdn-cgi/l/email-protection" class="__cf_email__">[email protected]</a>
    </button>

`suporte-email-menu.tsx` renderiza `{email}` como no de TEXTO. O Email Address
Obfuscation (Scrape Shield) trocava por ELEMENTO — descasamento de hidratacao,
a classe que produz React #418/#423. Em 5 paginas publicas: `/` (x1),
`/privacidade` (x3), `/termos` (x3) e as duas de conteudo (x1 cada).

**Nenhum dos quatro portoes alcanca**: `localhost` nao passa pelo Cloudflare.

**Desligado pelo dono** — nao ha caminho por codigo, a reescrita acontece
depois que a resposta sai da Vercel. A guarda ficou em
`auditar-descoberta.mjs`, dentro do laco que ja le toda pagina do sitemap:
sem ela, "desliguei" e "desliguei ate alguem religar" sao indistinguiveis.
Controle negativo: com a obfuscacao ligada, reprovava em exatamente 5.

**O recurso ja nao protegia nada**: o endereco esta em texto puro no
`aria-label` do mesmo botao, a dois atributos de distancia.

**Fica em aberto:** `layout/user-menu.tsx` mostra `{currentUser.email}` em 4
pontos da area logada. Nunca foi medido, e agora nao da mais para reproduzir.

### Um `filter` de valor ZERO tirava seis animacoes da GPU

`tw-animate-css@1.4.0` poe `filter: blur(var(--tw-enter-blur, 0))` no
`@keyframes enter`. Basta a propriedade EXISTIR para o Chrome recusar compor —
a animacao cai na thread principal nos 600ms em que o LCP e decidido.

`animate-entrada` (`app/globals.css`) e o mesmo quadro sem essa linha, lendo as
MESMAS variaveis, entao `fade-in`, `slide-in-from-*` e `zoom-in-*` seguem
valendo. 27 elementos, uma palavra cada.

**A armadilha, e ela e de Tailwind v4:** escrito em `@theme static`, rodava a
**150ms** em vez de 600. `static` emite a variavel em `:root`, e e la que os
`var()` internos sao substituidos — onde `--tw-duration` nao existe, porque
quem escreve isso e a classe `duration-entrada`, no elemento. `@theme inline`
substitui dentro da utility, que aplica no elemento. O `@theme static` vizinho
continua certo para `--ease-entrada`, que PRECISA existir em `:root` porque o
RevealOnScroll a le num `style` inline.

**E `components/auth/animacao.ts` quase escapou**: e `.ts`, e a varredura usava
`--include=*.tsx`. Quem o pegou foi `document.getAnimations()` no navegador —
quatro animacoes de `/cadastro` ainda vinham com o nome `enter`.

### O telefone baixava 3840px para desenhar 1025

Duas causas, nenhuma delas a qualidade. **O `sizes` mentia**: `vw` e a janela,
mas o print e 300% do CONTAINER. Medido em 390px — janela 390, moldura 342,
print desenhado 1025, ou seja **263vw**. E o degrau de **3840 saiu** do
`deviceSizes`: `produto-print.tsx` e o unico consumidor de `next/image` do
projeto, e a fonte tem 2880px. **AVIF entrou** (o padrao do Next 14 e so WebP).

    producao antes   webp w3840   169.042 + 89.948 = 259,0 KB
    producao agora   avif         60.587 + 32.794 =  93,4 KB   -64%

### Contraste: 2 de 169, e o medidor errou DUAS vezes antes de acertar

O relatorio devolveu 90 em Acessibilidade. Medido: dois elementos, os mesmos
nos dois temas, ambos `text-muted-foreground/70` em 11px no rodape — 3,00 no
claro e 4,14 no escuro, contra 4,5. Sem o `/70`: 5,58 e 7,38. Tamanho pequeno
E opacidade sao dois recuos empilhados, e o texto apagado era o dado cadastral,
que existe para ser conferido.

**O metodo importa mais que a correcao.** Primeira versao do medidor leu
`oklch(0.17 0.004 220)` como RGB: 178 falhas, todas falsas. Segunda converteu
pelo canvas mas pintando sobre PRETO opaco, o que faz `getImageData` devolver
alfa 255 sempre e todo ancestral transparente virar fundo preto — no escuro
passou (o fundo real e quase preto), no claro deu 158 de 169 reprovando,
incluindo `text-foreground` sobre a pagina, que da 18,5:1. A versao que vale
pinta sobre preto E sobre branco: se o resultado nao muda, a cor e opaca.

**Um resultado plausivel num tema so nao prova nada.**

### Os quatro que NAO devem ser mexidos, com a medida de cada um

**"JavaScript legado, 12 KiB"** e o `polyfill-module.js` do proprio Next (em
`node_modules`, sob `next/dist/build/polyfills/`), **1.380 bytes no disco**, injetado sem condicao pelo Next 14 e nao governado
por browserslist. Declarar um browserslist moderno nao removeria: o Tailwind v4
ja exige Chrome 111 / Safari 16.4.

**"Bloqueio de renderizacao, 460ms"** — as duas folhas baixam EM PARALELO (a
propria arvore do relatorio termina uma aos 332ms e a outra aos 351). A pequena
tem **339 bytes em brotli** e e a folha do `next/font`, com
`ascent-override`/`size-adjust` — as metricas que IMPEDEM o salto de layout.
Junta-las a mao trocaria protecao real de CLS por economia que nao existe.
`experimental.inlineCss` e do Next 15; aqui e 14.2.35.

**Preconnect** — o proprio relatorio diz que nao ha candidato. Correto desde
que o cliente do Supabase saiu da landing, em 02/09.

**Ciclos de cache** — 0 KiB, e a unica entrada era o script do Cloudflare.

### Nao medido, e fica anotado

O relatorio novo trouxe dois itens que o primeiro nao tinha: **reflow forcado**
(43ms, a maior parte no chunk 2117) e **2 tarefas longas**. Nenhum dos dois foi
investigado.


## A campanha do Meta esta pronta e nao pode ser ligada (03/09)

Montada inteira e pausada, sem custo:

    campanha   120253684403370580   OUTCOME_LEADS   R$ 25/dia   PAUSED
    conjunto   120253684403670580   Brasil, Advantage+, otimiza por Lead
    criativos  6, um mecanismo psicologico cada, todos 1:1
    anuncios   0                    BLOQUEADO

**O bloqueio nao e de codigo, de conta nem de cartao.** O suporte da Meta
confirmou: restricao de Fraude e Decepcao no PERFIL PESSOAL, aplicada em
06/07/2026, que desativa o Meta Pay. Desativado, nenhum meio de pagamento
funciona — nem cartao, nem Pix, nem boleto, em conta nenhuma.

O diagnostico custou uma sessao porque a API culpa "pagamento" (`code 100`,
`subcode 1815010`), o que manda mexer no cartao. Ficam registradas as
hipoteses testadas e DESCARTADAS, para ninguem refazer a ronda: trocar cartao,
corrigir o CNPJ do cadastro, conta bloqueada, limite de gasto, app em modo de
desenvolvimento.

**O teste decisivo** foi montar campanha, conjunto, criativo e anuncio na OUTRA
conta de anuncio (`27108979755418323`), que tem metodo de pagamento diferente e
nenhum business: os tres primeiros passaram, o anuncio recusou com o mesmo
subcodigo. Duas contas, dois metodos, um erro — logo o bloqueio e do usuario.

Caso aberto no suporte (`1782313419778871`), aguardando especialista. Detalhes
em [docs/campanha-meta.md](campanha-meta.md).

## O 1:1 e a imagem unica, e a escolha foi MEDIDA (03/09)

Sem `asset_feed_spec` — que o app em modo de desenvolvimento bloqueia — o
creative carrega uma imagem so. Qual sofre menos foi decidido abrindo o preview
real do Facebook no navegador:

    4:5 em posicionamento 1:1   CORTA topo e base: marca e dominio somem
    1:1 em posicionamento 4:5   INTEIRA, nada cortado

**A regra que fica:** quando so cabe uma imagem, escolha a mais QUADRADA das
que voce tem. Ela perde area nas outras; as alongadas perdem conteudo.

E o achado estrutural: **um `foco` unico nao serve para as tres proporcoes**. A
caixa de `comp_passo` vai de 2.14 (1:1) a 1.30 (9:16), e o card sangra pela
direita — o mesmo recorte cortava o botao "Google Calendar" em 1:1 e o e-mail
do contato em 4:5. `foco` passou a aceitar dicionario por formato.

## A Politica negava usar cookie de publicidade, e usa (03/09)

Achado ao preparar o Google Ads. A secao 3 dizia em texto *"nao usamos cookies
de publicidade"* — falso desde a instalacao do Meta Pixel, que grava `_fbp`. E
a lista de SUBOPERADORES trazia Supabase, Vercel, Resend, Asaas e Google, **sem
a Meta**, que recebe e-mail, telefone, nome, cidade, estado e CEP pela CAPI.

Hasheados, e hash nao descaracteriza dado pessoal quando o destinatario
consegue casa-lo com a base dele — que e para o que serve. Omitir destinatario
contraria o Art. 9o, I.

`lib/analytics/consentimento.ts` registrou em 02/09 que fechar o consentimento
"deixou de ser opcional no momento em que o trafego pago entrou no plano". O
raciocinio estava certo e **parou na metade**: o banner foi construido, o
cookie espelho foi construido, a CAPI passou a respeitar a recusa — e a
POLITICA, que e onde tudo isso e declarado, continuou dizendo o contrario.

## A IA do Google estava PROIBIDA de citar o site (03/09)

Relato do dono, e foi ele que resolveu o caso: *"aparece o site, mas a IA do
Google nao fala do meu site"*.

O `robots.txt` SERVIDO tinha 76 linhas; `app/robots.ts` gera 15. A diferenca
vinha do Cloudflare, que injetava bloqueio de nove bots de IA — entre eles o
`Google-Extended`, que autoriza o Google a usar o conteudo em AI Overview e no
Gemini.

    Googlebot         rastreia e indexa    -> ranking na busca normal
    Google-Extended   autoriza uso em IA   -> citacao em AI Overview

A origem era o toggle **"robots.txt gerenciado"** do AI Crawl Control, sensato
como padrao e o oposto do que um SaaS querendo ser descoberto precisa.
Desligado pelo dono: 76 linhas -> 15.

**E duas suposicoes minhas estavam erradas**, as duas desmentidas pela fonte
oficial: eu disse que o site NAO APARECIA (o Search Console mostra posicao
media 1,7 e CTR de 33%) e que faltava Search Console (ja estava configurado
desde 13/08). Quando a fonte oficial existe, e ela que decide.

O diagnostico correto: **nao e visibilidade, e demanda**. 114 impressoes em
tres meses, quase todas pelo nome proprio. Detalhes em
[docs/descoberta-no-google.md](descoberta-no-google.md).

## O site ganhou conteudo, dados estruturados e um vigia (03/09)

    sitemap        5 -> 7 URLs
    JSON-LD        0 -> 6 blocos na home, 2 em cada pagina nova
    description    213 -> 148 chars   o corte comia "nao por vendedor"
    canonical      /login, que era a unica sem

Duas paginas escritas para quem NAO conhece o produto:
`/quanto-custa-um-crm` e `/crm-que-nao-cobra-por-usuario`. As duas admitem
quando o concorrente e melhor — conteudo que so puxa para o proprio lado nao e
citado por IA nem ranqueia.

`scripts/marketing/auditar-descoberta.mjs` le o site COMO O BUSCADOR LE, por
HTTP. Nenhum dos quatro portoes fazia isso: eles leem o codigo que GERA o
robots, nunca o que e servido — e os dois discordavam por 61 linhas.

**`aggregateRating` fica FORA, com teste travando.** Ele desenha estrelas no
resultado e seria prova social inventada. Provado com controle negativo:
injetado, 1 de 6 reprova. Marcar avaliacao inexistente tambem viola a politica
do Google, e a punicao e ação manual — o site perde TODO rich snippet.

## O banco nao guardava qual PECA trouxe o cliente (03/09)

`workspaces` tinha `utm_source`, `utm_medium`, `utm_campaign`, `fbc` e `fbp`.
Faltava `utm_content` — e os seis anuncios apontam para o mesmo `/cadastro`,
distinguidos so por ele.

Sem a coluna, o teste de seis angulos rodaria e nao concluiria qual argumento
vendeu. E o relatorio da Meta nao substitui: ela sabe quem se cadastrou, nao
quem PAGOU, que acontece dias depois no Asaas. Migration 0069.

## O botao "Criar conta" nao podia ser clicado, em telefone (02/09, tarde)

Auditoria de frontend antes de investir no Meta Ads. O achado que justifica a
rodada inteira apareceu ao medir em **390x659** — o viewport VISIVEL de um
iPhone, nao os 844 do aparelho. A diferenca e a barra do navegador, e e ela que
muda a resposta.

    /cadastro, rolado ate o FIM     scrollY 144 == maxScroll 144
    botao "Criar conta"             539..583
    elementFromPoint no centro      o <p> do banner de consentimento

**Nao e "abaixo da dobra".** A pagina e curta, ja estava no fim da rolagem, e
nao havia para onde rolar. Quem chegava de anuncio pelo telefone **nao tinha
como criar conta**, exceto pelo "Continuar com Google", que fica no topo.

Na landing, os dois CTAs tambem: o do hero (532..580) atras do banner, e o CTA
fixo (z-40) inteiro debaixo dele (z-50) — clicavel pelo teclado, invisivel para
o dedo.

**E a TERCEIRA reincidencia.** O proprio arquivo do banner documenta que ele
cobriu o "Comecar gratis" em 23/08 e a linha de preco em 24/08. A correcao de
24/08 moveu a linha de preco para CIMA do botao, o que empurrou o botao mais
para baixo, na direcao do banner. **Corrigir posicao nao fecha a classe** — todo
texto que crescer no hero reabre.

### O que fecha: o banner publica a propria altura

`--altura-do-banner`, escrita no `<html>` por `ResizeObserver`. Quem sabe a
altura do banner e o banner; todo o resto estava chutando um numero que muda
com a largura, o zoom de fonte e a quebra do texto.

    body            padding-bottom: var(--altura-do-banner)
    CTA fixo        bottom: var(--altura-do-banner)

O comentario do banner afirmava que reservar espaco **"nao resolve, medido"**.
Resolve — so nao resolve a DOBRA, que e outro problema. A distincao custou o
defeito mais caro que esta pagina ja teve: numa pagina curta, o espaco
reservado e o que faz a rolagem existir.

**E o banner aberto forca o CTA fixo a aparecer.** Na dobra do telefone o CTA do
hero continua atras dele, e ai deixa de importar: existe um botao identico e
livre 59px acima. Assim que a pessoa responde, o banner some, a variavel zera e
a regra volta a ser so a do hero.

### Provado nos dois sentidos

    /cadastro   maxScroll 144 -> 271, botao 539..583 -> 413..457
                elementFromPoint devolve BUTTON "Criar conta"
    landing     CTA fixo 599..647 -> 473..521, clique chega no botao
    negativo    banner respondido -> variavel removida, padding 0px,
                maxScroll volta a 144, CTA fixo recolhe, hero recebe o clique

**O controle negativo e o que separa "corrigi" de "empurrei para sempre".**

### E a correcao abriu DUAS regressoes, achadas so por medir mais larguras

Perguntado pelo dono antes de promover: *"seria bom medir isso?"*. Era. Eu tinha
medido **so em 390px**, e o `padding-bottom` vai no `body` — que e global.

**1. Vao morto em desktop.** Em 1440x900 o banner nao e faixa: e card de 448px
no canto direito. Reservar altura no `body` abria **142px de espaco vazio abaixo
do rodape**, nos 992px a esquerda onde nao ha banner nenhum.

A correcao obvia era cortar em `sm` (640px), onde o banner vira card. **Medida,
ela reabria o defeito original numa largura diferente** — 700x800, tablet em
retrato ou telefone deitado, no `/cadastro`:

    banner    448px, comecando em x=252
    botao     x de 126 a 574
    clique    o <p> do banner, de novo

O card a direita ALCANCA o formulario enquanto ele e coluna unica centralizada;
a tela dividida so comeca em `lg`. A troca, entao, e entre um vao temporario
abaixo do rodape e um botao de cadastro inalcancavel em tablet. **Reserva
sempre** — o vao some no primeiro clique, o botao inalcancavel custa a conversao
que o anuncio pagou.

**2. O dashboard passou a rolar.** `app/(dashboard)/layout.tsx` e
`flex h-dvh overflow-hidden`: ali o documento NAO rola de proposito, quem rola e
a coluna interna. Medido com o banner aberto, `scrollHeight - innerHeight` saiu
de 0 para **142px**, e a janela ganhou uma segunda barra de rolagem.

`data-casca="tela-cheia"` + `body:has(...)` zera o padding la, e o espaco nao
faz falta porque nada do dashboard fica preso atras do banner.

**A licao e sobre metodo:** medir uma largura prova uma largura. Regra global
(`body`) exige varredura global — 390, 700, 1024 e 1440, mais a area logada, que
tem casca diferente de tudo.

    390    padding 126px   chega no BOTAO   (maxScroll 144 -> 271)
    700    padding 150px   chega no BOTAO   <- a que o corte em `sm` quebrava
    1024   padding 142px   chega no BOTAO
    1440   padding 142px   chega no BOTAO
    dashboard  padding 0px, rolagem extra 0
    negativo   respondido -> padding 0px em todas, e o clique continua chegando

## O cliente do Supabase viajava na landing (02/09, tarde)

Medido em producao, com `fetch` nos proprios chunks:

    JS total     1.299 KB descomprimido, 33 arquivos
    chunk 9086   193 KB, com GoTrueClient dentro
    console      400 em /auth/v1/token?grant_type=refresh_token

Unico consumidor: `useSessaoAtiva()`, para escolher entre "Entrar" e "Ir para o
sistema". E o comentario do hook afirmava que `getSession()` "le o cookie local
sem ida a rede" — **falso**: com access token expirado ele RENOVA, e todo
visitante de volta pagava um round-trip que ainda devolvia 400.

Passou a ler o cookie do `@supabase/ssr` direto, com o prefixo DERIVADO da
`NEXT_PUBLIC_SUPABASE_URL` (escrever a mao quebraria na proxima troca de
projeto, o que ja aconteceu em 12/08). A resposta e mais fraca de proposito: a
presenca do cookie nao prova que o token vale, e quem valida e o
`middleware.ts`.

    JS total     1.299 KB -> 1.045 KB   (-254 KB, -20%)
    Supabase     193 KB   -> NENHUM chunk
    console      sem o 400

**O LCP estava travado por CSS.** O h1 do hero — o candidato a LCP — nascia em
`opacity: 0` por `fade-in` + `fill-mode-both`, com 70ms de atraso e 600ms de
duracao: o LCP nao podia acontecer antes de ~670ms, com a pagina pronta desde
os 555ms (TTFB 127ms). O `fade-in` saiu; o `slide-in` fica, porque deslocar nao
esconde o pixel.

**Fontes para `.woff2`**, 17% menores cada (66.268 -> 55.516 e 67.864 ->
56.828). Os `.woff` **ficam no disco**: `gerar-stories.py`, `gerar-feed.py` e
`velofunil_criativos.py` os carregam pelo Pillow, que nao le `.woff2`, e um
deles tem teste amarrado. Apaga-los pareceria limpeza e quebraria o gerador de
criativos.

**Um achado do relatorio que medi e e FALSO:** "6 PNGs baixados para 3
exibidos". So 3 baixam — `loading="lazy"` com `display: none` nunca intersecta,
entao nunca dispara.

## Tres promessas e um spinner eterno (02/09, tarde)

**"Dois minutos do cadastro ao primeiro contato" aparecia em TRES lugares**, e
o caminho real sai do site para abrir a caixa de entrada antes de qualquer tela
do produto. Duas copias foram corrigidas de inicio; **a terceira so apareceu ao
ler o DOM da tela de login durante a prova** (`auth-arte.tsx`), e e onde mais
doi — a pessoa esta no formulario, e a frase descreve os proximos segundos.

**"Assinar Pro" nao assina nada:** leva a mesma tela de conta gratis do botao
ao lado, e o checkout so existe depois do e-mail de confirmacao. Virou "Comecar
com o Pro". O `?plano=pro` continua igual, e o E2E passou a localizar pelo
`href` em vez do texto.

**`onSubmit` do cadastro sem `try/catch`:** Server Action que REJEITA (rede
caindo, falha de transporte) deixava `isSubmitting` em `true` para sempre com
`formError` em `null` — spinner girando, sem mensagem, sem botao, e recarregar
perdia o formulario de cinco campos. Erro DEVOLVIDO ja era tratado; faltava o
LANCADO, que nao passa por nenhum `if`.

**Alvo de toque de 44px** nos dois botoes dentro dos campos de senha
(`after:-inset-1`, so a regiao clicavel, sem crescer um pixel: o campo tem 44px
e dois controles desse tamanho comeriam a area de digitar).

## O "Pular por enquanto" era uma saida que reprovava (02/09, tarde)

Pedido do dono: tirar o botao para quem entra pelo Google. **O motivo e mais
forte que o pedido.** `pularOnboarding` conta as empresas da pessoa antes de
tudo e recusa quem nao tem nenhuma — e a empresa so nasce dentro do assistente.

Para TODA conta recem-criada, pelo Google ou por e-mail, o botao nao pulava:
mostrava um toast de erro e deixava a pessoa onde estava. O comentario do codigo
diz *"pular e oferta de verdade, nao armadilha"*; para o caso mais comum era o
contrario.

So aparece quando ele funciona, ou seja, para quem ja tem empresa e voltou com o
assistente pela metade. Provado 4 de 4, **com o controle negativo**: sem o
terceiro caso, "sumiu o botao" e "sumiu para sempre" seriam indistinguiveis.

## O produto passou a avisar por dentro (02/09, tarde)

Pedido do dono, sobre o print da barra superior: ela tinha tema e conta, e nada
mais. Todo aviso do produto — pagamento, plano, trial — saia so por e-mail, e
quem esta com o CRM aberto e justamente quem nao vai abrir a caixa de entrada.

**A regra que governa e a licao de 20/08**, quando 8 dos 11 alertas da Central
eram ruido: fila com lixo dentro ensina a ignorar a fila inteira, e junto com o
item chato vai embora o alerta de dinheiro.

    so entra o que ja provou valer um e-mail
    nada do que a pessoa acabou de fazer
    contador so aparece quando > 0
    sino vazio e sino vazio, nunca "tudo certo"

**Quatro tipos, e cada um tem chamador vivo.** Dois candidatos obvios foram
RECUSADOS e o motivo fica registrado: `whatsapp_caiu` (a integracao esta em
`migrando` e o e-mail nao existe mais — tipo sem chamador e codigo morto com
aparencia de recurso) e `limite_do_plano` (`lib/leads/actions.ts` ja devolve a
mensagem na tela, no mesmo segundo).

**Migration 0066**, com tres decisoes de RLS:

    select    is_workspace_member, e so o que e seu
    update    so `lida_em`, e so a propria linha (using E with check)
    insert    NENHUM para authenticated

O terceiro e o que importa: **notificacao forjavel e aviso de cobranca
forjavel**. Bastaria um `POST` no PostgREST com a chave publica — que esta no
HTML por design — para fabricar "seu pagamento falhou" na tela de outra empresa.
Quem escreve e `service_role`, pelo mesmo motivo de `error_logs`.

**Um ponto de escrita so** (`lib/notificacoes/registrar.ts`), chamado de onde os
e-mails ja saem. O e-mail continua saindo: os dois respondem perguntas
diferentes e leem o mesmo registro, entao nao podem discordar. Falha ali **nao
derruba o chamador** — perder o aviso na tela e recuperavel, derrubar um webhook
de pagamento nao.

**Nasceu com purga de 90 dias**, no cron que ja existe — `purge_old_asaas_webhook_events`
ficou sete migrations sem nunca ter sido agendada.

Provado contra producao, **10 de 10**, com empresa descartavel apagada num
`finally`: intruso lendo devolve 0 linhas; intruso inserindo toma `42501`;
**nem o proprio dono da empresa escreve**; tipo fora da lista e `href` para fora
do dominio recusados pelo `check` (`23514`); purga leva a de 91 dias e mantem a
de 89. E visto na tela: badge com o numero, ponto vermelho no que custa
dinheiro, "ha 12 min / ha 3 horas / ontem", 44px em mobile, e o vazio que **nao
afirma que esta tudo certo**.

**Antes disso, 02/09/2026, madrugada** (o vigia ganhou quem o vigie, fora da
Vercel; a Meta recebia dado pessoal de quem RECUSOU o banner; e a entrada pelo
Google entrava sem deixar ninguem escolher a conta)

**Antes disso, 01/09/2026, noite** (o sistema passou a avisar sozinho, de
hora em hora e so quando muda; e tres coisas que este documento afirmava
deixaram de ser verdade sem ninguem notar)

## Quem vigia o vigia, e por que ele nao mora na Vercel (02/09)

O vigia de 01/09 fechou o "ninguem olha a Central". Ficou um buraco que ele
nao podia fechar sozinho: **se ELE parar, o silencio parece ordem.**

Quatro falhas produzem o mesmo silencio — o cron nao disparar, a rota lancar,
o Resend recusar, um deploy quebrar a rota. De fora, "nenhum problema" e "o
vigia parou" eram indistinguiveis, e o segundo some justamente quando mais se
confia nele.

**Um segundo cron na Vercel cairia junto.** Vigiar o vigia so funciona de fora,
e o Postgres e a unica infraestrutura deste projeto que ja esta de pe e nao
depende dela. `vigiar_o_vigia` (0063) roda por `pg_cron` aos 30 de cada hora —
deslocado de proposito, porque conferir na hora cheia correria contra a
execucao que se quer observar.

**A peca que faltava era o carimbo.** A memoria so grava quando um e-mail sai,
o que e correto para nao repetir aviso e deixa a varredura limpa sem rastro.
`__ultima_varredura` avanca em TODA passagem, antes de qualquer decisao de
envio, e sobrevive a limpeza: nao e alerta, e prova de vida.

Tres horas de tolerancia, nao uma: uma falha isolada se resolve na proxima
passagem, e alertar na primeira ausencia geraria alarme falso todo deploy que
caisse na hora cheia.

**`pg_cron`, `pg_net` e o Vault entraram para isso.** Quatro migrations (0014,
0015, 0027, 0051) afirmam em texto que `pg_cron` nao esta habilitado — passa a
ser falso a partir daqui, e nenhuma decisao daquelas quatro migra para la.

**A chave do Resend foi posta no Vault PELO DONO**, pelo painel. O
classificador bloqueou minhas duas tentativas de move-la, e o bloqueio estava
certo: mover credencial de API para outro sistema nao e algo que eu deva fazer
sozinho. Ela nao entra em migration versionada — arquivo no Git e a forma mais
comum de vazar credencial.

Provado nos dois sentidos: carimbo de agora cala, carimbo de 5 horas atras
manda o e-mail, entrega `delivered` conferida no Resend.

## A Meta recebia dado de quem clicou "Recusar" (02/09)

Auditoria do funil de aquisicao. O achado mais grave nao era de conversao — era
juridico, e estava no codigo desde que a CAPI existe.

O pixel do navegador sempre respeitou o banner, com duas cercas independentes.
**A Conversions API nunca consultou nada**: a decisao vive em `localStorage`, e
o servidor nao le `localStorage`.

Quem recusava e se cadastrava tinha e-mail, telefone, nome, cidade, estado, CEP
e `external_id` enviados a Meta — hasheados, mas enviados. Seis eventos. Sob a
LGPD e tratamento sem base legal declarada, e a Politica de Privacidade
descrevia outra coisa.

**A correcao tem duas metades, e a segunda foi erro meu.** Cookie espelho
resolve os cinco eventos que nascem numa requisicao do visitante. O `Purchase`
nao: ele nasce no webhook do Asaas, onde quem faz a requisicao e o gateway.
Minha primeira versao tinha um `catch` que retornava — faria o Purchase nunca
ser enviado, matando a conversao principal para consertar o consentimento. A
0065 guarda a decisao em `workspaces`, gravada no onboarding.

`null` conta como recusa nos dois caminhos: **ausencia de decisao nunca e
consentimento**.

Junto: o `Purchase` passou a levar `fn/ln/ct/st/zp` como os outros cinco ja
levavam — era o evento mais valioso para o algoritmo e o de pior
identificacao —, e `CompleteRegistration` ganhou `event_id` deterministico.

**Os 9 testes afirmam a RECUSA, nao o aceite.** O defeito era uma ausencia:
nada falhava, nenhum teste quebrava. So um caso que exercita "recusado" e "nao
decidiu" o pega.

**O metodo de prova contra a Meta fica registrado:** token INVALIDO. A recusa
alta prova que a chamada aconteceu; sucesso seria silencioso. E
`test_event_code` inventado NAO serve — a Meta responde `events_received: 1` e
grava no dataset de producao do mesmo jeito.

## A entrada pelo Google, e o que ela quebrou ao ser consertada (02/09)

`signInWithOAuth` sem `queryParams`. Sem `prompt`, o Google pula toda tela
quando ha uma conta logada e o app ja foi autorizado: "Entrar com Google"
virava uma piscada e a pessoa ja estava dentro, sem ver com qual identidade.

**Num CRM isso e pior que abrupto.** Quem trabalha tem conta pessoal e de
trabalho no mesmo navegador; entrar com a errada significa criar uma empresa
paralela sem perceber, ou nao achar os proprios contatos e concluir que o
sistema perdeu tudo.

`prompt: select_account`. Nao `consent`, que remostraria as permissoes em toda
entrada — atrito diario que nao protege de nada.

**E a correcao abriu um defeito novo, o que vale mais registrar que ela.** Com
a tela de escolha passou a existir o botao voltar, e quem desistia voltava para
`/login` com o botao girando para sempre: `isGoogleLoading` nunca era desligado
no caminho de sucesso, de proposito, porque o navegador estaria saindo.

A pagina volta do **bfcache** com a arvore React inteira preservada — sem
remontagem, `useEffect([])` nao roda e o estado inicial nao e reavaliado.
`pageshow` com `event.persisted` e o unico evento que distingue esse caso.

**Mudanca que acrescenta um passo ao fluxo acrescenta junto todos os caminhos
de saida desse passo.**

## O botao "Entrar" abria o sistema de surpresa (02/09)

`middleware.ts:168` desvia quem tem sessao de `/login` para `/dashboard`, e
isso esta certo. O defeito era o rotulo: escrito "Entrar", o efeito e o de
abrir o produto sem avisar. Provavelmente e tambem o "duplo clique" relatado —
clica, vai ao dashboard, volta, clica de novo.

O desvio fica; o rotulo acompanha. Deslogado le "Entrar" e vai ao login; logado
le "Ir para o sistema" e vai ao painel.

**A sessao e lida no NAVEGADOR, e isso e decisao.** Ler num Server Component
tornaria a landing dinamica, e ela e o LCP da pagina que recebe trafego pago. O
padrao e "deslogado", que e o caso da quase totalidade de quem chega — so quem
TEM sessao ve o rotulo mudar, e essa pessoa ja conhece o produto.

**A sessao passou a expirar em 7 dias sem uso**, nao 14. A divisao no mercado
nao e por tamanho de produto, e pelo que ele guarda: Salesforce usa 2h e
HubSpot 24h, os dois CRM; Notion e Linear ficam em meses porque guardam o
trabalho da propria pessoa. Um CRM guarda dado de gente que nunca concordou com
nada, e o publico daqui usa computador compartilhado. O teto absoluto de 30
dias fica — ele responde outra pergunta: limitar o estrago de um cookie
roubado.

## A Central de anuncio mostrava campanha e so (02/09)

Oito endpoints da Meta testados, **nenhum bloqueado**. A tela parava na
campanha, e dois defeitos so apareceram ao ler o nivel abaixo:

    a campanha nao tem NENHUM anuncio    ligar nao veicula nada
    o conjunto otimiza por LINK_CLICKS   nao usa o pixel para conversao

O campo `optimization_goal` so existe no CONJUNTO — por isso a tela que parava
na campanha nao tinha como mostrar. E o botao Ligar ficava disponivel, sem
sinal de que o clique seria inocuo.

Agora mostra a arvore inteira, o dinheiro da conta, a serie de 30 dias em
barras CSS (sem dependencia nova), e o que impede de rodar. `Parcial<T>` faz
cada bloco falhar sozinho: antes um endpoint fora do ar apagava a tela toda.

**Escrita continua nas tres reversiveis.** Criar campanha segue fora, pela
decisao de 20/08.

## Outras quatro, curtas (02/09)

**Excluir empresa** existe no produto (0064), com quatro travas no banco — so
o criador, nunca a ultima, sem assinatura viva, e o nome conferido no servidor.
`workspaces` tem RLS sem policy de DELETE: um `delete` do cliente seria negado
em silencio, devolvendo sucesso com zero linhas.

**Trocar de empresa pede confirmacao**, contra o que Slack, Notion e Linear
fazem. Aqui as empresas nao sao espacos intercambiaveis, sao carteiras de
cliente: escrever na errada nao se desfaz voltando.

**A tarefa marcada sumia em 4 segundos**, antes de dar tempo de conferir se
marcou a certa. Agora fica riscada ate sair da tela — e o "Desfazer" perdeu o
prazo.

**A importacao de planilha** tinha tres defeitos: a tela prometia 1000 linhas e
o servidor recusava as 1500; um telefone repetido derrubava o lote inteiro
(`23505`); e o `update` de negocio nao checava erro. O gargalo do caminho
`atualizar` (~2010 requisicoes para 1000 linhas) fica registrado e nao foi
corrigido — merece rodada propria.

## O Kanban quebrou, e o instrumento de diagnostico estava cego (02/09)

Dois React #185 ("Maximum update depth exceeded") em producao, ao arrastar um
card. **Nao reproduzi o laco** — nem varrendo o caminho de render, nem com o
gesto real em build de producao local.

O que achei foi por que ninguem consegue: `component_stack` das duas linhas
estava VAZIO, e essa coluna existe (0058) para nomear o componente que entra em
laco. `CapturaDeComponente` estava no layout, e no App Router o `error.tsx` da
rota e um boundary MAIS INTERNO — captura primeiro, e o Next nao passa
`componentStack` para ele. Para erro de pagina, ela era codigo morto.

Desceu para dentro da pagina. **Na proxima ocorrencia o nome do componente
chega**, e a busca vira consulta.

**Hipotese que os horarios sustentam:** os dois erros caem dentro da janela de
promocao (07:12 e 07:15, com deploys as 07:14 e 07:17-18). E *deployment skew*
— aba aberta com chunks da versao antiga. Explica o erro ser novo, nao
reproduzir e ter parado sozinho quando parei de promover. **Nao esta provado**,
e se voltar fora de janela de deploy e defeito de verdade.

Fica em aberto: `skewProtectionBoundaryAt` nao definido, e `ChunkLoadError` nao
tratado em lugar nenhum do codigo.

## O sistema avisa, em vez de esperar alguem abrir a tela (01/09)

Pedido: monitorar tudo, 24h, sem parar. A saida obvia era publicar a Central
num host gratuito, e ela nao serve por duas razoes.

`lib/dono/queries.ts` le com `createAdminClient()`, que **ignora RLS por
completo** — nome, e-mail, telefone e valor de negocio de todos os clientes.
O gate de duas condicoes (`NODE_ENV` e host local) existe exatamente para
isso, e publicar exige desliga-lo. E o free do Render **dorme** apos 15
minutos, que e o oposto do que foi pedido.

`/api/cron/vigia` resolve a necessidade sem tocar no gate: em vez de uma tela
que alguem precisa lembrar de abrir, um e-mail que chega sozinho para
`notificacaosistemavelofunil@gmail.com`.

### Silencio e resposta, e essa e a regra que governa o resto

**Quando nao ha nada, nao sai e-mail nenhum.** Um "tudo certo" diario parece
cuidado e e o contrario: treina a pessoa a arquivar sem ler, e no dia em que o
assunto for grave o reflexo ja esta formado. E a licao de 20/08, quando 8 dos
11 alertas da fila eram e-mail de teste gerado por script.

Mas o e-mail **sai** quando uma leitura falha, mesmo sem alerta: um vigia que
nao conseguiu ler o Asaas e cala passa a mensagem de que conferiu e estava
tudo bem. `null` significa **nao sei**, nunca "esta zerado" — a distincao que
fez a Central declarar R$ 490/mes de receita com R$ 0,00 real em 30/08.

### A memoria, e por que ela decide a frequencia

De hora em hora sem memoria, um erro que aparece de manha gera **24 e-mails
identicos** ate alguem resolver. Vigilancia continua nao quer dizer aviso
continuo — quer dizer varrer sempre e avisar quando MUDA.

    nunca avisado        MANDA   e novidade
    igual ao ultimo      cala    ela ja sabe, e ja esta resolvendo
    PIOROU (2 -> 30)     MANDA   mudou de tamanho, e isso e fato novo

Comparar o NUMERO e o que separa "continua" de "piorou": dois erros num dia
podem ser navegador antigo, trinta sao defeito em producao. Migration 0062
(`vigia_ultimo_aviso`, RLS ligada e zero policy).

**Duas decisoes de seguranca do proprio mecanismo:** se a leitura da memoria
falhar, tudo parece novo e o e-mail sai — errar para o lado de avisar demais e
recuperavel, calar transforma o vigia no problema que ele evita. E a memoria
so grava DEPOIS do envio confirmado, senao um alerta ficaria enterrado ate
piorar de numero.

### Provado contra producao

1a chamada enviou, 2a respondeu `nada novo desde o ultimo aviso`. Entrega
`delivered` conferida na API do Resend. Sem token 401, token errado 401.

**Tres defeitos achados na propria revisao:** as leituras iam em serie ao
Supabase (viraram `Promise.all`); a fila de suporte contava relato de conta de
teste do dono (a tabela ja carrega `interno`, decidido por `ehContaDeTeste` na
gravacao — filtrar por ele evita uma segunda copia da regra); e a coluna era
um palpite meu (`tratado_em`, sendo `status`). **O terceiro apareceu pelo
comportamento certo funcionando:** a leitura virou `null` e o e-mail disse que
nao conferiu a fila.

### O que falta, e esta escrito no e-mail

As duas leituras do Asaas — assinatura ativa sem Pro, e cobranca vencida.
`lerDinheiro()` e `import 'server-only'` amarrado ao gate da Central, e
traze-lo para uma rota da Vercel exige separar a leitura do gate primeiro.
Ate la o e-mail **diz em texto** que nao conferiu dinheiro.

## Tres coisas que este documento afirmava e nao eram mais verdade (01/09)

Medidas nesta rodada, todas contra a fonte:

**O Instagram TEM caminho por API.** A secao de 29/08 diz "codigo que publica
no IG: 0 arquivos". Existe `scripts/marketing/publicar-instagram.mjs`, com
`META_INSTAGRAM_TOKEN` proprio, e o carrossel de sete slides saiu por ele.
Modo de ensaio por padrao: sem `--confirmar` ele confere token, resolve conta,
sobe as artes e imprime o que iria ao ar.

**O perfil tem 11.528 seguidores**, nao 3.555.

**O `META_ADS_TOKEN` NAO esta morto.** A pendencia registrada em 29/08 dizia
`API access blocked` em 8 de 8 chamadas. Medido em 01/09, tres chamadas reais:

    /me                          Velo Funil (122113347051334091)
    conta de anuncio             Rickdaskin Ads, account_status 1
    campanhas                    1, "Teste Pagamento", PAUSED

O business tambem mudou de nome — era `Rickdaskin`, agora **`Velo Funil`**.
Logo `/dono/anuncio` deixou de estar cega. A tela em si nao foi exercitada
nesta rodada; so o token.

**Antes disso, 31/08/2026, noite** (o CNPJ novo entrou e reacendeu seis
superficies de uma vez; e cinco e-mails de autenticacao sairam 23 dias com um
CNPJ que a Receita desmentia, porque o alarme tocou e so metade foi atendida)

**Antes disso, 31/08/2026** (a logo que o cliente sobe nunca apareceu desde
27/08, bloqueada pela propria CSP; o relato de suporte existia e a Central nao
deixava ver; e o Asaas cobrava R$ 0,99 para mandar o e-mail que ja mandamos)

**Antes disso, 30/08/2026** (a Central declarava R$ 490/mes de receita e o
real era R$ 0,00 — trial gratuito contava como dinheiro; o cliente ganhou canal
de suporte com anexo; e o funil da Meta foi de 3 para 7 eventos)

**Antes disso, 26/08/2026, tarde** (a elevação do modo claro nunca chegou a
nenhum cartão do sistema, desde 22/08, porque `ring` e sombra disputam o mesmo
`box-shadow` no Tailwind v4; e o PRD e o diagrama voltaram a bater com o banco)

**Antes disso, 26/08/2026, madrugada** (três telas que pareciam funcionar e
não funcionavam: o clique na tarefa ficava 1,5s sem sinal nenhum, o dashboard
mostrava tudo e não abria nada, e o filtro de /hoje se desfazia sozinho)

**Antes disso, 25/08/2026, noite** (diagnóstico do sistema inteiro, 15
achados que nenhum dos quatro portões enxerga; e a assinatura passou a avisar
4 dias antes, inclusive quem está em trial e nunca recebia e-mail nenhum)

**Antes disso, 25/08/2026, tarde** (o CNPJ que a landing exibia como prova
de confiança está BAIXADO desde 08/08; e o Business da Meta nunca foi
submetido, apesar de este documento afirmar as duas coisas ao contrário)

**Antes disso, 25/08/2026, madrugada** (a Central passou a mostrar quem
está decidindo AGORA; a API de anúncio da Meta ligada e a tela de Anúncio viva
pela primeira vez; e a bio do Instagram vendia a oferta que a 0051 aposentou,
para 3.555 seguidores)

**Antes disso, 25/08/2026, madrugada** (verificação OAuth do Google
APROVADA para `calendar.events.owned` e `gmail.send`; e o WhatsApp estava
ativo numa empresa Free — o gate de plano faltava no webhook e em duas Server
Actions)

**Antes disso, 24/08/2026, noite** (arquitetura do WhatsApp auditada ponta
a ponta: sessão medida em 100% de disponibilidade, envio e recebimento
provados, e quatro buracos de perda silenciosa de mensagem fechados)

**Antes disso, 24/08/2026, noite** (o site inteiro virava TELA PRETA para
quem aceitasse os cookies, por uma quebra de linha no valor do Pixel do Meta
colado na Vercel; corrigido no painel e no código, e o pixel passou a medir
pela primeira vez)

**Antes disso, 24/08/2026, tarde** (WhatsApp: loop infinito no diálogo de
pareamento corrigido, reconexão automática + e-mail de aviso quando uma sessão
JÁ conectada cai, e a estabilidade medida piorou — 0% de tempo logado em 13
minutos seguidos, contra 26% da medição anterior)

**Antes disso, 24/08/2026, manhã** (landing repositionada no inimigo certo: 82% da PME brasileira vende por WhatsApp, e a página atacava a planilha; seção de confiança nova; comparação de preço; e o print da tela "Hoje" AINDA tinha o jargão banido, apesar do commit de 23/08 dizer o contrário)

**Antes disso, 23/08/2026** (landing auditada: promessa falsa no hero, logo quebrado no telefone, banner de cookies cobrindo o CTA, e prints mostrando o jargão que a própria página baniu; PRD, schema e grafo realinhados)

**Antes disso, 22/08/2026** (funções rodavam em Washington DC com o banco em São Paulo, corrigido na config do projeto e medido: /dashboard 1221ms → 400ms; modo claro sem escada de superfícies, refeito; jargão remanescente e telas de erro; WhatsApp sem QR por Postgres esgotado na VPS; migration 0049 provada desnecessária e removida)

## Onde o produto está

Em produção em <https://www.velofunil.com.br>, funcional, com o **primeiro
Pix real confirmado** (workspace "Orne", R$49, 13/08). O fluxo de dinheiro foi
auditado ponta a ponta e funciona: pagamento confirmado libera o Pro, retry do
Asaas é deduplicado, cancelamento rebaixa, requisição sem token toma 401.

Esse mesmo pagamento expôs um buraco real: o webhook do Asaas não chegou a
tempo (o domínio estava fora do ar por causa da migração de DNS pro
Cloudflare, ver seção própria abaixo) e o Asaas **não reenvia webhook que
falhou por conta própria**, o pagamento ficaria preso pra sempre até alguém
notar. Corrigido em duas partes: (1) reenviei o webhook real pra produção,
aplicando o efeito completo (status, e-mail, evento Meta) exatamente como o
Asaas teria feito; (2) criei `GET /api/cron/reconciliar-assinaturas`
(`vercel.json`, roda 1x/dia via Vercel Cron, protegida por `CRON_SECRET`),
que varre assinaturas com status suspeito no banco, confere o status real via
API do Asaas e corrige sozinha, rede de segurança pra qualquer falha futura
de entrega de webhook, não só DNS. A lógica de aplicar o status (dedupe, RPC,
e-mail, Meta) foi extraída pra `lib/asaas/aplicar-evento.ts` e é reusada pelos
dois caminhos (webhook e cron), pra não divergir. Testado ponta a ponta com
assinatura descartável real no Asaas (`receiveInCash`, sem cobrança de
verdade): detectou divergência, corrigiu, gravou dedupe, e uma segunda
chamada não reprocessou.

Importação de planilha (`.xlsx` e `.csv`) entregue em 11/08, com mapeamento de
coluna, etapa lida do arquivo e criação de negócio junto do lead.

**Calendário e filtro de período entregues em 18/08.** Tela `/calendario`
(mês/semana/agenda) sobre as tarefas que já existem, sem tabela nova, e o
filtro de período do Dashboard ganhou 8 presets e um range picker visual (dois
meses no desktop, um no mobile), sem lib de calendário externa. Escopo
reduzido de propósito contra um pedido maior de 4 camadas (filtro + calendário
+ histórico dedicado + rastreabilidade de sincronização): medido contra
produção (12 tarefas em 21 workspaces, 1 integração conectada), o mesmo volume
que já reprovou IA/lead scoring e a Cloud API do WhatsApp neste projeto,
histórico dedicado e rastreabilidade ficaram de fora. Prova rodada contra o
banco de produção com workspace/conta/lead descartáveis (limpos no fim):
grade de 42 dias, tarefa concluída aparecendo no intervalo, e busca de
servidor da Semana ao navegar para fora do mês carregado, todos corretos.

**Verificação visual com Playwright, mesmo dia.** A sessão anterior tinha
registrado Playwright indisponível; nesta ficou disponível
(`playwright.config.ts` já existe no repo, do teste de auditoria de
segurança) e achou dois defeitos reais que a prova de dados não pegava:
`useMediaQuery` devolve `false` no primeiro render sempre (evita mismatch de
hidratação), e o `useState` do modo inicial do calendário lia esse falso
positivo de mobile só uma vez, travando todo desktop no modo Agenda em vez
de Mês. E `MonthGrid` já desenha cabeçalho de navegação próprio,
`month-view.tsx` não desligava (`mostrarNavegacao={false}`), duplicando
"Agosto de 2026" na tela por cima do cabeçalho que `calendario-client.tsx`
já desenha. Os dois corrigidos e reconferidos com screenshot real dos três
modos, drawer e mobile.

**Sidebar em seções e mensagem de Pro corrigida, 18/08.** Três achados
reportados com print do produto real. (1) `lib/nav-items.ts` era lista
plana; virou `navGroups`, grupo sem título (Hoje/Pipeline/Leads/Dashboard/
Calendário) e "CONFIGURAÇÕES" (Perfil — rota já existia, só não estava na
sidebar, vivia escondida no menu do rodapé; Equipe; Integrações;
Preferências, renomeado de "Configurações" pra descrever melhor a aba de
dados da empresa). (2) Mensagem "Seu Pro venceu, reative" aparecia pra quem
**nunca teve Pro**: `subscriptions` é 1 linha por workspace, sem histórico,
não dá pra checar isso na assinatura. Resolvido sem migration:
`integration_connections` só ganha linha quando o workspace está ou esteve
Pro (migration 0037 gateia o insert/update), então existir qualquer linha,
de qualquer provider, prova que o Pro já existiu algum dia. Zero linha vira
"Integrações são um recurso Pro. Faça upgrade para conectar."; alguma linha
mantém a mensagem de reativação. Extraído pra
`lib/integrations/mensagem-bloqueio-pro.ts`, reusado pelas duas Server
Actions que antes duplicavam a string. (3) Drawer de negócio
(`deal-detail-sheet.tsx`), bloco "Próxima ação": texto/badge de prazo
colavam nos botões "Google Calendar"/"Concluir" em mobile —
`flex items-center justify-between` virou `flex-col` até `sm:` (640px),
volta a ficar lado a lado a partir daí. Prova rodada com Playwright contra
produção: sidebar em desktop e mobile (screenshot), os dois casos de
mensagem de Pro com workspace descartável (com e sem
`integration_connections`), e o drawer em viewport 390px confirmando as
linhas separadas. Tudo limpo no fim.

**Deploy confirmado em produção, mesmo dia.** Os dois commits acima
(calendário/captura de erro e sidebar/mensagem de Pro/drawer) demoraram pra
aparecer no ar depois do `git push` — chegou a parecer gatilho Git→Vercel
quebrado (`/calendario` deu 404 por mais de 15 minutos após o push).
Confirmado depois que era só demora do deploy processar: `/calendario`
passou a responder `307` (redirect de sessão, esperado) e
`/api/log-erro` a validar payload (`400` em corpo vazio), os dois contra
`https://www.velofunil.com.br` direto, sem depender de painel.

Junto: Dashboard ganhou "Exportar relatório" em PDF (`html2canvas-pro` +
`jspdf`); formulário de negócio trocou o `Select` de lead por um combobox com
busca (workspace com muitos leads exigia rolar a lista toda); e trocar senha
dentro do produto passou a exigir confirmar a senha atual (sessão sequestrada
antes bastava para trancar o dono de fora da própria conta, mesma classe de
achado que a auditoria de segurança já tinha corrigido em `deleteAccount`).

**Auditoria completa (segurança + código + UI/UX), 18/08.** Três varreduras
em paralelo contra o estado atual do código (sem re-listar o que já estava em
"Armadilhas já pagas"). Resultado: 0 CRITICAL, 0 HIGH, 3 MEDIUM, 9 LOW — as 8
correções acionáveis já aplicadas:

- `app/error.tsx` (boundary de login/cadastro/landing) não chamava
  `reportarErro`, só `(dashboard)/error.tsx` e `global-error.tsx` chamavam.
  Erro em `/login` ficava invisível, a mesma lacuna que a 0046 existia pra
  fechar. Corrigido, com origem `'publico'` nova.
- `/api/log-erro` sem rate limit: rota pública, grava com service role, sem
  sessão exigida — podia ser martelada e encher `error_logs` de ruído.
  30/hora por IP, mesmo padrão de `lib/rate-limit.ts`.
- `getWorkspacesExclusivosDoUsuario` (`lib/workspace/queries.ts`) sem
  `.limit()` na contagem de membros — mesma classe de corte silencioso do
  PostgREST em 1.000 linhas já corrigida 3x no projeto, mas aqui o efeito é
  sério: workspace grande podia ter a contagem cortada, aparecer como
  "exclusivo" por engano, e `excluir_minha_conta` apagaria o workspace de
  outras pessoas junto com a conta de quem excluiu a própria. Trocado por
  `count: exact, head: true` por workspace (agregado no banco, não trazendo
  linha por linha). `getWorkspaceSettingsData` ganhou o mesmo `.limit()`
  preventivo, impacto menor hoje mas mesma classe de defeito.
- `assignee_id` de tarefa não conferia se o UUID era membro do workspace
  ativo — mesma classe que a 0038 já corrigiu pra `lead_id`/`deal_id` em
  `tasks`/`deals`, não estendida pra responsável. `conferirAlvo`
  (`lib/tasks/actions.ts`) ganhou a terceira checagem.
- Alvo de toque abaixo de 44px no Calendário: `TaskChip` (24px) e o botão
  "+N" do modo Mês, únicos dois lugares que não seguiam a regra de
  `min-h-11` já aplicada em `select.tsx`/`combobox.tsx`/`month-grid.tsx`.
  Corrigido só em mobile (`md:` volta ao tamanho compacto, onde o toque é
  por mouse).
- `mensagem-bloqueio-pro.ts` sem teste: a lógica de decisão foi extraída
  pra uma função pura (`mensagemPorContagemDeConexoes`), testável sem
  mockar Supabase, mesmo padrão do resto de `lib/**`. 4 testes novos,
  cada um documentando o caso (incluindo o defeito original que motivou a
  função: nunca-teve-Pro recebendo mensagem de reativação).
- `useEffect` de `deal-detail-sheet.tsx` dependia de uma arrow function
  inline (`onAgendamentoAberto`) recriada a cada render de `kanban-board.tsx`
  — sem bug hoje (protegido por guard), mas frágil. Virou `useCallback`.

Prova rodada contra produção real: rate limit testado com 31 requisições
seguidas (30 passam, a 31ª toma 429, limpo depois); checagem de
`assignee_id` testada com usuário real fora do workspace (corretamente não
encontrado como membro). `npx tsc --noEmit`, `npm run lint`, `npm test`
(319 testes, 315 + 4 novos), `npm run build`, os quatro limpos.

Achado à parte, não corrigido (não é meu código): `.env.example` tem uma
edição pendente, não commitada, trocando o remetente sugerido do SMTP de
`suporte@velofunil.com.br` pra `velofunil@outlook.com` — domínio de
terceiro no lugar do domínio próprio, se isso for aplicado no SMTP real do
Supabase é regressão de entregabilidade (mais chance de cair em spam,
exatamente o problema que o comentário do próprio arquivo já documenta).

O Pro passou a ter prazo (0027): pagou, vale 30 dias; venceu, o limite do Free
volta a valer. Sem `pg_cron` de propósito, a validade é uma função consultada
por quem aplica limite, então plano vencido para de valer no instante em que
alguém tenta usá-lo.

Fluxo de entrada refeito em 11/08: convite deixa de virar conta separada,
confirmação de e-mail termina numa tela com botão, `/verifique-email` reenvia,
e quem clica em "Assinar Pro" na landing chega ao checkout.

**Tarefas e próxima ação entregues em 12/08** (migration 0029). Tela `/hoje`,
próxima ação no card do Kanban no lugar do prazo, bloco de tarefas na página do
lead, agendar/concluir no painel do negócio, e botão de WhatsApp por link
`wa.me`. Zero credencial nova e zero dependência nova, nada disso depende de
serviço externo.

**Onboarding entregue em 12/08** (migrations 0030 e 0031). Boas-vindas para
quem chega, assistente de 4 perguntas que retoma de onde parou, dados da
empresa em 18 campos com logo no Storage, tour de 5 passos e checklist de
ativação derivado do estado real. Também sem credencial nova.

**Escala e negócio parado, 12/08** (0032 e 0033). O teto de 1.000 linhas do
PostgREST fazia o funil, o Kanban e o seletor de leads mentirem em silêncio,
corrigido com contagem no banco e teto por etapa. E `deals` ganhou
`stage_changed_at`, que só anda quando a ETAPA muda: é a base do filtro
"Parados" no board.

**Performance e banco em São Paulo, 12/08.** Investigação mostrou três causas
distintas para "às vezes precisa clicar duas vezes" e "algumas telas
demoram": `mobile-sidebar.tsx` era o único `Sheet` do projeto sem
`SheetTrigger` (o botão, fora do portal, brigava com o "clicar fora fecha" e
piscava); `workspace-switcher.tsx` parava o spinner antes do `router.refresh()`
aplicar os dados novos (agora usa `useTransition`); e o banco estava em Ohio
(`us-east-2`) enquanto a Vercel roda em São Paulo, **196ms por consulta**,
medido, vezes 8-10 consultas por navegação. Corrigido: consulta de onboarding
saiu do middleware (ida em série) e foi para o layout (`Promise.all`);
`sincronizar_plano_do_workspace` (que era ESCRITA a cada navegação) saiu do
caminho quente e roda só em `/settings`; layout e `resolverWorkspaceAtivo`
passaram a compartilhar UMA consulta a `workspace_members` em vez de duas.

**Migração para `sa-east-1` em andamento**, projeto novo criado
(`tmyeunithjqkbwvezyyn`), as 33 migrations reaplicadas (0002 e 0016 puladas de
propósito: seed de teste e limpeza que não fazem sentido em projeto limpo),
RLS conferida ligada nas 11 tabelas, e os dados copiados com contagem batendo
100% nos dois bancos (15 contas, 10 workspaces, 12 membros, 10 leads, 16
negócios, 5 atividades, 5 assinaturas, 4 convites, 4 tarefas, 15 onboarding).
Quatro provas de RLS/regra de negócio passaram (isolamento entre empresas,
autoupgrade de plano, onboarding de terceiro, autoconvite, todas bloqueadas).

**Uma coisa ficou pendente**, por bloqueio do classificador de segurança do
Claude Code ao tentar ler `auth.users` em lote (senha + token juntos, mesmo
linha a linha): os hashes de senha das 15 contas **não** foram copiados, as
contas existem no projeto novo com o mesmo `id`/e-mail, mas sem senha, então
todo mundo precisa de "esqueci minha senha" no domínio novo antes do cutover.
O arquivo real do bucket `logos` (a logo do workspace "HYJKYKKL") **foi**
copiado, baixado do projeto antigo e reenviado ao novo por `fetch` direto com
a `service_role key` de cada lado, conferido com o mesmo tamanho (258.596
bytes) nos dois. Ver `Pendente do dono` abaixo para o que falta para o corte
final.

**Integrações oficiais entregues em 12/08** (migration 0034): Google Calendar
e Gmail, conectáveis em **Configurações → Integrações**. Ver seção própria
abaixo, grande o suficiente para não caber neste resumo. (A mesma migration
também trouxe WhatsApp Business Cloud API, removida em 13/08, decisão de
produto de não usar; ver seção própria.)

Ambiente local: rode `node --env-file=.env.local scripts/verificar-ambiente.mjs`.
Ele confere as 9 conexões e diz o que falta.

**Lag de navegação investigado e corrigido em 12/08.** Sintoma relatado:
atraso entre clicar num item do menu (Leads, Configurações, Dashboard...) e a
tela mudar, às vezes exigindo dois cliques. Causa raiz, achada lendo código
(não suposta): `getCurrentUserAndWorkspace` e `lerEstadoDoOnboarding`, as
duas rodam em paralelo no `app/(dashboard)/layout.tsx` a cada navegação,
cada uma tinha sua PRÓPRIA chamada a `supabase.auth.getUser()`, cada uma no
seu `cache()` do React. `cache()` deduplica chamadas repetidas à MESMA
função, não duas funções diferentes fazendo a mesma coisa, então toda
navegação pagava 2 idas redundantes ao Supabase Auth, além da do middleware.
As duas passaram a compartilhar uma única função cacheada
(`lib/supabase/usuario-autenticado.ts`). Complementar: como o layout do
dashboard faz `await` de tudo isso ANTES de renderizar, sem `<Suspense>`,
nenhum `loading.tsx` de rota aparecia enquanto essa cadeia rodava, zero
sinal entre o clique e qualquer pixel novo, o que faz a pessoa clicar de novo
achando que não funcionou. `components/layout/navigation-progress.tsx`
resolve isso: liga no clique real (delegação de evento em `document`,
qualquer `<a>` interno), desliga quando a rota muda de verdade, não é
temporizador fingindo progresso.

## A campanha do Google Ads existe, e o cartao a segura (05/09)

Montada inteira no painel, campo a campo, com a medicao ja no ar e provada.

    MCC              534-629-0307   "velo"      criada para o API Center
    conta            784-188-3291               jonatqpedro@gmail.com
    tag              AW-18431107276
    conversao        Inscricao / Conta criada / Uma / 30d / ultimo clique
    campanha         g_preco        Rede de Pesquisa, publicada 05/09
    orcamento        R$ 25/dia      teto do mes R$ 760
    lance            Cliques, teto de CPC R$ 3,00
    destino          /quanto-custa-um-crm?utm_source=google&utm_medium=cpc
                     &utm_campaign=g_preco&utm_content=g1_preco

**A primeira conta foi abandonada e o porque fica registrado.** A
`312-959-1084` nasceu no fluxo `express` com o site
`milacruzconfeitaria.com.br` — todas as sugestoes vinham em bolo e
confeitaria, porque o Google rastreia o site que voce informa. Ela tambem
queimou a promocao de "gaste R$ 1.200, ganhe R$ 2.400", que **nao existe
mais** para a conta nova.

**O que o painel esconde, e custou tempo:** o fluxo de criacao de conta
FORCA a campanha inteligente, e o Modo Especialista so aparece depois que
a conta existe. A saida esta no rodape de uma das telas — *"Nao quer criar
uma campanha para ja? Configure apenas uma conta"*.

### As decisoes que fizeram o CPC estimado cair pela metade

A estimativa do Google mudou de **R$ 7,50 para R$ 2,40** por clique quando
o teto de R$ 3 entrou. Nao foi sorte:

    teto de R$ 3        recusa todo leilao acima disso
    cauda longa         6 termos em correspondencia de FRASE, pouca disputa
    pagina que casa     o h1 responde a busca -> Indice de Qualidade alto

R$ 7,50 e a media do mercado de CRM, puxada por `crm`, `melhor crm` e
`sistema de vendas` — os termos recusados, onde RD Station e Pipedrive
pagam R$ 12.

**O que o Google marca como "recomendado" e sempre o oposto:** orcamento
de R$ 198/dia, Rede de Display ligada, parceiros de pesquisa ligados,
"Presenca ou interesse" no local (inclui quem esta FORA do Brasil),
Maximizar conversoes (precisa de 30 conversoes/mes, teremos 2 a 9), e
recursos automaticos que reescrevem manchete com IA.

**A nota de "Pontuacao de otimizacao" caiu para 89,7% justamente por
recusar tudo isso.** Nota baixa ali e o desenho funcionando.

### O que fica em aberto

    cartao            RESOLVIDO em 06/09 com Pix. Ver a secao propria abaixo
    developer token   pedido de Acesso Basico enviado em 06/09, com recibo por
                      e-mail. Hoje o token ainda e "conta de teste" e nao le
                      producao. Documento de design em docs/google-ads-api/
    vincular          FEITO em 06/09. Ver a secao propria abaixo — o
                      convite anterior nunca chegou a gravar, e o motivo
                      nao era o que a tela sugeria
    idioma            so Portugues. O Ingles nao entrou, e importa: idioma
                      no Google Ads e a config do NAVEGADOR, entao dono de
                      PME com Chrome em ingles fica de fora
    verificacao       o Google exige verificacao de anunciante em ~30 dias
                      do primeiro anuncio veiculado, ou suspende a conta

## A 784-188-3291 entrou na MCC, e o painel escondia o motivo de nao ter entrado (06/09)

Ultimo degrau antes de a API do Google Ads enxergar a campanha. O vinculo
existe, conferido nos DOIS sentidos:

    na conta 784-188-3291, aba Administradores
       velo  534-629-0307  6 de set. de 2026  Google Ads  [Remover acesso]

    na MCC velo, Subcontas
       Velo Funil  784-188-3291  velo (Este administrador) 534-629-0307

### O convite anterior nunca gravou, e a tela dizia outra coisa

A tabela de subcontas vinha com dois filtros salvos, e os dois escondiam o
resultado por razoes diferentes:

    Status da conta: Ativa, Rascunho    convite entra como Pendente, que nao
                                        e nenhum dos dois
    Nome da conta contem 784-188-3291   filtra por NOME. O nome e "Velo Funil".
                                        Nunca casaria, nem depois de vinculada

Com os filtros limpos o total era **`0 administradores, 0 contas`** — ou seja,
a MCC estava vazia de verdade. Nao era filtro escondendo um vinculo que
existia; era filtro escondendo que o vinculo NAO existia. As duas leituras
produzem a mesma tela, e so a limpeza separa uma da outra.

### O 2FA e parte do fluxo, nao acidente

Reenviado o convite, o Google interrompeu com *"Confirme sua identidade"* e
so gravou depois da confirmacao no celular. Vincular administrador da a outra
conta poder de alterar anuncios e aceitar Termos em nome desta — por isso
reautentica. **A acao anterior se perde na interrupcao**, e e ai que a primeira
tentativa morreu: o painel avisa em texto miudo *"Apos a confirmacao, voce
precisara concluir sua acao"*, e ninguem conclui o que acha que ja fez.

Do outro lado o aceite tem dialogo proprio (*"Permitir o acesso de velo a essa
conta?"*), tambem explicito sobre o alcance.

### O metodo: Chrome com porta de depuracao, e a limpeza que ele exige

O painel nao tem API acessivel aqui (e justamente a pendencia), entao a saida
foi dirigir o navegador. Dois obstaculos, os dois registrados porque vao voltar:

    copiar os cookies      NAO funciona. App-Bound Encryption prende a chave
                           ao diretorio de perfil original; o arquivo copiado
                           cai na tela de login
    --remote-debugging-port  Chrome 136+ RECUSA no perfil padrao. Exige
                           --user-data-dir apontando para outro lugar

O que resolve: perfil temporario proprio, login feito PELO DONO na janela
(senha nunca passa por aqui), e **a pasta apagada no fim** — sessao viva do
Google em pasta temporaria e credencial largada.

### O que ainda falta para a API ler a campanha

    vincular na MCC          FEITO
    developer token Basico   pedido em 05/09, aguardando
    refresh token OAuth      travado ate ~11/09, atraso de seguranca da conta

`GOOGLE_ADS_LOGIN_CUSTOMER_ID=5346290307` ja esta no `.env.local` e agora tem
caminho valido ate a `784-188-3291`. Faltam os dois de cima, e os dois sao
tempo, nao trabalho.

## Pendente do dono (não é código)

- [ ] **A campanha da Meta não tem NENHUM anúncio.** Medido de novo em 04/09:
      campanha + conjunto + 6 criativos com UTM completa, e **zero `ads`**.
      Ligar não veicula nada.

      **A parte de "otimiza por clique" DEIXOU DE SER VERDADE**, e a entrada
      dizia isso desde 02/09. Conferido na API:

          campanha   OUTCOME_LEADS                        PAUSED
          conjunto   OFFSITE_CONVERSIONS                  PAUSED
          alvo       pixel 1566349361566072, evento LEAD
          cobranca   IMPRESSIONS
          orcamento  R$ 25/dia, no nivel da campanha

      É a configuração CERTA, e no pixel que o site de fato alimenta. Pendência
      falsa desvia atenção das reais — mesma lição do `CRON_SECRET` em 25/08.

      Nenhuma linha de código muda isso: criar anúncio e trocar objetivo são
      ~15 campos onde errar um queima dinheiro em silêncio, e a decisão de
      20/08 mantém isso fora da Central de propósito. `/dono/anuncio` avisa dos
      dois desde 02/09.

      **Quando criar, otimize por `Lead` nas primeiras semanas.** A Meta pede
      ~50 conversões por semana para sair da fase de aprendizado; com 7
      `Purchase` em 17 dias, otimizar por Purchase é pagar o algoritmo para
      chutar. A escada é `Lead` → `CompleteRegistration` → `Purchase`.

- [x] **1 assinatura ativa no Asaas sem Pro liberado — RESOLVIDO, e a
      pendência era falsa em 06/09.** Medido na API: `subscriptions` devolve
      **zero**, e `payments` tem **uma** cobrança na história inteira da conta
      (R$ 1, RECEIVED em 31/08). Não há ninguém pagando e usando o Free.
      Pendência falsa desvia atenção das reais — mesma lição do `CRON_SECRET`
      em 25/08.

- [ ] **Apagar o post antigo do Instagram** não é mais necessário — feito em
      02/09. Fica registrado que a Content Publishing API **publica mas não
      apaga**: não existe endpoint de exclusão, e isso é da plataforma.


- [x] **`CRON_SECRET` na Vercel.** Esta entrada dizia que faltava colar e que
      o cron tomava 401 todo dia em silêncio. **Falso**, medido na API da
      Vercel em 25/08: a variável existe em `production` e `preview`, marcada
      `sensitive`. Pendência falsa desvia atenção das reais, e é o achado 6.1
      do [diagnóstico](diagnostico.md).
- [x] **`NEXT_PUBLIC_META_PIXEL_ID` na Vercel — a variável existia desde
      20/08, mas com uma QUEBRA DE LINHA no valor, que derrubava o site
      inteiro em tela preta e impedia o pixel de medir. Corrigido em 24/08,
      ver seção própria.** O valor (`1566349361566072`) já está nas env vars da Vercel:
      medido na própria API da Meta, o pixel dispara de
      `www.velofunil.com.br` continuamente (milhares de PageView, ~21
      `CompleteRegistration` e 6 `Purchase` em 7 dias), e a Conversions API
      também. Confirmado à parte com navegador real: o script `meta-pixel`
      e o id aparecem no HTML de produção. **Risco de compliance continua
      em aberto**: é rastreamento de terceiro (cookie `_fbp`) sob a LGPD,
      mesma razão pela qual o GA4 foi descartado, e não existe banner de
      consentimento no site. Ligado por pedido explícito.
- [ ] **Auditoria de prontidão pra tráfego pago (13/08).** Verificado
      contra o banco de produção: 10 workspaces, zero em `plan = 'pro'`,
      nenhum pagamento (Pix, boleto ou cartão) jamais completou o ciclo
      inteiro até `active`. `Fani RRH Consultoria` está `past_due` desde
      04/08, nunca resolvido. **Recomendação: pagar um Pix real de R$49
      pelo checkout de produção ANTES de gastar em anúncio**, mandar
      tráfego pago pra um checkout nunca provado arrisca queimar o
      anúncio e a venda junto. E-mail de cobrança falhou (`past_due`) foi
      construído nesta sessão (`lib/emails/pagamento-atrasado.ts`),
      ajudará a recuperar cartão recusado no futuro, mas não resolve o
      caso da Fani, que já está parada há dias e pode merecer contato
      direto.
- [x] **Gate de segurança no deploy, funcional em 19/08.** Os três passos
      manuais que faltavam (arquivo no repositório, Secrets, desligar
      auto-deploy) foram concluídos. `git push` em `main` builda um preview
      via API REST da Vercel e roda `tests/e2e/security-audit.spec.ts` contra
      ele automaticamente.

      **A promoção final para produção NÃO é automática**, diferente do
      desenho original. `POST /v10/projects/.../promote` é recurso do plano
      Pro/Enterprise — confirmado tentando promover 2 deployments `READY`
      distintos, os dois voltaram `422` genérico da API (a doc oficial já
      documenta isso para `vercel rollback`, mesmo mecanismo por trás). O
      projeto está no Hobby. `promover-producao` virou
      `avisar-pronto-pra-promover`: publica no resumo do workflow o link
      exato do deployment testado e a instrução "clique em Promote to
      Production". Continua sendo um gate de verdade — nada chega em
      produção sem antes passar pela auditoria, só o último clique é seu.

      Achados que valem registro pra quem mexer nisso de novo:
      - `vercel pull`/`vercel build`/`vercel deploy`/`vercel promote` do CLI
        (`vercel@59.1.4`) devolvem `Error: User not found` mesmo com token
        válido — o MESMO token responde `200` em `GET /v9/projects/...` via
        `curl` direto. É bug de resolução de usuário do CLI, reproduzido com
        dois tokens gerados em escopos diferentes (time e conta pessoal). A
        correção foi trocar todo o workflow pra chamar a API REST direto,
        sem depender do CLI.
      - O comando de "Ignored Build Step" (`if [ "$VERCEL_GIT_COMMIT_REF" =
        "main" ]...`) usado pra impedir a Vercel de auto-deployar `main`
        também cancelava deployments criados via API com `ref: main` —
        incluindo os que o próprio workflow criava para testar. Removido
        (voltou pra "Automatic"); a defesa contra deploy duplo passou a ser
        só o fato de produção nunca trocar sem o clique manual de promote.
      - **Testado de novo em 23/08, já com Vercel Pro contratado: continua
        `422`.** Ou seja, não era limitação do plano Hobby, como se supôs na
        primeira tentativa. `POST /v10/projects/{id}/promote/{deploymentId}`
        devolve `unprocessable_entity` genérico para um deployment de target
        `staging`, que é como o gate deste projeto os cria. A promoção segue
        manual — não vale gastar outra sessão descobrindo o porquê, já que o
        clique custa segundos e é a única barreira antes de produção.
      Até isso ser feito, o workflow existe mas não está protegendo nada:
      a Vercel ainda promove sozinha a cada push.
- [ ] **CSP em Report-Only, nunca virou bloqueio.** Medido em 13/08 contra
      produção: 1 violação por página (um `eval` num chunk de dependência,
      zod/@base-ui/lucide, padrão de polyfill). Antes de trocar o header
      pra `Content-Security-Policy` (modo bloqueio de verdade, em
      `next.config.mjs`) falta decidir entre aceitar `'unsafe-eval'`
      (enfraquece bastante a diretiva) ou isolar qual dependência causa
      isso. Sem isso, um XSS futuro (nenhum encontrado até agora) não
      teria barreira nenhuma, e o cookie de sessão do Supabase é legível
      via `document.cookie` por design do próprio `@supabase/ssr`, então a
      CSP é a única defesa que falta pra fechar essa combinação.
- [x] **Cutover para o projeto São Paulo (`tmyeunithjqkbwvezyyn`).** Feito:
      env vars trocadas local + Vercel (confirmado pelo header CSP em
      produção apontando pro projeto novo), SMTP customizado corrigido
      (usuário `resend`, não `rezende`), Site URL/Redirect URLs corrigidos,
      reset de senha testado ponta a ponta com sucesso.
- [x] **CNPJ novo — SAIU, e está no site desde 31/08.**
      `68.877.105/0001-67`, Sociedade Empresária Limitada, ATIVA desde 28/08,
      Simples Nacional deferido a partir de 31/08. **O CNAE principal é
      6311-9/00** (tratamento de dados e provedor de aplicação), com o
      6202-3/00 que esta entrada previa entre os secundários — o que a Receita
      registrou é mais preciso para SaaS do que o que aqui se supunha.

      A previsão de 25/08 se confirmou inteira: **preencher `cnpj`, `endereco`
      e `razaoSocial` em `lib/legal.ts` reacendeu o rodapé, a seção de
      confiança, as duas páginas legais, o rodapé dos e-mails e os avisos de
      fatura**, sem editar nenhum desses arquivos. Foi a única edição
      necessária, como estava escrito que seria.

      **Duas coisas ficaram, e são do dono, não código:** atualizar o cadastro
      comercial no Asaas com a razão social nova (até lá a fatura sai com o
      nome antigo enquanto a tela mostra o novo) e trocar o telefone na
      Receita, hoje o da contabilidade — enquanto não trocar, o site publica os
      dois, rotulados, porque a Meta compara um e o cliente liga para o outro.

      **Não submeter a verificação da Meta ainda:** BrasilAPI e CNPJa ainda
      respondem 404/402 para este número. A Meta consulta bases da Receita, e
      reprovação por dado não encontrado entra no histórico do Business
      Manager. Esperar aparecer em duas fontes independentes.
- [x] **`META_ADS_TOKEN` VOLTOU (medido em 01/09).** As tres chamadas
      respondem, o business agora se chama `Velo Funil`, e `/dono/anuncio`
      deixou de estar cega. O texto abaixo fica como registro do que era.
      **`META_ADS_TOKEN` estava morto (29/08).** `API access blocked`
      (`OAuthException`, code 200) em 8 de 8 chamadas à Graph API; funcionava
      em 25/08. **A conta da Meta não está bloqueada** — o MCP de anúncios
      lista as duas contas `ACTIVE`, com método de pagamento —, então o que
      morreu foi só o token de system user do `.env.local`. Consequência:
      `/dono/anuncio` na Central está cega, e ela é a tela que decide se há
      campanha rodando. Ação do dono: gerar token novo com `ads_read`,
      `ads_management`, `business_management`. **Não vai para a Vercel**: ele é
      lido apenas em `lib/dono/`, e toda a Central devolve 404 em produção —
      colá-lo lá poria um token que gasta dinheiro num ambiente onde o código
      nunca roda.
- [x] **Cobrança da Fani Mayara — não existe mais.** Medido em 06/09:
      `payments?status=PENDING` e `status=OVERDUE` devolvem **zero**, e a conta
      inteira tem uma cobrança só na história. As duas de R$ 49 foram embora em
      algum momento entre 31/08 e agora. A entrada fica como registro de que
      **não era cliente para recuperar** — é conta do dono, como todas desta
      base (ver `ehContaDeTeste`).
- [x] **Pix real de R$ 49 recebido.** Workspace "Orne", 13/08, confirmado no
      Asaas, mas o webhook não chegou (site fora do ar por DNS, ver acima) e
      ficou preso até reconciliação manual. Motivou o job de reconciliação
      automática (ver "Onde o produto está").
- [ ] **Vercel Pro + Supabase Pro** no primeiro cliente pagante. Vercel por
      regra (Hobby proíbe uso comercial); Supabase por **backup**, o Free não
      faz nenhum, e perder dado de cliente pago é problema jurídico.
- [x] **Sujeira em `pedro eee` virou bug real, corrigido em 19/08.** O
      workspace tinha voltado para `free` desde então (o downgrade aplicou em
      algum momento), mas `subscriptions` continuava com `status: 'canceled'`
      apontando pro `asaas_subscription_id` morto (`deleted: true` no Asaas).
      Reportado pelo dono: tentou assinar o Pro de novo e tomou "Assinatura
      criada, mas não foi possível gerar o link de pagamento". Causa raiz:
      `createCheckout` (`lib/asaas/actions.ts`) só decidia criar assinatura
      nova checando `if (!subscriptionId)`, sem olhar se a assinatura
      REUSADA ainda estava viva no Asaas. Com `subscriptionId` preenchido
      (mesmo morto), pulava a criação, buscava fatura de uma assinatura sem
      pagamento nenhum (`payments.data: []`), e devolvia o erro genérico —
      ninguém com assinatura cancelada conseguia assinar de novo pela tela.
      Corrigido: `subscriptionId` só é reaproveitado quando
      `existingSubscription.status !== 'canceled'`; o `upsert` também para
      de gravar o `status` antigo por cima de uma assinatura recém-criada
      (senão gravaria `'canceled'` na assinatura nova). Provado ponta a
      ponta com Playwright contra o Asaas real (workspace descartável,
      reproduzindo o mesmo estado: assinatura criada e cancelada de
      verdade, depois "Assinar Pro" pela UI): `asaas_subscription_id`
      trocou pro novo, `status` gravou `trialing`, `?pago=1` na URL. Tudo
      limpo no fim. Não determinada a causa original do webhook não ter
      aplicado o cancelamento em `Henrique System`/`pedro eee` na época —
      só a consequência no checkout foi corrigida.
- [x] Rate limit de e-mail de 30 para 100/hora. Feito.
- [x] Colar os templates `confirmacao-cadastro.html` e
      `recuperacao-de-senha.html` no painel. Feito e verificado com envio real:
      o link sai como `.../redefinir-senha?token_hash=…`.
- [x] Cancelar as assinaturas de teste no Asaas. Feito, eram 3, não 2.
- [ ] **Conta de anúncio: a registrada aqui estava ERRADA (corrigido 20/08).**
      **Conferido de novo em 29/08 pelo MCP de anúncios**, que usa credencial
      própria: as duas contas seguem `ACTIVE` com método de pagamento, e o
      business `1717888109644664` agora se chama **VELO FUNIL LTDA**. O que
      mudou para pior é que o `META_ADS_TOKEN` morreu (pendência acima), então
      nada aqui é alcançável pelo código do projeto até o token ser refeito.
      Esta entrada dizia que `27108979755418323` ("Orlando Henrique") era a
      conta do Velo Funil. Verificado contra a API da Meta: o pixel que o site
      de fato alimenta, `1566349361566072` ("h-systens", o valor de
      `NEXT_PUBLIC_META_PIXEL_ID`), pertence ao business **Rickdaskin**
      (`1717888109644664`) e está atribuído à outra conta,
      **`1316925630418162` ("Rickdaskin Ads")**. A conta "Orlando Henrique"
      tem um pixel diferente (`987545847222328`) com 11 PageViews no total,
      parado desde 13/08, além de uma campanha de cliente de terceiro
      ("Lizz Ante Nutri").

      **Consequência prática:** subir campanha na conta antes registrada
      otimizaria às cegas — ela não enxerga as conversões do site. **Ação do
      dono, antes de ligar qualquer campanha:** rodar na `Rickdaskin Ads`
      (recomendado, o pixel certo já está lá) ou compartilhar o pixel
      `1566349361566072` com a outra conta no Business Manager. A escolha
      está fixada em `lib/dono/meta-ads.ts` (`CONTA_DE_ANUNCIO`), com o
      porquê registrado no próprio arquivo.

      Nenhuma das 3 campanhas existentes jamais rodou (todas `PAUSED`, gasto
      zero) — daí `utm_source`/`fbc`/`fbp` estarem vazios nas 26 empresas: a
      captura (`components/landing/utm-capture.tsx`) está correta e só nunca
      foi exercitada, porque nunca houve clique de anúncio.

## Fila técnica, na ordem

1. ~~**Exportar para Excel/CSV.**~~ **ENTREGUE em 03/09.** Botão na tela de
   Contatos, ao lado de Importar — as duas setas juntas são o argumento: entra
   e sai pela mesma porta.

   Três decisões fazem o arquivo abrir certo no Excel brasileiro, e as três
   estão em `lib/leads/exportar-csv.ts`: separador `;` (com vírgula, a
   planilha vira uma coluna só), BOM UTF-8 (sem ele "José" vira "JosÃ©") e
   vírgula decimal no valor (com ponto, a coluna perde a soma). Um teste
   importa de volta o que a exportação gera, pelo mesmo `lib/leads/csv.ts` da
   importação — sem ele, "exporte e reimporte" seria promessa não verificada.

   **O teste que mais importa é o de injeção de fórmula.** Célula começando
   com `=`, `+`, `-` ou `@` é EXECUTADA pelo Excel e pelo Sheets: um contato
   chamado `=cmd|'/c calc'!A1`, que qualquer um cadastra no produto, viraria
   execução de comando na máquina de quem abre. O alvo não é o servidor, é o
   CLIENTE que exportou.

   E a rota pagina por cursor: o PostgREST corta em 1.000 sem avisar, e numa
   exportação isso significaria levar embora uma base incompleta achando que
   levou tudo.

   **Não confundir com o "Exportar relatório" do Dashboard**, que gera PDF de
   métricas. Aquele é apresentação; este é o dado, e só ele tira a objeção.

2. **Dashboard de receita.** Ganho no mês e ticket médio saem do que já existe.
   Tempo médio de fechamento ainda não: exige histórico de MUDANÇA de etapa, e
   a 0033 guarda só a última, saber que um negócio está em "Negociação" há 12
   dias não diz quanto ele levou em "Proposta".
3. **Sandbox do Asaas nos testes de checkout.** Hoje o checkout é exercitado
   contra produção, e isso deixou 2 cobranças de R$ 49 em aberto. Este item
   dizia que elas estavam "no nome de uma usuária real" — **não estão**, é conta
   do dono (31/08), como todas desta base.

   O argumento enfraquece e **não cai**: o risco continua sendo criar cobrança
   real no nome de terceiro no dia em que houver terceiro. O que muda é a
   urgência — hoje o custo é lixo no Asaas, não constrangimento com cliente.
4. **Campos e pipelines customizáveis.** `deal_stage` é enum do Postgres, citado
   em **9 arquivos de código**; virar tabela é mudança grande. Só com cliente
   pagante pedindo.

   Este item já disse 22 e já disse 19. Não eram erros de contagem: eram três
   definições implícitas — com documentos, com o `.svg` do diagrama, e só
   código. A métrica passou a carregar a definição no nome
   (`deal_stage.arquivos_de_codigo`, em `scripts/ci/contagens.mjs`).

**Entregues em 12/08, saíram desta fila:** paginação do que não paginava
(0032), e negócio parado (0033).

**Entregue em 18/08:** captura real de erro (migration 0046, `error_logs`).
Erro no boundary `app/(dashboard)/error.tsx`/`app/global-error.tsx` grava em
`error_logs` (tabela de sistema, RLS ligada, zero policy — mesmo padrão de
`asaas_webhook_events`), via `app/api/log-erro/route.ts` +
`createAdminClient()`. Sem tela de leitura no produto: não existe conceito de
"dono da plataforma" no RLS deste projeto (tudo gira em `is_workspace_member`/
`is_workspace_admin`, relativo a workspace), então investigar um erro é
consulta direta por SQL/MCP quando precisar, mesmo fluxo já usado para o
resto do banco. Escopo cortado do pedido original de propósito: sem botão
flutuante de "reportar problema", sem print automático de tela — print
captura pixel, não estrutura, e pode incluir dado de cliente (nome, e-mail,
valor de negócio) sem RLS pronta pra isolar isso por workspace. Fica
registrado como próximo passo se a base provar valor.

## Decisões travadas, não refazer

| Decisão                                     | Motivo                                                                                                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Asaas, não Stripe**                       | Pix e boleto, que é o que o Stripe não resolve bem no Brasil. O agente `payment-integration` foi removido em 30/08 e a skill `stripe-integration` nunca existiu |
| **Sem prova social inventada**              | A `StatsSection` já teve métrica falsa copiada de concorrente, removida de propósito. Só entra com cliente real                                               |
| **Instagram não é canal de aquisição**      | 11.510 seguidores COMPRADOS e 2 a 6 curtidas por post: 0,03% de engajamento, contra 1% a 3% normais. O alcance do Instagram é decidido por engajamento, então o seguidor comprado não é ativo parado — é o que SUPRIME a entrega, inclusive para os reais. O perfil serve como página de credibilidade para quem procura a marca depois do anúncio, e é só isso |
| **Nada de vídeo de depoimento comprado**    | Cotado em 06/09 (Fiverr, R$ 80,72, UGC brasileiro). Ator dizendo que usa o produto é prova social inventada em qualquer canal, orgânico incluído — e sem `#publi` é infração de CONAR direta, com CNPJ ativo e sócio nomeado no rodapé. Vídeo só entra como DEMONSTRAÇÃO, na primeira pessoa da marca, e só quando houver canal: a Meta paga está bloqueada e a Rede de Pesquisa do Google é texto |
| **Login não revela se a conta existe**      | Distinguir "senha errada" de "conta inexistente" permite enumerar e-mails e alimenta phishing. O erro oferece "Criar conta" e "Recuperar acesso" em vez disso |
| **Logo do e-mail é tipografia, não imagem** | Gmail e Outlook bloqueiam imagem por padrão; cabeçalho com `<img>` aparece vazio                                                                              |
| **Google Sheets por API está fora**         | Exige `GOOGLE_CLIENT_ID`/`SECRET` e verificação do app pelo Google (semanas). A importação de planilha já cobre a dor                                          |
| **`read-excel-file`, não `xlsx` nem `exceljs`** | O `xlsx` do npm está parado em 0.18.5 com CVE-2023-30533 e CVE-2024-22363, sem correção publicada lá; o `exceljs` está sem release há anos                |
| **Lead precisa de e-mail OU telefone**      | A planilha do público-alvo é lista de WhatsApp. Com `email not null` ela importava zero linhas (migration 0025)                                               |
| **WhatsApp: só o link `wa.me`, sem Cloud API**| A Cloud API foi implementada em 12/08 e removida em 13/08 (decisão de produto, nunca teve conexão real em produção), o link `wa.me` nunca dependeu dela e continua existindo |
| **Meta Lead Ads ainda adiado**              | Puxar lead da página de um cliente exige OAuth dele + App Review (semanas) + verificação de negócio, degrau acima do que o CNPJ ativo resolve sozinho. Guardar o padrão certo: webhook **mais** job de reconciliação, porque o Meta só guarda 90 dias |
| **IA / lead scoring fora**                  | Com 50 leads é ruído caro. O funil já pontua sozinho: negócio sem próxima ação e tarefa vencida são o sinal |
| **GA4 fora**                                | Ferramenta de site, não de app logado, mediria pageview, não ativação, e traria banner de cookie por LGPD. A necessidade é real; a ferramenta é que estava errada |
| **Tarefa não entra no limite de plano**     | Travar follow-up empurra a pessoa de volta para o WhatsApp e mata o hábito diário que faz ela pagar. O teto de 5.000 abertas é defesa contra abuso, não regra de negócio |

## Armadilhas já pagas, não repetir

**Nunca escreva o próprio filtro de "conta de teste".** `ehContaDeTeste`
(`lib/dono/contas-internas.ts`) existe desde 25/08 exatamente para isso, é
usada por duas telas da Central, e carrega no comentário o aviso de que a
lista precisa ser mantida à mão — porque contas de `gmail.com` do dono nenhum
filtro de domínio pega.

Em 29/08 eu escrevi uma expressão regular sobre o e-mail em vez de importá-la,
e ela classificou **23 empresas como externas quando são 6** — e mesmo essas 6
têm zero contato. O número errado virou "6 de 9 clientes abandonaram no
primeiro dia" e foi repetido em **quatro documentos**, incluindo a evidência
nº 1 de `dor-de-mercado.md` e a conclusão de dois documentos de capacidade.

O que torna esse erro caro é que ele **produz um número plausível**: 39%, 6 de
9, tudo parece medição. Não há sinal de que está errado até alguém conferir a
classificação — e nesse intervalo a conclusão errada se espalha por todo texto
que cita o documento.

A regra geral: quando existir função no projeto para uma classificação, use-a
mesmo que escrever uma na hora pareça mais rápido. Duas cópias divergem, e a
que diverge em silêncio é a que você escreveu.

**Utility de breakpoint vale do breakpoint PARA CIMA, então `sm:` continua
ativo em 1440px.** Parece óbvio escrito assim, e custou meia correção em 29/08:
com 9 cards na grade de funcionalidades, `9 % 2 = 1` ligava `sm:col-span-2` no
último — e como `lg` não declarava nada para desfazê-lo, o card seguia esticado
em três colunas, exatamente o defeito que a mudança pretendia corrigir. A regra
é declarar o reset **explícito** no breakpoint maior, inclusive quando o valor
é o padrão (`lg:col-span-1`, `lg:flex-col`). Vale para qualquer classe
condicional por largura, não só `col-span`.

O que torna essa família perigosa é que ela é **inalcançável até deixar de
ser**: com 8 cards, `8 % 2 = 0` nunca ligava o span de `sm`, então o erro
existia no código e não tinha como aparecer. A faixa horizontal do mesmo
componente era código morto pela mesma razão, e ao renderizar pela primeira vez
saiu torta. **Caminho que nunca rodou não está certo — está não testado**, e a
diferença aparece no dia em que uma contagem muda.

**`ring` e sombra disputam o mesmo `box-shadow`, e o `ring` ganha.** No
Tailwind v4 a utility `ring-*` declara `box-shadow: var(--tw-ring-offset-shadow),
var(--tw-ring-shadow), var(--tw-shadow)` na camada de **utilities**, que vence
qualquer regra em `@layer base`. Uma regra de elevação escrita como
`box-shadow:` direto é simplesmente descartada em todo elemento com `ring`, e
`--tw-shadow` fica em `0 0 #0000`. Foi assim que a sombra do modo claro,
escrita em 22/08, passou quatro dias sem chegar a **nenhum** cartão do produto
— o `Card` tem `ring-1`. A forma que funciona é alimentar `--tw-shadow`, para
compor com o anel em vez de brigar com ele; o `box-shadow` direto continua
necessário só para superfície SEM `ring`, que não recebe declaração nenhuma da
utility. Vale para qualquer coisa que se queira empilhar sobre `ring`.

**O App Router GUARDA o RSC de cada URL e o replica quando se volta por
`<Link>`, sem perguntar ao servidor.** Custou meia investigação em 26/08: o
filtro de `/hoje` já estava correto no cookie e no servidor — recarregar a
página mostrava o valor certo — e voltar pelo menu lateral continuava mostrando
o antigo. Duas chaves de cache (`/hoje` e `/hoje?escopo=equipe`) e o menu
apontando para a primeira. Estado que precisa sobreviver a ir-e-voltar não pode
depender de a URL mudar: com **uma** chave só, `router.refresh()` invalida ELA.
`staleTimes` resolveria também, e foi descartado — muda a navegação do produto
inteiro por causa de um filtro.

**A cópia otimista tem que VENCER a do servidor, não ser descartada por ela.**
`mesclarSaindo` filtrava fora a tarefa riscada sempre que o servidor ainda
mandasse a versão aberta — o que dura toda a viagem de `revalidatePath`, 1,5s
medido. O filtro existia para não duplicar a linha, e o efeito colateral foi um
segundo e meio de clique sem sinal nenhum na tela. Sempre que houver as duas
cópias, a regra é substituir por id, nunca ignorar a local. E o espelho vale
junto: **não tire a cópia local antes de o servidor concordar** — desfazer
tirava na hora e a linha sumia por 1s até a revalidação chegar.

**Contar clique não prova que é clicável.** Os roteiros do dashboard clicam na
BORDA do card e na célula mais distante do título, de propósito: é o que separa
"tem link" de "é clicável", e foi assim que apareceu o painel que abria vazio
com id inexistente. Clicar no texto teria passado nos dois casos.

**`cache()` do React deduplica a MESMA função, não duas que fazem a mesma
coisa.** `getCurrentUserAndWorkspace` e `lerEstadoDoOnboarding` (chamadas em
paralelo no layout do dashboard a cada navegação) cada uma tinha seu próprio
`cache(async () => supabase.auth.getUser())`, o React não enxerga que as duas
pedem a mesma coisa, então cada navegação pagava a ida ao Supabase Auth duas
vezes em vez de uma. A correção não é "cachear mais forte": é ter UMA função
cacheada (`lib/supabase/usuario-autenticado.ts`) e todo mundo chamar ELA, para
o `cache()` ter algo de fato idêntico para deduplicar.

**Layout `async` sem `<Suspense>` esconde que a navegação está rodando.**
`app/(dashboard)/layout.tsx` faz `await Promise.all(...)` antes do `return`,
nenhum `loading.tsx` de rota aparece enquanto isso não resolve, porque não há
fronteira de Suspense delegando o fetch. Clique processa, navegação começa,
mas fica muda por toda a cadeia de rede; sem sinal nenhum, a pessoa clica de
novo achando que não funcionou. Não dá para envolver esse `await` em Suspense
sem enfraquecer o guard: os dois `redirect()` do layout (workspace vazio,
onboarding pendente) dependem do resultado dele para decidir SE a página
deve renderizar. A correção ficou no lado visual,
`components/layout/navigation-progress.tsx` liga no clique real e desliga na
troca real de rota, não em tentar apressar o guard.

**O PostgREST corta em 1.000 linhas, e quem não pagina mente em silêncio.**
Medido em 12/08 com 1.100 negócios: o app recebe 1.000 e não recebe erro
nenhum. Três funções são anteriores a isto e não paginam, `getFunnelCounts`
(gráfico com número errado), `getBoardDeals` (**cards somem do Kanban**, e como
ordena por data são os mais antigos) e `getWorkspaceLeadsForSelect` (leads
somem do seletor de novo negócio, ordenado por nome). O banco tem 14 negócios
hoje, então ninguém é afetado, mas qualquer consulta nova sem `.limit()`
explícito herda o mesmo defeito.

**PATCH que não casa com nenhuma linha devolve 204, e 204 é sucesso.** O
primeiro roteiro de prova da 0030 deu um `check constraint` como aprovado sem
nunca tê-lo exercitado: a conta de teste não tinha linha em `onboarding_state`,
o `PATCH` não casou com nada e o script leu o 204 como "passou". Prova de
constraint precisa garantir que a linha existe antes.

**`.select()` do supabase-js precisa ser string LITERAL.** Quebrar em
`'a, b' + 'c, d'` para caber na linha faz o tipo do retorno inteiro virar
`GenericStringError`, o supabase-js analisa essa string no nível de tipo.

**`storage.foldername(name)[1]::uuid` estoura em caminho fora do padrão**, e
quem escolhe o caminho é quem envia o arquivo. A 0031 usa
`workspace_do_caminho`, que devolve `null` nesse caso, e
`is_workspace_member(null)` é `false`, então caminho torto não pertence a
ninguém.

**No `update` de policy, `using` sem `with check` deixa renomear para fora.**
Só com os dois é que um admin fica impedido de mover o próprio arquivo para a
pasta de outra empresa: `using` avalia a linha ANTES da mudança e aprovaria.

**`revoke select (coluna) ... from authenticated` sozinho não bloqueia nada.**
Mesma família de defeito que a 0013 já pagou para `EXECUTE` de função: o
Supabase concede `select` na TABELA INTEIRA para `authenticated` por default
privilege, e revogar uma coluna não subtrai de um grant mais amplo já
concedido. Achado testando `integration_connections` (0034), um admin lia
`access_token_enc` cifrado direto pela API pública, apesar do `revoke`
explícito na migration. A correção que funciona: revogar `select` da tabela
inteira e conceder de volta só nas colunas seguras, para o grant específico
ser o único que existe.

**Quem aceita convite não tem empresa para configurar.** Sem marcar o
onboarding como concluído no aceite, nos DOIS caminhos, a página e a Server
Action,, o middleware manda a pessoa às boas-vindas e ela atravessa quatro
perguntas sobre uma empresa que não é dela.

**Abrir tour por parâmetro de URL exclui quem não passa pela URL.** A primeira
versão dependia de `?tour=1`, posto pela finalização do assistente; quem entra
por convite nunca passaria por lá. O gatilho é o estado no banco.

**O servidor da Vercel roda em UTC, e "hoje" do usuário não é o dele.** Às 21h
de São Paulo já é o dia seguinte em UTC, `toISOString().slice(0,10)` no
servidor mandaria toda tarefa marcada para hoje à noite para o grupo "Depois".
Por isso `diaEmSaoPaulo` usa `Intl.DateTimeFormat` com `timeZone`, e o relógio
das telas de tarefa nasce num `useEffect`, no cliente. Tem teste travando os
dois casos em `lib/tasks/buckets.test.ts`.

**Prefixar `55` em número de 11 dígitos transforma telefone dos EUA em
brasileiro.** `+1 415 555 2671` vira `14155552671`, mesmo tamanho de um celular
com DDD. O teste pegou. O que separa os dois é o dígito depois do DDD: celular
brasileiro é sempre `9`, fixo começa em 2–5. Sem isso o `wa.me` abriria tela de
erro do WhatsApp e pareceria defeito nosso.

**`select` largo em rota sem paginação dobra o custo dela.** O `/kanban`
carrega todos os negócios abertos de uma vez. Medido em produção com 100
negócios: a consulta da próxima ação com as 8 colunas de `TaskRow` custava
315 B por negócio contra 292 B da consulta de negócios, mais que dobrava a
rota. Com as 5 colunas que o card usa de fato, 198 B. Daí o tipo
`ProximaAcaoRow` separado.

**`Map` não sobrevive à travessia servidor→cliente.** Prop de Server Component
é serializada; `Map` chega vazio, sem erro. Vai como pares `[chave, valor]` e
vira `Map` num `useMemo` do lado do cliente.

**O overlay do arrasto duplica o card à mão.** `deal-card-overlay.tsx` repete a
marcação de `deal-card.tsx`. Mudar um sem o outro faz o card trocar de altura no
instante em que é pego, e o movimento parece defeito.

**Contar linha com `for update` nem sempre vale.** A 0026 precisou do lock
porque 50 leads é fronteira de monetização e o 51º é receita perdida. O teto de
tarefas da 0029 é 5.000, defesa contra abuso: sob corrida o estouro é do tamanho
da concorrência e para na leva seguinte. O lock ali seria na MESMA linha de
workspace que a trava de leads pega, e faria toda tarefa criada durante uma
importação de planilha esperar a importação inteira.

**Regra que só vive na Server Action não é regra.** Server Action é endpoint
HTTP; quem chama o PostgREST direto com a chave pública (que está no HTML por
design) pula a validação. Três defeitos vieram disso: autoupgrade para Pro sem
pagar (migrations 0019→0022), limite de leads contornável (0023) e autoconvite
(0024). Limite de plano e permissão precisam de trigger no banco.

**`SECURITY DEFINER` troca o dono da execução, não o papel da sessão.** A 0019
liberava por `role = 'service_role'` e bloqueou o próprio webhook.

**Variável de sessão é forjável.** A 0021 liberava por uma marca posta pela
RPC; `set_config` é chamável por qualquer um e o ataque voltou a passar. Só
credencial secreta (service role) distingue de verdade.

**Trigger que conta linhas precisa de `for update`.** A 0023 recusava a partir
de 50 leads, mas sob READ COMMITTED duas transações liam a MESMA contagem antes
de qualquer commit e as duas passavam, 51 leads num plano de 50. Corrigido na
0026 com `select ... for update` na linha do workspace.

**Fragmento de URL (`#access_token`) nunca chega ao servidor.** Causou três
bugs: reset de senha morto, confirmação de cadastro que não logava, e a troca
de senha que não acontecia (o `PUT /user` sumia na travessia navegador↔Server
Action). Tudo que depende da sessão de recuperação roda no cliente.

**`File.text()` decodifica sempre em UTF-8.** O Excel em português salva CSV em
Windows-1252, então "José Antônio" entrava no banco como `Jos� Ant�nio`, calado.
Medido em 11/08. A leitura passa por `decodificarPlanilha`, que tenta UTF-8 com
`fatal: true` e cai para Windows-1252 quando falha, nessa ordem, porque
Windows-1252 aceita qualquer byte e nunca falharia.

**`.in()` do PostgREST vira query string.** A dedupe da importação mandava até
1000 e-mails num `select`, e o gateway recusa: medido, 500 valores já dão 400 e
2000 dão 414. Pior, o código não olhava o `error`, então o conjunto de
duplicados saía vazio e a planilha inteira era reimportada em silêncio. Trocado
por leitura paginada do workspace.

**Link de e-mail não carrega parâmetro.** O link de confirmação é montado pelo
template do Supabase e só sabe ir para o `emailRedirectTo` fixo, então tudo que
a pessoa escolheu antes de abrir a caixa de entrada morre ali. Dois defeitos
vieram disso: o convite virando conta separada (o token se perdia no caminho
para `/cadastro`, a pessoa caía em `/onboarding` e criava a própria empresa, com
o convite preso em `pending`) e a intenção de compra descartada ("Assinar Pro"
apontava para o mesmo destino do Free). A travessia agora é por cookie
`httpOnly` em `lib/auth/intencao.ts`, não querystring, que vazaria e-mail e
token no histórico e no `Referer`.

**Coluna de plano e validade de plano são coisas diferentes.** Depois da 0027,
qualquer regra que leia `workspaces.plan` pode discordar de `pro_vigente()`, a
coluna é o último valor gravado e não sabe que o tempo passou. Foi o caso do
aceite de convite (0028): um Pro vencido aceitava o terceiro membro e a trigger
de leads recusava o lead dele. **Regra de plano lê a função, nunca a coluna.**

**O `callback.successUrl` do Asaas não funciona.** Medido em 11/08:
`POST /subscriptions` aceita o campo com HTTP 200, não o devolve na leitura, não
propaga para a cobrança gerada, e `PUT /payments` com `callback` responde 500.
Por isso o retorno depois do pagamento é feito por conta própria, a fatura abre
em outra aba e o app fica na de trás.

**Erro do Postgres não chega à UI sozinho.** A mensagem de limite de plano da
trigger 0023 morria em `console.error` e virava "Não foi possível importar".
Quem trata `error.code === '42501'` é o TypeScript, e a mensagem boa precisa
existir dos dois lados.

**O editor de templates do painel do Supabase** engasga com linha de mais de
mil caracteres e rejeita comentário condicional aninhado, o botão "Save"
simplesmente não responde, sem erro. Por isso os arquivos em
`supabase/email-templates/` são gerados com `paraPainelDoSupabase: true`.

**`{{ .ConfirmationURL }}` verifica o token no próprio GET, antes do clique.**
Causou "link expirado" em confirmação de cadastro e recuperação de senha,
qualquer requisição que visite o link primeiro (scanner de e-mail, antivírus,
preview de webmail) consome o token de uso único antes da pessoa clicar. Os
dois templates usam `{{ .RedirectTo }}?token_hash=...`, que só carrega a
página; a verificação (`verifyOtp`) espera um clique explícito. Ver
`supabase/email-templates/README.md`.

**O nome do recebedor na fatura do Asaas não é editável, e para MEI não tem
mais saída por nome fantasia.** O campo `availableCompanyNames` da API traz só
a razão social vinda da Receita, para MEI, é o nome pessoal do empresário
individual, sem opção alternativa. **Correção 13/08/2026**: esta entrada dizia
antes que cadastrar nome fantasia no Portal do Empreendedor resolveria, errado,
o dono trouxe a fonte oficial (gov.br, resposta de 21/11/2023): nome fantasia
foi **descontinuado da base do CNPJ para MEI desde 15/11/2023**. Não é
limitação do Asaas nem trocaria com outro processador (Stripe incluído), é
dado da Receita Federal. Única saída real é formalizar como ME/LTDA (sair do
MEI), decisão de negócio fora do código. O que já mitiga: a descrição da
cobrança (commit `b8b9ec0`) mostra "Velo Funil" antes do nome do recebedor.

## Como verificar as coisas aqui

O padrão do projeto é **provar contra produção, não supor**. Scripts
descartáveis em Node no diretório de scratchpad, lendo `.env.local` com
`node --env-file=.env.local`, sempre limpando o que criaram:

- **RLS**: simular sessão real com `set local role authenticated` +
  `set local request.jwt.claims` e tentar a escrita indevida.
- **Limite de plano**: encher até o teto pelo PostgREST e conferir que a linha
  seguinte toma `42501`. Foi assim que a 0025 e a 0026 foram aceitas.
- **Billing**: bater no webhook de produção com o token real e conferir o
  plano no banco.
- **E-mail**: disparar de verdade e ler o resultado no log do Resend.
- **Auth**: criar conta descartável, exercitar o fluxo, apagar no `finally`.

Nunca deixar dado de teste para trás.

## Ferramentas

MCP do Supabase e Playwright vêm de plugins e ficam em `~/.claude.json`, que é
da máquina, não do login. **Já apareceu apontando para o projeto errado**
(`zjhgoaoctboxdtygdwjs`, vazio, de outra conta) numa sessão antiga, quando o
`.env.local` ainda usava `unydqzzjokhjwcqufehr`. **Confirmado certo em
19/08/2026**, sessão no VS Code: `list_projects` devolve só
`tmyeunithjqkbwvezyyn` (`velofunil-sao-paulo`, `sa-east-1`,
`ACTIVE_HEALTHY`), o mesmo projeto do `.env.local` pós-cutover. Ainda assim,
**confira o projeto antes de aplicar qualquer migration por ele** — já errou
uma vez. O MCP do Stripe pede autorização e **não é usado** (o projeto é
Asaas). Quando o Playwright cai, o caminho é `curl` + análise do HTML, ou
script Node contra a API.

**MCP do Supabase via conector do claude.ai (19/08), diferente do plugin
acima.** O dono confirmou no painel (`claude.ai/settings/connectors`) que o
conector Supabase está "Desvinculado"/conectado, mas nenhuma ferramenta
`mcp__*Supabase*` apareceu nesta sessão, nem depois de reiniciar (o mesmo
reinício resolveu o caso análogo do MCP da Vercel, ver "Vercel MCP" abaixo).
Ficou pendente sem causa confirmada — pode ser propagação lenta, pode ser
escopo de autorização insuficiente, pode ser troca de conta destravando.
Enquanto não resolver: banco é lido/escrito por script Node descartável com
`SUPABASE_SERVICE_ROLE_KEY` (`node --env-file=.env.local script.mjs`), mesmo
padrão que resolveu toda a investigação do checkout travado nesta sessão,
sem depender do MCP nenhuma vez.

**Vercel MCP (`mcp__claude_ai_Vercel__*`) funciona nesta sessão**, projeto
`closify-crm-dr3t` (`prj_1MkOuMTY5zGiRXEG8TWRKSs9n3hJ`), team
`ricks-projects-1e819723` (`team_7KBrcdMaIrg3kCRSZy3cNA34`). Serve pra
confirmar deploy sem depender do dono abrir o painel — `list_deployments`
com `since` no timestamp do push mostra `state: READY/BUILDING/ERROR` do
commit exato. Repositório GitHub é `rickcruzzz/closify-crm` (nome antigo do
projeto, mantido).

## Últimos commits relevantes

| Commit    | O quê                                                              |
| --------- | ------------------------------------------------------------------ |
| _(a fazer)_ | Tarefas com próxima ação, tela `/hoje` e WhatsApp por link (0029) |
| `312225b` | Seletor de empresa passa a trocar de empresa de verdade            |
| `3779d72` | Convite deixa de virar conta separada; confirmação de e-mail tem fim |
| `9fe5cd4` | Reimportar planilha atualiza quem já existe                        |
| `efcf2be` | Importação de planilha: Excel, mapeamento de coluna, negócio junto do lead |
| `b8b9ec0` | Descrição da cobrança que o cliente reconhece                      |
| `7b67e23` | Verificador de ambiente local                                      |
| `185f97c` | Link de confirmação deixa de morrer antes do clique                |
| `1a49eb6` | Troca de senha deixa de falhar em silêncio (movida para o cliente) |
| `faba2db` | Bloqueia autoconvite e convite para quem já é membro               |
| `c5ad888` | Impede upgrade sem pagamento; conserta a RPC do webhook            |

Para o resto: `git log` conta a história completa, com o porquê de cada
decisão.
