# Instagram — Velo Funil

Pasta de trabalho pros criativos do Instagram (posts, stories, destaques).
Referência de marca extraída do código real do produto — não inventada —,
pra quem for desenhar (você, designer, IA de imagem) não precisar abrir o
código-fonte pra descobrir hex de cor ou nome de fonte.

## Referência de marca

- **Cor principal**: `#00bfc0` (cyan-teal) — equivalente ao `--primary` do
  tema escuro (`app/globals.css`), que é o padrão do produto.
- **Cor de texto sobre a principal**: `#031010` (quase-preto).
- **Fundo dos criativos**: teal escuro `rgb(4,32,33)`, a cor da marca — não
  o `#0a0a0a` neutro do produto. Preto não identifica ninguém; a cor de marca
  em tela cheia marca a peça antes de qualquer leitura.
- **Fonte**: Geist (`app/fonts/GeistVF.woff`), variável, pesos 100-900 —
  [geist.dev](https://geist-font.vercel.app/) pra quem for usar em
  ferramenta externa. **Esta linha já estava aqui em 24/08 e o gerador usava
  Segoe UI mesmo assim** — documento e código discordaram por semanas sem
  ninguém notar, porque nenhum `tsc`/`lint`/`test` lê dentro de um PNG. Vale
  como aviso: aqui, prova é abrir o arquivo.
- **Logo**: ícone é a silhueta de um funil — três barras horizontais
  decrescentes de largura (18.8 → 10.2 → 2.2), mesmo desenho lê como a
  letra "V" de Velo. Wordmark "Velo" (semibold) + "Funil" (peso normal,
  cinza). Definido em `components/branding/logo.tsx`. Sem arquivo
  exportável (PNG/SVG solto) ainda — só existe como código React/SVG.
- **Screenshot real do produto**: `land-hero.png` (raiz do repositório).
- **Tom de voz**: sem jargão técnico (nada de "pipeline", "Kanban",
  "workspace" cru) — ver `docs/prd-copy-sem-jargao.md`. Headline de
  referência (trocada em 24/08, quando a landing foi repositionada da planilha
  para o WhatsApp): **"O WhatsApp guarda a conversa. Não guarda o cliente."**
  A anterior, "Pare de perder venda por esquecimento", apontava para a segunda
  dor — 82% da PME brasileira vende por WhatsApp (Sebrae, Pulso 2026).
- **Identidade visual geral**: modo escuro como padrão, alto contraste,
  poucos elementos por tela (`CLAUDE.md`, seção Identidade Visual).

## Stories dos destaques (conteúdo de dentro)

Gerados por `scripts/marketing/gerar-stories.py`:

```sh
python scripts/marketing/gerar-stories.py
```

São **15 telas em 3 destaques**. Cada uma sai em dois arquivos: a versão de publicação (**1080×1920**, que é
o padrão de Story e o que se sobe no Instagram) e uma `@4k` (2160×3840) para
reaproveitar em feed ou anúncio sem regerar.

**Renderiza a 2x e reduz no fim.** Desenhar direto em 1080×1920 desperdiçava
o print de origem (2880px entrando a 0,49x, metade dos pixels jogados fora) e
rasterizava texto e selo uma única vez, sem folga de amostragem — o que
serrilhava a borda do símbolo e embaçava o endereço, visível a olho nu em
qualquer zoom. Com supersampling cada pixel final vira média de 4 amostras.

**Não suba o `@4k` direto no Instagram.** O app recomprime para 1080 de
largura de qualquer jeito, às vezes com resultado pior que a redução
controlada por LANCZOS que o script já faz.

### A tipografia é a do produto, não a do sistema

Até 24/08 estas telas saíam em **Segoe UI** — a fonte padrão do Windows. Nada
identifica menos uma marca do que o tipo já instalado na máquina de quem
desenhou: é o default absoluto, e aparece em slide de qualquer empresa. Era a
causa nº 1 de o conjunto parecer genérico.

Agora usam **Geist**, a mesma que `app/layout.tsx` serve no produto e na
landing — o Pillow abre o `.woff` direto, sem dependência nova. Sendo
variável, ela traz **nove pesos** onde havia dois, e cada um tem papel:

| peso | onde | por quê |
| --- | --- | --- |
| UltraBlack | o número que domina a tela | único lugar sem nada competindo |
| Bold | headline | |
| SemiBold | trecho forte dentro da frase, linha teal | Bold ao lado de Regular abre degrau grande demais e parte a frase em duas |
| Medium | etiqueta de categoria, marca no rodapé | tem que ler como rótulo, não como segunda headline |
| Regular | corpo, fonte do dado | |

Com só `bold` e `regular`, toda hierarquia interna precisava ser feita no
TAMANHO — e é por isso que blocos assim ou gritam ou somem.

### O fundo carrega a marca, e ela sangra

O símbolo do funil aparecia só a 26px no rodapé: uma forma forte sem uso, com
o fundo sendo uma chapa e um halo, idêntica nas vinte telas.

Ele agora é **estrutura**: em escala 2,6× a largura do quadro, a 5,5% de
opacidade, sangrando pelos dois lados. Nenhuma das três camadas cabe inteira,
e é essa a intenção — símbolo inteiro num canto lê como adesivo, e a primeira
tentativa (pouco maior que a tela) virou uma faixa diagonal que o olho
classifica como artefato de render. Cortado, sobram arestas que dão direção ao
fundo sem se anunciarem como logotipo. Um desfoque leve tira a borda dura, que
é o que denuncia forma colada.

O halo ganhou **segunda fonte de luz**, menor e deslocada, e **ancora num
ponto diferente por destaque**. O Instagram exibe os Stories de um destaque em
sequência, então a repetição aparece dentro de UM destaque — cinco telas com a
mesma luz é o que faz o conjunto parecer uma imagem só, repetida.

E o card do print recebe **luz atrás**, não sombra: sobre fundo escuro sombra
preta não aparece, mesma razão pela qual o tema claro do produto ganhou sombra
no cartão e o escuro teve a regra anulada.

> **Armadilha paga duas vezes nesta sessão:** o brilho aplicado na imagem
> INTEIRA passa por cima do texto já desenhado — a headline branca vira
> cinza-esverdeada e a tela parece desbotada. O glow do card é recortado na
> faixa abaixo do texto justamente para tornar isso impossível de repetir.

### Os quatro layouts, e por que são quatro

Repetir a mesma composição em quinze telas faria o destaque inteiro parecer a
mesma imagem, e é a variação que segura quem está passando os Stories.

| layout | quando | o que carrega |
| --- | --- | --- |
| `tela_produto` | mostrar o produto | headline + print do app sangrando pela direita |
| `tela_lista` | plano, o que está incluso | título + itens com marcador, palavra-chave em peso maior |
| `tela_numero` | dado de mercado | o número dominando, com a FONTE dele logo abaixo |
| `tela_declaracao` | pergunta, fechamento | só tipografia, sem imagem competindo |

**A cápsula de categoria não é âncora de topo, é a primeira linha do bloco.**
Fixá-la no alto deixava uma etiqueta solta a 14% da altura e o título só a
33%, com um vão morto entre os dois que lia como erro de montagem — e a
etiqueta existe para dizer do que o título trata, o que só funciona colada
nele.

**Bloco medido antes de desenhar.** A primeira leva ancorava tudo no topo e
deixava o resto cair onde caísse: a tela de lista terminava em 45% da altura,
com metade do Story vazia. Não dá para centralizar sem saber a altura, e não
dá para saber a altura sem quebrar as linhas — que é trabalho de `ImageDraw`.
Daí a passada seca em `medir()`: as MESMAS funções desenham num rascunho
descartável, devolvem o `y` final, e só então o bloco real é posicionado.

O centro é **óptico, não geométrico** — 42% do vão sobra em cima, 58%
embaixo. O olho lê um bloco como centrado quando ele está um pouco acima da
metade, e a assinatura no rodapé já pesa para baixo.

**O print sangra pela direita.** Encaixá-lo entre as duas margens deixava o
card com 29% da altura do Story e um vazio embaixo. Sangrar não é só
preencher espaço: a janela do app continuando para fora do enquadramento diz
que existe mais tela do que cabe ali, que é o oposto do que um retângulo
inteiro e pequeno comunica. Quando o corte cai no meio de uma linha de
tabela, os últimos pixels esmaecem — borda dura afirma que ali acaba a tela,
borda que some diz que ela segue fora do quadro.

### Destaque 1 — Demo (Como funciona)

| # | arquivo | conteúdo |
| --- | --- | --- |
| 1 | `demo-1-gancho.png` | "O cliente pediu orçamento e sumiu no WhatsApp. Aqui ele não some." |
| 2 | `demo-2-trazer.png` | Traga quem já é seu cliente · print de Contatos |
| 3 | `demo-3-arrastar.png` | Arraste pelas etapas · print do Funil |
| 4 | `demo-4-resultado.png` | Veja onde está o dinheiro · print de Resultados |
| 5 | `demo-5-cta.png` | 7 dias com tudo liberado, sem cartão |

**Sem numeração de passo.** Quem entra num destaque pelo meio não viu o "01",
e número solto sem contexto atrapalha mais do que ordena. As cápsulas dizem o
que a tela mostra ("Seus contatos", "O funil", "Os números"), não em que
posição ela está.

A copy dos passos é **literal** de
`components/landing/how-it-works-section.tsx` — a mesma que já passou pelo PRD
de copy sem jargão. Reescrever aqui faria o Story divergir da página no
primeiro ajuste que alguém fizesse lá.

O formato segue o padrão "Bold Headline + Product UI", o que mais converte em
anúncio B2B SaaS, com a regra que o faz funcionar: **a headline descreve
exatamente o que o print mostra**. Foi por essa regra que a tela 2 deixou de
usar o print de "Hoje" — ela promete importar contatos e mostrava tarefas. O
print de Contatos foi capturado para isso (`/leads` entrou em
`scripts/capturar-prints-do-produto.mjs`), e nele o botão "Importar planilha"
aparece na própria tela. A regra maior: **print real prova, ícone abstrato
não** — a primeira tentativa usava ilustração gerada por IA e foi descartada.

Os prints são **escuros**, sem exceção: telas escuras com uma clara no meio
lê como erro de montagem, e o modo escuro é o padrão do produto.

### Destaque 2 — Planos

| # | arquivo | conteúdo |
| --- | --- | --- |
| 1 | `planos-1-free.png` | Grátis para sempre: 2 pessoas, 50 contatos |
| 2 | `planos-2-pro.png` | Pro: R$ 49/mês, contatos e colaboradores ilimitados |
| 3 | `planos-3-produto.png` | O que você vê no Pro · print de Resultados |
| 4 | `planos-4-comparacao.png` | A maioria cobra por vendedor: 5 × R$ 53 = R$ 265/mês |
| 5 | `planos-5-pagamento.png` | Pix, boleto ou cartão · cancele quando quiser |

A comparação de preço usa **tabela pública de concorrente**, por isso pode ser
dita — e **sem citar nome**, que convidaria processo e ainda ensinaria a marca
do concorrente a quem não a conhecia. Sem essa âncora o cérebro compara R$ 49
com R$ 0, e qualquer preço perde.

### Destaque 3 — Dicas de venda

| # | arquivo | conteúdo |
| --- | --- | --- |
| 1 | `dicas-1-resposta-rapida.png` | **21x** mais chance respondendo em 5 min (InsideSales/MIT) |
| 2 | `dicas-2-media-do-mercado.png` | **42h** é a média de primeira resposta (HBR, 2.241 empresas) |
| 3 | `dicas-3-whatsapp.png` | **82%** vendem pelo WhatsApp (Sebrae, Pulso 2026) |
| 4 | `dicas-4-proximo-passo.png` | Negócio sem próximo passo morre calado · print do Funil |
| 5 | `dicas-5-medir.png` | O que você mede, você cobra |

**Cada número traz a fonte no próprio criativo.** São dados de pesquisa
pública, não medição nossa, e dizer de onde vêm é o que os separa de número
inventado — decisão travada neste projeto desde que a landing teve uma métrica
copiada de concorrente. O 21x costuma ser creditado errado à Harvard; é
InsideSales/MIT.

### Destaque 4 — Bastidores

**Não gerado, de propósito.** Exige conteúdo seu (rotina, processo, decisões),
que não existe no código e não dá para inventar sem cair na prova social
fabricada que este projeto recusa.

## Feed — `marketing/instagram/feed/`

Gerados por `scripts/marketing/gerar-feed.py`:

```sh
python scripts/marketing/gerar-feed.py
```

**1080×1350 (4:5), não 1080×1080.** O quadrado é o formato que todo mundo
lembra e não é mais o recomendado. 4:5 é a moldura mais alta que o feed aceita,
e altura é a única variável que aumenta o tempo que a peça fica na tela de quem
rola. `lib/dono/formatos-do-meta.ts` já classificava a medida como "Feed no
celular, ocupa mais tela" desde 20/08.

**A grade do perfil recorta em 3:4, e isso não estava registrado aqui.** A peça
vai ao feed inteira, mas na grade do perfil o Instagram mostra **1012×1350
centralizado** — 34px somem de cada lado. Quem desenhar encostado na borda
perde conteúdo exatamente na tela onde alguém decide se segue o perfil. A
coluna de texto começa a 97px e tem 63px de folga; `conferir_zona_segura()`
derruba a geração se alguém mexer na margem e essa folga sumir.

### Não há ícone nenhum nestas peças

A cápsula de categoria do topo é a mesma dos Stories — mesma borda, mesmo raio,
mesmo tracking — **vazia por dentro**: o ponto teal que `pill()` desenha antes
do texto não existe em `capsula_vazia()`. A área continua no lugar, sem nada
dentro dela.

O espaço do ponto sai junto com o ponto. Manter o recuo produziria uma etiqueta
com vão à esquerda e o texto empurrado, que lê como imagem que não carregou —
pior do que o ícone que se queria remover.

O funil da marca segue no fundo a 5,5% e no selo do rodapé. Ele não é ícone de
banco: é a marca, e é a única forma de a peça se identificar sem escrever o
nome três vezes. **Os 5 selos de destaque, esses sim, usam ícone genérico**
(lâmpada, engrenagem, `?`, etiqueta) — foram feitos no Canva e continuam como
estavam; refazê-los é trabalho à parte.

### As cinco peças, na ordem de publicação

| # | arquivo | o que carrega | fonte impressa na arte |
| --- | --- | --- | --- |
| 1 | `feed-1-janela-de-5-minutos.png` | **21x** mais chance respondendo em 5 min | InsideSales / MIT |
| 2 | `feed-2-media-do-mercado.png` | **42h** é a média de primeira resposta | HBR, 2.241 empresas |
| 3 | `feed-3-onde-a-pme-vende.png` | **82%** vendem pelo WhatsApp | Sebrae, Pulso 2026 |
| 4 | `feed-4-morre-calado.png` | Negócio sem próximo passo morre calado | — (declaração) |
| 5 | `feed-5-preco-por-empresa.png` | **R$ 49** por mês, pela empresa inteira | tabela pública de CRMs |

A ordem conta uma história em vez de listar números soltos: existe uma janela,
quase ninguém a cumpre, o canal onde isso acontece é o WhatsApp, o que mata a
venda é não ter próximo passo, e o que custa resolver é R$ 49. **O preço fecha
porque preço abre defesa** — quem lê o valor antes de entender o problema
compara com zero, e as quatro anteriores constroem o custo de não fazer nada.

**Cada número traz a fonte na própria arte**, mesma regra dos Stories: é o que
separa dado público de métrica inventada, e prova social fabricada é decisão
travada contra neste projeto enquanto não houver cliente pagante externo.

A linha da fonte é escrita para quem lê no Instagram, não para quem desenhou.
Duas delas nasceram com nota de bastidor — *"o dado costuma ser creditado à
Harvard, e não é"* (que cita Harvard na arte só para negá-la) e *"Sem citar
nome de concorrente"* (decisão de redação, não atribuição) — e foram
reescritas. Quem vê a peça não tem contexto para nenhuma das duas.

### O fundo muda de peça para peça, de propósito

No Story a luz do halo é escolhida por destaque, porque as telas são vistas em
sequência. No feed elas aparecem **lado a lado na grade**, então a luz é
passada por peça (0.20 a 0.42): cinco fundos idênticos leem como uma imagem
repetida cinco vezes.

Cada peça sai também em `...@4k.png` (2160×2700), reserva para anúncio. **Não
suba o `@4k` direto** — o Instagram recomprime para 1080 de largura de
qualquer jeito, às vezes pior que a redução LANCZOS que o script já faz.

## Convenção de nome de arquivo

**Story de destaque:** `destaque-N-assunto.png`, com `N` na ordem de
publicação (`demo-2-trazer.png`). A ordem está no NOME porque o Instagram
mostra o destaque na sequência em que os Stories foram subidos, e sem ela
sobe-se errado — ao contrário da numeração VISÍVEL na arte, que foi removida
porque quem entra no meio do destaque não viu o "01".

Cada tela sai também em `...@4k.png`, que é reserva para feed e anúncio e
**não** se sobe no Instagram.

**Peça avulsa** (selo, post solto): `AAAA-MM-DD-descricao-curta.png`, para
achar por data depois.

## Destaques (Highlights) do perfil

5 categorias decididas (não copia concorrente — ver rationale completo no
plano desta sessão). Nenhuma prova social inventada (depoimento, prêmio,
"clientes atendidos") até existir cliente pagante real — mesma regra do
produto (`CLAUDE.md`, Decisões travadas).

**Rótulo curto** (limite real do Instagram: ~10-12 caracteres antes de
cortar) — nome exibido embaixo do círculo é diferente do nome de conteúdo
usado nesta tabela:

| # | Rótulo no perfil | Conteúdo (nome interno) | Arquivo local | Design (Canva, editável) |
| --- | --- | --- | --- | --- |
| 1 | **Demo** | Como funciona | `2026-08-15-selo-01-como-funciona.png` | https://www.canva.com/d/y5yCTHPiWgfOujf |
| 2 | **Planos** | Planos | `2026-08-15-selo-02-planos.png` | https://www.canva.com/d/ikkWaVFFiply_9R |
| 3 | **Dicas** | Dicas de venda | `2026-08-15-selo-03-dicas-de-venda.png` | https://www.canva.com/d/-uoDGcqoAD5YxUI |
| 4 | **Bastidores** | Bastidores | `2026-08-15-selo-04-bastidores.png` | https://www.canva.com/d/W3-rbDiviPcGluo |
| 5 | **FAQ** | Perguntas | `2026-08-15-selo-05-perguntas.png` | https://www.canva.com/d/C76ZllXX8PIdlaq |

Sem emoji nos rótulos — tom premium B2B, mesmo padrão de perfis SaaS
sérios (o próprio Pipedrive, mostrado como referência, usa palavra única
sem ícone: "Events", "Swag", "Office").

Todos em `marketing/instagram/`, 1080×1920px PNG, exportados direto do
Canva (`export-design`, PNG lossless). Link do Canva fica pra quem quiser
editar depois (trocar cor, recortar pro círculo do destaque, etc.).

Os 5 ícones foram gerados via Canva MCP (`generate-design`, design_type
`your_story`), mesmo prompt-base pros 5 (fundo `#0A0A0A` sólido, 1 glifo
`#00BFC0` centralizado, sem texto, sem gradiente, sem sombra) — só troca o
ícone central. **Um candidato do selo "Bastidores" saiu com template
promocional errado** ("Unlock Amazing Deals", 20% off) — descartado antes
de aprovar, usado o 2º candidato do mesmo job, que bateu certinho. Todos
os 5 abaixo já foram conferidos visualmente (não só pelo título gerado)
antes de entrar nesta tabela.

Cada destaque só publica no perfil quando tiver pelo menos 1 Story real
dentro — destaque vazio parece pior que não ter destaque nenhum.
