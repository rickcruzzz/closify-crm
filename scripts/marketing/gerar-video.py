"""
O criativo em VÍDEO — o mesmo sistema visual das artes, em movimento.

    python scripts/marketing/gerar-video.py
    python scripts/marketing/gerar-video.py --zona-segura   # conferência

Sai em dois formatos, do mesmo roteiro:

    reels   1080x1920 (9:16)   o que aparece em Reels e Stories
    feed    1080x1350 (4:5)    o que fica permanente na grade do perfil

## Por que existe um vídeo, e por que ESTE vídeo

As 21 peças do feed dizem coisas verdadeiras e todas dizem por escrito. A
frase "negócio parado morre calado" está numa arte desde 31/08, e ela pede
que a pessoa IMAGINE o que é um negócio parando.

Vídeo é o único formato deste projeto que pode mostrar em vez de afirmar: os
cards descem o funil, e um não desce. Ninguém precisa acreditar na frase, o
olho vê a diferença entre o que anda e o que fica.

É o mesmo critério que fez a grade de 100 blocos existir no feed, aplicado à
única coisa que arte estática não consegue fazer. Se o roteiro fosse texto
aparecendo sobre fundo, o vídeo seria uma arte cara: o MP4 tem que carregar o
que o PNG não carrega, senão não há motivo para ele existir.

## Por que os frames nascem do gerador de arte, e não de um editor

`lib/marketing/oferta-nas-artes.test.ts` trava a oferta em todo `.py` desta
pasta: nenhuma promessa que o produto já aposentou, preço interpolado de
`lib/plans.ts`, domínio com www, e nenhum dado repetido entre as peças que
dividem a grade do perfil.

Este parágrafo já foi escrito nomeando as promessas proibidas, uma a uma, e
as travas reprovaram o arquivo por causa DELE, não do texto que vai à tela.
A regra está certa e a redação estava errada: o gerador não precisa escrever
a palavra banida para explicar que ela é banida, e a bio do Instagram ganhou
um teste com essa mesma forma em 25/08.

Imagem não compila, e MP4 muito menos, ninguém audita preço dentro de um
vídeo. Ao nascer aqui, o texto do vídeo é lido pelos mesmos testes que leem o
texto das artes. Um MP4 montado num editor seria a primeira superfície deste
projeto onde a oferta voltaria a poder mentir em silêncio, que é exatamente o
defeito que aquele arquivo de teste existe para impedir.

O `ffmpeg` entra no fim, só para juntar PNG em vídeo. Ele não escreve texto.

## As zonas seguras MUDAM entre os dois formatos, e isso não é detalhe

Reels e Stories têm a barra de ações (curtir, comentar, compartilhar) e a
pilha de legenda POR CIMA do vídeo. O feed não tem, mas a grade do perfil
recorta a peça em 3:4.

    reels   topo 220px   base 500px   lados 180px    banda util 720x1200
    feed    topo  122px  base 176px   lados  97px    e o recorte 3:4

Exportar a peça de um formato no outro é o atalho óbvio e enterra conteúdo
debaixo da interface. `conferir_zonas()` falha se alguém mexer nas margens e
a banda deixar de fechar.

## Áudio: nenhum, de propósito

O vídeo sai mudo. Para publicação orgânica, a trilha é anexada DENTRO do
Instagram, e isso não é preguiça: som nativo do aplicativo é descoberto pela
busca de áudio, é reutilizável por outras pessoas e entra na distribuição que
o algoritmo dá a áudio da própria plataforma. Trilha queimada no arquivo
perde as três coisas.

Queimar só faz sentido em anúncio pago, onde não existe a opção de anexar.
"""

import argparse
import importlib.util
import math
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw

# Mesmo carregamento por caminho de `gerar-feed.py`: o gerador de Stories tem
# hífen no nome, que não é identificador Python. Importar em vez de copiar,
# fundo, tipografia, marca d'água e paleta já existem lá.
_spec = importlib.util.spec_from_file_location(
    "gerar_stories", Path(__file__).resolve().parent / "gerar-stories.py"
)
g = importlib.util.module_from_spec(_spec)
sys.modules["gerar_stories"] = g
_spec.loader.exec_module(g)


FPS = 30
SAIDA = g.RAIZ / "marketing" / "video"

# ## O fundo é caro e quase não muda, então ele é guardado
#
# `fundo_marca` aplica um desfoque gaussiano de 400px sobre a tela inteira em
# escala dobrada. Medido: 420 quadros levavam 7min27s, e o desfoque é quase
# todo esse tempo.
#
# A luz do fundo sobe devagar ao longo do vídeo (0.20 a 0.42). Arredondada a
# um centésimo, ela assume 23 valores em vez de 420, e o olho não distingue
# um degrau de 1% de luminosidade num degradê desfocado. O cache troca 420
# desfoques por 23.
_FUNDOS = {}

# ## Por que ESCALA 2 também no vídeo
#
# Movimento perdoa serrilha de forma, não perdoa serrilha de TEXTO: a borda
# de uma letra que treme entre quadros é o artefato mais visível que existe
# em vídeo curto, e é o que faz um criativo parecer feito em editor de
# apresentação. O supersampling custa tempo de máquina uma vez e o vídeo é
# visto muitas.
ESCALA = 2


#: Cada formato traz a moldura e as bordas que a interface come.
#:
#: `lados` é simétrico de propósito, mesmo no Reels, onde só a direita tem
#: barra de ações: composição que respeita 180px de um lado e 97px do outro
#: fica visivelmente torta, e o ganho de 83px não paga isso.
FORMATOS = {
    "reels": {
        "w": 1080, "h": 1920,
        "topo": 220, "base": 500, "lados": 180,
        "titulo": 76, "corpo": 34,
    },
    "feed": {
        "w": 1080, "h": 1350,
        # 9% e 13%, os mesmos de `gerar-feed.py`. O feed não tem barra de
        # ações por cima; o que morde aqui é o recorte 3:4 da grade.
        "topo": 122, "base": 176, "lados": 97,
        "titulo": 66, "corpo": 30,
    },
}

DURACAO = 14.0  # segundos


# ----------------------------------------------------------------- o tempo

def suavizar(t: float) -> float:
    """
    Aceleração que desacelera no fim (ease-out cúbico).

    Movimento linear é o que denuncia animação gerada: nada no mundo físico
    começa e para na mesma velocidade. O cubo é forte o bastante para ser
    percebido como intenção e fraco o bastante para não virar elástico.
    """
    return 1 - (1 - t) ** 3


def faixa(t: float, inicio: float, fim: float) -> float:
    """Progresso de 0 a 1 dentro de uma janela de tempo. Fora dela, 0 ou 1."""
    if t <= inicio:
        return 0.0
    if t >= fim:
        return 1.0
    return (t - inicio) / (fim - inicio)


def entra_e_sai(t: float, inicio: float, fim: float, fade: float = 0.4) -> float:
    """Opacidade de um elemento que aparece, fica e some."""
    if t < inicio or t > fim:
        return 0.0
    return min(faixa(t, inicio, inicio + fade), 1 - faixa(t, fim - fade, fim))


# --------------------------------------------------------------- o desenho

def mesclar(base: Image.Image, camada: Image.Image, alfa: float) -> Image.Image:
    """
    Aplica uma camada com opacidade.

    `Image.blend` em vez de `alpha_composite` porque as peças deste projeto
    são RGB, e `alpha_composite` recusa com `image has wrong mode`, o defeito
    já pago ao pôr a marca d'água sobre o fundo.
    """
    if alfa <= 0:
        return base
    if alfa >= 1:
        return camada
    return Image.blend(base, camada, alfa)


def etapas_do_funil(cfg, escala):
    """
    As três faixas do funil, em coordenadas do quadro.

    Trapézios que estreitam, e não retângulos: a silhueta precisa ler como
    funil sem rótulo, e é a mesma forma das três camadas do símbolo da marca
    (`components/branding/logo.tsx`), onde as larguras caem 18.8, 10.2, 2.2.
    """
    w, h = cfg["w"] * escala, cfg["h"] * escala
    lados = cfg["lados"] * escala
    topo = cfg["topo"] * escala
    base = cfg["base"] * escala

    util = h - topo - base
    # ## O funil ocupa a maior parte da banda, não a metade
    #
    # A primeira versão dava 50% da banda a ele e o resultado, aberto,
    # era tímido: um funil pequeno no meio de muito vazio, com os cards
    # ainda menores dentro. Vazio no MEIO da peça lê como erro de
    # alinhamento, e é a mesma reprovação que o feed já pagou.
    #
    # O texto usa o terço de cima, o funil o meio, e o rodapé precisa caber
    # DEPOIS dele e AINDA DENTRO da banda: a faixa de baixo pertence à
    # interface do aplicativo, não à peça.
    y0 = topo + util * 0.30
    altura = util * 0.56
    alt_etapa = altura / 3

    larguras = [1.0, 0.68, 0.36]
    faixas = []
    for i, larg in enumerate(larguras):
        meia_cima = (w - lados * 2) * larg / 2
        meia_baixo = (w - lados * 2) * larguras[min(i + 1, 2)] / 2
        if i == 2:
            meia_baixo = meia_cima * 0.62
        cy = y0 + i * alt_etapa
        faixas.append({
            "topo": cy,
            "base": cy + alt_etapa * 0.82,
            "meia_cima": meia_cima,
            "meia_baixo": meia_baixo,
            "centro": w / 2,
        })
    return faixas


def desenhar_funil(draw, faixas, cor_borda, acesa=None, cor_acesa=None):
    """As três faixas. `acesa` pinta uma delas com destaque."""
    for i, f in enumerate(faixas):
        poli = [
            (f["centro"] - f["meia_cima"], f["topo"]),
            (f["centro"] + f["meia_cima"], f["topo"]),
            (f["centro"] + f["meia_baixo"], f["base"]),
            (f["centro"] - f["meia_baixo"], f["base"]),
        ]
        cor = cor_acesa if (acesa == i and cor_acesa) else cor_borda
        draw.polygon(poli, outline=cor, width=max(2, int(2 * ESCALA)))


def posicao_no_funil(faixas, indice_etapa: float, escala):
    """
    Onde um card fica, dado um ponto contínuo entre as etapas.

    Contínuo e não discreto porque o card ATRAVESSA a fronteira entre etapas
    durante a animação, e um salto de posição leria como troca de imagem em
    vez de movimento.
    """
    i = max(0, min(2, int(indice_etapa)))
    frac = indice_etapa - i
    f = faixas[i]
    y = f["topo"] + (f["base"] - f["topo"]) * (0.5 + frac * 0.5)
    if frac > 0 and i < 2:
        prox = faixas[i + 1]
        y = f["topo"] + (prox["topo"] - f["topo"]) * frac + (f["base"] - f["topo"]) * 0.5

    return f["centro"], y, meia_largura_em(faixas, y)


def meia_largura_em(faixas, y: float) -> float:
    """
    Meia-largura da parede do funil na altura `y`.

    ## Por que ela é calculada a partir do y, e não da etapa de origem

    A primeira versão interpolava dentro da faixa de ORIGEM do card. Enquanto
    ele atravessa para a etapa seguinte o `y` já saltou para lá, mas a
    largura ainda vinha da faixa anterior, que é mais larga. Aberto o quadro:
    cards com a borda direita FORA do trapézio, exatamente o defeito que a
    correção anterior tentou fechar.

    Percorrer as faixas pelo `y` real resolve os dois casos, o de dentro de
    uma faixa e o do vão entre duas, sem o chamador saber de qual etapa o
    card veio.
    """
    for f in faixas:
        if f["topo"] <= y <= f["base"]:
            desce = (y - f["topo"]) / max(1.0, f["base"] - f["topo"])
            return f["meia_cima"] + (f["meia_baixo"] - f["meia_cima"]) * desce

    # No vão entre duas faixas, a mais estreita das duas: a alternativa é o
    # card aparecer mais largo que a etapa em que está prestes a entrar.
    if y < faixas[0]["topo"]:
        return faixas[0]["meia_cima"]
    if y > faixas[-1]["base"]:
        return faixas[-1]["meia_baixo"]
    for anterior, seguinte in zip(faixas, faixas[1:]):
        if anterior["base"] < y < seguinte["topo"]:
            return min(anterior["meia_baixo"], seguinte["meia_cima"])
    return faixas[-1]["meia_baixo"]


# ------------------------------------------------------------------ o roteiro

#: O texto que vai à tela, separado do código que o desenha.
#:
#: Junto num lugar só porque é ele que os testes leem: `21x`, `42h`, `82%`,
#: `3,4h` e `55%` já estão em peças do feed, e a grade do perfil mostra vídeo
#: e arte lado a lado. "12 dias" é novo, e é o único número deste roteiro.
ROTEIRO = {
    "gancho": "Todo dia um negócio seu para de andar.",
    "apoio": "E ele não avisa. Só para.",
    "revelacao": "Parado há 12 dias.",
    "causa": "Ninguém esqueceu de propósito. Só não tinha onde ver.",
    "virada": "O funil vê por você.",
    "oferta": None,   # montada de lib/plans.ts, ver `montar_oferta()`
}


def montar_oferta() -> str:
    """
    A oferta, interpolada. Nunca escrita à mão.

    Em 31/08 havia arte pronta anunciando uma condição que o produto tinha
    aposentado dois dias antes. O valor vem de `lib/plans.ts` para que mudar
    o plano mude o vídeo junto, sem ninguém reabrir este arquivo.
    """
    return (f"Grátis até {g.FREE_LEAD_LIMIT} contatos. "
            f"R$ {g.PRO_PLAN_PRICE} por mês pela empresa inteira.")


# --------------------------------------------------------------- o quadro

def quadro(t: float, cfg, marcar_zona=False) -> Image.Image:
    """Um quadro do vídeo, no instante `t` em segundos."""
    w, h = cfg["w"] * ESCALA, cfg["h"] * ESCALA
    lados = cfg["lados"] * ESCALA
    topo = cfg["topo"] * ESCALA
    base = cfg["base"] * ESCALA
    largura_texto = w - lados * 2

    # O fundo é o da marca. `fundo_marca` lê `g.W`/`g.H`, então elas são
    # ajustadas ao formato antes, o mesmo padrão de `gerar-feed.py`.
    g.W_FINAL, g.H_FINAL = cfg["w"], cfg["h"]
    g.W, g.H = w, h
    g.ESCALA = ESCALA
    g.SEGURO_TOPO, g.SEGURO_BASE = topo, base
    g.MARGEM_ESQ = lados
    g.LARGURA_TEXTO = largura_texto
    g._TEMA_CLARO = False
    # A luz do fundo sobe devagar ao longo do vídeo: o quadro final é mais
    # claro que o primeiro, e isso dá sensação de chegada sem cortar nada.
    g._LUZ_ATUAL = 0.20 + 0.22 * faixa(t, 0, DURACAO)

    # ## A marca d’água do funil sai NESTA peça
    #
    # `fundo_marca` cola o símbolo da marca gigante no canto, a 5,5%. Nas
    # artes estáticas ele é estrutura de fundo e funciona. Aqui ele é a MESMA
    # forma que o funil desenhado no meio da tela, em outra escala e outro
    # ângulo: aberto o primeiro quadro, as duas se leem como dois funis
    # fantasmas disputando a mesma peça, e nenhum dos dois se resolve.
    #
    # Forma dentro de forma é o mesmo defeito que tirou o selo do rodapé em
    # 31/08. A marca continua identificando a peça pelo endereço no rodapé.
    marca_original = g.marca_dagua_do_funil
    g.marca_dagua_do_funil = lambda im, forca=0.0: im
    try:
        chave = (cfg["w"], cfg["h"], round(g._LUZ_ATUAL, 2))
        if chave not in _FUNDOS:
            g._LUZ_ATUAL = chave[2]
            _FUNDOS[chave] = g.fundo_marca()
        img = _FUNDOS[chave].copy()
    finally:
        g.marca_dagua_do_funil = marca_original

    faixas = etapas_do_funil(cfg, ESCALA)

    # ---------------------------------------------------------------- funil
    #
    # Ele entra cedo e fica: se aparecesse só no meio, as duas metades do
    # vídeo leriam como dois vídeos. O que muda ao longo do tempo é o que
    # acontece DENTRO dele.
    op_funil = entra_e_sai(t, 0.5, DURACAO, fade=0.6)
    if op_funil > 0:
        camada = img.copy()
        d2 = ImageDraw.Draw(camada)
        acesa = 1 if t > 8.2 else None
        # `(0, 96, 98)` era a cor da primeira versão e sumia: aberto o quadro,
        # o funil lia como marca de fundo, não como estrutura. Num vídeo em
        # que a única coisa que acontece é um card não descer o funil, o funil
        # precisa ser visível o bastante para alguém reparar onde o card
        # deveria estar indo.
        desenhar_funil(d2, faixas, (0, 150, 152), acesa, g.TEAL)
        img = mesclar(img, camada, op_funil)

    draw = ImageDraw.Draw(img)

    # ---------------------------------------------------------------- cards
    #
    # Quatro cards. Três atravessam as três etapas; o segundo trava na etapa
    # do meio e fica lá até o fim do vídeo.
    #
    # A defasagem de partida existe para o olho ler "fluxo" em vez de "quatro
    # coisas iguais se movendo juntas", que leria como uma imagem deslizando.
    larg_card = (w - lados * 2) * 0.34
    alt_card = larg_card * 0.34

    if t > 1.6:
        # ## Seis cards, não quatro
        #
        # Com quatro e a defasagem original, boa parte do vídeo tinha UM card
        # na tela: os primeiros já tinham saído pela ponta e o último ainda
        # não havia entrado. Um card sozinho não é fluxo, e sem fluxo o card
        # travado não tem contra o que se destacar, que é a única coisa que
        # este vídeo precisa mostrar.
        #
        # A cadência também encurtou: eles entram a cada 1,2s em vez de a
        # cada 2s, então há sempre dois ou três em movimento ao lado do que
        # ficou parado.
        PARTIDAS = [1.8, 3.0, 4.2, 5.4, 6.6, 7.8]
        TRAVADO = 1
        for i, partida in enumerate(PARTIDAS):
            if i == TRAVADO:
                # Ele anda até o meio da segunda etapa e para. O corte em 1.5
                # é o que deixa o card exatamente na faixa do meio.
                etapa = min(suavizar(faixa(t, partida, partida + 1.6)) * 3.0, 1.5)
            else:
                etapa = suavizar(faixa(t, partida, partida + 4.2)) * 3.0

            if etapa >= 2.94 and i != TRAVADO:
                continue  # saiu pela ponta do funil

            cx, cy, meia = posicao_no_funil(faixas, etapa, ESCALA)

            # ## O espalhamento é proporcional à ETAPA, não fixo
            #
            # A primeira versão somava um deslocamento fixo por índice, e os
            # cards saíam pelas paredes do trapézio na etapa do meio e na
            # ponta: aberto o quadro, três cards flutuavam FORA do funil, que
            # é o contrário do que o vídeo diz.
            #
            # O funil estreita e o espaço estreita junto. A folga é a
            # meia-largura da etapa naquele y, menos meio card.
            #
            # Três trilhas (`i % 3`) em vez de uma posição por card: com seis
            # cards numa distribuição linear eles ficariam colados, e o
            # travado precisa ter alguém PASSANDO ao lado dele para a
            # diferença entre andar e ficar existir na tela.
            #
            # O travado é o índice 1, que cai na trilha do meio: é onde ele
            # fica mais visível e onde os outros passam dos dois lados.
            # O card tem altura, e a parede estreita ao longo dela: medir só
            # no centro deixaria o canto inferior para fora. A folga sai da
            # borda mais apertada das duas.
            meia = min(meia,
                       meia_largura_em(faixas, cy - alt_card / 2),
                       meia_largura_em(faixas, cy + alt_card / 2))

            # ## O card ENCOLHE ao descer, e isso corrigiu 3.040 vazamentos
            #
            # Com largura fixa, o card era mais largo que a etapa final: a
            # ponta do funil tem meia-largura pequena e `larg_card` não. A
            # folga ia a zero, o card ficava centrado, e ainda assim
            # atravessava as duas paredes.
            #
            # A prova quadro a quadro achou isso; uma tira de seis quadros
            # não acharia, porque o vazamento é maior justamente nos
            # instantes de travessia, que são poucos.
            #
            # Encolher não é remendo: no funil, o que avança fica mais
            # apertado, e o card acompanhando a parede é o que o desenho já
            # dizia. `w_card` nunca cresce acima do tamanho de entrada.
            w_card = min(larg_card, max(0.0, 2 * meia - 18 * ESCALA))
            h_card = alt_card * (w_card / larg_card if larg_card else 1)
            if w_card < larg_card * 0.34:
                continue  # menor que isso vira risco, não card

            folga = max(0.0, meia - w_card / 2 - 8 * ESCALA)
            cx += (i % 3 - 1) * folga * 0.78

            parado = i == TRAVADO and t > 8.2
            if parado:
                # Pulso lento: o card não pisca, ele respira. Piscar lê como
                # erro de renderização; respirar lê como alerta.
                pulso = 0.5 + 0.5 * math.sin((t - 8.2) * 2.6)
                fundo_card = (int(6 + 24 * pulso), int(74 + 44 * pulso),
                              int(76 + 44 * pulso))
                cor_borda = g.TEAL
                cor_linha = g.BRANCO
                largura_borda = max(2, int(3.5 * ESCALA))
            else:
                fundo_card = (5, 42, 43)
                cor_borda = (0, 128, 130)
                cor_linha = (0, 138, 140)
                largura_borda = max(1, int(1.5 * ESCALA))

            draw.rounded_rectangle(
                [cx - w_card / 2, cy - h_card / 2,
                 cx + w_card / 2, cy + h_card / 2],
                radius=9 * ESCALA, fill=fundo_card,
                outline=cor_borda, width=largura_borda,
            )

            # Duas linhas dentro do card: sem elas o retângulo lê como bloco,
            # não como ficha de negócio.
            for k, frac in enumerate((0.36, 0.62)):
                lx = cx - w_card * 0.32
                ly = cy - h_card / 2 + h_card * frac
                draw.line(
                    [(lx, ly), (lx + w_card * (0.46 if k == 0 else 0.28), ly)],
                    fill=cor_linha, width=max(1, int(2 * ESCALA)),
                )

    # ----------------------------------------------------------------- texto
    fnt_titulo = g.fonte(g.TITULO, cfg["titulo"])
    fnt_corpo = g.fonte(g.CORPO, cfg["corpo"])

    def bloco(imagem, texto, fnt, y, cor, opacidade, subir=0.0):
        """
        Escreve centrado, com opacidade, e devolve (imagem, y do fim).

        ## Devolver o y não é conveniência

        A primeira versão punha o corpo em `y_titulo + tamanho * 1.5`, o que
        assume que o título ocupa UMA linha. No fecho ele ocupa duas, e
        aberto o quadro o corpo estava escrito POR CIMA da segunda linha do
        título. Onde um bloco termina depende da largura dos glifos, então o
        único jeito de saber é medir depois de escrever.
        """
        if opacidade <= 0:
            return imagem, y
        camada = imagem.copy()
        d2 = ImageDraw.Draw(camada)
        linhas, atual = [], ""
        for palavra in texto.split():
            teste = f"{atual} {palavra}".strip()
            if d2.textlength(teste, font=fnt) <= largura_texto:
                atual = teste
            else:
                linhas.append(atual)
                atual = palavra
        if atual:
            linhas.append(atual)
        yy = y + subir
        for linha in linhas:
            larg = d2.textlength(linha, font=fnt)
            d2.text((lados + (largura_texto - larg) / 2, yy), linha,
                    font=fnt, fill=cor)
            yy += fnt.size * 1.16
        return mesclar(imagem, camada, opacidade), yy - subir

    y_titulo = topo + (faixas[0]["topo"] - topo) * 0.16
    #: Respiro entre título e corpo, em fração do corpo de texto.
    VAO = 0.9

    op = entra_e_sai(t, 0.3, 4.4, fade=0.5)
    if op > 0:
        img, _ = bloco(img, ROTEIRO["gancho"], fnt_titulo, y_titulo, g.BRANCO,
                       op, subir=(1 - suavizar(faixa(t, 0.3, 1.0))) * 18 * ESCALA)

    op = entra_e_sai(t, 4.6, 8.4, fade=0.5)
    if op > 0:
        img, _ = bloco(img, ROTEIRO["apoio"], fnt_titulo, y_titulo, g.BRANCO, op)

    op = entra_e_sai(t, 8.6, 11.4, fade=0.45)
    if op > 0:
        img, fim = bloco(img, ROTEIRO["revelacao"], fnt_titulo, y_titulo,
                         g.TEAL, op)
        img, _ = bloco(img, ROTEIRO["causa"], fnt_corpo,
                       fim + fnt_corpo.size * VAO, (150, 172, 172), op)

    op = entra_e_sai(t, 11.6, DURACAO, fade=0.5)
    if op > 0:
        img, fim = bloco(img, ROTEIRO["virada"], fnt_titulo, y_titulo,
                         g.BRANCO, op)
        img, _ = bloco(img, montar_oferta(), fnt_corpo,
                       fim + fnt_corpo.size * VAO, (150, 172, 172), op)

    # -------------------------------------------------------------- rodapé
    #
    # O endereço entra no último terço e fica. Ele é a única forma de alguém
    # chegar ao produto: Reel não tem link clicável.
    op = entra_e_sai(t, 10.6, DURACAO, fade=0.6)
    if op > 0:
        camada = img.copy()
        d2 = ImageDraw.Draw(camada)
        fnt = g.mono(cfg["corpo"], 500)
        larg = d2.textlength(g.SITE_CANONICO, font=fnt)

        # ## O endereço fica ACIMA da zona de base, não dentro dela
        #
        # A primeira versão o punha em `h - base + ...`, ou seja, 103px
        # ABAIXO do fim da banda útil. Num Reel isso é exatamente onde a
        # pilha de legenda e os botões do aplicativo ficam: o endereço
        # sairia publicado e coberto.
        #
        # É o pior lugar possível para esse defeito. Reel não tem link
        # clicável, então o endereço escrito é a única forma de alguém
        # chegar ao produto depois de assistir.
        faixas_ = etapas_do_funil(cfg, ESCALA)
        limite = h - base
        y_site = min(faixas_[-1]["base"] + fnt.size * 1.5,
                     limite - fnt.size * 1.4)
        d2.text((lados + (largura_texto - larg) / 2, y_site),
                g.SITE_CANONICO, font=fnt, fill=g.TEAL)
        img = mesclar(img, camada, op)

    # --------------------------------------------------- conferência visual
    if marcar_zona:
        d2 = ImageDraw.Draw(img)
        for y in (topo, h - base):
            d2.line([(0, y), (w, y)], fill=(255, 64, 64), width=3 * ESCALA)
        for x in (lados, w - lados):
            d2.line([(x, 0), (x, h)], fill=(255, 64, 64), width=3 * ESCALA)

    return img.resize((cfg["w"], cfg["h"]), Image.LANCZOS)


# ------------------------------------------------------------------ montagem

def conferir_zonas():
    """
    A banda útil precisa fechar em cada formato.

    Um erro de aritmética aqui não quebra nada e nasce publicado, com texto
    debaixo da barra de ações do aplicativo. É o mesmo papel de
    `conferir_zona_segura()` no gerador de feed.
    """
    for nome, cfg in FORMATOS.items():
        alt = cfg["h"] - cfg["topo"] - cfg["base"]
        larg = cfg["w"] - cfg["lados"] * 2
        if alt <= 0 or larg <= 0:
            raise SystemExit(f"{nome}: banda útil inválida ({larg}x{alt})")
        if nome == "reels" and (larg, alt) != (720, 1200):
            raise SystemExit(
                f"reels: banda {larg}x{alt}, esperado 720x1200. "
                "A barra de ações e a pilha de legenda comem o resto."
            )
        print(f"  {nome:6} banda útil {larg}x{alt}")


def montar(nome_formato, cfg, marcar_zona=False):
    """Renderiza os quadros e junta em MP4."""
    total = int(DURACAO * FPS)
    pasta = Path(tempfile.mkdtemp(prefix=f"velo-video-{nome_formato}-"))
    sufixo = "-zona-segura" if marcar_zona else ""
    destino = SAIDA / f"negocio-parado-{nome_formato}{sufixo}.mp4"

    try:
        print(f"  {nome_formato}: {total} quadros a {FPS}fps", end="", flush=True)
        for n in range(total):
            t = n / FPS
            quadro(t, cfg, marcar_zona).save(pasta / f"q{n:04d}.png")
            if n % 60 == 0:
                print(".", end="", flush=True)
        print()

        # O primeiro quadro vai separado: é ele que a conferência de zona
        # segura olha, e é a capa que o Instagram usa por padrão.
        quadro(0.6, cfg, marcar_zona).save(
            SAIDA / f"negocio-parado-{nome_formato}{sufixo}-capa.png")

        subprocess.run([
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
            "-framerate", str(FPS),
            "-i", str(pasta / "q%04d.png"),
            "-c:v", "libx264",
            # `yuv420p` não é preferência: sem ele o vídeo não abre em parte
            # dos aparelhos e no player do próprio Instagram.
            "-pix_fmt", "yuv420p",
            "-preset", "slow", "-crf", "18",
            "-movflags", "+faststart",
            str(destino),
        ], check=True)

        mb = destino.stat().st_size / 1024 / 1024
        print(f"  {destino.name}  ({cfg['w']}x{cfg['h']}, {DURACAO:.0f}s, {mb:.1f} MB)")
    finally:
        shutil.rmtree(pasta, ignore_errors=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--zona-segura", action="store_true",
                    help="desenha as margens por cima, para conferência")
    ap.add_argument("--formato", choices=list(FORMATOS), default=None)
    args = ap.parse_args()

    if not shutil.which("ffmpeg"):
        raise SystemExit("ffmpeg não encontrado no PATH.")

    print("VÍDEO: o negócio que para de andar")
    conferir_zonas()
    print()

    SAIDA.mkdir(parents=True, exist_ok=True)
    escolhidos = [args.formato] if args.formato else list(FORMATOS)
    for nome in escolhidos:
        montar(nome, FORMATOS[nome], args.zona_segura)

    print()
    print(f"em {SAIDA.relative_to(g.RAIZ)}")


if __name__ == "__main__":
    main()
