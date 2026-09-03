# A campanha do Meta Ads, e os dois portões que faltam

Montada em 02/09/2026. Está **pausada e completa até onde a conta permite** —
dois bloqueios de configuração do Meta, nenhum deles de código, impedem o
último passo.

```
campanha   120253684403370580   OUTCOME_LEADS   R$ 25/dia   PAUSED
conjunto   120253684403670580   Brasil, 25-55, Advantage+   PAUSED
criativos  6, um por angulo                                 criados
anuncios   0                                                BLOQUEADO
```

---

## O que mudou a estratégia: o Instagram orgânico não é canal

Medido nesta rodada, e o dono confirmou a causa: **os 11.416 seguidores foram
comprados**, para o perfil não parecer vazio.

```
11.416 seguidores
7 posts, 25 curtidas no total, 3,6 por post
engajamento 0,031%     saudavel e 3% a 6%
```

**Uma recomendação anterior deste projeto dizia que o Instagram era "o ativo
mais barato que você tem, parado". Era falsa.** Seguidor comprado não é só
inútil: o algoritmo mede a taxa de reação nas primeiras horas para decidir
quanto entregar, e onze mil contas que nunca reagem afundam essa taxa. O perfil
alcança menos do que alcançaria com cem seguidores reais.

**Decisão: o perfil é vitrine.** Serve para quem vê o anúncio e vai conferir se
a empresa existe — e para isso os 11 mil ajudam, que era a intenção original.
Nada de aquisição vem dali.

Isso **não contamina o anúncio**: o público do anúncio é escolhido pela Meta
pelo pixel, não pelos seguidores da página.

---

## As decisões da campanha

### `OUTCOME_LEADS`, e não `OUTCOME_SALES`

O plano dizia `OUTCOME_SALES` otimizando pelo evento `Lead`. **A Meta recusa
essa combinação** — medido, não suposto:

```
Evento de conversao indisponivel: Este evento de conversao nao esta
disponivel com o objetivo selecionado.
```

`OUTCOME_SALES` só aceita eventos de compra. Otimizar pelo cadastro exige
`OUTCOME_LEADS`, que é literalmente o que ele é. A campanha de SALES criada por
engano foi apagada no mesmo dia.

### Otimizar por `Lead`, e isto corrige uma recomendação anterior

Eu havia recomendado otimizar por visualização de página, argumentando que com
R$ 25/dia o `Lead` nunca sai da fase de aprendizado. **O cálculo continua certo
— 3 a 5 leads por semana contra os ~50 que a Meta pede — e a conclusão estava
errada:**

- otimizar por **tráfego** compra quem clica, e quem clica por hábito não assina
- otimizar por **conversão**, mesmo em aprendizado, faz a Meta procurar gente
  parecida com quem já converteu — e o pixel tem histórico

Fase de aprendizado entrega pior. Comprar clique barato entrega **errado**.

### Um conjunto só, Brasil inteiro, sem interesse travado

R$ 25 divididos em três conjuntos viram R$ 8/dia cada, e nenhum acumula sinal.
Segmentação estreita encarece o CPM — menos inventário, leilão mais disputado —
e o criativo da âncora de preço ("os outros cobram por pessoa") **se
autofiltra**: quem trabalha sozinho ignora, quem tem quatro vendedores para.

Advantage+ Audience fica ligado; 25-55 entra como sugestão, não como teto.

### Os seis ângulos, um mecanismo psicológico cada

A Meta aprende comparando. Seis peças com a mesma tese e cores diferentes não
dão nada para comparar — ela testaria a arte e concluiria sobre a arte. Seis
**teses** fazem o teste responder por que essa pessoa compraria.

| peça | mecanismo | headline |
|---|---|---|
| `a1_ancora_preco` | ancoragem + contraste | R$ 49 pela empresa inteira |
| `a2_perda_memoria` | aversão à perda | Nenhum cliente esquecido |
| `a3_objecao_planilha` | viés de status quo | Sua planilha vira funil |
| `a4_prova_produto` | prova por demonstração | Veja o funil por dentro |
| `a6_google` | energia de ativação | Funciona com o que você já usa |
| `a5_oferta` | efeito preço zero | Comece grátis, sem cartão |

Todos apontam para `/cadastro` com UTM. `utm-capture.tsx` grava a origem em
`workspaces` — a ponte existe desde sempre e **nunca foi exercitada**, porque
nenhuma campanha rodou. Será o primeiro dado real de origem deste projeto.

---

## As três proporções, e por que elas existem

Dos **19 posicionamentos** que a conta alcança, apenas 4 recebiam peça na
medida certa. Nos outros 15 o Meta recorta o 4:5 sozinho, e recorte automático
não sabe onde está o texto.

```
4:5   1080x1350   feed do IG e do FB                            4 posicionamentos
1:1   1080x1080   Explorar, Marketplace, coluna da direita,
                  busca, notificacoes, Messenger, Audience Network
9:16  1080x1920   Stories e Reels, nos dois aplicativos
```

`scripts/marketing/gerar-anuncios.py` passou a produzir as três (18 arquivos), e
isso exigiu duas correções no gerador — registradas na seção seguinte.

**As 18 estão na biblioteca da conta**, com os hashes em
`criativos/anuncio/hashes.json`. `scripts/marketing/criar-anuncios-meta.mjs`
monta o `asset_feed_spec` com `asset_customization_rules`, que é o mecanismo
oficial para imagem por posicionamento — e **não existe no MCP**, só na Graph
API, que o app em modo de desenvolvimento bloqueia.

### Enquanto isso: o 1:1 é a imagem única, e isso foi MEDIDO

Sem `asset_feed_spec`, o creative carrega uma imagem só. Qual das três sofre
menos? Medido abrindo o preview real do Facebook no navegador, não deduzido:

```
4:5 em posicionamento 1:1 (coluna da direita)
    CORTA topo e base — a marca "Velo Funil" e o dominio somem, sobra o miolo

1:1 em posicionamento 4:5 (feed do Facebook)
    INTEIRA — marca, claim, grafico, linha de fonte e dominio, nada cortado
```

**O 1:1 é o denominador comum seguro.** O custo é ocupar menos altura no feed
do que uma 4:5 ocuparia — atenção, não conteúdo. O custo do 4:5 é perder a
marca e o endereço do site em sete posicionamentos, o que é pior.

Os seis creatives da conta usam o 1:1. Os de 4:5 foram criados primeiro e
apagados depois desta medição.

**A regra que fica:** quando só cabe uma imagem, escolha a proporção mais
QUADRADA das que você tem. Ela perde área nas outras; as alongadas perdem
conteúdo.

---

## Os três defeitos que só apareceram ao abrir o PNG

Nenhum dos quatro portões olha dentro de imagem, e os três abaixo são a prova
disso mais uma vez.

**1. O domínio estava desenhado FORA da tela, em toda proporção.**
`comp_conta` fazia `c.texto(x, base + 96, ...)`:

```
4:5    base 1254 + 96 = 1350   a tela tem 1350   FORA
1:1    base 1002 + 96 = 1098   a tela tem 1080   FORA
```

A peça de âncora de preço — o argumento mais forte que este produto tem —
**sempre saiu sem o endereço do site**, desde que existe. Corrigido reusando o
que `comp_numero` já resolvia: domínio à direita, na linha da fonte.

**2. Os rótulos do Kanban por cima do claim, em 9:16.** `topo_k` era o literal
`452`, e em 9:16 o claim começa em 433 — 19px de folga para um texto de corpo
58. Passou a derivar da altura do claim, com `max(452, …)` preservando o 4:5
exatamente.

**3. O 9:16 nativo tinha ~800px de vazio no meio.** Tecnicamente correto e
ilegível como arte. Resolvido assentando a peça 4:5 na banda segura do 9:16
(269 no topo, 384 na base) sobre o fundo da paleta: a arte que vai ao ar é a
mesma que foi conferida no feed, e a zona coberta pela interface fica vazia
porque nada foi desenhado nela.

### O que passou a impedir a classe inteira

`metricas_da_proporcao` tira `FEED_PAD` e `TOPO_CONTEUDO` de globais e os faz
viajar com a `Tela`. Um `assert` trava que o 4:5 devolve exatamente os valores
antigos — **é o que impede a correção do anúncio de mexer no orgânico já
publicado.**

`scripts/marketing/conferir-criativos.py` mede proporção, resolução e a zona
segura do 9:16. **Provado nos dois sentidos:** 18 de 18 passam, e os três casos
negativos (9:16 nativo, paisagem 16:9, 720px de largura) são todos reprovados
com exit 1. Verde sem controle negativo não prova nada.

Ele **não diz que a arte está boa** — diz que não está obviamente quebrada.
Colisão de texto é de pixel, e só o olho pega.

---

## Os dois portões que faltam, e nenhum é código

### 1. O app do Meta está em modo de desenvolvimento

```
app 1248926890692442 "budsiness"   META_ADS_TOKEN e META_INSTAGRAM_TOKEN
```

Medido: esse token **não cria creative nem anúncio**, nem com `asset_feed_spec`
nem sem ele. O MCP cria (usa credencial de um app publicado), mas o MCP não
expõe imagem por posicionamento.

```
O post do criativo dos anuncios foi criado por um app que esta em modo de
desenvolvimento. Ele deve estar em modo publico para criar este anuncio.
```

**Ação:** em <https://developers.facebook.com/apps/1248926890692442/>, menu
lateral → **Publicar**. Isso destrava `criar-anuncios-meta.mjs` e, com ele, as
três proporções nos 19 posicionamentos.

**Não é um clique, e a estimativa importa:** o app usa `ads_management` e
`business_management`, que são permissões avançadas. Publicar com elas exige
**Análise do app** e **Verificação da empresa** — dias a semanas. No painel de
02/09, 5 dos 7 requisitos estavam sem check.

**Por isso a campanha não espera por isto.** O 1:1 como imagem única resolve o
recorte hoje (ver acima), e a customização por posicionamento entra depois, se
e quando o App Review passar. Ela é melhoria, não pré-requisito.

**Nota sobre a Verificação da empresa:** ela consulta bases da Receita, e o
CNPJ ainda não propagou em todas. Medido em 02/09:

```
ReceitaWS      HTTP 200   ATIVA
minhareceita   HTTP 404   ainda nao tem
BrasilAPI      HTTP 403   inconclusivo (bloqueio de robo)
CNPJa          HTTP 402   inconclusivo (paywall)
```

Uma fonte confirma. A regra registrada em 31/08 — esperar duas fontes
independentes antes de submeter — **ainda não foi satisfeita**, e reprovação
entra no histórico do Business Manager.

### 2. O Meta Pay do perfil está desativado — e é o bloqueio real

```
Pagamentos desativados
Para sua seguranca, desativamos sua conta do Meta Pay.
Para reativa-la, entre em contato conosco.
```

Essa mensagem, vista na tela de adicionar fundos em 03/09, nomeia a causa que
o erro da API só descrevia:

```
(#100) subcode 1815010   "Pagamento desativado para o usuario"
```

**Meta Pay é a camada de pagamento do PERFIL, não da conta de anúncio.**
Desativada, nenhum meio funciona — nem cartão, nem Pix, nem boleto, em conta
nenhuma.

#### O que foi eliminado antes de chegar aqui, e como

O diagnóstico levou uma sessão inteira porque a mensagem da API culpa
"pagamento", o que manda todo mundo mexer no cartão. Cada hipótese abaixo foi
testada e descartada:

```
trocar o cartao                    o funding id nem mudou; e nao era ele
corrigir o CNPJ                    68.877.105/0001-67 entrou; erro igual
conta de anuncio bloqueada         ACTIVE, disable_reason 0, nas duas
limite/saldo                       R$ 750 disponiveis, teto diario R$ 567,95
app do Meta em modo dev            bloqueia o TOKEN, nao o MCP — e o MCP
                                   tambem recusa o anuncio
```

**O teste decisivo foi criar a campanha inteira na OUTRA conta de anúncio**
(`27108979755418323`), que tem método de pagamento diferente e nenhum
business: campanha, conjunto e criativo passaram; o anúncio recusou com o
mesmo subcódigo. Duas contas, dois métodos, um erro — logo o bloqueio é do
usuário, e não de nada que se configure por API.

**Ação, e não há alternativa técnica:** suporte da Meta em
<https://www.facebook.com/business/help/support>, pedindo a reativação do Meta
Pay e citando o subcódigo `1815010`. O subcódigo é específico o bastante para
evitar a ronda de "troque o cartão".

---

## A ordem certa quando os dois portões abrirem

```
1. app em Live + pagamento resolvido
2. node --env-file=.env.local scripts/marketing/criar-anuncios-meta.mjs
3. abrir os previews e OLHAR, um por posicionamento
4. ativar campanha e conjunto
5. NAO TOCAR EM NADA por 7 dias
```

**O passo 5 é o que mais pesa.** Toda edição de orçamento, público ou criativo
reinicia a fase de aprendizado e joga fora o que a Meta já sabia. É o erro mais
comum e o mais caro.

Por isso os 6 creatives criados com a peça 4:5 **não devem ser ativados como
estão**: se forem, e depois trocados pelos de três proporções, o aprendizado
recomeça. Melhor esperar e ligar uma vez só.

## A ressalva, dita na cara

Com R$ 25/dia o `Lead` não sai da fase de aprendizado — 3 a 5 por semana contra
~50. O custo por resultado será mais alto e mais instável nas primeiras semanas.
Não é defeito de configuração; é o que R$ 750/mês compra num leilão em que
concorrentes de SaaS gastam dez vezes isso.

O que esse dinheiro **realmente** compra é o primeiro dado real deste projeto:
quanto custa um cadastro, e quantos deles pagam. Hoje esses dois números não
existem — nunca houve um cliente externo. Com eles, subir para R$ 100/dia deixa
de ser aposta.
