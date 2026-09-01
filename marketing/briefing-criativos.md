# Briefing de criativos — Velo Funil

Você é o diretor de arte de um CRM brasileiro. O trabalho é desenhar as peças
de Instagram — estáticas e em vídeo — e entregar o **script Python** que as
gera.

Este documento é auto-contido. Você não vai ter o repositório, então tudo que
precisa decidir está aqui: as cores exatas, as fontes, as medidas, o que a
marca pode e não pode dizer, e o que já foi tentado e reprovado.

Leia a seção "O que já foi reprovado" antes de desenhar qualquer coisa. Ela
vale mais que qualquer instrução do que fazer.

---

## 1. O produto, em cinco linhas

**Velo Funil** é um CRM para pequena empresa de serviço no Brasil — agência,
consultoria, clínica, imobiliária pequena. Funil de vendas em Kanban.

    grátis      até 50 contatos, sem cartão
    Pro         R$ 49 por mês, PELA EMPRESA INTEIRA, não por vendedor
    site        www.velofunil.com.br

**O posicionamento, e ele decide o tom de tudo:** 82% da pequena empresa
brasileira vende pelo WhatsApp (Sebrae, 8,2 mil ouvidas). O produto **não
compete com o WhatsApp** — a headline da landing é *"O WhatsApp guarda a
conversa. Não guarda o cliente."*

Nunca mande a pessoa trocar de ferramenta. "Mas eu já uso WhatsApp" é a objeção
número 1 do público, e brigar com ela perde a discussão antes de começar.

**A vantagem que nenhum concorrente mapeado tem:** os outros cobram por
vendedor. Cinco pessoas a R$ 53 (mediana pública do mercado) dão R$ 265 por
mês. Aqui são R$ 49, independente de quantas pessoas.

---

## 2. O sistema visual

Estes valores são o sistema real, não sugestão. Eles saem dos tokens de cor do
próprio software, e é isso que faz quem clica no post e chega no produto ver a
mesma marca.

### Formatos

```
feed          1080 x 1350   (4:5)
story / reel  1080 x 1920   (9:16)
supersample   desenhe em 2x e reduza com LANCZOS no fim
```

**A grade do perfil recorta em 3:4.** A peça vai ao feed inteira, mas na grade
o Instagram mostra **1012×1350 centralizado** — 34px somem de cada lado. Quem
desenhar encostado na borda perde conteúdo justamente na tela onde alguém
decide seguir o perfil.

### Paleta

Dois registros. O escuro é o padrão; o claro entra 1 peça a cada 3.

```
                  ESCURO             CLARO
fundo             (4, 32, 33)        (246, 248, 249)
título            (252, 252, 252)    (10, 10, 10)
corpo             (150, 172, 172)    (94, 101, 101)
destaque          (0, 191, 192)      (0, 120, 122)
borda             (42, 46, 48)       (217, 220, 221)
```

O destaque muda de valor entre os registros porque `#00BFC0` sobre fundo claro
dá 2,1:1 e some. `(0, 120, 122)` dá 4,76:1 e sobrevive.

**O ritmo é 1 clara a cada 3, não 1 a cada 2.** A grade do perfil tem três
colunas: numa alternância 1:2 as peças claras cairiam sempre na mesma coluna e
formariam uma listra vertical.

### Tipografia

```
Geist Variable          UltraBlack · Bold · SemiBold · Medium · Regular
Geist Mono              rótulo e unidade. NUNCA corpo de texto
Instrument Serif Italic o número, nas peças sem barra de proporção
```

A serifa itálica existe para uma coisa só: dar peso editorial ao número quando
não há grafismo. Usada em texto corrido, vira decoração.

### Margens e zonas seguras — atenção, elas MUDAM entre arte e vídeo

```
                 arte estática (9:16)   vídeo (Reels/TikTok)
topo                269px   (14%)          220px
base                384px   (20%)          500px
lateral              97px    (9%)          180px
```

A base do vídeo pede **500px** e a lateral **180px**, contra 384 e 97 da arte.
A barra de ações (curtir, comentar, compartilhar) e a pilha de legenda ficam
**por cima** do vídeo.

**Consequência direta: exportar uma arte estática como MP4 enterra o rodapé e a
margem direita debaixo da interface do aplicativo.** É o atalho óbvio e é o
erro mais caro desta frente. A banda útil real do vídeo é **720×1200, de y=220
a y=1420**, e ela precisa fechar: `220 + 1200 + 500 = 1920`.

---

## 3. As restrições que não se negociam

Cada uma existe porque já foi violada.

### A oferta é lida do código, nunca escrita à mão

Preço, teto do plano grátis e nome do plano são interpolados de constantes:

```python
FREE_LEAD_LIMIT = 50    # lido de lib/plans.ts
PRO_PLAN_PRICE  = 49    # lido de lib/plans.ts
```

Em 31 de agosto havia 21 peças prontas anunciando *"7 dias com o Pro
completo"* — um trial que tinha sido removido dois dias antes — e *"contatos
ilimitados"* com o plano grátis em 50. **Imagem não compila.** O gerador é o
último ponto do caminho onde o texto ainda é texto, e é lá que a trava
funciona.

Nunca escreva `R$ 49` literal numa peça. Escreva `f"R$ {PRO_PLAN_PRICE}"`.

### Proibido, sem exceção

```
prova social      não existe cliente externo. Zero depoimento, zero logo,
                  zero "mais de N empresas". Inventar isso é a linha que
                  não se cruza
trial             acabou. Nenhuma peça promete período de teste
"ilimitado"       o grátis tem teto de 50 contatos
travessão (—)     banido do texto das peças E das legendas que você
                  escrever junto. É assinatura de texto de máquina
domínio sem www   sempre www.velofunil.com.br (sem o www custa um
                  redirecionamento: 980ms contra 255ms, medido)
repetir dado      cada número aparece em UMA peça só
uma fonte só      a monoespaçada e a serifa itálica precisam estar em uso.
                  Um conjunto inteiro numa família só é o que fazia as
                  peças anteriores parecerem template
```

### Os dados já em uso — não reaproveite nenhum

```
21x           mais chance de qualificar respondendo em 5 min (InsideSales/MIT)
3,4h          por semana digitando em CRM
55%           das implantações falham, 60% disso é adoção
82%           da PME vende por WhatsApp (Sebrae, 8,2 mil ouvidas)
R$ 265        cinco pessoas a R$ 53 em CRM que cobra por usuário
```

Todo dado precisa da fonte impressa na própria arte. É o único conteúdo que
passa sem esbarrar na regra contra prova social.

### Contraste

```
título    >= 7:1
corpo     >= 4.5:1
destaque  >= 4.5:1
```

Meça, não estime. O registro claro já reprovou uma vez em 3,69:1.

### Determinismo

Sem relógio, sem `random`, sem rede no momento de gerar. Mesma entrada, mesmo
arquivo, sempre. Vale para PNG e para MP4.

---

## 4. O que já foi reprovado

Esta lista é o resultado de peças abertas e olhadas, não de teoria.

```
número cortado no topo       reprovado pelo dono: em miniatura lê como erro
                             de alinhamento, não como escolha

selo com funil dentro        forma dentro de forma. Em 66px vira bloco
                             indistinto. O funil SOZINHO funciona

três barras horizontais
no topo                      leem como skeleton loader de página carregando

grade de 10 colunas num
card de carrossel            passa por cima do rodapé. Parametrize as colunas

vazio no MEIO da peça        40% de buraco central lê como erro de
                             alinhamento. Vazio no FIM é respiro

texto cortado na lateral     corte no topo pode ser decisão; corte lateral é
                             sempre defeito

eyebrow em maiúscula
espaçada em toda peça        clichê número 1 de post corporativo. Se usar,
                             que seja exceção, não padrão

barra de proporção com
parte pequena                3,4h em 40h desenha 8,5%: uma barra quase vazia,
                             e o olho conclui "é pouco" — o contrário do que
                             a frase diz. Proporção só é argumento quando a
                             parte é grande
```

E o teste que separa design de decoração:

> **O grafismo diz algo que o texto teria de explicar?**

Uma grade de 100 blocos com 82 acesos passa: a proporção é vista antes de ser
lida. Textura de fundo não passa.

---

## 5. Vídeo

### Os formatos que este produto pode fazer sem mentir

Não há criador, não há cliente e não há depoimento. Isso elimina UGC, vídeo de
reação e prova social — que são justamente os formatos de maior alcance. Sobra
o que é verdade:

```
demo de tela real       a única prova que este produto tem hoje. O produto
                        existe e está em produção
poster animado          os frames do gerador, com movimento sobre eles
explicador tipográfico  o texto É o visual, que já é o que as artes fazem
```

### As regras de execução

```
canvas        1080x1920, 30fps, MP4
banda útil    720x1200, de y=220 a y=1420
legenda       branca, contorno preto, SEM pílula de fundo.
              paint-order: stroke fill, para o glifo ficar nítido
              ESTÁTICA — legenda animada lê como "feito por marca".
              Ela está em visibilidade cheia no primeiro frame da janela
              dela, e a janela casa exatamente com o segmento
tamanho       comece em ~58px e diminua de 2 em 2 até caber na banda.
              Piso ~26px. Nunca estoure, nunca corte glifo pela metade
fim           fade de ~0.8s. Corte seco para o silêncio lê como quebrado
```

**Áudio, e esta decisão afeta alcance de verdade:** no orgânico, **não** queime
música. Publique sem trilha e anexe o som dentro do aplicativo — o algoritmo
premia áudio nativo, e som anexado no app é descobrível e reutilizável por
outras pessoas. Queimar só em anúncio pago, onde não dá para anexar.

### O pipeline, e por que ele é assim

```
1. o gerador PIL produz os frames        (o texto ainda é texto)
2. ffmpeg monta, por subprocess          (já instalado, versão 8.1.2)
3. a legenda queimada sai do MESMO texto que gerou o frame
```

MP4 é ainda mais opaco que PNG: ninguém audita preço dentro de um vídeo. Se os
frames nascem do mesmo gerador, o vídeo **herda as travas** da arte estática em
vez de abrir uma superfície nova onde a oferta volta a poder mentir.

Não use `moviepy` — não está instalado. `ffmpeg` está, e chamada por
`subprocess` é previsível e sem dependência nova.

### Duração e estrutura

```
15 a 30s      o alvo. Se cabe menor, faça menor
0 a 3s        o gancho. Visual, verbal e texto na tela ao mesmo tempo,
              tudo no primeiro segundo
meio          uma ideia por batida. Calmo e específico bate empolgado
fim           uma linha de chamada, uma só
```

---

## 6. O que entregar

```
3 a 5 composições estáticas novas, cada uma justificada pelo TIPO de
      conteúdo que ela carrega (dado com fonte, declaração sem número,
      card de carrossel, chamada). Composição sem tipo próprio é
      variação, não composição

1 a 2 formatos de vídeo, com o roteiro batido em segundos

o script Python que implementa as duas coisas, usando Pillow para os
      frames e ffmpeg por subprocess para montar

uma peça de exemplo por composição, renderizada e aberta

a montagem 3x3 das estáticas, em miniatura

o primeiro frame de cada vídeo com a zona segura desenhada por cima
```

### A régua

**Para arte, o critério não é a peça isolada: é a grade 3×3 em miniatura.** Foi
ela que revelou os três defeitos da última rodada, e nenhuma medição de peça
sozinha mostra o conjunto. Uma peça linda que empata visualmente com a vizinha
é um defeito de grade, não uma peça boa.

**Para vídeo, o critério é o primeiro frame parado com a zona segura por
cima.** É onde a barra de ações aparece, e é o teste que a arte estática
exportada como MP4 reprova.

### A liberdade que você tem

A paleta, as fontes e os formatos são fixos — eles vêm dos tokens do produto, e
trocá-los criaria uma segunda marca para manter coerente.

**Tudo o mais é seu:** composição, hierarquia, grafismo, uso do vazio, ritmo da
grade, e o desenho inteiro do movimento. É aí que está o trabalho, e é aí que
as peças atuais ainda são genéricas demais.
