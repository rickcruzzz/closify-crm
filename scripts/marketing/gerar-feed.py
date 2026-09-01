"""
As artes de FEED do Instagram — 1080x1350, o formato retrato.

    python scripts/marketing/gerar-feed.py

## Por que 1080x1350, e não o quadrado

O quadrado é o formato que todo mundo lembra e não é mais o que o Instagram
recomenda. Conferido em 29/08/2026 contra guias de tamanho atualizados: 4:5 é
a moldura mais alta que o feed aceita, e altura é a única variável que aumenta
o tempo que a peça fica na tela de quem rola. `lib/dono/formatos-do-meta.ts` já
classificava essa medida como "Feed no celular, ocupa mais tela" desde 20/08.

**A grade do perfil recorta em 3:4, e isso NÃO estava registrado em lugar
nenhum deste projeto.** A peça vai ao feed inteira, em 4:5, mas na grade do
perfil o Instagram mostra 1012x1350 centralizado — 34px somem de cada lado.
Quem desenhar encostado na borda perde conteúdo justamente na tela onde alguém
decide se segue o perfil.

Aqui isso não é risco, e por construção: a coluna de texto começa a 9% da
largura (97px) e termina a 97px da outra borda, com 63px de folga sobre o
recorte dos dois lados. `conferir_zona_segura()` falha se alguém mexer nas
margens e essa folga desaparecer.

## O que estas artes NÃO têm

**Nenhum ícone.** A cápsula de categoria do topo é a mesma dos Stories — mesma
borda, mesmo raio, mesmo tracking —, só que vazia por dentro: o ponto teal que
os Stories desenham antes do texto não existe aqui. A área continua no lugar,
sem nada dentro dela.

O funil da marca segue no fundo a 5,5% e no selo do rodapé. Ele não é ícone de
banco: é a marca, e é a única forma de a peça se identificar sem escrever o
nome três vezes.

## Por que só dado com fonte

As cinco peças carregam número de pesquisa pública com a fonte impressa na
própria arte, ou preço de tabela. É o único conteúdo que pode ir ao feed sem
esbarrar na decisão travada deste projeto contra prova social inventada — não
existe cliente pagante externo, então depoimento, "+500 empresas" e estrela de
avaliação estão fora, e continuariam fora mesmo que rendessem mais.
"""

import importlib.util
import sys
from pathlib import Path

from PIL import Image, ImageDraw

# O gerador de Stories tem hífen no nome, que não é identificador Python — daí
# o carregamento por caminho. Importar em vez de copiar: fundo, halo, marca
# de água, tipografia, medição e assinatura já existem lá, provados em vinte
# telas. Duplicá-los faria as duas famílias divergirem no primeiro ajuste.
_spec = importlib.util.spec_from_file_location(
    "gerar_stories", Path(__file__).resolve().parent / "gerar-stories.py"
)
g = importlib.util.module_from_spec(_spec)
sys.modules["gerar_stories"] = g
_spec.loader.exec_module(g)


# ----------------------------------------------------------- o formato muda
#
# As funções do gerador de Stories leem `W`, `H`, `MARGEM_ESQ` e as zonas
# seguras como globais DO MÓDULO, resolvidas em tempo de chamada. Reatribuí-las
# aqui reconfigura todas elas de uma vez — mas só junto com as derivadas, que
# foram computadas uma única vez no import e não se atualizam sozinhas.

g.W_FINAL, g.H_FINAL = 1080, 1350
g.W, g.H = g.W_FINAL * g.ESCALA, g.H_FINAL * g.ESCALA

# **Story e feed têm zonas seguras diferentes, e por motivos diferentes.**
# No Story os 14%/20% são a interface do Meta — barra de progresso em cima,
# campo de resposta embaixo — cobrindo a arte. O feed não tem nada por cima:
# aqui a margem é respiro de composição, e por isso é menor. Copiar os 14%/20%
# do Story desperdiçaria um terço da peça com vazio que não protege nada.
g.SEGURO_TOPO = int(g.H * 0.09)
# 13% e não menos: a assinatura do rodapé desenha ~110px abaixo da própria
# linha (filete, depois selo de 66px), e uma base curta a empurraria para fora
# da peça.
g.SEGURO_BASE = int(g.H * 0.13)

g.MARGEM_ESQ = int(g.W * 0.09)
g.LARGURA_TEXTO = int(g.W * 0.82)

# O rascunho de medição nasceu com a altura do Story; deixá-lo mediria o bloco
# contra uma tela que não é esta.
g._RASCUNHO = None

SAIDA = g.RAIZ / "marketing" / "instagram" / "feed"

# ## O preço do concorrente vem do módulo comum
#
# Não sai de `lib/plans.ts`: não é o nosso preço, é a mediana de tabela pública
# dos CRMs que cobram por usuário. Fica nomeada num lugar só porque aparece em
# três peças e a conta de cinco pessoas é derivada dela — escrita à mão nos
# três lugares, bastaria corrigir dois para a arte passar a mentir sozinha.
#
# É preço de tabela pública, e por isso pode ser dito: não é prova social
# inventada, é aritmética sobre número que qualquer um confere no site deles.

# Largura que sobrevive ao recorte 3:4 da grade do perfil, e a folga mínima
# que a coluna de texto tem que manter sobre ela.
RECORTE_DA_GRADE = int(g.H_FINAL * 3 / 4)


def salvar(img, nome):
    """Publicação em 1080x1350 e uma reserva @4k, o mesmo par dos Stories."""
    final = img.resize((g.W_FINAL, g.H_FINAL), Image.LANCZOS)
    final.save(SAIDA / f"{nome}.png")
    img.save(SAIDA / f"{nome}@4k.png")
    print(f"  {nome}.png  ({final.width}x{final.height})  +  @4k")


# A cápsula de categoria vem do gerador de Stories, não de uma cópia daqui.
#
# Existiu uma `capsula_vazia()` neste arquivo, idêntica à `pill()` de lá menos
# o ponto teal que ela desenhava antes do texto. Em 30/08 o ponto saiu do
# gerador de Stories também, e as duas funções passaram a ser a mesma coisa
# escrita duas vezes — que é exatamente o defeito que este projeto acabou de
# pagar em `loading.tsx` contra `page.tsx`, onde duas cópias da mesma string
# divergiram por dez dias sem nenhum portão perceber.
#
# Agora existe uma cápsula só. Mudar borda, raio ou tracking muda o Story e o
# feed juntos, que é o que mantém as duas famílias parecendo a mesma marca.
capsula_vazia = g.pill


# ## O ritmo claro/escuro da grade
#
# A cada três peças avulsas, a terceira nasce no registro claro. A proporção
# fica AQUI e não em cada chamada porque escolher à mão derivaria na primeira
# peça nova: alguém acrescenta duas escuras seguidas e ninguém percebe até a
# grade estar publicada.
#
# 1 em 3, e não 1 em 2, por causa de como o Instagram monta a grade: são três
# colunas, então 1:2 alinharia as claras numa coluna só e criaria uma faixa
# vertical. Com 1:3 elas caminham na diagonal, que dá ritmo em vez de listra.
#
# Os CARROSSÉIS ficam de fora: os cinco cards precisam ser do mesmo registro,
# senão a peça pisca quando a pessoa desliza o dedo.
_CONTADOR_DE_RITMO = {"n": 0}


def proximo_registro() -> bool:
    """True quando a próxima peça avulsa deve nascer clara."""
    _CONTADOR_DE_RITMO["n"] += 1
    return _CONTADOR_DE_RITMO["n"] % 3 == 0


def grade_de_cem(draw, y, parte, cor_aceso, cor_apagado, cols=10):
    """
    Cem blocos, `parte` deles acesos. Devolve o y do fim.

    ## Por que desenhar o dado em vez de escrever o número

    "82%" é uma afirmação: quem lê precisa acreditar. Oitenta e dois quadrados
    acesos entre cem são a mesma informação em forma de evidência — o olho
    conta a proporção antes de o cérebro ler o rótulo, e não há como discordar
    de uma área.

    É a única composição desta família em que o grafismo diz algo que o texto
    teria de explicar. Nas outras, forma sem conteúdo seria decoração, que é o
    que faz peça parecer template.

    ## Dez por dez, e não uma barra

    Barra de proporção já existe aqui (`barra_de_proporcao`) e serve para
    comparar duas grandezas. A grade serve para outra coisa: ela mostra a
    UNIDADE. Cada bloco é uma empresa, e "82 em cada 100" é como a pesquisa do
    Sebrae foi feita — 8,2 mil ouvidas. A forma espelha o método.
    """
    larg = g.W - g.MARGEM_ESQ * 2
    gap = 9 * g.ESCALA
    lado_x = (larg - gap * (cols - 1)) / cols
    linhas = 100 // cols
    # ## A proporção do bloco depende de quantas linhas existem
    #
    # Com 10 colunas são 10 linhas, e blocos quadrados ocupariam 60% da peça.
    # Com 20 colunas são 5, e aí o bloco pode ser mais alto que largo sem
    # sufocar nada.
    #
    # Achado gerando: a primeira versão usava 10 colunas em todo lugar, e no
    # card de carrossel — que já tem cápsula, número, título e corpo antes da
    # grade — ela passou POR CIMA do rodapé e saiu pela borda. `medir()` não
    # pega isso: ele mede o bloco, não se o bloco cabe.
    lado_y = lado_x * (0.62 if linhas >= 10 else 1.15)
    for i in range(100):
        cx = g.MARGEM_ESQ + (i % cols) * (lado_x + gap)
        cy = y + (i // cols) * (lado_y + gap)
        draw.rounded_rectangle([cx, cy, cx + lado_x, cy + lado_y],
                               radius=6 * g.ESCALA,
                               fill=cor_aceso if i < parte else cor_apagado)
    return y + linhas * (lado_y + gap)


def arte_numero(numero, unidade, explicacao, fonte_dado, arquivo, categoria, luz,
                claro=False, proporcao=None):
    """
    Duas composições, escolhidas pelo que o dado É.

    ## `proporcao` presente: o dado vira grade de 100

    Só faz sentido quando o número é uma parte de um todo conhecido — 82%, 55%.
    Aí o desenho carrega o argumento e o algarismo vira legenda.

    ## `proporcao` ausente: serifa itálica em corpo grande

    "21x" e "42h" não têm todo para desenhar; forçar um gráfico ali seria
    inventar uma proporção que o dado não tem, o que é pior que número escrito.

    A serifa entra porque era o que faltava: as 21 peças usavam Geist bold com
    Geist regular, contraste de PESO e nenhum de VOZ. `InstrumentSerif-Italic`
    já estava no projeto, usada em duas palavras de duas peças — e era o único
    momento com personalidade nas vinte e uma.

    ## O corte no topo saiu

    A versão anterior sangrava o número pela borda de cima. Reprovado olhando a
    grade: em miniatura lê como erro de alinhamento, não como intenção. Corte
    só funciona quando quem vê tem certeza de que foi de propósito, e 3:4 a
    150px de largura não dá essa certeza.
    """
    g._TEMA_CLARO = claro
    g._LUZ_ATUAL = luz
    img = g.fundo_do_tema(escuro_extra=0.16 if not claro else 0.0)
    draw = ImageDraw.Draw(img)
    topo, base = g.faixa_livre()

    if proporcao is not None:
        def bloco(d, y):
            # O rótulo em mono: é a voz de software, e diz de onde o dado vem
            # antes de o desenho aparecer.
            d.text((g.MARGEM_ESQ, y), categoria_em_mono(categoria),
                   font=g.mono(30, 500), fill=g.cor_rotulo_mono())
            y += 74 * g.ESCALA
            y = grade_de_cem(d, y, proporcao, g.cor_destaque(),
                             g.cor_bloco_apagado())
            y += 62 * g.ESCALA
            d.text((g.MARGEM_ESQ, y), numero, font=g.fonte(g.DISPLAY, 130),
                   fill=g.cor_titulo())
            cx = d.textbbox((g.MARGEM_ESQ, y), numero, font=g.fonte(g.DISPLAY, 130))
            d.text((cx[2] + 14 * g.ESCALA, cx[3] - 54 * g.ESCALA),
                   f"em cada {100}", font=g.mono(32, 500), fill=g.cor_corpo())
            y = cx[3] + 22 * g.ESCALA
            y = g.escrever_esq(d, unidade, g.fonte(g.TITULO, 58), y, g.cor_titulo(),
                               entrelinha=1.14)
            y += 30 * g.ESCALA
            return g.escrever_esq(d, fonte_dado, g.fonte(g.CORPO, 29), y,
                                  g.cor_fonte_dado(), entrelinha=1.26)
    else:
        def bloco(d, y):
            d.text((g.MARGEM_ESQ, y), numero, font=g.italica(300),
                   fill=g.cor_destaque())
            cx = d.textbbox((g.MARGEM_ESQ, y), numero, font=g.italica(300))
            y = cx[3] + 30 * g.ESCALA
            # O filete separa o dado do que ele significa. Curto de propósito:
            # atravessar a peça inteira viraria divisória de slide.
            d.line([(g.MARGEM_ESQ, y), (g.MARGEM_ESQ + 130 * g.ESCALA, y)],
                   fill=g.cor_filete(), width=3 * g.ESCALA)
            y += 42 * g.ESCALA
            y = g.escrever_esq(d, unidade, g.fonte(g.TITULO, 64), y, g.cor_titulo(),
                               entrelinha=1.14)
            y += 28 * g.ESCALA
            y = g.escrever_esq(d, explicacao, g.fonte(g.CORPO, 42), y, g.cor_corpo(),
                               entrelinha=1.34)
            y += 34 * g.ESCALA
            return g.escrever_esq(d, fonte_dado, g.fonte(g.CORPO, 29), y,
                                  g.cor_fonte_dado(), entrelinha=1.26)

    bloco(draw, g.centrar(topo, base, g.medir(bloco)))
    g.assinar_discreto(img, draw)
    salvar(img, arquivo)
    g._TEMA_CLARO = False


def categoria_em_mono(categoria):
    """
    O rótulo em caixa alta espaçada vira comentário de código.

    `"D A D O   D E   M E R C A D O"` era espaçado letra a letra na string, o
    truque de tracking sem suporte a `letter-spacing`. Em mono o espaçamento já
    vem da fonte, então o texto volta a ser texto — e ganha o `//`, que é o que
    o faz ler como anotação de software em vez de etiqueta de apresentação.
    """
    return "// " + " ".join(categoria.split()).lower()


def arte_declaracao(categoria, titulo, corpo, arquivo, luz, remate=None,
                    claro=False):
    """
    Só tipografia, centralizada no quadro, com ar deliberado dos dois lados.

    ## O vazio deixou de ser sobra

    A versão anterior ancorava o bloco no alto e deixava ~30% de espaço morto
    entre o fim do corpo e o filete do rodapé. Não era respiro: era o que
    sobrou depois que o texto acabou.

    Centralizando na faixa livre, o mesmo espaço se divide em cima e embaixo e
    passa a enquadrar a frase. É a diferença entre uma peça que termina e uma
    que respira — e não custa um pixel de conteúdo novo.

    `g.medir` faz a passada seca que torna isso possível: dá para saber a
    altura do bloco antes de desenhá-lo, sem chutar.
    """
    g._TEMA_CLARO = claro
    g._LUZ_ATUAL = luz
    img = g.fundo_do_tema(escuro_extra=0.10 if not claro else 0.0)
    draw = ImageDraw.Draw(img)
    topo, base = g.faixa_livre()

    def bloco(d, y):
        y = capsula_vazia(d, categoria, y) + 54 * g.ESCALA
        y = g.escrever_esq(d, titulo, g.fonte(g.TITULO, 88), y, g.cor_titulo(),
                           entrelinha=1.16)
        y += 30 * g.ESCALA
        y = g.escrever_esq(d, corpo, g.fonte(g.CORPO, 44), y, g.cor_corpo(),
                           entrelinha=1.34)
        if remate:
            y += 28 * g.ESCALA
            y = g.escrever_esq(d, remate, g.fonte(g.FORTE, 46), y,
                               g.cor_destaque(), entrelinha=1.22)
        return y

    bloco(draw, g.centrar(topo, base, g.medir(bloco)))
    g.assinar_discreto(img, draw)
    salvar(img, arquivo)
    g._TEMA_CLARO = False


# ------------------------------------------------------------- carrossel
#
# ## Por que carrossel, e o que foi tirado do modelo da concorrência
#
# Os cinco posts do @ploomescrm trazidos como referência em 31/08 são todos
# carrossel (2/5, 1/4). É o formato da categoria, e o que o algoritmo premia em
# B2B — carrossel gera salvamento e compartilhamento, que pesam mais que
# curtida.
#
# O que veio de lá: o formato, o gancho em pergunta, a palavra realçada na
# headline, o CTA desenhado com "Link na bio", e a progressão (abre, prova,
# explica, fecha).
#
# O que NÃO veio, e é decisão: o roxo (é a marca deles), a foto de banco com
# overlay, e os cards de interface falsos flutuando sobre a foto. Os dois
# últimos porque inventam uma tela que não existe — e este projeto já paga caro
# por print que não corresponde ao produto (19/08 e 24/08).
#
# **O dado que sustenta a poda:** aqueles cinco posts têm 4, 5, 5, 7 e 5
# curtidas. Copiar a embalagem inteira seria copiar o resultado junto.
#
# ## Cada card é uma peça inteira
#
# Não é uma imagem larga fatiada. O Instagram trata carrossel como N peças
# independentes, e alguém pode salvar ou compartilhar um card isolado — o que
# só funciona se ele se explicar sozinho. Por isso todos levam a assinatura de
# rodapé, e não apenas o último.


def barra_de_proporcao(draw, y, parte, total, rotulo_parte, rotulo_resto, largura=None):
    """
    Mostra o dado em vez de só escrevê-lo.

    ## Por que uma barra, e não pizza

    A skill de design deste projeto é explícita: para part-to-whole, barra
    empilhada com legenda; pizza é ruim de acessibilidade e pior de comparar.
    Aqui o argumento é ainda mais simples — num criativo lido em dois segundos,
    a barra é a única forma que se entende sem legenda, porque o comprimento é
    a grandeza.

    ## O que ela resolve

    "55%" escrito é um símbolo: o olho lê o número e segue. Uma barra em que
    mais da metade está acesa faz o leitor VER a proporção antes de ler
    qualquer palavra — e é isso que separa um dado de uma afirmação.

    O trecho apagado usa a cor de borda do sistema em vez de um cinza novo: o
    resto não é "vazio", é a parte que não aconteceu, e precisa existir na
    composição para o cheio significar alguma coisa.
    """
    if largura is None:
        largura = g.LARGURA_TEXTO

    altura = 22 * g.ESCALA
    raio = altura // 2
    fim_parte = g.MARGEM_ESQ + int(largura * parte / total)

    # O trilho inteiro primeiro, depois a parte acesa por cima: desenhar dois
    # retângulos lado a lado deixaria uma junta visível no arredondamento.
    draw.rounded_rectangle(
        [g.MARGEM_ESQ, y, g.MARGEM_ESQ + largura, y + altura],
        radius=raio, fill=(0, 74, 76),
    )
    draw.rounded_rectangle(
        [g.MARGEM_ESQ, y, fim_parte, y + altura], radius=raio, fill=g.TEAL,
    )

    y += altura + 20 * g.ESCALA
    fnt = g.fonte(g.CORPO, 30)

    draw.text((g.MARGEM_ESQ, y), rotulo_parte, font=fnt, fill=g.TEAL)
    largura_resto = draw.textlength(rotulo_resto, font=fnt)
    draw.text((g.MARGEM_ESQ + largura - largura_resto, y), rotulo_resto,
              font=fnt, fill=(110, 132, 132))

    return y + fnt.size * 1.3


def marcador_de_passo(draw, atual, total):
    """
    Onde a pessoa está na sequência, no topo.

    Carrossel sem isso é leitura no escuro: não se sabe se falta um card ou
    quatro, e a decisão de continuar deslizando é tomada sem informação. Os
    pontinhos nativos do Instagram ficam FORA da arte, minúsculos e no rodapé
    da tela — servem ao aplicativo, não à peça.

    Traços e não pontos: traço tem direção, e direção é o que comunica "isto
    avança". Ponto comunica lista, que é outra coisa.
    """
    largura, altura, folga = 46 * g.ESCALA, 5 * g.ESCALA, 10 * g.ESCALA
    y = int(g.H * 0.058)
    x = g.MARGEM_ESQ

    for i in range(1, total + 1):
        aceso = i <= atual
        draw.rounded_rectangle(
            [x, y, x + largura, y + altura], radius=altura // 2,
            fill=g.TEAL if aceso else (0, 74, 76),
        )
        x += largura + folga


def _peca(luz, escuro_extra, bloco, passo=None):
    """
    Fundo, posicionamento, assinatura. O miolo vem de fora.

    ## O card ancora no TOPO, e a peça única centraliza

    Esta é a única diferença estrutural entre as duas famílias, e ela existe
    por causa de como cada uma é vista.

    Peça única aparece sozinha na tela: centralizar dá equilíbrio, e não há com
    o que comparar. Carrossel é percorrido com o dedo, e o olho fica PARADO
    enquanto o conteúdo desliza por baixo dele — então a altura em que a
    headline começa vira posição fixa na tela.

    Medido nos cinco cards antes desta correção, com centragem: o texto
    começava em 369, 283, 297, 328 e 322px. **86px de variação**, e cada
    deslize fazia o título saltar sob o dedo. É o tipo de defeito que não dá
    erro, não aparece em card isolado, e faz a sequência inteira parecer mal
    montada sem que se saiba dizer por quê.

    Ancorado no topo da faixa livre, os cinco começam na mesma linha e a
    transição fica estável. O vazio que sobra vai todo para a base, onde ele é
    respiro em vez de desalinhamento.
    """
    g._LUZ_ATUAL = luz
    img = g.fundo_marca(escuro_extra=escuro_extra)
    draw = ImageDraw.Draw(img)
    topo, _base = g.faixa_livre()
    if passo:
        marcador_de_passo(draw, *passo)
    bloco(draw, topo)
    g.assinar_discreto(img, draw)
    return img


def card_gancho(partes, apoio, luz, passo=None):
    """
    O primeiro card: uma pergunta, com a palavra que dói em itálico serifado.

    `partes` é a lista de `(texto, realce)` de `escrever_com_realce`.

    A pergunta abre porque afirmação convida a discordar e pergunta convida a
    responder — e quem responde na cabeça já parou de rolar. É o que os cinco
    prints de referência fazem sem exceção ("Você ainda acha que…", "Sua
    empresa vende muito, mas…").

    Sem rótulo de categoria aqui, de propósito: o card 1 tem uma função só, que
    é parar o dedo. Um rótulo acima da pergunta rouba a primeira linha de
    leitura para dizer algo que ninguém precisa saber ainda.
    """
    def bloco(d, y):
        y = g.escrever_com_realce(
            d, partes, g.fonte(g.TITULO, 94), g.italica(108),
            y, g.BRANCO, g.TEAL, entrelinha=1.18,
        )
        if apoio:
            y += 40 * g.ESCALA
            y = g.escrever_esq(d, apoio, g.fonte(g.CORPO, 48), y, (168, 190, 190),
                               entrelinha=1.36)
        return y

    return _peca(luz, 0.12, bloco, passo)


def card_dado(numero, unidade, explicacao, fonte_dado, categoria, luz, passo=None,
              proporcao=None, remate=None):
    """O card de prova. Mesmo esqueleto de `arte_numero`, sem salvar."""
    # 258 quando o número é o protagonista; 176 quando existe grade, porque
    # aí quem prova é o desenho e o algarismo vira legenda dele. Dois
    # elementos disputando o mesmo papel deixam o card confuso.
    fnt_num = g.fonte(g.DISPLAY, 176 if (proporcao and proporcao[1] == 100) else 258)

    def bloco(d, y):
        y = capsula_vazia(d, categoria, y) + 50 * g.ESCALA
        d.text((g.MARGEM_ESQ, y), numero, font=fnt_num, fill=g.TEAL)
        _, _, _, fim = d.textbbox((g.MARGEM_ESQ, y), numero, font=fnt_num)
        y = fim + 24 * g.ESCALA
        y = g.escrever_esq(d, unidade, g.fonte(g.TITULO, 72), y, g.BRANCO)
        y += 32 * g.ESCALA
        y = g.escrever_esq(d, explicacao, g.fonte(g.CORPO, 46), y, (168, 190, 190),
                           entrelinha=1.36)
        # A barra entra ENTRE a explicação e a fonte, não no fim: ela é parte
        # do argumento, e a fonte é o rodapé dele. Invertido, o crédito
        # separaria o dado da sua própria ilustração.
        #
        # ## Grade de 100 quando o todo É 100
        #
        # Proporção sobre 100 vira grade: cada bloco é uma empresa, e "82 em
        # cada 100" é literalmente como a pesquisa do Sebrae foi feita. A
        # barra continua para o resto, onde o todo é outra coisa (40 horas de
        # semana, por exemplo) e cem blocos mentiriam sobre a unidade.
        if proporcao:
            y += 40 * g.ESCALA
            if proporcao[1] == 100:
                # 20 colunas no carrossel: o card já gastou metade da
                # altura antes de chegar aqui.
                y = grade_de_cem(d, y, proporcao[0], g.TEAL, (0, 66, 68), cols=20)
            else:
                y = barra_de_proporcao(d, y, *proporcao)
        # O remate é a conclusão que o número não diz sozinho. Em teal e peso
        # forte porque é a frase que a pessoa deve levar embora — o dado é a
        # prova, isto é o argumento.
        if remate:
            y += 40 * g.ESCALA
            y = g.escrever_esq(d, remate, g.fonte(g.FORTE, 52), y, g.TEAL,
                               entrelinha=1.24)
        y += 34 * g.ESCALA
        return g.escrever_esq(d, fonte_dado, g.fonte(g.CORPO, 28), y, (110, 132, 132),
                              entrelinha=1.26)

    return _peca(luz, 0.15, bloco, passo)


def card_causa(titulo, corpo, luz, passo=None):
    """
    O card que explica. Só tipografia, corpo grande.

    Vem depois dos dados porque explicação antes de prova é opinião; depois de
    prova, é conclusão.
    """
    def bloco(d, y):
        y = g.escrever_esq(d, titulo, g.fonte(g.TITULO, 86), y, g.BRANCO, entrelinha=1.18)
        y += 32 * g.ESCALA
        return g.escrever_esq(d, corpo, g.fonte(g.CORPO, 48), y, (168, 190, 190),
                              entrelinha=1.38)

    return _peca(luz, 0.10, bloco, passo)


def card_cta(chamada, apoio, luz, passo=None):
    """
    O último card: o que fazer, e onde.

    O botão é DESENHADO, não escrito — a forma de botão é o que faz o olho
    entender "aqui se age" antes de ler. Os prints de referência fazem isso, e
    é o único elemento de interface que cabe num criativo: ele não finge ser
    uma tela do produto, ele é a chamada da peça.

    "Link na bio" logo abaixo porque o botão não é clicável, e o Instagram não
    dá link em post de feed. Sem essa linha, a peça pede uma ação impossível.
    """
    fnt_ch = g.fonte(g.TITULO, 86)
    fnt_bt = g.fonte(g.FORTE, 44)
    rotulo = "Comece grátis"

    def bloco(d, y):
        y = g.escrever_esq(d, chamada, fnt_ch, y, g.BRANCO, entrelinha=1.18)
        y += 30 * g.ESCALA
        y = g.escrever_esq(d, apoio, g.fonte(g.CORPO, 48), y, (168, 190, 190),
                           entrelinha=1.36)
        y += 64 * g.ESCALA

        pad_x, pad_y = 52 * g.ESCALA, 30 * g.ESCALA
        larg = d.textlength(rotulo, font=fnt_bt) + pad_x * 2
        alt = fnt_bt.size + pad_y * 2
        d.rounded_rectangle([g.MARGEM_ESQ, y, g.MARGEM_ESQ + larg, y + alt],
                            radius=int(alt / 2), fill=g.TEAL)
        d.text((g.MARGEM_ESQ + pad_x, y + pad_y - 4 * g.ESCALA), rotulo,
               font=fnt_bt, fill=(3, 16, 16))
        y += alt + 26 * g.ESCALA

        return g.escrever_esq(d, "Link na bio", g.fonte(g.CORPO, 34), y,
                              (122, 214, 214))

    return _peca(luz, 0.18, bloco, passo)


def carrossel(nome, cards):
    """
    Salva a sequência como `nome-1.png … nome-N.png`, mais os `@4k`.

    A numeração é a ordem de publicação e não pode depender da ordem em que os
    arquivos aparecem no disco: `create_carousel_post` do Windsor recebe a
    lista de URLs e publica NA ORDEM DADA, então um card fora de posição quebra
    a narrativa inteira sem dar erro em lugar nenhum.
    """
    for i, img in enumerate(cards, start=1):
        salvar(img, f"{nome}-{i}")
    print(f"  {nome}: {len(cards)} cards")


def conferir_zona_segura():
    """
    A coluna de texto cabe no recorte 3:4 da grade do perfil?

    Falha em vez de avisar. Margem é o tipo de número que alguém ajusta por
    gosto meses depois, e o prejuízo — texto cortado na grade — só aparece no
    aplicativo de outra pessoa, nunca no arquivo que se abre para conferir.
    """
    borda = (g.W_FINAL - RECORTE_DA_GRADE) / 2
    margem = g.MARGEM_ESQ / g.ESCALA
    folga = margem - borda
    if folga < 20:
        raise SystemExit(
            f"A margem de {margem:.0f}px deixa só {folga:.0f}px de folga sobre o "
            f"recorte 3:4 da grade (corta {borda:.0f}px de cada lado). Aumente "
            f"MARGEM_ESQ."
        )
    print(f"  zona segura: recorte 3:4 tira {borda:.0f}px de cada lado, "
          f"texto começa a {margem:.0f}px, folga de {folga:.0f}px")


# ------------------------------------------------------------- as cinco peças
#
# A ordem é de publicação, e ela conta uma história em vez de listar números
# soltos: existe uma janela (21x), quase ninguém a cumpre (42h), o canal onde
# isso acontece é o WhatsApp (82%), o que faz a venda morrer é não ter próximo
# passo, e o que custa resolver é R$ 49 pela empresa inteira.
#
# O preço fecha porque preço abre defesa: quem lê o valor antes de entender o
# problema compara com zero. As quatro peças anteriores constroem o custo de
# não fazer nada.

def main():
    print("FEED 1080x1350")
    SAIDA.mkdir(parents=True, exist_ok=True)
    conferir_zona_segura()
    print()

    arte_numero(
        "21x", "mais chance de qualificar",
        "Responder em 5 minutos em vez de 30. A conta não é sobre ser rápido: "
        "é sobre chegar enquanto a pessoa ainda está decidindo.",
        "Estudo InsideSales com o MIT sobre tempo de resposta a lead.",
        "feed-1-janela-de-5-minutos", "D A D O   D E   M E R C A D O", 0.30, claro=proximo_registro(),
    )


    # A peça "82% vendem pelo WhatsApp" saiu em 31/08, por decisão do dono:
    # nenhum tema de WhatsApp nesta rodada do feed. Ela continua verdadeira e
    # continua sendo o eixo da landing — só não entra aqui agora.
    #
    # Sem esse eixo, o conteúdo volta para a dor que o produto resolve sem
    # depender de canal: o pedágio de digitação e a venda que morre parada.



    arte_declaracao(
        "A   O B J E Ç Ã O   M A I S   C O M U M",
        "O funil não mente. A memória mente.",
        "Guardar na cabeça funciona com cinco clientes. Com trinta, o que "
        "some não é o cliente que você lembra: é o que você esqueceu.",
        "feed-7-memoria-mente", 0.38, claro=proximo_registro(),
    )


    arte_declaracao(
        "O   S I N A L   Q U E   N I N G U É M   O L H A",
        "Negócio sem próximo passo morre calado",
        "Ele não dá erro, não avisa e não aparece em relatório. Só para de "
        "andar. Quando alguém lembra, o cliente já comprou de outro.",
        "feed-4-morre-calado", 0.20, claro=proximo_registro(),
    )

    arte_numero(
        f"R$ {g.PRO_PLAN_PRICE}", "por mês, pela empresa inteira",
        "Não por vendedor. A maioria dos CRMs cobra por pessoa, e cinco "
        f"pessoas a R$ {g.PRECO_POR_USUARIO} fecham a conta em "
        f"R$ {g.PRECO_POR_USUARIO * 5} todo mês.",
        "Preço de tabela pública de CRMs que cobram por usuário.",
        "feed-5-preco-por-empresa", "A   C O N T A   Q U E   N I N G U É M   F A Z", 0.36, claro=proximo_registro(),
    )

    # ---------------------------------------------------- o primeiro carrossel
    #
    # Tema: o pedágio de digitação. É a dor central de `docs/dor-de-mercado.md`,
    # é o que separa este produto do concorrente que cobra por vendedor, e não
    # toca em WhatsApp — restrição desta rodada.
    #
    # A luz do fundo sobe de card para card (0.16 → 0.46). Numa sequência que a
    # pessoa percorre com o dedo, fundo idêntico cinco vezes lê como a mesma
    # imagem travada; a variação dá a sensação de estar avançando.
    print()
    carrossel("carrossel-1-pedagio", [
        card_gancho(
            [("Você comprou um CRM. Quem ", False), ("alimenta", True),
             (" ele?", False)],
            "Ninguém vende a parte chata na hora da contratação.",
            luz=0.16, passo=(1, 5),
        ),
        card_dado(
            "3,4h", "por semana só digitando",
            "É o que um vendedor gasta alimentando CRM à mão, tempo que "
            "viraria proposta e vira cadastro.",
            "Número de mercado. Varia com o tamanho da equipe.",
            "D A D O   D E   M E R C A D O", luz=0.28, passo=(2, 5),
            # ## Por que este card NÃO leva barra de proporção
            #
            # A primeira versão tinha `proporcao=(3.4, 40, ...)`, ancorando as
            # 3,4h numa semana de 40h. Aberta a arte e olhada: 8,5% desenha uma
            # barra quase vazia, e o olho conclui "é pouco" — o contrário
            # exato do que a frase diz.
            #
            # Proporção só é argumento quando a parte é grande em relação ao
            # todo. Aqui o argumento é ACUMULAÇÃO: pouco por semana que vira
            # muito no ano. Isso é uma frase, não uma barra — e é o que o
            # remate faz.
            remate="22 dias por ano. Quase um mês de trabalho.",
        ),
        card_dado(
            "55%", "das implantações falham",
            "E 60% disso é adoção, não plataforma. O problema quase nunca é o "
            "sistema que foi escolhido.",
            "Número de mercado, recorrente em levantamentos do setor.",
            "D A D O   D E   M E R C A D O", luz=0.36, passo=(3, 5),
            proporcao=(55, 100, "55% falham", "45% vingam"),
        ),
        card_causa(
            "O sistema funciona. Quem desiste é a pessoa.",
            "Toda ferramenta cobra um pedágio de digitação antes de devolver "
            "qualquer coisa. Quem paga esse pedágio todo dia é quem deveria "
            "estar vendendo, e na terceira semana ele para de pagar.",
            luz=0.42, passo=(4, 5),
        ),
        card_cta(
            "Um funil que cabe num dia de trabalho.",
            f"Grátis até {g.FREE_LEAD_LIMIT} contatos, sem cartão. "
            f"R$ {g.PRO_PLAN_PRICE} por mês pela empresa inteira quando "
            "precisar de mais, não por vendedor.",
            luz=0.46, passo=(5, 5),
        ),
    ])

    # -------------------------------------------- o carrossel do eixo WhatsApp
    #
    # ## Por que o WhatsApp volta ao feed, tendo saído em 31/08
    #
    # Ele foi removido de propósito naquela rodada. A decisão se desfaz aqui,
    # conscientemente, porque criou um problema maior do que resolveu: a
    # landing inteira é construída sobre "O WhatsApp guarda a conversa. Não
    # guarda o cliente", e o feed falava de digitação. Quem vem do perfil cai
    # numa página que parece de outra empresa.
    #
    # O pedágio de digitação NÃO some — ele é o carrossel acima, e continua
    # sendo a dor de `docs/dor-de-mercado.md`. O que muda é qual dos dois
    # abre a conversa: 82% da PME brasileira vende por WhatsApp (Sebrae, 8,2
    # mil ouvidos), e é o canal, não o sintoma, que a pessoa reconhece como
    # sendo dela.
    #
    # ## O card 4 é a dor que nunca apareceu em peça nenhuma
    #
    # `docs/estado-atual.md` registra, desde a pesquisa de 21/08, que a dor
    # PRIMEIRA não é esquecer a venda — é **o vendedor sair e levar a carteira
    # junto**. Esquecer dói uma vez; perder o histórico não tem conserto, e
    # ainda expõe a empresa na LGPD, que continua responsável por dado que não
    # consegue auditar.
    #
    # Nenhuma das 13 peças existentes toca nisso. É o argumento mais forte que
    # este produto tem e estava inteiramente fora do marketing.
    print()
    carrossel("carrossel-2-carteira", [
        card_gancho(
            [("Sua carteira de clientes mora no ", False),
             ("celular", True), (" de quem vende.", False)],
            "E o dia em que ele sair, ela sai junto.",
            luz=0.16, passo=(1, 5),
        ),
        card_dado(
            "82%", "vendem pelo WhatsApp",
            "É o principal canal de venda da pequena empresa brasileira. A "
            "negociação inteira acontece lá. E fica lá.",
            "Pesquisa Pulso do Sebrae, 8,2 mil empresas ouvidas.",
            "D A D O   D E   M E R C A D O", luz=0.26, passo=(2, 5),
            proporcao=(82, 100, "82% pelo WhatsApp", "18% em outros canais"),
        ),
        card_dado(
            "42h", "para responder o primeiro contato",
            "É a média do mercado. Quem responde em 5 minutos tem 21x mais "
            "chance de qualificar, e ninguém lembra do que não está anotado.",
            "Harvard Business Review, auditoria com 2.241 empresas.",
            "D A D O   D E   M E R C A D O", luz=0.34, passo=(3, 5),
        ),
        card_causa(
            "O histórico não é da empresa. É do aparelho.",
            "Quando o vendedor sai, vai embora com o contato, a negociação em "
            "aberto e tudo que foi combinado. A empresa continua responsável "
            "pelo dado do cliente. Só não consegue mais olhar para ele.",
            luz=0.40, passo=(4, 5),
        ),
        card_cta(
            "O WhatsApp continua. O cliente passa a ser seu.",
            f"Grátis até {g.FREE_LEAD_LIMIT} contatos, sem cartão. "
            f"R$ {g.PRO_PLAN_PRICE} por mês pela empresa inteira, "
            "não por vendedor.",
            luz=0.46, passo=(5, 5),
        ),
    ])

    # ------------------------------------------- as avulsas do eixo WhatsApp
    #
    # Peça avulsa no feed tem função diferente da do carrossel: ela é vista
    # na GRADE do perfil, recortada em 3:4, muitas vezes sem legenda lida.
    # Precisa entregar a ideia inteira no primeiro olhar.
    print()


    arte_declaracao(
        "O   Q U E   N I N G U É M   D I Z",
        "Não é o WhatsApp que é o problema.",
        "Ele é ótimo para conversar e péssimo para lembrar. O erro é pedir "
        "que ele faça as duas coisas, e culpar a equipe quando falha.",
        "feed-11-o-whatsapp-nao-e-o-problema", 0.32, claro=proximo_registro(),
    )

    print()
    # `@4k` e a mesma arte em dobro, nao uma peca a mais: contar o glob cru
    # daria o dobro. O numero literal que estava aqui virou mentira no dia
    # em que a lista mudou de tamanho — 31/08, quando passou de 5 para 8.
    quantas = len([f for f in SAIDA.glob("*.png") if not f.stem.endswith("@4k")])
    print()
    print(f"{quantas} artes em {SAIDA.relative_to(g.RAIZ)}")


if __name__ == "__main__":
    main()
