# O pacote do Claude designer

Chegou em 01/09/2026, em resposta ao briefing de
[`marketing/briefing-video.md`](../briefing-video.md).

```
velofunil_criativos.py   O GERADOR. Roda. 9 peças 1080x1350, 2 vídeos
                         1080x1920, mosaico 3x3 e travas próprias
briefing/                o briefing visual do designer e o prompt enviado.
                         REFERÊNCIA: não roda aqui
runtime/                 runtime do Claude Design, de terceiro. Só existe
                         para abrir os `.dc.html` de `briefing/`
```

## Como rodar

```sh
python marketing/claude-designer/velofunil_criativos.py --check
python marketing/claude-designer/velofunil_criativos.py --tudo --out ~/Desktop/artes-designer
```

`--check` roda as travas sem desenhar. `--tudo` leva ~35s e produz as nove
peças, o `mosaico_3x3.png` e os dois MP4 com o primeiro frame e a zona segura
marcada.

## Por que ele mora aqui e não em `scripts/marketing/`

Aquela pasta é varrida por `lib/marketing/oferta-nas-artes.test.ts`, que trava
**todo** `.py` que mora nela. Pôr este arquivo lá faria duas coisas de uma vez,
e nenhuma delas foi decidida:

1. **Promoveria o arquivo a gerador oficial**, ao lado dos três que já existem
   (`gerar-stories.py`, `gerar-feed.py`, `gerar-video.py`). Ele cobre feed e
   vídeo com composições que os atuais não têm — a prova de produto e a conta
   por assento —, então a troca é decisão de produto, não de arrumação.
2. **Faria o `npm test` do projeto reprovar**, pelas duas auto-referências
   descritas abaixo.

Enquanto estiver aqui, o `--check` dele é a trava dele. No dia em que virar
oficial, ele muda de pasta e passa a ser varrido junto com os outros.

`runtime/` está no `.graphifyignore` pelo mesmo motivo que `.claude/skills/`
entrou hoje: 125 KB de código de terceiro não é código deste produto, e
competiria com ele numa consulta ao grafo.

## O que foi corrigido para ele rodar

Seis coisas, e nenhuma delas toca no desenho das peças. As quatro primeiras
impediam a execução; as duas últimas apareceram ao abrir as imagens.

**1. As fontes.** Ele procurava uma pasta `fonts/` ao lado dele, com `.ttf`. O
projeto tem `app/fonts/` com `.woff` — e Pillow lê `.woff` variável sem
problema, medido. Agora ele lê a fonte **do produto**: duas pastas de fonte no
mesmo repositório divergiriam, e a arte passaria a desenhar numa fonte que a
tela não usa mais.

**2, 3 e 4. Três falsos positivos do próprio `--check`**, que reprovava o
gerador que ele acompanha:

```
"202"     a regex nao exigia fim de palavra, entao o ANO da pesquisa
          (2025) era lido como o numero 202
"1.126"   as duas pecas de numero citam a MESMA pesquisa. O tamanho da
          amostra e credito de fonte, e credito repetido esta certo
"49"      e o PRECO, interpolado de PRO_PLAN_PRICE. A oferta aparece onde
          precisar; a regra existe para dado de argumento
```

**5. Duas auto-referências nas travas.** O arquivo escrevia as palavras banidas
**dentro dos próprios regexes que as proíbem** — o tracinho longo literal no
`re.compile`, e a palavra proibida na mensagem de erro. É a mesma ironia que
`scripts/marketing/gerar-video.py` pagou horas antes, no mesmo dia.

**6. Duas colisões de pixel**, achadas abrindo as imagens:

```
peca de numero   a linha de credito quebrava em largura fixa (600) e o
                 dominio era desenhado a direita na MESMA base: o "6" de
                 "1.126" saia por baixo do "w" de "www"
video v1         o preco por assento e o rotulo do degrau comecavam no mesmo
                 x, a 8px de distancia vertical com fontes de 22 e 24 —
                 14px de sobreposicao, um "1" em cima de um "53"
```

Nenhuma das duas o `--check` pega, e não tem como: ele lê texto, e colisão é
de pixel. Quem as mostrou foi o **mosaico 3×3**, a régua que o próprio gerador
produz.

## Uma leitura minha que estava errada

Ao abrir o frame com a zona segura, julguei que "POR PESSOA" e a legenda saíam
da banda útil. **Não saem.** Medido varrendo a peça inteira em sete instantes,
nos dois vídeos: **0px** acima do topo, abaixo da base e nos dois lados. O que
eu vi como corte era a faixa translúcida do overlay de conferência passando
por cima do texto.

A conta fecha: `220 + 1200 + 500 = 1920`.

## O que ainda não foi decidido

Substituir os geradores atuais por este. Ele é melhor no que faz — as
composições são distintas entre si, a grade tem ritmo e há uma peça que mostra
o produto, coisa que nenhuma das nossas fazia. Mas trocar é decisão de produto,
e ela fica melhor depois de as nove peças serem vistas.
