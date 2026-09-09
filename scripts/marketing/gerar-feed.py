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
import time
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

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


def _salvar_com_paciencia(img, caminho, tentativas=6):
    """
    Grava insistindo, porque a pasta mora dentro do OneDrive.

    O OneDrive trava o arquivo enquanto sincroniza, e o Windows devolve
    `OSError: [Errno 22] Invalid argument` — mensagem que não diz nada sobre
    trava e manda procurar caractere ilegal no nome. Medido em 09/09: o erro
    caiu num arquivo DIFERENTE a cada rodada (`feed-4`, depois
    `carrossel-3-...-5`), e é essa aleatoriedade que identifica a causa. Se
    fosse o nome, falharia sempre no mesmo.

    Sem isto, uma rodada de 45 artes morre no meio e deixa metade gravada —
    pior que falhar inteiro, porque a pasta fica num estado que parece
    completo.
    """
    for tentativa in range(1, tentativas + 1):
        try:
            img.save(caminho)
            return
        except OSError:
            if tentativa == tentativas:
                raise
            time.sleep(0.6 * tentativa)


def salvar(img, nome):
    """Publicação em 1080x1350 e uma reserva @4k, o mesmo par dos Stories."""
    final = img.resize((g.W_FINAL, g.H_FINAL), Image.LANCZOS)
    _salvar_com_paciencia(final, SAIDA / f"{nome}.png")
    _salvar_com_paciencia(img, SAIDA / f"{nome}@4k.png")
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


def _peca_clara(bloco, passo=None, luz=0.30):
    """
    O par claro de `_peca`: mesmo esqueleto, registro invertido.

    `_TEMA_CLARO` é global de módulo — as funções de cor (`cor_titulo`,
    `cor_destaque`, `cor_fonte_dado`) consultam ele em tempo de chamada, e é
    isso que faz a peça inteira mudar de registro sem passar tema por
    parâmetro em quinze assinaturas.

    O `try/finally` não é zelo: sem ele, uma exceção no meio do bloco deixaria
    o módulo em claro e o PRÓXIMO card sairia com as cores erradas — texto
    quase preto sobre fundo quase preto. Falha silenciosa, e só a arte
    denunciaria.
    """
    g._TEMA_CLARO = True
    g._LUZ_ATUAL = luz
    try:
        img = g.fundo_do_tema(escuro_extra=0.0)
        draw = ImageDraw.Draw(img)
        topo, _ = g.faixa_livre()
        if passo:
            marcador_de_passo(draw, *passo)
        # A imagem vai junto porque o bloco precisa COLAR o selo da marca, e
        # `ImageDraw` não cola — só desenha. Sem `try/except` de assinatura de
        # propósito: um `TypeError` levantado lá dentro seria engolido e o
        # bloco rodaria duas vezes, o que é pior que a falha original.
        bloco(draw, topo, img)
        g.assinar_discreto(img, draw)
        return img
    finally:
        g._TEMA_CLARO = False


def _print_no_claro(img, nome_print, topo, altura_alvo, recorte=None):
    """
    O print sobre fundo claro: card com SOMBRA, não com brilho.

    `card_com_print` desenha uma elipse teal desfocada atrás da tela, e isso só
    funciona sobre escuro — sobre off-white, luz atrás de objeto claro não
    aparece. É a mesma regra que o produto já carrega: o modo claro do CRM
    ganhou sombra no cartão e o escuro teve a regra anulada.

    A sombra é desenhada em camada própria e desfocada antes de compor, porque
    borda dura sobre fundo claro lê como recorte mal feito, não como
    profundidade.
    """
    origem = Image.open(g.PRINTS / nome_print).convert("RGB")
    pad = 12 * g.ESCALA
    # ## O print tem gutter PROPRIO, e menor que o da coluna de texto
    #
    # Alinhado a `MARGEM_ESQ` (9% de cada lado), sobravam 862px no arquivo de
    # 1080 para uma tela cuja regiao util tem ~1100px de CSS: 0,78x, e o texto
    # do app em 11px. Com 40px de margem sobram 1000px e a escala vai a 0,89x.
    #
    # 40 e nao menos: a grade do perfil recorta em 3:4 e come 34px de cada
    # lado. Abaixo disso o proprio card perderia a borda arredondada na tela
    # onde alguem decide se segue o perfil.
    #
    # A quebra de alinhamento e deliberada e e a mesma da referencia: o bloco
    # de prova respira mais que o bloco de leitura, e a diferenca de recuo e o
    # que separa os dois visualmente sem precisar de linha divisoria.
    margem = 40 * g.ESCALA
    larg = g.W - margem * 2
    larg_util = larg - pad * 2

    # ## O print ESTAVA DISTORCIDO, e o `min()` era a causa
    #
    # A versão anterior calculava a altura proporcional, tomava o `min()` com
    # a altura disponível e depois redimensionava a origem para essa altura
    # menor — ou seja, **espremia a tela verticalmente**. Medido em 09/09 com
    # `hoje-light.png` (2880x1800): a altura proporcional é 562px na peça de
    # 1080, e o espaço disponível era ~205px. A tela do produto aparecia
    # achatada em 2,7x.
    #
    # Não era só feiúra: as linhas de texto do app viravam faixas de 1px, o
    # que destrói a nitidez e é exatamente o "borrado ao dar zoom" relatado.
    # Reduzir 1800px de altura para 362 é jogar fora quatro quintos da
    # informação vertical antes de qualquer LANCZOS ajudar.
    #
    # ## A saída já existia neste projeto, em `card_com_print`
    #
    # O gerador de Stories resolve o mesmo problema há semanas: escala pela
    # LARGURA, mantém a proporção e **corta pela base** quando sobra altura,
    # com um esmaecimento nos últimos pixels. O comentário de lá registra o
    # porquê do fade — borda dura afirma que a tela acaba ali, borda que some
    # diz que ela continua fora do quadro.
    #
    # Cortar é honesto e espremer não é: no corte, o pedaço que aparece está
    # em proporção real; no esmagamento, nada na peça está.
    # ## O print inteiro nao cabe legivel em 1080, e essa e a conta
    #
    # A tela do produto tem 1440px de largura em CSS. A coluna da arte tem
    # 862px no arquivo publicado, entao a tela inteira entra a 0,60x: um texto
    # de 14px vira 8,4px. Nao e desfoque de compressao — e tipografia pequena
    # demais para existir, e nenhum tratamento de imagem recupera isso.
    #
    # `recorte` resolve amostrando uma REGIAO da origem em vez da tela toda.
    # Em `(x, y, largura_na_origem)`, com a largura escolhida para a escala
    # ficar perto de 1:1 — a 0,93x o mesmo texto de 14px chega a 13px, que se
    # le. Foi assim que o print deixou de ser enfeite e virou prova.
    #
    # A barra lateral fica de fora nos dois cortes de proposito: ela ocupa 35%
    # da largura e nao diz nada sobre orcamento. Quem identifica o produto e a
    # marca no topo da peca, que existe justamente para isso.
    if recorte is not None:
        x_fonte, y_fonte, larg_fonte = recorte
        escala = larg_util / larg_fonte
        if escala < 0.80:
            raise ValueError(
                f"{nome_print}: recorte de {larg_fonte}px cai para {escala:.2f}x "
                "na peca. Abaixo de 0,80x o texto do app nao se le."
            )
        alt_util = int(altura_alvo) - pad * 2
        alt_fonte = min(int(alt_util / escala), origem.height - y_fonte)
        alt_util = int(alt_fonte * escala)
        origem = origem.crop((x_fonte, y_fonte,
                              x_fonte + larg_fonte, y_fonte + alt_fonte))
        alt_util_cheia = alt_util
        continua_abaixo = (y_fonte + alt_fonte) < 1800
    else:
        alt_util_cheia = int(origem.height * larg_util / origem.width)
        alt_util = min(alt_util_cheia, int(altura_alvo) - pad * 2)
        continua_abaixo = alt_util < alt_util_cheia
    # Menos de um terço da tela vira faixa sem contexto — some o cabeçalho, e
    # o que resta pode ser qualquer software. Falhar aqui obriga a encurtar o
    # texto acima, que é a correção certa; o silêncio é que produziu a versão
    # espremida.
    if alt_util < alt_util_cheia * 0.30:
        raise ValueError(
            f"{nome_print}: sobrou {alt_util}px para um print de "
            f"{alt_util_cheia}px ({alt_util / alt_util_cheia:.0%}). "
            "Encurte a manchete ou o apoio."
        )
    alt = alt_util + pad * 2
    x0, y0 = margem, int(topo)

    # ## A sombra entra por MÁSCARA, e a primeira versão não entrava
    #
    # Ela fazia `img.paste(Image.blend(img, sombra, 0.55))` — e `Image.blend`
    # opera na imagem INTEIRA. A camada da sombra é branca fora do retângulo,
    # então o blend clareava a peça toda em 55%, por cima do texto que já
    # estava desenhado: o título quase preto virou cinza médio e o teal
    # desbotou. Aberta a arte, era o que se via.
    #
    # É a mesma família do defeito que `card_com_print` documenta ter pago no
    # escuro — composição fora de ordem passando por cima da headline. Lá a
    # correção foi recortar a faixa; aqui é a máscara, que limita o efeito ao
    # que ela desenha e torna impossível alcançar o resto.
    mascara = Image.new("L", img.size, 0)
    ImageDraw.Draw(mascara).rounded_rectangle(
        [x0 + 6 * g.ESCALA, y0 + 16 * g.ESCALA,
         x0 + larg + 6 * g.ESCALA, y0 + alt + 16 * g.ESCALA],
        radius=26 * g.ESCALA, fill=150,
    )
    mascara = mascara.filter(ImageFilter.GaussianBlur(24 * g.ESCALA))
    img.paste(Image.new("RGB", img.size, (168, 184, 186)), (0, 0), mascara)

    moldura = Image.new("RGB", (larg, alt), (255, 255, 255))
    d = ImageDraw.Draw(moldura)
    d.rounded_rectangle([0, 0, larg - 1, alt - 1], radius=24 * g.ESCALA,
                        outline=g.BORDA_NO_CLARO, width=max(1, 2 * g.ESCALA // 2))
    tela = origem.resize((larg_util, alt_util_cheia), Image.LANCZOS)
    if continua_abaixo:
        tela = tela.crop((0, 0, larg_util, alt_util))
        # O corte cai no meio de uma linha da tabela, e meia linha de texto
        # não lê como "continua", lê como render quebrado. A rampa desce até o
        # BRANCO da moldura, que é o fundo do card no registro claro.
        fade = min(90 * g.ESCALA, alt_util // 3)
        rampa = Image.new("L", (1, fade))
        rampa.putdata([int(255 * (i / max(fade - 1, 1)) ** 1.5) for i in range(fade)])
        rampa = rampa.resize((larg_util, fade))
        faixa = tela.crop((0, alt_util - fade, larg_util, alt_util))
        tela.paste(
            Image.composite(Image.new("RGB", (larg_util, fade), (255, 255, 255)),
                            faixa, rampa),
            (0, alt_util - fade),
        )
    moldura.paste(tela, (pad, pad))
    img.paste(moldura, (x0, y0))
    return y0 + alt


def marca_no_topo(img, draw, y):
    """
    O lockup da marca no ALTO da peça: selo do funil e a palavra, lado a lado.

    ## Por que ela sobe, tendo assinatura no rodapé

    A referência que o dono mandou (@agendorcrm) põe a marca no topo em todos
    os quatro posts, e não é enfeite: no carrossel o dedo entra pelo primeiro
    card e sai no último, e a única coisa garantidamente vista é a faixa
    superior. Marca só no rodapé depende de a pessoa chegar ao fim.

    ## Não substitui a assinatura, e a diferença é de função

    A do rodapé carrega o ENDEREÇO — `velofunil.com.br` —, que é a única forma
    de alguém chegar ao produto: post de Instagram não tem link clicável. Ela é
    o caminho.

    Esta é o reconhecimento: quem desliza sabe de quem é a peça antes de ler a
    manchete. Duas funções distintas, e por isso as duas ficam.

    O selo volta aqui depois de ter saído do rodapé em 31/08. Lá ele competia
    com o texto num espaço apertado de 66px; no topo há folga, e é justamente o
    contraste do quadrado teal que faz a marca ser reconhecida de relance.
    """
    tam = 62 * g.ESCALA
    img.paste(g.desenhar_selo(tam), (g.MARGEM_ESQ, int(y)), g.desenhar_selo(tam))

    fnt_b = g.fonte(g.FORTE, 44)
    fnt_r = g.fonte(g.CORPO, 44)
    x = g.MARGEM_ESQ + tam + 22 * g.ESCALA
    meio = y + tam / 2
    draw.text((x, meio), "Velo ", font=fnt_b, fill=g.cor_titulo(), anchor="lm")
    draw.text((x + draw.textlength("Velo ", font=fnt_b), meio), "Funil",
              font=fnt_r, fill=g.cor_corpo(), anchor="lm")
    return y + tam + 46 * g.ESCALA


def card_produto(selo, partes, apoio, print_nome, passo=None, recorte=None):
    """
    O card claro com prova: selo, manchete com palavra em teal, print grande.

    ## Por que esta forma, e de onde ela veio

    O dono mandou o @agendorcrm como referência e recusou a direção anterior.
    Lidos os quatro posts, a fórmula deles é `dado + produto + palavra colorida
    + marca` — e não há uma fotografia em nenhum. O Exa concorda: em 20 guias
    de criativo B2B SaaS, print de produto aparece em 7 e foto/lifestyle em 2,
    o menos recomendado de todos.

    A peça anterior (fundo escuro, só tipografia) não estava errada — estava
    incompleta. Faltava a prova. Um CRM que fala de orçamento e não mostra a
    tela do orçamento pede fé.

    ## O que NÃO copiamos do Agendor

    Prova social. Eles usam; 30% dos guias recomendam; e nós não temos cliente
    externo. `docs/estado-atual.md` trava isso — "sem prova social inventada".
    O substituto honesto é o dado de mercado com a fonte declarada, que é o
    card escuro da sequência.
    """
    def bloco(d, y, img_alvo=None):
        if img_alvo is not None:
            y = marca_no_topo(img_alvo, d, y)
        if selo:
            y = g.pill(d, selo, y) + 40 * g.ESCALA
        y = g.escrever_com_realce(
            d, partes, g.fonte(g.TITULO, 78), g.fonte(g.TITULO, 78),
            y, g.cor_titulo(), g.cor_destaque(), entrelinha=1.16,
        )
        if apoio:
            y += 26 * g.ESCALA
            y = g.escrever_esq(d, apoio, g.fonte(g.CORPO, 42), y, g.cor_corpo(),
                               entrelinha=1.34)
        return y

    # O print precisa da IMAGEM e o texto precisa do `draw`, então a
    # composição é sequencial aqui em vez de passar por `_peca_clara`: o texto
    # primeiro (para saber onde ele termina), o print no que sobrar.
    g._TEMA_CLARO = True
    g._LUZ_ATUAL = 0.30
    try:
        img = g.fundo_do_tema(escuro_extra=0.0)
        draw = ImageDraw.Draw(img)
        topo, base = g.faixa_livre()
        if passo:
            marcador_de_passo(draw, *passo)
        fim = bloco(draw, topo, img)
        _print_no_claro(img, print_nome, fim + 40 * g.ESCALA,
                        base - fim - 40 * g.ESCALA, recorte=recorte)
        g.assinar_discreto(img, draw)
        return img
    finally:
        g._TEMA_CLARO = False


def icone_de_confirmacao(tamanho: int) -> Image.Image:
    """
    Disco teal com o visto branco dentro — o marcador da recapitulação.

    ## Por que desenhado, e não um glifo de fonte

    A primeira versão usava um travessão de texto. O travessão é pontuação:
    ele diz "aparte", não "pronto". Um visto diz que aquilo está entregue, que
    é exatamente a afirmação das três linhas do último card.

    E o glifo de fonte não serve como substituto: `✓` não existe na Geist, e
    quando falta o Pillow desenha o retângulo vazio em silêncio, sem erro. O
    traçado aqui é geometria, então ele existe sempre e escala junto com a
    peça.

    ## Por que disco cheio, e não contorno

    A 38px o contorno de 2px some na redução para 1080. O disco chapado no
    teal do modo claro mantém peso na miniatura da grade, que é onde o
    carrossel é visto antes de ser aberto.

    Supersample 4x e LANCZOS, como o selo e o funil da marca: o círculo e a
    diagonal do visto são as duas formas que mais denunciam serrilhado.
    """
    s = 4
    t = tamanho * s
    ico = Image.new("RGBA", (t, t), (0, 0, 0, 0))
    d = ImageDraw.Draw(ico)
    d.ellipse([0, 0, t - 1, t - 1], fill=g.TEAL_NO_CLARO)
    # O visto em duas retas com ponta arredondada, nas proporções do ícone de
    # `check` do produto (lucide): perna curta descendo até 62% da altura,
    # perna longa subindo até 34%.
    grosso = max(2, int(t * 0.11))
    d.line([(t * 0.28, t * 0.52), (t * 0.44, t * 0.68)],
           fill=(255, 255, 255), width=grosso, joint="curve")
    d.line([(t * 0.44, t * 0.68), (t * 0.73, t * 0.34)],
           fill=(255, 255, 255), width=grosso, joint="curve")
    for ponta in ((t * 0.28, t * 0.52), (t * 0.44, t * 0.68), (t * 0.73, t * 0.34)):
        r = grosso / 2
        d.ellipse([ponta[0] - r, ponta[1] - r, ponta[0] + r, ponta[1] + r],
                  fill=(255, 255, 255))
    return ico.resize((tamanho, tamanho), Image.LANCZOS)


def card_cta_claro(chamada, apoio, recapitulacao=(), passo=None):
    """
    O fechamento no registro claro, para a sequência terminar como começou.

    ## A recapitulação existe porque o último card é lido fora de ordem

    Quem chega ao quinto slide arrastou quatro vezes e já não tem os três
    argumentos na cabeça — e parte de quem vê este card nem passou pelos
    outros, porque o Instagram mostra o carrossel a partir do slide que a
    pessoa tocou na grade. Repetir em três linhas curtas custa nada e é a
    única superfície onde a peça pode ser lida sozinha.

    E resolve um defeito visível: sem elas o card terminava aos 60% da altura
    e o terço de baixo ficava vazio, o que num carrossel lê como slide
    inacabado — visto ao abrir o PNG, não pelo conferidor.
    """
    def bloco(d, y, img_alvo=None):
        if img_alvo is not None:
            y = marca_no_topo(img_alvo, d, y)
        y = g.escrever_esq(d, chamada, g.fonte(g.TITULO, 80), y, g.cor_titulo(),
                           entrelinha=1.14)
        y += 34 * g.ESCALA
        y = g.escrever_esq(d, apoio, g.fonte(g.CORPO, 44), y, g.cor_corpo(),
                           entrelinha=1.36)
        y += 46 * g.ESCALA
        for linha in recapitulacao:
            fnt = g.fonte(g.CORPO, 40)
            recuo = 64 * g.ESCALA
            # `d.text` não quebra linha, então uma frase comprida sai PELA
            # BORDA sem erro nenhum — foi o que aconteceu na primeira versão,
            # com duas das três linhas vazando à direita. A guarda transforma
            # isso em falha de geração, que é o único jeito de não repetir.
            largura = d.textlength(linha, font=fnt)
            if largura > g.LARGURA_TEXTO - recuo:
                raise ValueError(
                    f"recapitulação não cabe na coluna: {linha!r} "
                    f"({int(largura)} > {g.LARGURA_TEXTO - recuo})"
                )
            marca = icone_de_confirmacao(38 * g.ESCALA)
            alto = fnt.getbbox("Ag")[3]
            img_alvo.paste(
                marca,
                (g.MARGEM_ESQ, int(y + (alto - marca.height) / 2)),
                marca,
            )
            d.text((g.MARGEM_ESQ + recuo, y), linha, font=fnt, fill=g.cor_corpo())
            y += 72 * g.ESCALA
        if recapitulacao:
            y += 30 * g.ESCALA
        else:
            y += 6 * g.ESCALA
        # O botão desenhado, e não escrito: "Comece grátis" como texto solto
        # lê como mais uma linha do corpo. Em forma de botão, o olho reconhece
        # a ação antes de ler a palavra.
        fnt = g.fonte(g.TITULO, 46)
        larg = int(d.textlength("Comece grátis", font=fnt)) + 76 * g.ESCALA
        alt = 104 * g.ESCALA
        d.rounded_rectangle([g.MARGEM_ESQ, y, g.MARGEM_ESQ + larg, y + alt],
                            radius=alt // 2, fill=g.TEAL_NO_CLARO)
        d.text((g.MARGEM_ESQ + 38 * g.ESCALA, y + alt // 2), "Comece grátis",
               font=fnt, fill=(255, 255, 255), anchor="lm")
        y += alt + 26 * g.ESCALA
        return g.escrever_esq(d, "Link na bio", g.fonte(g.CORPO, 36), y,
                              g.cor_destaque())

    return _peca_clara(bloco, passo)


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
    corpo_num = 176 if (proporcao and proporcao[1] == 100) else 258
    # ## O número encolhe até caber, e a primeira versão não encolhia
    #
    # 258 foi escolhido para "4%" e "R$ 49", de dois a cinco glifos. "0 de 25"
    # tem sete e **vazou pela borda direita** — visto ao abrir o PNG, sem erro
    # nenhum: `draw.text` não quebra linha nem reclama, o mesmo silêncio que a
    # recapitulação do card 5 já pagou nesta mesma rodada.
    #
    # Escolher o corpo à mão por peça resolveria hoje e voltaria a quebrar na
    # próxima frase. Medir e descer de 6 em 6 resolve para qualquer número, e
    # o piso de 120 existe para o card falhar em vez de imprimir um algarismo
    # do tamanho do texto de apoio, que não seria mais o protagonista.
    while corpo_num > 120:
        fnt_teste = g.fonte(g.DISPLAY, corpo_num)
        if g.medir(lambda d, _y: d.textlength(numero, font=fnt_teste)) <= g.LARGURA_TEXTO:
            break
        corpo_num -= 6
    fnt_num = g.fonte(g.DISPLAY, corpo_num)

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

    # ------------------------------------------ o carrossel do eixo ORÇAMENTO
    #
    # ## Por que ele existe, e por que só agora
    #
    # O produto ganhou o orçamento com prazo em 08/09, e a landing passou a
    # dizer isso em 09/09. Antes disto, uma peça sobre orçamento seria promessa
    # falsa — a mesma razão pela qual o perfil não podia falar disso até ontem.
    #
    # ## Este carrossel NÃO é para alcance, e isso muda o que ele precisa fazer
    #
    # Medido em 09/09: 12.194 seguidores e 4,0 curtidas de média — 0,033% de
    # engajamento, contra 1% a 3% normais. Os seguidores foram comprados, e num
    # feed que entrega por engajamento eles não são público parado: são o que
    # SUPRIME a entrega, inclusive para os reais. `docs/estado-atual.md` registra
    # isso como decisão travada, e ela continua valendo.
    #
    # O que mudou é quem chega aqui. ~510 mensagens de prospecção estão saindo,
    # e parte de quem recebe vai procurar o perfil antes de clicar em qualquer
    # coisa — é o reflexo de quem recebe mensagem de empresa que não conhece.
    # Então a função desta peça é **confirmar que a empresa é real e que ela faz
    # o que a mensagem disse**, não conquistar seguidor.
    #
    # Por isso o roteiro é o mesmo eco da mensagem e da landing, palavra por
    # palavra: quem sai da conversa e cai no perfil precisa reconhecer a frase.
    print()
    # ## O posicionamento mudou em 09/09, e saiu de medicao com o Exa
    #
    # A versao anterior dizia "o sistema COBRA o retorno". Buscado no Exa o que
    # responde quando alguem procura *"como cobrar retorno de orcamento"*, os
    # 8 primeiros resultados eram **inadimplencia** — cobranca de quem nao
    # pagou, com modelo de mensagem e advogado. No portugues do cliente,
    # "cobrar" quer dizer receber divida, e o produto estaria prometendo outra
    # coisa para quem le rapido.
    #
    # O verbo do mercado e outro, medido nas mesmas buscas: **follow-up**
    # aparece em 10 de 10 titulos do tema. Mas follow-up e jargao de vendedor,
    # e o pedido aqui foi um posicionamento que quase todo mundo entenda.
    #
    # A frase que o proprio cliente digita esta nos titulos que o Exa devolveu:
    # *"cliente pediu orcamento e sumiu"*, *"cliente nao respondeu o
    # orcamento"* — 6 de 10. E o verbo que ninguem disputa e o mais simples da
    # lingua: **lembrar**. Zero dos 25 geradores de orcamento lidos usam.
    carrossel("carrossel-3-orcamento", [
        card_produto(
            "O R Ç A M E N T O   C O M   P R A Z O",
            [("O cliente pediu orçamento e ", False), ("sumiu.", True),
             ("Aqui ele não some.", False)],
            "Você guarda até quando o preço vale, e o Velo Funil lembra você "
            "de dar o retorno dois dias antes.",
            "hoje-light.png", passo=(1, 5),
            # A barra lateral fica fora: o que prova a promessa é a tarefa
            # vencida com hora e nome, não o menu.
            recorte=(530, 285, 2200),
        ),
        card_dado(
            "0 de 25", "lembram você de dar o retorno",
            "Lemos 25 sistemas de orçamento brasileiros. 88% geram o PDF e "
            "60% mandam pelo WhatsApp. Quase metade até guarda a validade. "
            "Avisar antes de o prazo acabar: nenhum.",
            "25 geradores de orçamento, lidos em 09/09/2026.",
            "O   Q U E   O   M E R C A D O   F A Z", luz=0.30, passo=(2, 5),
            # ## A grade INTEIRA apagada é o argumento, e por isso ela fica
            #
            # O carrossel do pedágio registra que `proporcao` foi recusada lá:
            # 3,4h em 40h desenha uma barra quase vazia e o olho conclui "é
            # pouco", o oposto da frase. Aqui a frase É "nenhum", então a
            # grade sem nenhum quadrado aceso diz exatamente o texto.
            #
            # O número mudou de "4%" para "0 de 25" depois da medição com o
            # Exa. Os 4% vinham de CRMs que anunciam proposta; os 25 são
            # geradores de ORÇAMENTO, que é a categoria que este cliente de
            # fato procura. E o dado ficou mais forte: entre eles, 48% já
            # guardam a validade — guardar não diferencia, avisar sim.
            # ## Sem `proporcao` aqui, e a tentativa fica registrada
            #
            # `card_dado` só desenha a GRADE quando o todo é 100; com 25 ele
            # cai na barra, e uma barra com zero preenchido é indistinguível
            # de um esqueleto de carregamento. Visto ao abrir o PNG.
            #
            # Trocar o 25 por "0 em cada 100" resolveria o desenho e mentiria
            # sobre a amostra. O número "0 de 25" já é o gráfico.
        ),
        card_produto(
            "N O   F U N I L",
            [("Valor, validade e o retorno, ", False),
             ("no mesmo card.", True)],
            "Sem planilha paralela. O prazo vive junto do negócio que já está "
            "no funil.",
            "kanban-light.png", passo=(3, 5),
            recorte=(530, 230, 2200),
        ),
        card_dado(
            f"R$ {g.PRO_PLAN_PRICE}", "por mês, pela empresa inteira",
            # O número sai de `PRECO_POR_USUARIO`, não da mão: escrevi
            # "R$ 300" nesta rodada e o teste `oferta-nas-artes` reprovou, com
            # razão. A mediana de tabela pública é R$ 53, então cinco pessoas
            # dão R$ 265 — "passam de R$ 300" era arredondamento para cima de
            # um número que a arte tem como conferir sozinha.
            "Com 1 ou com 20 pessoas. A maioria dos CRMs cobra por usuário, e "
            f"cinco pessoas custam R$ {g.PRECO_POR_USUARIO * 5} por mês.",
            "Preço de tabela pública dos concorrentes, lido em 09/09/2026.",
            "O   P R E Ç O", luz=0.38, passo=(4, 5),
        ),
        card_cta_claro(
            "Comece hoje, com o que você já tem.",
            f"Grátis até {g.FREE_LEAD_LIMIT} contatos, sem cartão. Traga sua "
            "planilha e o funil monta sozinho.",
            recapitulacao=(
                "O sistema lembra do retorno, você não",
                "Valor e prazo dentro do negócio",
                f"R$ {g.PRO_PLAN_PRICE} pela empresa, não por pessoa",
            ),
            passo=(5, 5),
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
