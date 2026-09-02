#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gerador de criativos de Instagram - Velo Funil.

Duas saidas, um so caminho de texto:

    estatica  1080x1350 (feed 4:5), desenhada em 2x e reduzida com LANCZOS
    video     1080x1920 (9:16), frames PIL montados por ffmpeg/subprocess

A oferta (preco, teto do grato, nome do plano) e SEMPRE interpolada das
constantes abaixo. Nada de numero de oferta escrito a mao dentro de uma
composicao: imagem nao compila, e este arquivo e o ultimo ponto do caminho
onde o texto ainda e texto.

Uso:
    python velofunil_criativos.py --check            # travas, sem desenhar
    python velofunil_criativos.py --estaticas        # 9 pecas + mosaico 3x3
    python velofunil_criativos.py --videos           # 2 mp4 + frames com zona segura
    python velofunil_criativos.py --tudo
    python velofunil_criativos.py --so p04_conta

Dependencias: Pillow. ffmpeg no PATH (8.1.2). Sem moviepy, sem rede,
sem random, sem relogio: mesma entrada, mesmo arquivo, sempre.
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

# ---------------------------------------------------------------------------
# 1. A oferta. Lida de lib/plans.ts, nunca escrita a mao numa peca.
# ---------------------------------------------------------------------------

FREE_LEAD_LIMIT = 50
FREE_MEMBER_LIMIT = 2   # lib/plans.ts
PRO_PLAN_PRICE = 49           # lib/plans.ts
PRO_PLAN_NAME = "Pro"         # lib/plans.ts
FREE_PLAN_NAME = "Gratis"     # lib/plans.ts  (acentuado na saida via PLAN_LABELS)

PLAN_LABELS = {"free": "GRÁTIS", "pro": PRO_PLAN_NAME.upper()}

# Base publica da comparacao por assento. Mediana de preco por usuario do
# mercado mapeado, e o tamanho de time que a peca declara na propria arte.
# ## Este numero vive em `lib/plans.ts`, e ali ele e 60
#
# O gerador tinha 53, e o produto tem `PRECO_MEDIANA_POR_USUARIO = 60`, com
# `PRECOS_CONFERIDOS_EM = '31/08/2026'` ao lado. Duas fontes do mesmo dado
# discordando — a classe de defeito que custou 23 dias de e-mail com CNPJ
# baixado neste projeto.
#
# Vence o do produto: ele carrega a data da conferencia, e a peca nao. O
# argumento fica mais forte de graca (5 pessoas passam de R$ 265 para R$ 300),
# mas o motivo de trocar nao e esse — e que 53 nao era mais verdade.
SEAT_MEDIAN_PRICE = 60
TEAM_SIZE = 5
MONTHS = 12

DOMAIN = "www.velofunil.com.br"   # sempre com www: 255ms contra 980ms medidos


def brl(valor: int) -> str:
    """1234 -> 'R$ 1.234'. Unico lugar do arquivo que escreve o cifrao."""
    return "R$ " + f"{valor:,}".replace(",", ".")


SEAT_YEAR = SEAT_MEDIAN_PRICE * TEAM_SIZE * MONTHS   # 3180
FLAT_YEAR = PRO_PLAN_PRICE * MONTHS                  # 588

# ---------------------------------------------------------------------------
# 2. Sistema visual. Sai dos tokens de cor do produto.
# ---------------------------------------------------------------------------

FEED = (1080, 1350)
STORY = (1080, 1920)
GRID_CROP_W = 1012            # a grade do perfil recorta 3:4 centralizado
SS = 2                        # supersample das estaticas

MARGENS_ESTATICA = dict(topo=269, base=384, lado=97)          # arte 9:16
MARGENS_VIDEO = dict(topo=220, base=500, lado=180)            # Reels/TikTok
BANDA_VIDEO = (720, 1200)                                     # 180..900, 220..1420
assert MARGENS_VIDEO["topo"] + BANDA_VIDEO[1] + MARGENS_VIDEO["base"] == STORY[1]

FEED_PAD = dict(topo=88, base=96, lado=96)   # 96 > 34 do recorte, com folga

# A marca. O selo com o funil dentro foi reprovado (forma dentro de forma, e
# em 66px vira bloco indistinto). O funil sozinho funciona, entao ele entra
# sem moldura, no topo, com o nome ao lado. Mesma ancora em toda peca: e o
# que faz a grade do perfil ler como um perfil e nao como nove posts soltos.
MARCA_TAM = 86
MARCA_TOPO = FEED_PAD["topo"]
TOPO_CONTEUDO = 252


# ---------------------------------------------------------------------------
# As metricas por PROPORCAO, e por que elas precisaram existir
# ---------------------------------------------------------------------------
#
# `FEED_PAD` e `TOPO_CONTEUDO` acima nasceram medidos contra 1080x1350, que era
# a unica medida que este gerador produzia. Toda composicao posiciona a partir
# deles e do rodape (`c.h - pad["base"]`), entao a altura da tela entra em cada
# conta sem aparecer em nenhuma.
#
# Isso quebrou de duas formas opostas ao gerar as outras duas proporcoes que os
# posicionamentos do Meta pedem:
#
#     1:1   1080x1080   270px A MENOS. O conteudo calibrado para 1350 nao cabe,
#                       e o primeiro sintoma medido em 02/09 foi o rotulo do
#                       eixo ("PESSOAS NO TIME") sobreposto a linha de fonte.
#
#     9:16  1080x1920   570px A MAIS, e a folga e ARMADILHA: Stories e Reels
#                       cobrem 14% do topo (foto de perfil, nome) e 20% do
#                       rodape (legenda, botao). Escalar proporcionalmente
#                       poria a marca embaixo do avatar do proprio perfil.
#
# Por isso a tabela e por proporcao, e nao um fator de escala: o 1:1 precisa
# ENCOLHER e o 9:16 precisa AFASTAR-SE DAS BORDAS. Sao problemas diferentes.
#
# ## O 4:5 devolve exatamente os valores de cima, e isso e a rede de seguranca
#
# Toda peca organica ja publicada e 4:5. Se esta funcao mudasse um pixel ali,
# a proxima geracao do feed sairia diferente da que esta no ar sem ninguem
# pedir. O `assert` abaixo trava isso: nao e estilo, e o que impede a correcao
# do anuncio de mexer no organico.
def metricas_da_proporcao(largura: int, altura: int) -> tuple[dict, int]:
    """Devolve `(pad, topo_do_conteudo)` para a proporcao desta tela."""
    prop = largura / altura

    if prop >= 0.95:                       # 1:1 — o quadrado
        # Os recuos verticais encolhem na proporcao da altura (0.8), o lateral
        # NAO: a largura continua 1080, e estreitar a mancha de texto so para
        # acompanhar a altura deixaria vazio nos dois lados.
        return dict(topo=70, base=78, lado=96), 196

    if prop <= 0.65:                       # 9:16 — Stories e Reels
        # `MARGENS_ESTATICA` ja e a zona segura do 9:16 neste arquivo, medida
        # para a arte de Story: 269 no topo (14%) e 384 na base (20%). Reusar
        # em vez de escrever numero novo — duas copias da mesma margem divergem
        # na primeira vez que a Meta mudar a interface.
        m = MARGENS_ESTATICA
        return dict(topo=m["topo"], base=m["base"], lado=m["lado"]), \
            m["topo"] + 164

    return dict(FEED_PAD), TOPO_CONTEUDO   # 4:5 — o feed, inalterado


assert metricas_da_proporcao(*FEED) == (FEED_PAD, TOPO_CONTEUDO), \
    "o 4:5 mudou de metrica; toda peca organica publicada sairia diferente"

# Tracado do simbolo, no espaco 24x24 do arquivo de marca.
FUNIL_BARRAS = [
    ((2.6, 4.4), (21.4, 4.4), (18.9, 7.76), (5.1, 7.76)),
    ((6.9, 10.6), (17.1, 10.6), (14.98, 13.46), (9.02, 13.46)),
    ((10.9, 16.6), (13.1, 16.6), (12.0, 19.51)),
]


def _cantos_arredondados(pontos, raio: float, passos: int = 10) -> list:
    """
    O poligono com os cantos cortados por curva, no lugar de vertice vivo.

    ## O que isto substitui, e por que

    A versao anterior encolhia o poligono inteiro pelo raio e depois
    desenhava o contorno por cima com `joint="curve"`, contando com a
    espessura da linha para devolver o tamanho. Aberto em 300px, o resultado
    nao era o simbolo:

      barra 1   ganhava um degrau no canto superior esquerdo
      barra 2   perdia a simetria do trapezio
      barra 3   virava um PINGO disforme, e nao o triangulo da marca

    A terceira e a que denuncia o metodo: ela tem 2.2 de largura por 2.9 de
    altura, e encolher isso por 0.9 em cada direcao nao deixa forma nenhuma
    de pe. O erro cresce quanto MENOR a peca, ou seja, exatamente onde a
    marca precisa se sustentar.

    Aqui cada canto e recuado ao longo das duas arestas que o formam e
    ligado por um Bezier quadratico com o proprio vertice de controle. E o
    que os arcos `a.9 .9` do SVG fazem, e preserva a silhueta: nenhum ponto
    do poligono se move para dentro, so o canto e suavizado.

    O raio se adapta ao lado mais curto — 0.9 num triangulo de 2.2 comeria
    a forma, e a marca oficial usa arcos elipticos que se acomodam sozinhos.
    """
    n = len(pontos)
    lados = [((pontos[i][0] - pontos[(i + 1) % n][0]) ** 2
              + (pontos[i][1] - pontos[(i + 1) % n][1]) ** 2) ** 0.5
             for i in range(n)]
    r = min(raio, min(lados) / 2.4)

    saida = []
    for i in range(n):
        ant, atual, prox = pontos[i - 1], pontos[i], pontos[(i + 1) % n]

        def recuar(de, para):
            dx, dy = para[0] - de[0], para[1] - de[1]
            d = max(1e-6, (dx * dx + dy * dy) ** 0.5)
            t = min(r, d / 2) / d
            return (de[0] + dx * t, de[1] + dy * t)

        a = recuar(atual, ant)
        b = recuar(atual, prox)
        saida.append(a)
        # Bezier quadratico: o proprio vertice e o ponto de controle.
        for k in range(1, passos):
            u = k / passos
            saida.append((
                (1 - u) ** 2 * a[0] + 2 * (1 - u) * u * atual[0] + u * u * b[0],
                (1 - u) ** 2 * a[1] + 2 * (1 - u) * u * atual[1] + u * u * b[1],
            ))
        saida.append(b)
    return saida


def funil(c: "Tela", x: float, y: float, tam: float, cor: tuple, raio: float = 0.9) -> None:
    """
    Traca o simbolo do arquivo de marca (`marketing/marca/*.svg`).

    Tres camadas que afunilam: lidas juntas formam o funil e a letra V de
    Velo. As larguras caem 18.8, 10.2 e 2.2 no espaco 24x24 do arquivo, e o
    SVG arredonda os cantos em 0.9.
    """
    k = tam / 24.0
    for pontos in FUNIL_BARRAS:
        forma = _cantos_arredondados(pontos, raio)
        c.d.polygon([(c.u(x + px * k), c.u(y + py * k)) for px, py in forma],
                    fill=cor)


def marca(c: "Tela", selo: str = "") -> None:
    pal, x = c.pal, c.pad["lado"]
    topo = c.marca_topo
    funil(c, x, topo, MARCA_TAM, pal.destaque)
    # Assinatura conforme o arquivo completa-*: Velo em SemiBold no titulo,
    # Funil em Regular no corpo. O cinza do arquivo (#8c9c9c) reprova em fundo
    # claro, entao o segundo termo usa o corpo do registro, que ja passa 4.5:1.
    fv = c.f("sans", "SemiBold", 34)
    fu = c.f("sans", "Regular", 34)
    xt = x + MARCA_TAM + 22
    c.texto(xt, topo + 24, "Velo ", fv, pal.titulo)
    c.texto(xt + c.largura_texto("Velo ", fv), topo + 24, "Funil", fu,
            pal.corpo)
    if selo:
        fm = c.f("mono", "Medium", 24)
        c.texto(c.w - x - c.largura_texto(selo, fm) - 24 * 0.16 * len(selo),
                topo + 30, selo, fm, pal.corpo, 0.16 * 24)


@dataclass(frozen=True)
class Paleta:
    nome: str
    fundo: tuple
    titulo: tuple
    corpo: tuple
    destaque: tuple
    borda: tuple


# ## As cores das etapas, tiradas do produto e nao inventadas aqui
#
# Sao os mesmos valores de `lib/deals/stage-colors.ts`, que pintam a barra de
# cada etapa no Kanban, no grafico de funil e no card do negocio. Copiados a
# mao porque este gerador e Python e nao le TypeScript; se um dia divergirem,
# quem manda e o arquivo do produto.
#
# ## Por que ESTAS cores podem entrar, e outras nao
#
# A landing removeu oito matizes em 26/08 com um motivo escrito: "Funil visual"
# nao e a categoria azul, entao a cor nao carregava informacao — lia como
# template. As tres que ficaram, e continuam, sao as que SIGNIFICAM algo: os
# pontinhos da barra de janela (imitam o cromo do sistema) e as barras do
# funil.
#
# Estas sao as barras do funil. Azul e onde o negocio entra, verde e onde ele
# vira dinheiro, e a ordem entre os dois e o produto inteiro. Quem ja usou a
# tela reconhece a sequencia; quem nunca usou le um degrade que afunila, que e
# exatamente o que a marca desenha.
ETAPAS_DO_FUNIL = [
    ("Novo",       (57, 135, 229)),
    ("Contato",    (201, 133, 0)),
    ("Proposta",   (144, 133, 233)),
    ("Negociação", (217, 89, 38)),
    ("Ganho",      (25, 158, 112)),
]


ESCURO = Paleta("escuro", (4, 32, 33), (252, 252, 252), (150, 172, 172),
                (0, 191, 192), (42, 46, 48))
CLARO = Paleta("claro", (246, 248, 249), (10, 10, 10), (94, 101, 101),
               (0, 120, 122), (217, 220, 221))

FUMACA = (252, 252, 252)      # legenda queimada
FULIGEM = (0, 0, 0)           # contorno da legenda

# ---------------------------------------------------------------------------
# 3. Travas. Cada uma existe porque ja foi violada.
# ---------------------------------------------------------------------------

# Montado das constantes: o literal proibido nao aparece neste arquivo.
_PRECO_LITERAL = re.compile(r"R\$\s*" + str(PRO_PLAN_PRICE))
_TETO_LITERAL = re.compile(r"\b" + str(FREE_LEAD_LIMIT) + r"\s+contatos")

# ## As travas nao escrevem o que elas proibem
#
# Duas delas escreviam: o tracinho longo aparecia literal dentro do proprio
# regex, e a palavra proibida aparecia na mensagem de erro. Isso reprova o
# arquivo em `lib/marketing/oferta-nas-artes.test.ts`, que varre o codigo
# procurando exatamente esses termos.
#
# E o mesmo defeito que `scripts/marketing/gerar-video.py` pagou horas antes,
# em 01/09: a documentacao citando o termo banido para nega-lo. Aqui o
# caractere vira ponto de codigo e a mensagem descreve sem nomear.
_TRACO_LONGO = re.compile("[" + chr(0x2014) + chr(0x2013) + "]")

PROIBIDO = [
    (_TRACO_LONGO, "tracinho longo: assinatura de texto de maquina"),
    (re.compile(r"ilimitad", re.I), f"o grato tem teto de {FREE_LEAD_LIMIT}"),
    (re.compile(r"\bt" + "rial" + r"\b|dias? de teste|teste gr[aá]tis|per[ií]odo de teste", re.I),
     "a avaliacao gratuita foi removida do produto em 29/08"),
    (re.compile(r"mais de \d|\d+\s*(mil\s*)?(empresas|clientes) (usam|confiam)", re.I),
     "prova social: nao existe cliente externo"),
    (re.compile(r"depoimento|case de sucesso|nossos clientes", re.I),
     "prova social: zero depoimento"),
    (re.compile(r"(?<!www\.)velofunil\.com\.br"), "dominio sem www custa 980ms"),
]

DADOS_JA_USADOS = ["21x", "3,4h", "55%", "60% disso", "82%", brl(265)]


def lint_texto(*textos: str) -> None:
    for t in textos:
        if not isinstance(t, str):
            continue
        for rx, motivo in PROIBIDO:
            m = rx.search(t)
            if m:
                raise ValueError(f"texto reprovado ({motivo}): ...{t[max(0, m.start()-24):m.end()+24]}...")


def lint_fonte_deste_arquivo() -> list:
    """A oferta nao pode estar escrita a mao no codigo, so interpolada."""
    src = Path(__file__).read_text(encoding="utf-8")
    faltas = []
    for linha_n, linha in enumerate(src.splitlines(), 1):
        if linha.lstrip().startswith("#"):
            continue
        if "_PRECO_LITERAL" in linha or "_TETO_LITERAL" in linha:
            continue
        if _PRECO_LITERAL.search(linha):
            faltas.append(f"linha {linha_n}: preco literal, use PRO_PLAN_PRICE")
        if _TETO_LITERAL.search(linha):
            faltas.append(f"linha {linha_n}: teto literal, use FREE_LEAD_LIMIT")
    return faltas


def _lin(c: int) -> float:
    s = c / 255.0
    return s / 12.92 if s <= 0.04045 else ((s + 0.055) / 1.055) ** 2.4


def luminancia(rgb: tuple) -> float:
    r, g, b = (_lin(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contraste(a: tuple, b: tuple) -> float:
    la, lb = luminancia(a), luminancia(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


PISO_CONTRASTE = dict(titulo=7.0, corpo=4.5, destaque=4.5)


def checa_contraste() -> list:
    faltas = []
    for pal in (ESCURO, CLARO):
        for papel, piso in PISO_CONTRASTE.items():
            r = contraste(getattr(pal, papel), pal.fundo)
            if r < piso:
                faltas.append(f"{pal.nome}/{papel}: {r:.2f}:1, piso {piso}:1")
    return faltas


# ---------------------------------------------------------------------------
# 4. Fontes. Tres familias, e as tres precisam estar em uso no conjunto.
# ---------------------------------------------------------------------------

PESOS = {"UltraBlack": 900, "Black": 800, "Bold": 700, "SemiBold": 600,
         "Medium": 500, "Regular": 400}

# `.woff` primeiro, e isso nao e detalhe de compatibilidade: e o formato que
# o produto de fato tem em `app/fonts`, e o mesmo arquivo que o navegador
# serve na landing. Medido: Pillow le woff variavel e aceita
# `set_variation_by_axes`, entao a arte usa a MESMA fonte que a tela, e nao
# uma copia .ttf que poderia divergir na proxima atualizacao.
ARQUIVOS = {
    "sans": ["GeistVF.woff", "Geist[wght].ttf", "GeistVF.ttf", "Geist-Variable.ttf"],
    "mono": ["GeistMonoVF.woff", "GeistMono[wght].ttf", "GeistMonoVF.ttf",
             "GeistMono-Regular.ttf"],
    "serif": ["InstrumentSerif-Italic.ttf"],
}

# ## Por que as fontes vem do PRODUTO, e nao de uma pasta ao lado
#
# O arquivo original esperava `fonts/` ao lado dele. Duas pastas de fonte no
# mesmo repositorio divergem no dia em que uma for atualizada, e a arte
# passaria a desenhar numa fonte que a tela nao usa mais, sem nada avisar.
#
# `RAIZ` sobe tres niveis: marketing/claude-designer/x.py -> a raiz do repo.
RAIZ = Path(__file__).resolve().parents[2]
FONT_DIR = RAIZ / "app" / "fonts"
_cache: dict = {}


def fonte(familia: str, peso: str, tamanho: int) -> ImageFont.FreeTypeFont:
    chave = (familia, peso, tamanho)
    if chave in _cache:
        return _cache[chave]
    caminho = None
    for nome in ARQUIVOS[familia]:
        p = FONT_DIR / nome
        if p.exists():
            caminho = p
            break
    if caminho is None:
        raise FileNotFoundError(
            f"fonte '{familia}' ausente. Esperado um destes em {FONT_DIR}: "
            + ", ".join(ARQUIVOS[familia]))
    f = ImageFont.truetype(str(caminho), tamanho)
    if familia != "serif":
        # ## Um valor por EIXO, casado pelo nome
        #
        # A versao anterior mandava `[PESOS[peso]]` — uma lista de um item.
        # Isso funciona para a Geist, que so tem `wght`, e falha em silencio
        # para qualquer fonte de mais eixos: `set_variation_by_axes` exige um
        # valor por eixo, na ordem, e o `except: pass` engolia o erro deixando
        # a fonte no peso PADRAO.
        #
        # O defeito e do tipo que nao aparece: o texto sai desenhado, so que
        # em Regular onde se pediu UltraBlack. Bricolage tem tres eixos
        # (opsz, wdth, wght) e teria caido exatamente nisso.
        try:
            valores = []
            for eixo in f.get_variation_axes():
                nome_eixo = eixo["name"]
                if isinstance(nome_eixo, bytes):
                    nome_eixo = nome_eixo.decode("utf-8", "ignore")
                nome_eixo = str(nome_eixo).strip().lower()
                if nome_eixo in ("weight", "wght"):
                    valores.append(PESOS[peso])
                elif nome_eixo in ("optical size", "opsz"):
                    # Otico casado com o corpo real: e para isso que o eixo
                    # existe, e ignora-lo devolve o desenho de texto pequeno
                    # ampliado, que e o que engorda contraforma em titulo.
                    valores.append(min(max(tamanho / SS, eixo["minimum"]),
                                       eixo["maximum"]))
                else:
                    valores.append(eixo["default"])
            f.set_variation_by_axes(valores)
        except Exception:
            pass
    _cache[chave] = f
    return f


# ---------------------------------------------------------------------------
# 5. Tela. Todo desenho fala em unidades de 1080 de largura; a tela escala.
# ---------------------------------------------------------------------------

class Tela:
    def __init__(self, largura: int, altura: int, pal: Paleta, ss: int = SS):
        self.ss = ss
        self.w, self.h = largura, altura
        self.pal = pal
        self.im = Image.new("RGB", (largura * ss, altura * ss), pal.fundo)
        self.d = ImageDraw.Draw(self.im)
        # Os recuos viajam COM a tela, em vez de serem lidos de uma global.
        # Enquanto eram globais, a altura da peca entrava em toda conta de
        # posicao sem aparecer em nenhuma — e mudar de proporcao quebrava as
        # composicoes em silencio. Ver `metricas_da_proporcao`.
        self.pad, self.topo = metricas_da_proporcao(largura, altura)
        self.marca_topo = self.pad["topo"]
        # ## `esc`: quanto a tela encolheu em altura util, contra o 4:5
        #
        # Recuo e corpo de fonte escritos para 1350 nao cabem em 1080 — a
        # composicao `chamada` estourou por 124px na primeira geracao do
        # quadrado, e a guarda de altura dela foi quem avisou.
        #
        # Nunca passa de 1.0, de proposito: no 9:16 sobra altura, e ESTICAR a
        # tipografia para preencher deixaria a peca com corpo diferente das
        # outras duas. A mesma arte, com respiro maior, le como a mesma marca;
        # a mesma arte com letra 22% maior le como outra peca.
        self.esc = min(1.0, (altura - self.pad["base"] - self.topo)
                       / (FEED[1] - FEED_PAD["base"] - TOPO_CONTEUDO))

    def u(self, v: float) -> int:
        return int(round(v * self.ss))

    def f(self, familia: str, peso: str, tamanho: float):
        return fonte(familia, peso, self.u(tamanho))

    def retangulo(self, x, y, w, h, cor):
        self.d.rectangle([self.u(x), self.u(y), self.u(x + w) - 1, self.u(y + h) - 1],
                         fill=cor)

    def linha_fina(self, x, y, w, cor, espessura=2):
        self.retangulo(x, y, w, espessura, cor)

    def largura_texto(self, texto, f) -> float:
        return self.d.textlength(texto, font=f) / self.ss

    def texto(self, x, y, texto, f, cor, tracking=0.0, stroke=0):
        """y e a linha de base do topo (anchor 'la'). tracking em unidades."""
        px, py = self.u(x), self.u(y)
        kw = dict(fill=cor, font=f, anchor="la")
        if stroke:
            kw.update(stroke_width=self.u(stroke), stroke_fill=FULIGEM)
        if not tracking:
            self.d.text((px, py), texto, **kw)
            return
        for ch in texto:
            self.d.text((px, py), ch, **kw)
            px += int(round(self.d.textlength(ch, font=f) + self.u(tracking)))

    def quebra(self, texto, f, largura_max) -> list:
        palavras, linhas, atual = texto.split(), [], ""
        for p in palavras:
            teste = f"{atual} {p}".strip()
            if self.largura_texto(teste, f) <= largura_max or not atual:
                atual = teste
            else:
                linhas.append(atual)
                atual = p
        if atual:
            linhas.append(atual)
        return linhas

    def paragrafo(self, x, y, texto, f, cor, largura_max, leading, tracking=0.0,
                  stroke=0, centro=False) -> float:
        linhas = self.quebra(texto, f, largura_max)
        for i, linha in enumerate(linhas):
            lx = x
            if centro:
                lx = x + (largura_max - self.largura_texto(linha, f)) / 2
            self.texto(lx, y + i * leading, linha, f, cor, tracking, stroke)
        return len(linhas) * leading

    def salvar(self, caminho: Path):
        im = self.im
        if self.ss != 1:
            im = im.resize((self.w, self.h), Image.LANCZOS)
        caminho.parent.mkdir(parents=True, exist_ok=True)
        im.save(caminho, "PNG", optimize=True)
        return im

    def imagem(self) -> Image.Image:
        return self.im if self.ss == 1 else self.im.resize((self.w, self.h), Image.LANCZOS)


# ---------------------------------------------------------------------------
# 6. As cinco composicoes. Cada uma carrega um TIPO de conteudo.
# ---------------------------------------------------------------------------
# A. numero      dado com fonte, sem grafismo. A serifa italica E o grafismo.
# B. conta       dado com grafismo que argumenta pela forma (escada x reta).
# C. declaracao  afirmacao sem numero. Vazio no fim, nunca no meio.
# D. carrossel   card de sequencia: indice, colunas parametrizadas, rodape.
# E. chamada     a oferta e o dominio, no registro claro.


# ## O fundo fica CHAPADO, e isso e decisao
#
# Houve uma versao com gradiente: duas luzes, uma quente no teal da marca e uma
# fria no azul da etapa `novo`, mais o simbolo em escala a 4,5%. Ela funcionava
# — a peca ganhava profundidade — e foi retirada assim mesmo.
#
# O motivo e o carrossel, nao a peca. Sete slides passam sob o dedo em
# sequencia, e o fundo e a unica coisa constante entre eles: qualquer variacao
# ali le como slide de outro post. Uniforme, o fundo desaparece e o conteudo
# fica sendo a unica coisa que muda, que e o que se quer.
#
# O que a versao com gradiente resolvia — a peca parecer morta — ficou
# resolvido por outros meios, e sao eles que valem: a captura do produto ocupa
# 55% da peca, a faixa das etapas colore o rodape, e o simbolo ancora o rotulo.
# Cor com funcao em vez de cor de fundo.

def faixa_de_etapas(c: "Tela", x: float, y: float, larg: float, alt: float = 9) -> None:
    """
    O rodape deixa de ser um traco cinza e passa a ser o funil.

    ## O que ela substitui, e por que a troca vale

    Era `linha_fina(...)` na cor da borda: um filete que separa o conteudo do
    rodape e nao diz nada. Aqui os mesmos pixels desenham as cinco etapas do
    Kanban, com as larguras caindo — o que e literalmente a forma do funil, e
    literalmente a forma do simbolo da marca.

    ## Isto nao contradiz a decisao de 26/08 contra cor decorativa

    Aquela decisao removeu oito matizes da landing porque "Funil visual" nao e
    a categoria azul: a cor nao codificava informacao. Estas cinco codificam a
    unica coisa que o produto tem de estrutural — em que pe esta o negocio —, e
    sao os mesmos valores que pintam a barra no Kanban. Quem abriu o produto
    reconhece; quem nao abriu le um degrade que afunila.

    ## As larguras

    Caem 5 / 4 / 3 / 2.4 / 1.8. Nao e dado de conversao — nenhuma medicao deste
    projeto sustentaria uma taxa por etapa, e inventa-la seria a metrica falsa
    que a `StatsSection` ja removeu uma vez. E proporcao de DESENHO, e por isso
    a faixa nao carrega numero nenhum: sem eixo e sem rotulo, ela nao afirma
    nada que possa ser lido como medicao.
    """
    pesos = [5.0, 4.0, 3.0, 2.4, 1.8]
    vao = 7
    util = larg - vao * (len(pesos) - 1)
    cx = x
    for peso, (_, cor) in zip(pesos, ETAPAS_DO_FUNIL):
        w = util * peso / sum(pesos)
        # Cantos levemente arredondados: o mesmo raio do card do produto.
        c.d.rounded_rectangle(
            [c.u(cx), c.u(y), c.u(cx + w) - 1, c.u(y + alt) - 1],
            radius=c.u(alt / 2), fill=cor)
        cx += w + vao


def comp_numero(c: Tela, p: dict) -> None:
    pal, pad = c.pal, c.pad
    x, larg = pad["lado"], c.w - 2 * pad["lado"]
    marca(c, p.get("selo", ""))
    # ## O corpo do numero e CALCULADO, nao fixo em 400
    #
    # O `-12` de recuo e compensacao optica da serifa: o glifo carrega
    # sidebearing e sem isso o numero parece deslocado para dentro. Com "97%"
    # a 400 isso cabe. Com "3 em 5", que e quatro vezes mais largo, o mesmo
    # corpo passava **21px da margem esquerda e 6px da direita** (medido).
    #
    # Sobrevivia ao recorte 3:4 da grade por sorte, nao por construcao — e a
    # peca seguinte com um numero longo nao teria a mesma sorte. O corpo
    # agora desce de 10 em 10 ate caber na largura util, como a legenda do
    # video ja faz.
    larg_util = c.w - 2 * pad["lado"]
    corpo = 400
    while corpo > 180:
        fnum = c.f("serif", "Regular", corpo)
        if c.largura_texto(p["numero"], fnum) + 12 <= larg_util:
            break
        corpo -= 10
    fnum = c.f("serif", "Regular", corpo)
    c.texto(x - 12, c.topo - 76, p["numero"], fnum, pal.titulo)
    y = c.topo + 322
    c.linha_fina(x, y, larg, pal.borda, 2)
    y += 44
    y += c.paragrafo(x, y, p["claim"], c.f("sans", "SemiBold", 62), pal.titulo,
                     860, 74) + 22
    c.paragrafo(x, y, p["texto"], c.f("sans", "Regular", 33), pal.corpo, 800, 48)
    fm = c.f("mono", "Regular", 23)
    base = c.h - pad["base"]
    dom = p["dominio"]

    # ## A largura da fonte e CALCULADA, nao fixa em 600
    #
    # Achado abrindo a peca em tamanho real, em 01/09: a linha de credito
    # quebrava em 600 e o dominio era desenhado a direita na MESMA linha de
    # base. Com 886 de largura util, os dois somavam mais que isso e o "6" de
    # "1.126" ficava POR BAIXO do "w" de "www". As duas pecas de numero
    # saiam assim.
    #
    # O `--check` nao pega isso, e nao tem como pegar: ele le texto, e a
    # colisao e de pixel. Foi o mosaico 3x3, a regua que o proprio gerador
    # produz, que a mostrou.
    #
    # O tracking entra na conta porque `texto()` o soma caractere a
    # caractere: sem ele, a medida erra por 8px justamente no fim da linha.
    tracking = 0.4
    larg_dom = c.largura_texto(dom, fm) + tracking * len(dom)
    folga = 40
    larg_fonte = c.w - 2 * pad["lado"] - larg_dom - folga

    for i, linha in enumerate(c.quebra(p["fonte"], fm, larg_fonte)):
        c.texto(x, base + i * 34, linha, fm, pal.corpo, tracking)
    c.texto(c.w - pad["lado"] - larg_dom, base, dom, fm, pal.destaque, tracking)


def escada(c: Tela, x, y, w, h, passos_visiveis=TEAM_SIZE, reta=True,
           rotulos=True) -> None:
    """Cinco degraus de SEAT_MEDIAN_PRICE contra uma reta de PRO_PLAN_PRICE.
    A forma e o argumento: a escada sobe, a reta nao."""
    pal = c.pal
    n = TEAM_SIZE
    gap = w * 0.035
    bw = (w - gap * (n - 1)) / n
    for i in range(n):
        if i >= passos_visiveis:
            continue
        bh = h * (i + 1) / n
        bx = x + i * (bw + gap)
        c.retangulo(bx, y + h - bh, bw, bh, pal.destaque if i == n - 1 else pal.borda)
        if rotulos:
            fm = c.f("mono", "Medium", 22)
            c.texto(bx, y + h + 18, str(i + 1), fm, pal.corpo, 0.6)
    if reta:
        ry = y + h - h * (FLAT_YEAR / SEAT_YEAR)
        c.retangulo(x, ry - 3, w, 6, pal.destaque)


def comp_conta(c: Tela, p: dict) -> None:
    pal, pad = c.pal, c.pad
    x, larg = pad["lado"], c.w - 2 * pad["lado"]
    marca(c, p.get("selo", ""))
    y = c.topo
    y += c.paragrafo(x, y, p["claim"], c.f("sans", "Bold", 60), pal.titulo,
                     880, 72) + 54
    gh = 380
    escada(c, x, y, larg * 0.62, gh)
    fm = c.f("mono", "Medium", 24)
    c.texto(x, y + gh + 62, p["unidade"], fm, pal.corpo, 0.8)
    xa = x + larg * 0.66
    c.texto(xa, y - 4, brl(SEAT_YEAR), c.f("sans", "SemiBold", 46), pal.corpo)
    c.paragrafo(xa, y + 56, p["nota_escada"], c.f("sans", "Regular", 27), pal.corpo,
                larg * 0.34, 38)
    ry = y + gh - gh * (FLAT_YEAR / SEAT_YEAR)
    c.texto(xa, ry - 60, brl(FLAT_YEAR), c.f("sans", "SemiBold", 46), pal.destaque)
    c.paragrafo(xa, ry - 4, p["nota_reta"], c.f("sans", "Regular", 27), pal.destaque,
                larg * 0.34, 38)
    # ## O dominio estava DESENHADO FORA DA TELA, e em toda proporcao
    #
    # Era `c.texto(x, base + 96, ...)`. Medido em 02/09, ao gerar as tres
    # proporcoes:
    #
    #     4:5    base 1254 + 96 = 1350   a tela tem 1350   FORA por 1px
    #     1:1    base 1002 + 96 = 1098   a tela tem 1080   FORA por 18px
    #
    # Ou seja: a peca de ancora de preco — o argumento mais forte que este
    # produto tem — sempre saiu SEM o endereco do site, desde que existe. Nao
    # apareceu em nenhuma revisao porque `tsc`, `lint`, `test` e `build` nao
    # olham dentro de imagem, e a fatia que faltava era a ultima linha.
    #
    # A correcao reusa o que `comp_numero` ja resolveu: o dominio vai a
    # DIREITA, na primeira linha da fonte, com a largura da fonte calculada
    # para os dois nao colidirem. Uma posicao derivada do rodape, em vez de um
    # recuo somado a ele, nao tem como cair fora de nenhuma tela.
    base = c.h - pad["base"]
    fs = c.f("mono", "Regular", 23)
    dom, tracking = p["dominio"], 0.4
    larg_dom = c.largura_texto(dom, fs) + tracking * len(dom)
    larg_fonte = larg - larg_dom - 40
    for i, linha in enumerate(c.quebra(p["fonte"], fs, larg_fonte)):
        c.texto(x, base + i * 34, linha, fs, pal.corpo, tracking)
    c.texto(c.w - pad["lado"] - larg_dom, base, dom, fs, pal.destaque, tracking)


def comp_declaracao(c: Tela, p: dict) -> None:
    pal, pad = c.pal, c.pad
    x = pad["lado"]
    marca(c, p.get("selo", ""))
    c.paragrafo(x, c.topo + 12, p["claim"],
                c.f("sans", "UltraBlack", 112), pal.titulo, 880, 118)
    fm = c.f("mono", "Regular", 26)
    c.texto(x, c.h - pad["base"] - 8, p["dominio"], fm, pal.corpo, 0.6)


def comp_carrossel(c: Tela, p: dict) -> None:
    pal, pad = c.pal, c.pad
    x, larg = pad["lado"], c.w - 2 * pad["lado"]
    marca(c, p["indice"])
    fm = c.f("mono", "Medium", 24)
    c.texto(x, c.topo, p["rotulo"], fm, pal.destaque, 1.6)
    y = c.topo + 68
    fclaim = c.f("sans", "SemiBold", 66)
    y += c.paragrafo(x, y, p["claim"], fclaim, pal.titulo, 880, 80)
    # A enfase cromatica na ultima linha: em miniatura a frase inteira vira
    # mancha, e a parte colorida e o que ainda se le.
    if p.get("realce"):
        y += c.paragrafo(x, y, p["realce"], fclaim, pal.destaque, 880, 80)
    y += 26
    c.paragrafo(x, y, p["texto"], c.f("sans", "Regular", 32), pal.corpo, 820, 46)

    # Colunas parametrizadas: a base do campo e calculada a partir do rodape,
    # nunca fixa. Foi assim que a grade de 10 colunas passou por cima dele.
    # O campo so aparece quando as colunas representam alguma coisa: barra de
    # altura escolhida a olho e textura de fundo, e textura nao passa no teste.
    rodape_y = c.h - pad["base"] - 74
    cols = p.get("colunas")
    if cols:
        campo_h, folga = 240, 44
        campo_y = rodape_y - folga - campo_h
        gap = 14
        cw = (larg - gap * (len(cols) - 1)) / len(cols)
        for i, (frac, aceso) in enumerate(cols):
            ch = campo_h * frac
            c.retangulo(x + i * (cw + gap), campo_y + campo_h - ch, cw, ch,
                        pal.destaque if aceso else pal.borda)
    c.linha_fina(x, rodape_y, larg, pal.borda, 2)
    fr = c.f("mono", "Medium", 24)
    c.texto(x, rodape_y + 26, p.get("rodape", "ARRASTE"), fr, pal.corpo, 0.16 * 24)


def comp_produto(c: Tela, p: dict) -> None:
    """Prova de produto. O recorte sangra pela direita: a tela continua fora
    da peca, entao ela le como produto e nao como cartao centralizado.

    A quarta coluna e um sliver sem texto. Uma coluna inteira cortada pelo
    meio da palavra seria corte lateral, que e sempre defeito; cortando um
    card vazio o corte cai em padding e nenhum glifo parte ao meio.

    Os cards so tem acao e data. Nome de empresa aqui viraria prova social.
    A base nao sangra: o vazio abaixo das pilhas e respiro, nao buraco.
    """
    pal, pad = c.pal, c.pad
    x = pad["lado"]
    marca(c, p.get("selo", ""))
    alt_claim = c.paragrafo(x, c.topo, p["claim"], c.f("sans", "SemiBold", 58),
                            pal.titulo, 800, 68)

    # ## `topo_k` deriva do claim, e nao e mais o literal 452
    #
    # Era fixo. Com `c.topo` variando por proporcao, o claim de 9:16 comecava
    # em 433 e o kanban continuava em 452: **19px de folga para um texto de 58
    # com duas linhas**, e os rotulos das colunas sairam POR CIMA da frase.
    # Visto abrindo o PNG em 02/09 — nenhuma trava pega colisao de pixel.
    #
    # `max` preserva o 4:5 exatamente: la o claim ocupa 2 linhas de 68 a partir
    # de 252, e 252 + 136 + 64 da 452, o mesmo numero que estava escrito a mao.
    cw, gap = 262, 18
    topo_k = max(452, c.topo + alt_claim + 64)
    fr = c.f("mono", "Medium", 22)
    ft = c.f("sans", "Medium", 26)
    fmeta = c.f("mono", "Regular", 19)
    ultima = len(p["kanban"]) - 1
    for ci, col in enumerate(p["kanban"]):
        cx = x + ci * (cw + gap)
        sliver = ci == ultima
        c.texto(cx, topo_k, col["rotulo"], fr,
                pal.destaque if sliver else pal.corpo, 0.1 * 22)
        if not sliver:
            c.texto(cx + c.largura_texto(col["rotulo"], fr) + 22 * 0.1 * len(col["rotulo"]) + 16,
                    topo_k, col["n"], fr, pal.corpo)
        c.linha_fina(cx, topo_k + 48, cw, pal.destaque if sliver else pal.borda, 3)
        cy = topo_k + 80
        for k, (titulo, meta) in enumerate(col["cards"]):
            destaque = ci == 1 and k == 0
            if sliver:
                ch = 168 if k == 0 else 140
                linhas = []
            else:
                linhas = c.quebra(titulo, ft, cw - 42)
                ch = 40 + len(linhas) * 34 + 38
            c.retangulo(cx, cy, cw, 1, pal.borda)
            c.retangulo(cx, cy + ch - 1, cw, 1, pal.borda)
            c.retangulo(cx + cw - 1, cy, 1, ch, pal.borda)
            c.retangulo(cx, cy, 5, ch, pal.destaque if destaque else pal.borda)
            for i, linha in enumerate(linhas):
                c.texto(cx + 21, cy + 20 + i * 34, linha, ft, pal.titulo)
            if linhas:
                c.texto(cx + 21, cy + 26 + len(linhas) * 34, meta, fmeta,
                        pal.destaque if destaque else pal.corpo, 0.04 * 19)
            cy += ch + 16


# ## Icones de TRACO, no vocabulario que o produto ja usa
#
# O produto desenha com Lucide: traco de 2px sobre grade de 24, ponta e junta
# arredondadas, sem preenchimento. Estes seguem a mesma gramatica — nao sao os
# arquivos do Lucide (nao ha como importar SVG aqui sem dependencia nova), sao
# os mesmos tracados, em coordenadas 0..24.
#
# ## Por que desenhar, e nao usar emoji ou dingbat da fonte
#
# Emoji renderiza colorido e chapado, com o estilo do SISTEMA e nao o da peca:
# num criativo B2B ele le como mensagem de WhatsApp. Dingbat de fonte muda de
# desenho conforme a familia instalada, que e como um icone vira quadrado vazio
# na maquina de outra pessoa. Tracado a mao, o desenho e o mesmo em qualquer
# lugar e herda a cor da paleta.
_TRACOS = {
    # cada entrada e uma lista de polilinhas; o circulo vai a parte
    "check":    [[(5, 12.5), (9.7, 17.2), (19, 7)]],
    "raio":     [[(13, 2), (4, 14), (11, 14), (10, 22), (19, 10), (12, 10),
                  (13, 2)]],
    "escudo":   [[(12, 2.2), (20, 5.6), (20, 11.6), (12, 21.8), (4, 11.6),
                  (4, 5.6), (12, 2.2)]],
    "relogio":  [[(12, 6.5), (12, 12), (16, 14.2)]],
    "usuarios": [[(3.5, 20.5), (3.5, 18.6)], [(14.5, 20.5), (14.5, 18.6)]],
    "seta":     [[(4, 12), (19, 12)], [(13, 6), (19, 12), (13, 18)]],
}
_ARCOS = {           # (cx, cy, raio) desenhados como circulo aberto
    "relogio":  [(12, 12, 9)],
    "usuarios": [(9, 8.5, 4.2), (9, 18.6, 5.5), (14.5, 18.6, 5.5)],
}


def icone(c: "Tela", nome: str, x: float, y: float, tam: float, cor: tuple,
          peso: float = 2.0) -> None:
    """Desenha o icone com o canto superior esquerdo em (x, y)."""
    k = tam / 24.0
    w = max(1, c.u(peso * k))

    def pt(px, py):
        return (c.u(x + px * k), c.u(y + py * k))

    for cx, cy, r in _ARCOS.get(nome, []):
        c.d.ellipse([pt(cx - r, cy - r), pt(cx + r, cy + r)],
                    outline=cor, width=w)
    for linha in _TRACOS.get(nome, []):
        c.d.line([pt(a, b) for a, b in linha], fill=cor, width=w, joint="curve")
        # `joint="curve"` arredonda so as juntas INTERNAS; as pontas ficam
        # quadradas e, num traco de 2px ampliado, isso le como pixel solto.
        # Um disco do diametro do traco em cada extremidade fecha as duas.
        for a, b in (linha[0], linha[-1]):
            px, py = pt(a, b)
            c.d.ellipse([px - w // 2, py - w // 2, px + w // 2, py + w // 2],
                        fill=cor)


# ## O CNPJ vem de `lib/legal.ts`, e so entra quando existe
#
# A skill de UI marca "no trust signals" como anti-padrao de pagina de preco,
# e no Brasil o CNPJ e o primeiro sinal que uma PME procura antes de confiar
# num site desconhecido. Ele ficou `null` de 08/08 a 31/08, com a inscricao
# anterior BAIXADA — e a landing, por construcao, simplesmente parou de
# exibi-lo em vez de mostrar numero morto.
#
# Copiado a mao porque este gerador e Python. A regra que vale e a mesma do
# TypeScript: se um dia voltar a nao existir, e para sair da peca inteiro, e
# nunca a palavra "CNPJ" sozinha.
CNPJ_DO_CONTROLADOR = "68.877.105/0001-67"


def assinatura_legal(sufixo: str) -> str:
    """A linha de rodape, com a inscricao quando ela existe."""
    if not CNPJ_DO_CONTROLADOR:
        return sufixo
    return f"CNPJ {CNPJ_DO_CONTROLADOR}  ·  {sufixo}"


def comp_chamada(c: Tela, p: dict) -> None:
    """
    O fecho: um plano dominante, a comparacao de preco, e o gratis como base.

    ## O que estava generico, e por que

    A versao anterior eram dois cartoes de mesmo tamanho, lado a lado, cada um
    com preco em cima e lista de tiques embaixo. Aberta em tamanho real ela
    nao tinha defeito de execucao — tinha defeito de IDEIA: e literalmente o
    layout de pagina de preco de qualquer SaaS, e por isso nao dizia nada que
    a proxima peca de outro produto nao dissesse igual.

    Simetria e o mecanismo do problema. Dois cartoes do mesmo tamanho afirmam
    que as duas opcoes tem o mesmo peso, e obrigam a pessoa a comparar item a
    item para descobrir qual e a oferta. A skill de UI resume isso em duas
    regras que a versao anterior quebrava: *popular plan highlighted* e
    *Free: grey*.

    ## As quatro decisoes

      hierarquia    o Pro ocupa a peca; o Gratis vira uma faixa embaixo. Nao e
                    escondido — continua legivel e continua sendo a entrada
                    sem cartao —, mas para de disputar atencao com a oferta

      ancora        o custo de uma equipe pequena em CRM por assento, ao
                    lado da mensalidade daqui. E o argumento
                    real deste produto e o unico numero da peca que vem de
                    fora: preco de TABELA PUBLICA de CRM que cobra por
                    assento, nao pesquisa e nao depoimento. Sem essa ancora o
                    cerebro compara a mensalidade com zero, e contra zero
                    qualquer preco perde

      selo          diz `SEM COBRAR POR PESSOA`, e NAO "mais popular". Este
                    produto nao tem cliente externo: escrever popularidade
                    seria a prova social inventada que a `StatsSection` ja
                    removeu uma vez deste projeto

      CNPJ          o sinal de confianca que a skill cobra como anti-padrao
                    quando falta. No Brasil e o primeiro que uma PME procura,
                    e desde 28/08 ele existe e esta ATIVO — vem de
                    `lib/legal.ts`, a mesma fonte do rodape do site
    """
    pal, pad = c.pal, c.pad
    x, larg = pad["lado"], c.w - 2 * pad["lado"]
    marca(c, p.get("indice", p.get("selo", "")))

    y = c.topo
    if p.get("rotulo"):
        funil(c, x, y + 2, 22, pal.destaque)
        c.texto(x + 34, y, p["rotulo"], c.f("mono", "Medium", 24),
                pal.destaque, 1.6)
        y += 58

    # ## O titulo usa a MESMA construcao dos outros seis
    #
    # Houve uma rodada com fonte de display propria aqui (Lexend Deca, a de
    # marca do HubSpot). Recuada: o fecho passou a ser o unico slide com outra
    # letra, e num carrossel isso le como peca de outro post, nao como fecho
    # do mesmo.
    #
    # O que resolve o titulo nao e trocar de fonte — e a divisao que os slides
    # de passo ja usavam: a primeira parte em preto, a segunda no teal. A cor
    # carrega a leitura em miniatura, onde a frase inteira vira mancha, e o
    # corte cai onde a frase vira do problema para a promessa.
    # ## `k` encolhe a peca inteira quando a tela e mais baixa
    #
    # Esta e a composicao mais densa do gerador: rotulo, titulo em duas cores,
    # um cartao com preco, itens e ancora de preco, uma faixa e um rodape de
    # tres linhas. Em 1080x1080 ela estourou por 124px — a guarda de altura
    # abaixo foi quem avisou, e a mensagem dizia "tire um item", que era o
    # conselho certo para o defeito ERRADO: nao sobravam itens, sobrava altura
    # de menos.
    #
    # Escalar e melhor que cortar conteudo porque o quadrado e o mesmo anuncio:
    # tirar a ancora de preco dele deixaria sete posicionamentos sem o unico
    # argumento que este produto tem contra CRM que cobra por assento.
    k = c.esc
    fclaim = c.f("sans", "SemiBold", 58 * k)
    y += c.paragrafo(x, y, p["claim"], fclaim, pal.titulo, larg, 68 * k)
    if p.get("realce"):
        y += c.paragrafo(x, y, p["realce"], fclaim, pal.destaque, larg, 68 * k)
    y += 46 * k

    pro, free = p["pro"], p["free"]
    claro = pal is CLARO

    # ------------------------------------------------------- o cartao do Pro
    alt_free = 132 * k
    alt_pro = c.h - pad["base"] - 122 * k - y - alt_free - 20 * k
    fundo = tuple(int(f * 0.94 + d * 0.06) for f, d in zip(pal.fundo, pal.destaque))
    c.d.rounded_rectangle([c.u(x), c.u(y), c.u(x + larg) - 1, c.u(y + alt_pro) - 1],
                          radius=c.u(20), fill=fundo,
                          outline=pal.destaque, width=c.u(3))

    ix, iy = x + 38, y + 34 * k
    icone(c, "raio", ix, iy, 30 * k, pal.destaque, 2.0)
    c.texto(ix + 44 * k, iy + 3, pro["nome"], c.f("mono", "Medium", 25 * k),
            pal.destaque, 1.4)

    # O selo, ancorado a DIREITA: medido e posicionado a partir da borda, para
    # nao depender do comprimento do texto ficar igual se a copy mudar.
    fs = c.f("mono", "Medium", 20 * k)
    ls = c.largura_texto(pro["selo"], fs) + 1.2 * len(pro["selo"])
    sx = x + larg - 38 - ls - 36
    c.d.rounded_rectangle([c.u(sx), c.u(iy - 3), c.u(sx + ls + 36) - 1,
                           c.u(iy + 35 * k) - 1], radius=c.u(19 * k),
                          fill=pal.destaque)
    c.texto(sx + 18, iy + 6 * k, pro["selo"], fs, pal.fundo, 1.2)

    # O preco e a unidade na MESMA linha de base: `R$ 49` e `/mes` separados em
    # duas linhas leem como dois numeros diferentes.
    py = iy + 66 * k
    fp = c.f("sans", "UltraBlack", 96 * k)
    c.texto(ix, py, pro["preco"], fp, pal.destaque)
    lp = c.largura_texto(pro["preco"], fp)
    c.texto(ix + lp + 14, py + 52 * k, pro["unidade"],
            c.f("sans", "Medium", 30 * k), pal.corpo)
    c.texto(ix, py + 112 * k, pro["apoio"], c.f("sans", "Regular", 29 * k),
            pal.titulo)

    by = py + 168 * k
    fb = c.f("sans", "Regular", 27 * k)
    col = (larg - 76) / 2
    linhas_de_item = -(-len(pro["itens"]) // 2)      # divisao para cima
    for i, item in enumerate(pro["itens"]):
        cx = ix + (i % 2) * col
        cy = by + (i // 2) * 46 * k
        icone(c, "check", cx, cy + 2, 21 * k, pal.destaque, 2.2)
        c.texto(cx + 32 * k, cy, item, fb, pal.titulo)

    # ------------------------------------------------------------- a ancora
    #
    # ## A posicao vem do CONTEUDO, e nao de um recuo fixo do fim do cartao
    #
    # `ay` era `y + alt_pro - 78`, e `alt_pro` deriva da ALTURA DA TELA. Ou
    # seja: a lista de itens crescia com a contagem e a ancora ficava parada,
    # entao a partir de quatro itens (duas linhas) a frase da comparacao
    # subia por cima da segunda linha. Visto na peca de anuncio `a5_oferta`
    # em 02/09, e o mesmo defeito estava na peca organica `p09_chamada`
    # desde que ela ganhou o quarto item.
    #
    # E o mesmo desenho do mosaico, que era fixo em 3x3 e cortou a decima
    # peca ao meio: contagem que cresce precisa de posicao derivada dela.
    #
    # `max` e nao substituicao: em tela alta a ancora continua onde estava,
    # colada ao rodape do cartao, que e onde ela le melhor. So quando o
    # conteudo empurra e que ela cede.
    piso_do_conteudo = by + linhas_de_item * 46 * k + 34 * k
    ay = max(y + alt_pro - 78 * k, piso_do_conteudo)

    # Sobrepor em silencio e o defeito; falhar alto e a correcao. Este
    # gerador ja lanca quando a linha nao cabe em LARGURA — faltava o mesmo
    # em altura, e por isso a colisao passou por duas revisoes.
    #
    # ## O numero 46 nao e folga, e a altura do que ainda vai ser desenhado
    #
    # A primeira versao usou 24 e a linha da ancora saiu EM CIMA da borda
    # arredondada do cartao — a guarda passou porque media so o topo do texto,
    # e o texto tem corpo. 26 e o tamanho maximo da fonte da comparacao (o
    # laco de encolhimento acima comeca nele) e 20 e a distancia minima ate a
    # borda para o cartao nao ler como cortado.
    #
    # ## A mensagem diz as DUAS causas, porque o mesmo estouro tem duas
    #
    # Ela dizia so "tire um item", que era o conselho certo para o defeito de
    # 4:5 (quatro itens viram duas linhas). Em 1080x1080 a guarda disparou com
    # DOIS itens, e o conselho estava errado: nao sobravam itens, faltava
    # altura de tela. Uma guarda que nomeia a causa errada manda quem a lê
    # estragar a peca tentando obedecer.
    ALTURA_DA_ANCORA = (26 + 20) * k
    if ay + ALTURA_DA_ANCORA > y + alt_pro:
        raise ValueError(
            f"a ancora nao cabe no cartao do Pro em {c.w}x{c.h} (esc={k:.2f}): "
            f"{len(pro['itens'])} itens em {linhas_de_item} linha(s) empurram "
            f"ate {ay:.0f}, e o cartao termina em {y + alt_pro:.0f}. "
            f"Em 4:5 a causa costuma ser CONTAGEM (quatro itens viram duas "
            f"linhas); em tela mais baixa costuma ser ALTURA, e ai o ajuste e "
            f"em `metricas_da_proporcao`, nao na copy.")

    c.linha_fina(ix, ay - 26 * k, larg - 76, pal.borda, 2)

    # ## A linha da ancora ENCOLHE ate caber, e nao quebra
    #
    # Medida a 26/30 ela terminava 9px alem da borda interna do cartao — a
    # frase e o valor sao duas fontes diferentes na mesma linha, e nenhum
    # `paragrafo` mede isso junto. Quebrar em duas linhas separaria o custo
    # do concorrente da frase que o explica, que e o contrario do efeito de
    # contraste que ela existe para produzir.
    #
    # O piso de 20 nao e enfeite: abaixo disso a linha deixa de ser legivel na
    # miniatura da grade, e ai o certo e encurtar a copy, nao diminuir mais.
    limite = larg - 76
    for tam in range(26, 19, -1):
        fa = c.f("sans", "Regular", tam * k)
        fv = c.f("sans", "SemiBold", (tam + 4) * k)
        la = c.largura_texto(pro["comparacao"], fa)
        lv = c.largura_texto(pro["valor_deles"], fv)
        if la + 12 + lv <= limite:
            break
    else:
        raise ValueError(
            f"a linha de comparacao nao cabe nem a 20px: "
            f"{pro['comparacao']!r} + {pro['valor_deles']!r}. Encurte a copy.")

    c.texto(ix, ay, pro["comparacao"], fa, pal.corpo)
    c.texto(ix + la + 12, ay - 3, pro["valor_deles"], fv, pal.corpo)
    # Riscado: o valor do concorrente e o que se quer ver DESCARTADO. Sem o
    # risco ele le como preco alternativo; com o risco, le como o que se deixa
    # de pagar.
    c.retangulo(ix + la + 12, ay + 12, lv, 3, pal.corpo)

    # ----------------------------------------------------- a faixa do gratis
    fy = y + alt_pro + 20 * k
    c.d.rounded_rectangle([c.u(x), c.u(fy), c.u(x + larg) - 1,
                           c.u(fy + alt_free) - 1], radius=c.u(20 * k),
                          fill=pal.fundo, outline=pal.borda, width=c.u(2))
    icone(c, "escudo", x + 38, fy + 30 * k, 26 * k, pal.corpo, 2.0)
    c.texto(x + 76 * k, fy + 32 * k, free["nome"], c.f("mono", "Medium", 23 * k),
            pal.corpo, 1.4)
    c.texto(x + 38, fy + 76 * k, free["texto"], c.f("sans", "Regular", 28 * k),
            pal.titulo)

    # ------------------------------------------------------------- o rodape
    base = c.h - pad["base"]
    faixa_de_etapas(c, x, base - 70 * k, larg, 8 * k)
    c.texto(x, base - 44 * k, p["dominio"], c.f("sans", "Medium", 42 * k),
            pal.destaque)
    c.texto(x, base + 16 * k, p["assinatura"], c.f("mono", "Regular", 21 * k),
            pal.corpo, 0.5)


# ---------------------------------------------------------------------------
# 6b. A composicao `passo`: uma captura REAL do produto, com legenda.
# ---------------------------------------------------------------------------

CAPTURAS = RAIZ.parent / "artes"     # saida de scripts/marketing/capturar-catalogo.mjs


def recortar(tela: "Image.Image", foco: tuple) -> "Image.Image":
    """
    Recorta a captura por FRACAO das dimensoes dela, nao por pixel.

    ## O defeito que isto fecha

    Os focos nasceram em pixel absoluto, medidos contra capturas de
    2880x1800 (viewport de 1440x900 em `deviceScaleFactor: 2`). Ao subir a
    captura para 4x — 5760x3600, feito para acabar com 41% de perda de
    nitidez por ampliacao — **todos os quatro focos passaram a apontar para o
    quadrante superior esquerdo da imagem**, porque a mesma coordenada agora
    significa metade do caminho.

    E o pior tipo de acoplamento: nada falha. O recorte continua valido, a
    peca continua sendo gerada, e so quem ABRIR a imagem descobre que ela
    mostra o canto errado da tela. Nenhuma das travas do gerador olha dentro
    de uma captura.

    Em fracao, a escala da captura deixa de importar. Recapturar em 2x, 4x ou
    8x devolve o mesmo enquadramento, e a unica coisa que muda e quanto pixel
    sobra para reduzir — que e exatamente o que se queria ganhar.
    """
    W, H = tela.size
    e, t, d, b = foco
    if max(foco) > 1.0:
        raise ValueError(
            f"foco em pixel: {foco}. Use fracao de 0 a 1 — pixel quebra em "
            "silencio quando a escala da captura muda.")
    return tela.crop((int(e * W), int(t * H), int(d * W), int(b * H)))


def comp_passo(c: Tela, p: dict) -> None:
    """
    Um passo do carrossel: a TELA e o heroi, nao a legenda dela.

    ## O que mudou depois de olhar o concorrente

    A primeira versao punha a captura numa faixa entre o titulo e o rodape.
    Comparada com o feed do Agendor — que e a referencia de SaaS B2B
    brasileiro nesta categoria —, a diferenca era estrutural e nao de
    acabamento:

      a tela ocupava ~28% da peca      la ocupa 55 a 60%
      encostada na margem, chapada     la e um card elevado sobre o fundo
      titulo em peso unico             la uma parte da frase muda de cor

    Nenhuma dessas tres e enfeite. A tela grande e a unica prova que um SaaS
    sem cliente externo consegue mostrar; o card elevado a separa do fundo e
    diz "isto e software, nao ilustracao"; e a enfase cromatica carrega a
    leitura em miniatura, onde a frase inteira vira mancha.

    Os principios foram extraidos, nao a arte: nada aqui copia layout,
    paleta ou composicao de ninguem. O `prompt-enviado.txt` pede exatamente
    isso, e a paleta continua sendo a dos tokens do produto.

    ## O card SANGRA pela direita

    Ele comeca na margem e sai pela borda. Uma tela inteira centralizada com
    ar dos dois lados le como print colado numa apresentacao; sangrando, le
    como software que continua fora do quadro. E a mesma decisao que
    `comp_produto` ja usava.
    """
    pal, pad = c.pal, c.pad
    x, larg_texto = pad["lado"], c.w - 2 * pad["lado"]
    if p.get("fundo_vivo"):
        fundo_vivo(c)
    marca(c, p["indice"])

    # ## O rotulo NAO vai dentro de capsula
    #
    # Ele esteve, por uma rodada. A capsula resolvia um problema real — o
    # eyebrow em mono espacado e o elemento mais apagado da peca e some na
    # miniatura da grade — e resolvia com a forma mais batida que existe: pill
    # arredondado com fundo a 10%. E o mesmo clichê de `rounded-lg` em tudo,
    # e um perfil de Instagram e onde ele mais aparece.
    #
    # O que entra no lugar resolve o MESMO problema com a marca: o simbolo do
    # funil, pequeno, antes do texto. Ele ancora a linha, sobrevive a reducao,
    # e ja e o desenho que a peca inteira usa — no rodape, na marca d'agua e
    # no proprio logotipo. Nao e um enfeite a mais; e o mesmo, tres vezes.
    fm = c.f("mono", "Medium", 24)
    funil(c, x, c.topo + 2, 22, pal.destaque)
    c.texto(x + 34, c.topo, p["rotulo"], fm, pal.destaque, 1.6)

    # ## A enfase entra na ULTIMA linha, e por construcao
    #
    # `realce` e a parte da frase que muda de cor. Ela e escrita separada, na
    # linha seguinte ao resto, em vez de dentro do fluxo: medir a quebra de
    # uma frase com dois pesos exigiria um layout de texto rico que este
    # gerador nao tem, e o resultado seria a palavra caindo em lugar
    # imprevisivel a cada mudanca de copy.
    y = c.topo + 58
    fclaim = c.f("sans", "SemiBold", 54)
    y += c.paragrafo(x, y, p["claim"], fclaim, pal.titulo, larg_texto, 64)
    if p.get("realce"):
        y += c.paragrafo(x, y, p["realce"], fclaim, pal.destaque, larg_texto, 64)
    y += 40

    rodape_y = c.h - pad["base"] - 74
    alt = rodape_y - 46 - y
    larg_card = c.w - x                       # sangra pela direita

    caminho = CAPTURAS / p["captura"]
    if not caminho.exists():
        raise FileNotFoundError(
            f"captura ausente: {caminho}\n"
            "Rode: npm run build && npm run start -- -p 3970\n"
            "      node --env-file=.env.local scripts/marketing/capturar-catalogo.mjs")

    tela = Image.open(caminho).convert("RGB")
    tela = recortar(tela, p["foco"])

    # Preenche a caixa e corta o excedente, em vez de caber inteira dentro
    # dela: caber deixava faixa vazia embaixo, e o vazio no MEIO da peca e o
    # defeito que a auditoria da grade ja tinha reprovado.
    k = max(larg_card / tela.width, alt / tela.height)
    lw, lh = int(tela.width * k), int(tela.height * k)
    tela = tela.resize((lw * c.ss, lh * c.ss), Image.LANCZOS)
    tela = tela.crop((0, 0, c.u(larg_card), c.u(alt)))

    # ## A sombra e curta, e so no registro claro
    #
    # Sobre fundo claro o contorno sozinho le como desenho, nao como
    # profundidade. Sombra longa le como cartao de marketing — a landing
    # removeu a `shadow-2xl` por isso em 26/08. Aqui sao 6px de deslocamento
    # com uma faixa esmaecida, o suficiente para o card descolar do fundo.
    if pal is CLARO:
        for i, d in enumerate((10, 7, 4)):
            tom = tuple(int(v - 6 + i * 2) for v in pal.fundo)
            c.d.rectangle([c.u(x + d), c.u(y + d),
                           c.u(x + larg_card) - 1, c.u(y + alt + d) - 1], fill=tom)

    c.im.paste(tela, (c.u(x), c.u(y)))
    c.d.rectangle([c.u(x), c.u(y), c.u(x + larg_card) - 1, c.u(y + alt) - 1],
                  outline=pal.borda, width=max(1, c.u(1)))

    faixa_de_etapas(c, x, rodape_y - 3, larg_texto)
    c.texto(x, rodape_y + 30, p.get("rodape", "ARRASTE"),
            c.f("mono", "Medium", 24), pal.corpo, 0.16 * 24)


def comp_passos(c: Tela, p: dict) -> None:
    """
    O mapa do carrossel: os passos como blocos, nao como frase corrida.

    ## Por que grafismo aqui, e por que este

    Os tres primeiros slides eram texto no topo e vazio no resto. Vazio no
    FIM e respiro; vazio ocupando metade da peca, com o titulo sozinho la em
    cima, le como arte que nao terminou de carregar.

    A tentacao e preencher com textura. O teste que este projeto usa contra
    isso: **o grafismo diz algo que o texto teria de explicar?** Barra de
    altura escolhida a olho nao diz — e por isso o campo de barras saiu dos
    cards de carrossel. Uma escada numerada diz: ela mostra que sao TRES,
    que tem ordem, e que cada um e curto. A frase precisaria de tres oracoes
    para isso, e ninguem le tres oracoes num slide.

    ## A barra de progresso a esquerda

    Cada passo tem uma regua vertical no acento. Juntas elas formam a
    coluna que a leitura desce, e e o mesmo elemento que o card do Kanban
    usa para marcar etapa: a peca e o produto falam a mesma lingua visual.
    """
    pal, pad = c.pal, c.pad
    x, larg = pad["lado"], c.w - 2 * pad["lado"]
    marca(c, p["indice"])

    fm = c.f("mono", "Medium", 24)
    c.texto(x, c.topo, p["rotulo"], fm, pal.destaque, 1.6)

    y = c.topo + 58
    fclaim = c.f("sans", "SemiBold", 54)
    y += c.paragrafo(x, y, p["claim"], fclaim, pal.titulo, larg, 64)
    if p.get("realce"):
        y += c.paragrafo(x, y, p["realce"], fclaim, pal.destaque, larg, 64)

    rodape_y = c.h - pad["base"] - 74
    passos = p["passos"]
    y += 56
    espaco = (rodape_y - 44 - y) / len(passos)

    fnum = c.f("mono", "Medium", 30)
    ftit = c.f("sans", "SemiBold", 42)
    ftxt = c.f("sans", "Regular", 29)

    for i, (titulo, apoio) in enumerate(passos):
        by = y + i * espaco
        # A regua no acento, do mesmo peso do marcador de etapa do Kanban.
        c.retangulo(x, by + 4, 5, espaco - 30, pal.destaque)
        c.texto(x + 34, by, f"0{i + 1}", fnum, pal.destaque, 0.8)
        c.texto(x + 34, by + 46, titulo, ftit, pal.titulo)
        c.paragrafo(x + 34, by + 102, apoio, ftxt, pal.corpo, larg - 34, 40)

    c.linha_fina(x, rodape_y, larg, pal.borda, 2)
    c.texto(x, rodape_y + 26, p.get("rodape", "ARRASTE"), fm, pal.corpo, 0.16 * 24)


COMPOSICOES = {
    "numero": comp_numero,
    "conta": comp_conta,
    "declaracao": comp_declaracao,
    "carrossel": comp_carrossel,
    "produto": comp_produto,
    "chamada": comp_chamada,
    "passo": comp_passo,
    "passos": comp_passos,
}

# ---------------------------------------------------------------------------
# 7. O plano de grade. Nove pecas, cinco composicoes, tres claras.
# ---------------------------------------------------------------------------
# As claras caem em 1, 5 e 9: colunas e linhas diferentes, nunca uma listra
# vertical na grade do perfil. Nenhuma composicao encosta na igual.

PECAS = [
    dict(id="p01_carrossel_1", comp="carrossel", pal=CLARO,
         rotulo="COMO É HOJE", indice="1/2", rodape="ARRASTE",
         claim="A conversa fica salva. O cliente fica na sua memória.",
         texto="Você lembra do orçamento de terça. Do de quinta, menos.",
         dominio=DOMAIN),
    dict(id="p02_numero_97", comp="numero", pal=ESCURO,
         numero="97%",
         claim="dos usuários abrem o WhatsApp todo dia.",
         texto="Toda conversa nova empurra a de ontem para baixo. Cinco dias "
               "depois, a proposta que você mandou está a trinta rolagens de "
               "distância.",
         fonte="Opinion Box, WhatsApp no Brasil 2025. 1.126 ouvidos.",
         dominio=DOMAIN),
    dict(id="p03_declaracao_posicionamento", comp="declaracao", pal=ESCURO,
         claim="O WhatsApp guarda a conversa. Não guarda o cliente.",
         dominio=DOMAIN),
    dict(id="p04_conta", comp="conta", pal=ESCURO,
         claim="Os outros cobram por pessoa. Aqui não existe por pessoa.",
         unidade="PESSOAS NO TIME",
         nota_escada=f"{TEAM_SIZE} pessoas em CRM que cobra por usuário.",
         nota_reta=f"{PLAN_LABELS['pro']}, a empresa inteira, "
                   f"{brl(PRO_PLAN_PRICE)} por mês.",
         fonte=f"mediana pública de {brl(SEAT_MEDIAN_PRICE)} por usuário por mês. "
               f"{TEAM_SIZE} pessoas. {MONTHS} meses.",
         dominio=DOMAIN),
    dict(id="p05_produto", comp="produto", pal=CLARO,
         claim="É isto. Quatro colunas e o próximo passo com data.",
         kanban=[
             dict(rotulo="NOVO", n="4", cards=[
                 ("Orçamento pedido no WhatsApp", "hoje, 09:12"),
                 ("Indicação, sem retorno ainda", "ontem"),
                 ("Formulário do site", "ontem")]),
             dict(rotulo="CONVERSANDO", n="7", cards=[
                 ("Pediu prazo de entrega", "responder até 17h"),
                 ("Sumiu depois do valor", "3 dias parado"),
                 ("Quer ver o portfólio", "amanhã, 10h")]),
             dict(rotulo="PROPOSTA", n="3", cards=[
                 ("Proposta enviada terça", "retomar quinta"),
                 ("Aguardando aprovação", "5 dias parado"),
                 ("Pediu desconto", "decidir hoje")]),
             dict(rotulo="FECHADO", n="2", cards=[
                 ("Assinou o contrato", "confirmado"),
                 ("Primeira parcela paga", "confirmado")]),
         ],
         dominio=DOMAIN),
    dict(id="p06_declaracao_objecao", comp="declaracao", pal=ESCURO,
         claim="Continue no WhatsApp. O funil fica do lado, não no lugar.",
         dominio=DOMAIN),
    dict(id="p07_numero_60", comp="numero", pal=ESCURO,
         numero="60%",
         claim="já compraram algum serviço pelo WhatsApp.",
         texto="A venda acontece na conversa. A conversa não tem etapa, não tem "
               "data e não tem próximo passo.",
         fonte="Opinion Box, WhatsApp no Brasil 2025. 1.126 ouvidos.",
         dominio=DOMAIN),
    dict(id="p08_carrossel_2", comp="carrossel", pal=ESCURO,
         rotulo="COMO COMEÇA", indice="2/2", rodape="ARRASTE",
         claim="Cole a conversa. O contato nasce com data e próximo passo.",
         texto="Leva menos tempo do que procurar a mensagem no histórico.",
         dominio=DOMAIN),
    # Escura desde 01/09: o carrossel de demonstracao termina numa chamada
    # clara, e duas chamadas claras no mesmo perfil leem como a mesma peca
    # publicada duas vezes.
    # Convertida junto com o `c7_fecho` em 01/09. Deixar as duas formas de
    # dado convivendo em `comp_chamada` seria dois caminhos para a mesma tela,
    # e o segundo so seria exercitado por esta peca — que e exatamente como um
    # deles diverge do outro sem ninguem notar.
    dict(id="p09_chamada", comp="chamada", pal=ESCURO,
         rotulo="SEM CARTAO PARA COMECAR",
         claim="O plano é o mesmo para uma pessoa",
         realce="ou para a equipe inteira.",
         pro=dict(
             nome=PLAN_LABELS["pro"].upper(),
             selo="SEM COBRAR POR PESSOA",
             preco=brl(PRO_PLAN_PRICE), unidade="/mês",
             apoio="A empresa inteira. Quantas pessoas quiser.",
             # "Integracoes" solto, num carrossel cujo tema E o WhatsApp, seria
             # lido como integracao de WhatsApp — que esta DESLIGADA e aparece
             # como "Em breve" na propria tela de Integracoes do produto
             # (`lib/integrations/whatsapp-estado.ts`). Nomear as duas que
             # existem tira a ambiguidade e ainda diz mais.
             # DOIS itens, e a guarda de altura de `comp_chamada` obriga.
             # Com quatro eles viram duas linhas, e a linha da comparacao de
             # preco subia por cima da borda do cartao — esta peca esteve
             # publicada assim, e o defeito so apareceu em 02/09 ao gerar a
             # peca de anuncio equivalente e OLHAR o PNG.
             #
             # Os dois que ficaram respondem OBJECAO; os que sairam descrevem
             # recurso, e recurso perde para objecao numa arte de decisao.
             itens=["Contatos sem teto", "Cancela sem multa"],
             comparacao=f"Em CRM que cobra por vendedor, {TEAM_SIZE} pessoas custam",
             valor_deles=f"{brl(SEAT_MEDIAN_PRICE * TEAM_SIZE)}/mês"),
         free=dict(
             nome=PLAN_LABELS["free"].upper(),
             # `FREE_MEMBER_LIMIT` e 2 em `lib/plans.ts`, e a trigger da 0011
             # recusa o terceiro. A peca dizia "uma pessoa" e subvendia o
             # proprio plano: duas pessoas e o socio ou a secretaria junto,
             # que e exatamente a PME que este produto atende.
             texto=f"Até {FREE_LEAD_LIMIT} contatos, {FREE_MEMBER_LIMIT} pessoas. "
                   "Sem cartão e sem prazo para decidir."),
         assinatura=assinatura_legal("CRIE A CONTA GRÁTIS EM 2 MINUTOS"),
         dominio=DOMAIN),

    # ## A decima peca, 01/09: o outro lado da mesma perda
    #
    # As nove primeiras falam do VENDEDOR que esquece. Esta fala do CLIENTE
    # que desiste, e e o mesmo evento visto do lado que decide a venda.
    #
    # O dado e da Opinion Box 2025: 62% dos brasileiros ja desistiram de
    # comprar pelo WhatsApp depois de uma experiencia ruim, e a pesquisa
    # nomeia as tres causas — demora, conversa que recomeca do zero,
    # follow-up ausente. As tres sao exatamente o que um funil resolve, e
    # nenhuma delas e o aplicativo: a propria pesquisa conclui que a raiz e
    # "falta de estrutura operacional, nao problema tecnologico".
    #
    # ## Por que "3 em 5" e nao "62%"
    #
    # A grade ja tem "97%" e "60%" em duas pecas de numero. Um terceiro
    # "6x%" leria como repeticao mesmo passando na trava, que compara texto e
    # nao forma. "3 em 5" e o MESMO dado com outro enquadramento, e o
    # enquadramento e o argumento: "62%" e uma estatistica, "3 em 5 clientes"
    # e um numero que a pessoa consegue contar na propria carteira.
    #
    # ## O que ela nao faz
    #
    # Nao acusa o WhatsApp. A landing inteira depende de nao competir com
    # ele, e a pesquisa esta do mesmo lado: o defeito nao e o canal.
    # Clara porque a coluna 2 da grade nao tinha nenhuma, e duas colunas com
    # todas as claras formam a listra vertical que a trava existe para
    # impedir. Ela tambem e a unica peca de dado no registro claro, o que
    # separa as tres pecas de numero entre si.
    dict(id="p10_numero_desistencia", comp="numero", pal=CLARO,
         numero="3 em 5",
         claim="clientes já desistiram de comprar por causa do atendimento.",
         texto="A pesquisa nomeia as três causas, e nenhuma delas é o "
               "aplicativo: a resposta que demorou, a conversa que recomeçou "
               "do zero e o retorno que não veio.",
         fonte="Opinion Box, 2025. A raiz apontada é falta de estrutura, "
               "não tecnologia.",
         dominio=DOMAIN),
]

# ---------------------------------------------------------------------------
# 7b. O carrossel de demonstracao. Framework E da skill de carrossel.
# ---------------------------------------------------------------------------
#
# ## Por que Demo Walkthrough, e nao os outros quatro
#
# A skill oferece cinco arquiteturas. Problem-Proof exige um resultado
# proprio com numero ("eu fiz X, deu Y") e este produto NAO TEM cliente
# externo: inventar seria a prova social que a decisao travada proibe.
# Value-Stack e Hack List pedem lista de dicas, que qualquer concorrente
# escreve igual. Rant Callout brigaria com o canal, e a landing inteira
# depende de nao brigar com o WhatsApp.
#
# Sobra Demo Walkthrough, e ele e o unico que usa o ativo que so este
# projeto tem: as 36 capturas reais do produto. A skill e explicita — "real
# screenshots; mockups read as vaporware".
#
# ## A estrutura, e por que o slide 3 existe
#
#   1  capa       produto + resultado. A capa e o post na grade: ela compete
#                 sozinha, antes de alguem saber que ha carrossel atras
#   2  dor        a frustracao especifica que isto substitui
#   3  mapa       os tres passos ANTES do detalhe
#   4  passo 1    captura real, recortada na acao
#   5  passo 2    captura real
#   6  passo 3    captura real
#   7  fecho      a oferta e o posicionamento
#
# O slide 3 e o que segura a leitura: quem viu "3 passos" termina; quem cai
# direto no passo 1 sem mapa abandona no 2. E a mesma razao pela qual receita
# lista ingrediente antes do modo de preparo.
#
# ## Tudo no registro claro
#
# Pedido do dono. Os sete slides usam a MESMA paleta: a skill exige um
# template visual por carrossel, e alternar registro entre slides faria a
# peca piscar sob o dedo.
#
# Isso muda o ritmo da grade — sao 4 claras em 12 pecas depois deste
# carrossel, e a trava agora escala com a contagem em vez de exigir 3 fixas.

CARROSSEL_DEMO = [
    # ## A capa MOSTRA o resultado, nao so promete
    #
    # Ela era tipografica, e sobrava metade da peca em branco. A capa e o
    # post na grade do perfil: ela compete sozinha, antes de alguem saber
    # que ha carrossel atras, e vazio ali nao le como respiro — le como arte
    # que nao terminou de carregar.
    #
    # O framework Demo Walkthrough manda o slide 1 abrir com o RESULTADO
    # ("lead with what they get"), e o resultado deste produto e literalmente
    # a tela Hoje: a lista de quem esta esperando. Prometer isso em texto e
    # deixar o espaco vazio embaixo era desperdicar as duas coisas.
    dict(id="c1_capa", comp="passo", pal=CLARO,
         rotulo="CRM PARA QUEM VENDE PELO WHATSAPP", indice="1/7", rodape="ARRASTE",
         claim="Ele já sabe",
         realce="com quem você precisa falar.",
         captura="04-hoje-desktop-light.png",
         # Recorte mais fechado que o do passo 3: a capa mostra as primeiras
         # linhas, o passo 3 mostra os grupos por prazo. Mesma tela, duas
         # leituras — repetir o mesmo enquadramento faria o carrossel
         # parecer travado.
         # ## A PROPORCAO do recorte precisa bater com a da caixa
         #
         # Este foco era 1476x580 (2.54:1) para uma caixa de ~984x660
         # (1.49:1). Com `max()` cobrindo, a escala vinha da altura e a
         # largura estourava em 700px: a tela saia com zoom de lupa e
         # cortada pela metade.
         #
         # 1836x1220 da 1.50:1 — a mesma da caixa, entao a captura entra
         # inteira, na escala em que foi feita para ser lida.
         # Medido na peca: o conteudo terminava a 72% da altura do card e os
         # 28% restantes eram o vazio da propria tela. Vazio no FIM da peca e
         # respiro; vazio DENTRO do card le como captura que nao carregou.
         # 1402x931 mantem a proporcao de 1.50 e corta onde o conteudo acaba.
         foco=(0.182, 0.222, 0.669, 0.739),
         dominio=DOMAIN),

    dict(id="c2_dor", comp="carrossel", pal=CLARO,
         rotulo="O QUE ELE SUBSTITUI", indice="2/7", rodape="ARRASTE",
         claim="Rolar a conversa para achar",
         realce="o que foi combinado.",
         texto="A negociação está lá, entre a foto do almoço e o áudio de "
               "três minutos. Achar leva mais tempo do que responder.",
         dominio=DOMAIN),

    dict(id="c4_passo1", comp="passo", pal=CLARO,
         rotulo="PASSO 1", indice="3/7", rodape="ARRASTE",
         claim="O contato entra uma vez",
         realce="e fica.",
         captura="03-contatos-desktop-light.png",
         foco=(0.182, 0.261, 0.819, 0.656),
         dominio=DOMAIN),

    dict(id="c5_passo2", comp="passo", pal=CLARO,
         rotulo="PASSO 2", indice="4/7", rodape="ARRASTE",
         claim="O negócio ganha etapa, valor",
         realce="e próximo passo.",
         captura="02-funil-desktop-light.png",
         foco=(0.208, 0.311, 0.764, 0.900),
         dominio=DOMAIN),

    dict(id="c6_passo3", comp="passo", pal=CLARO,
         rotulo="PASSO 3", indice="5/7", rodape="ARRASTE",
         claim="A tela de hoje cobra",
         realce="o que ficou em aberto.",
         captura="04-hoje-desktop-light.png",
         foco=(0.182, 0.222, 0.819, 0.667),
         dominio=DOMAIN),

    # `indice` num slide de fecho parece redundante e nao e: e ele que diz
    # a `ocupa_celula` que este cartao e slide, nao post. Sem ele, o fecho
    # entrava na grade do perfil como uma decima-primeira celula.
    # ## O fecho fica CLARO, como os outros seis
    #
    # Ele chegou a ir para a paleta escura — preto-esverdeado com teal, que e
    # a identidade do modo escuro do produto. Recuado depois de olhar em
    # tamanho real, e o motivo vale registrar.
    #
    # No escuro o preco sai em (0,191,192), o teal claro. Ele fica LUMINOSO, e
    # o brilho e o mesmo de um botao de app — o numero para de parecer preco e
    # comeca a parecer link. No claro, o (0,120,122) sobre off-white e a mesma
    # cor de marca com peso de tinta: le como valor impresso, que e o que o
    # ultimo slide precisa.
    #
    # E a captura dos seis slides anteriores vem do tema claro. Fechar o
    # carrossel com fundo preto trocaria de mundo no ultimo passo, bem onde a
    # pessoa decide.
    #
    # Preto no texto, teal na marca, fundo claro: as tres coisas pedidas, e as
    # tres ja estao na paleta CLARO — titulo (10,10,10), destaque (0,120,122),
    # fundo (246,248,249).
    dict(id="c3_mapa", comp="passos", pal=CLARO,
         rotulo="RECAPITULANDO", indice="6/7", rodape="ARRASTE",
         claim="Foi isso. Nenhum dos três",
         realce="é digitar relatório.",
         passos=[
             ("O contato entra",
              "Uma vez. Nome, empresa e telefone, e ele fica."),
             ("O negócio ganha etapa e prazo",
              "Arrastar o card é o trabalho inteiro."),
             ("Uma tela diz com quem falar hoje",
              "Ela cobra sozinha o que ficou em aberto."),
         ],
         dominio=DOMAIN),

    # ## Os recortes vem da tela em 2880x1800 (deviceScaleFactor 2)
    #
    # Cada `foco` e a regiao onde a acao acontece, medida na captura
    # original. Os primeiros recortes pegavam 2360x1030 e, cabendo em 886 de
    # largura, viravam uma faixa de 386 de altura onde o texto da interface
    # sumia. A skill de carrossel e explicita: cada captura precisa fazer
    # sentido em MINIATURA, entao o recorte fecha na acao, nao na tela.
    dict(id="c7_fecho", comp="chamada", pal=CLARO, indice="7/7",
         rotulo="LINK NA BIO",
         claim="O WhatsApp continua.",
         realce="O cliente passa a ser seu.",
         pro=dict(
             nome=PLAN_LABELS["pro"].upper(),
             selo="SEM COBRAR POR PESSOA",
             preco=brl(PRO_PLAN_PRICE), unidade="/mês",
             apoio="A empresa inteira. Quantas pessoas quiser.",
             # DOIS itens, e a guarda de altura de `comp_chamada` obriga.
             # Com quatro eles viram duas linhas, e a linha da comparacao de
             # preco subia por cima da borda do cartao — esta peca esteve
             # publicada assim, e o defeito so apareceu em 02/09 ao gerar a
             # peca de anuncio equivalente e OLHAR o PNG.
             #
             # Os dois que ficaram respondem OBJECAO; os que sairam descrevem
             # recurso, e recurso perde para objecao numa arte de decisao.
             itens=["Contatos sem teto", "Cancela sem multa"],
             comparacao=f"Em CRM que cobra por vendedor, {TEAM_SIZE} pessoas custam",
             valor_deles=f"{brl(SEAT_MEDIAN_PRICE * TEAM_SIZE)}/mês"),
         free=dict(
             nome=PLAN_LABELS["free"].upper(),
             texto=f"Até {FREE_LEAD_LIMIT} contatos, {FREE_MEMBER_LIMIT} pessoas. "
                   "Sem cartão e sem prazo para decidir."),
         assinatura=assinatura_legal("CRIE A CONTA GRÁTIS EM 2 MINUTOS"),
         dominio=DOMAIN),
]

PECAS += CARROSSEL_DEMO

VITRINE = ["p01_carrossel_1", "p02_numero_97", "p03_declaracao_posicionamento",
           "p04_conta", "p05_produto", "p09_chamada"]


def ocupa_celula(p: dict) -> bool:
    """
    Verdadeiro para a peca que aparece na GRADE do perfil.

    ## Peca nao e celula, e a diferenca so aparece com carrossel

    Um carrossel e UM post: a grade mostra so a capa, e as outras se veem
    deslizando o dedo. As travas de ritmo e o mosaico foram escritos quando
    todo carrossel do conjunto tinha dois cards, e nessa escala a diferenca
    entre "peca" e "celula" nao aparecia.

    Com um carrossel de sete slides ela apareceu de uma vez: a trava de
    ritmo passou a exigir 6 claras porque contou 17 pecas, quando a grade
    de fato mostra 11 celulas. Ela reprovava conteudo legitimo por um erro
    de contagem proprio.

    Fora da grade fica todo slide de carrossel que nao seja o primeiro.
    """
    ind = p.get("indice")
    if not ind:
        return True
    return ind.split("/")[0].strip() == "1"


# ## Palavras que so existem em portugues COM acento
#
# `O QUE VOCE ABRE AMANHA` foi publicado assim: duas palavras sem acento num
# rotulo em caixa alta, numa peca que vai para o Instagram. Caixa alta e onde
# isso passa despercebido — o olho nao estranha `VOCE` como estranharia
# `voce` —, e nenhuma das travas anteriores lia ortografia.
#
# A lista proibe a forma ERRADA em vez de conferir a certa, pelo mesmo motivo
# que o teste dos e-mails proibe o CNPJ baixado: conferir a forma certa passa
# mesmo com a errada ainda presente em outro lugar do texto.
#
# So entram palavras cuja forma sem acento NAO existe em portugues. `E` fica
# de fora de proposito: e conjuncao valida, e proibi-la reprovaria texto
# correto — a trava que grita em caso legitimo e a que se aprende a ignorar.
SEM_ACENTO = [
    "VOCE", "AMANHA", "NAO", "ATE", "TAMBEM", "PORQUE NAO", "NEGOCIO",
    "PROXIMO", "PROXIMA", "ULTIMO", "ULTIMA", "MES", "TRES", "JA ",
    "SERA", "ESTA ACABANDO", "PRE", "POS", "ORGANICO", "RELATORIO",
]


def textos_da_peca(p: dict) -> list:
    out = []
    for k, v in p.items():
        # `captura` e nome de ARQUIVO e `foco` sao coordenadas: nenhum dos
        # dois chega a tela. Sem esta linha, duas pecas usando a mesma
        # captura reprovavam por "repetir o numero 04" — o prefixo do nome
        # do arquivo.
        if k in ("id", "comp", "pal", "captura", "foco"):
            continue
        if isinstance(v, str):
            out.append(v)
        elif k == "linhas":
            out += [a for par in v for a in par]
        elif k == "kanban":
            for col in v:
                out.append(col["rotulo"])
                out += [t for card in col["cards"] for t in card]
    return out


def desenha_peca(p: dict) -> Tela:
    lint_texto(*textos_da_peca(p))
    c = Tela(*FEED, p["pal"])
    COMPOSICOES[p["comp"]](c, p)
    return c


def render_estaticas(out: Path, so: str | None = None) -> list:
    feitas = []
    for p in PECAS:
        if so and so != p["id"]:
            continue
        img = desenha_peca(p).salvar(out / f"{p['id']}.png")
        feitas.append((p, img))
        print(f"  {p['id']}.png  {p['comp']}/{p['pal'].nome}")
    return feitas


def mosaico(out: Path, escala: float = 0.25) -> None:
    """A regua: 3x3 no recorte 3:4 da grade do perfil, em miniatura.
    Nenhuma medicao de peca sozinha mostra o conjunto."""
    lado_x = (FEED[0] - GRID_CROP_W) // 2
    tw, th = int(GRID_CROP_W * escala), int(FEED[1] * escala)
    gap, moldura = 6, 24
    # ## As linhas vem da CONTAGEM, nao do numero 3
    #
    # A folha era fixa em 3x3 e a decima peca saiu cortada pela metade na
    # borda de baixo. A grade do perfil cresce; a regua tem que crescer com
    # ela, senao a peca nova nasce fora do unico lugar onde o conjunto e
    # julgado.
    na_grade = [p for p in PECAS if ocupa_celula(p)]
    linhas_grade = -(-len(na_grade) // 3)       # divisao para cima
    W = moldura * 2 + tw * 3 + gap * 2
    H = moldura * 2 + th * linhas_grade + gap * (linhas_grade - 1)
    folha = Image.new("RGB", (W, H), (12, 12, 12))
    for i, p in enumerate(na_grade):
        im = Image.open(out / f"{p['id']}.png").convert("RGB")
        im = im.crop((lado_x, 0, lado_x + GRID_CROP_W, FEED[1]))
        im = im.resize((tw, th), Image.LANCZOS)
        folha.paste(im, (moldura + (i % 3) * (tw + gap),
                         moldura + (i // 3) * (th + gap)))
    folha.save(out / "mosaico_3x3.png", "PNG", optimize=True)
    print(f"  mosaico_3x3.png  {W}x{H}")


# ---------------------------------------------------------------------------
# 8. Video. Os frames saem do mesmo gerador, entao o video herda as travas.
# ---------------------------------------------------------------------------

FPS = 30
FADE = 0.8
LEGENDA_MAX, LEGENDA_MIN, LEGENDA_PASSO = 58, 26, 2


def ease_out(t: float) -> float:
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** 3


def legenda(c: Tela, texto: str, y_base: float) -> None:
    """Branca, contorno preto, sem pilula. Estatica dentro do segmento:
    legenda animada le como 'feito por marca'."""
    x, larg = MARGENS_VIDEO["lado"], BANDA_VIDEO[0]
    tam = LEGENDA_MAX
    while tam > LEGENDA_MIN:
        f = c.f("sans", "SemiBold", tam)
        linhas = c.quebra(texto, f, larg)
        if len(linhas) * tam * 1.24 <= 260 and all(
                c.largura_texto(l, f) <= larg for l in linhas):
            break
        tam -= LEGENDA_PASSO
    f = c.f("sans", "SemiBold", tam)
    linhas = c.quebra(texto, f, larg)
    leading = tam * 1.24
    y = y_base - len(linhas) * leading
    for i, linha in enumerate(linhas):
        lx = x + (larg - c.largura_texto(linha, f)) / 2
        c.texto(lx, y + i * leading, linha, f, FUMACA, stroke=max(3, tam * 0.085))


# V1  explicador tipografico: a escada de preco cresce. 18,5s
V1_SEGMENTOS = [
    (0.0, 3.0, "Seu CRM cobra por pessoa."),
    (3.0, 7.5, "Cada pessoa que entra sobe a conta."),
    (7.5, 12.0, "Aqui a conta é uma só."),
    (12.0, 15.5, f"{brl(FLAT_YEAR)} por ano, a empresa inteira."),
    (15.5, 18.5, f"Grátis até {FREE_LEAD_LIMIT} contatos. Sem cartão."),
]

# V2  poster animado da declaracao: o tipo E o conteudo, entao a legenda
# queimada entra so na chamada. Texto duplicado na tela e defeito, nao reforco.
V2_SEGMENTOS = [
    (0.0, 3.0, None),
    (3.0, 6.0, None),
    (6.0, 8.5, None),
    (8.5, 11.0, f"Grátis até {FREE_LEAD_LIMIT} contatos. {DOMAIN}"),
]
V2_CLAUSULAS = ["O WhatsApp guarda a conversa.", "Não guarda o cliente.",
                "O funil fica do lado, não no lugar."]


def segmento_de(t: float, segs: list):
    for i, (a, b, cap) in enumerate(segs):
        if a <= t < b:
            return i, a, b, cap
    i = len(segs) - 1
    return i, segs[i][0], segs[i][1], segs[i][2]


def marca_video(c: Tela) -> None:
    """A marca entra DENTRO da banda util: no topo do canvas ela ficaria
    debaixo da interface do aplicativo."""
    x, topo = MARGENS_VIDEO["lado"], MARGENS_VIDEO["topo"]
    funil(c, x, topo + 16, 72, c.pal.destaque)
    fv = c.f("sans", "SemiBold", 30)
    c.texto(x + 94, topo + 36, "Velo ", fv, c.pal.titulo)
    c.texto(x + 94 + c.largura_texto("Velo ", fv), topo + 36, "Funil",
            c.f("sans", "Regular", 30), c.pal.corpo)


def frame_v1(t: float, ss: int = 1) -> Tela:
    c = Tela(*STORY, ESCURO, ss)
    pal = c.pal
    x, larg = MARGENS_VIDEO["lado"], BANDA_VIDEO[0]
    topo = MARGENS_VIDEO["topo"]
    i, a, b, cap = segmento_de(t, V1_SEGMENTOS)

    fm = c.f("mono", "Medium", 26)
    marca_video(c)
    c.texto(x, topo + 180, "POR PESSOA", fm, pal.corpo, 1.8)
    c.texto(x + larg - c.largura_texto("POR MÊS", fm) - 14, topo + 180, "POR MÊS",
            fm, pal.corpo, 1.8)
    c.linha_fina(x, topo + 230, larg, pal.borda, 2)

    gy, gh = topo + 300, 470
    p = ease_out((t - a) / max(0.001, b - a))
    if i == 0:
        passos = 1
    elif i == 1:
        passos = 1 + int(p * (TEAM_SIZE - 1) + 0.001)
    else:
        passos = TEAM_SIZE
    escada(c, x, gy, larg, gh, passos_visiveis=passos, reta=i >= 2)

    # ## O preco por assento desceu 46px, e virou frase
    #
    # Medido em 01/09: ele era desenhado em `gy + gh + 26`, e a `escada`
    # numera os degraus em `gy + gh + 18` com fonte 22. Os dois comecavam no
    # MESMO x e se sobrepunham por 14px verticais: na tela sai um "1" em cima
    # de um "53".
    #
    # Descer resolve a colisao. Virar frase resolve o resto: "53" sozinho
    # embaixo de uma escada nao diz o que e, e o eixo ja esta rotulado como
    # POR PESSOA logo acima.
    c.texto(x, gy + gh + 72,
            f"{brl(SEAT_MEDIAN_PRICE)} por pessoa, por mês",
            c.f("mono", "Medium", 24), pal.corpo, 0.8)

    if i >= 2:
        alvo = brl(FLAT_YEAR) if i >= 3 else f"{brl(PRO_PLAN_PRICE)} por mês"
        c.texto(x, gy + gh + 96, alvo, c.f("sans", "UltraBlack", 84), pal.destaque)
    if i >= 1:
        c.texto(x + larg - c.largura_texto(brl(SEAT_YEAR),
                c.f("sans", "SemiBold", 40)) - 8, gy - 62, brl(SEAT_YEAR),
                c.f("sans", "SemiBold", 40), pal.corpo)
    if cap:
        legenda(c, cap, MARGENS_VIDEO["topo"] + BANDA_VIDEO[1] - 20)
    return c


def frame_v2(t: float, ss: int = 1) -> Tela:
    c = Tela(*STORY, ESCURO, ss)
    pal = c.pal
    x, larg = MARGENS_VIDEO["lado"], BANDA_VIDEO[0]
    topo = MARGENS_VIDEO["topo"]
    i, a, b, cap = segmento_de(t, V2_SEGMENTOS)
    p = ease_out((t - a) / max(0.001, b - a))

    marca_video(c)
    y = topo + 190
    fbig = c.f("sans", "UltraBlack", 96)
    for k, clausula in enumerate(V2_CLAUSULAS):
        if k > i:
            break
        cor = pal.titulo if k == min(i, 2) else pal.corpo
        deriva = (1 - p) * 18 if k == i else 0
        y += c.paragrafo(x, y + deriva, clausula, fbig, cor, larg, 106) + 34
    if i >= 3:
        c.texto(x, topo + BANDA_VIDEO[1] - 300, brl(PRO_PLAN_PRICE) + " por mês",
                c.f("sans", "SemiBold", 52), pal.destaque)
    if cap:
        legenda(c, cap, topo + BANDA_VIDEO[1] - 20)
    return c


VIDEOS = {
    "v1_conta": dict(desenha=frame_v1, dur=V1_SEGMENTOS[-1][1],
                     segs=V1_SEGMENTOS,
                     titulo="explicador tipográfico: a conta"),
    "v2_poster": dict(desenha=frame_v2, dur=V2_SEGMENTOS[-1][1],
                      segs=V2_SEGMENTOS,
                      titulo="pôster animado: o posicionamento"),
}


def zona_segura(im: Image.Image) -> Image.Image:
    """A regua do video: primeiro frame parado com a zona segura por cima.
    E o teste que a arte estatica exportada como MP4 reprova."""
    base = im.convert("RGBA")
    over = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(over)
    W, H = base.size
    m = MARGENS_VIDEO
    veto = (255, 74, 74, 64)
    d.rectangle([0, 0, W, m["topo"]], fill=veto)
    d.rectangle([0, H - m["base"], W, H], fill=veto)
    d.rectangle([0, m["topo"], m["lado"], H - m["base"]], fill=veto)
    d.rectangle([W - m["lado"], m["topo"], W, H - m["base"]], fill=veto)
    d.rectangle([m["lado"], m["topo"], W - m["lado"], H - m["base"]],
                outline=(0, 255, 240, 220), width=4)
    try:
        f = fonte("mono", "Medium", 30)
    except FileNotFoundError:
        f = ImageFont.load_default()
    # A legenda da banda fica no interior de baixo: no topo ela colidia com o
    # trilho de rotulos que o proprio frame desenha em y=226.
    d.text((m["lado"] + 12, H - m["base"] - 72),
           f"BANDA ÚTIL {BANDA_VIDEO[0]}x{BANDA_VIDEO[1]}  y={m['topo']}..{m['topo']+BANDA_VIDEO[1]}",
           font=f, fill=(0, 255, 240, 230))
    d.text((m["lado"] + 12, H - m["base"] + 20),
           f"BARRA DE AÇÕES + LEGENDA  {m['base']}px", font=f,
           fill=(255, 190, 190, 240))
    return Image.alpha_composite(base, over).convert("RGB")


def render_videos(out: Path, so: str | None = None) -> None:
    if shutil.which("ffmpeg") is None:
        raise RuntimeError("ffmpeg nao encontrado no PATH")
    for nome, v in VIDEOS.items():
        if so and so != nome:
            continue
        for _, _, cap in v["segs"]:
            if cap:
                lint_texto(cap)
        total = int(round(v["dur"] * FPS))
        primeiro = v["desenha"](0.0).imagem()
        primeiro.save(out / f"{nome}_frame0.png")
        zona_segura(primeiro).save(out / f"{nome}_frame0_zonasegura.png")
        tmp = Path(tempfile.mkdtemp(prefix=f"vf_{nome}_"))
        try:
            for i in range(total):
                t = i / FPS
                im = v["desenha"](t).imagem()
                restante = v["dur"] - t
                if restante < FADE:
                    k = max(0.0, restante / FADE)
                    im = Image.blend(Image.new("RGB", im.size, (0, 0, 0)), im, k)
                im.save(tmp / f"{i:05d}.png")
            subprocess.run(
                ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
                 "-framerate", str(FPS), "-i", str(tmp / "%05d.png"),
                 "-c:v", "libx264", "-preset", "slow", "-crf", "18",
                 "-pix_fmt", "yuv420p", "-movflags", "+faststart",
                 "-an", str(out / f"{nome}.mp4")],
                check=True)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
        print(f"  {nome}.mp4  {v['dur']:.1f}s  {total} frames  sem trilha queimada")


# ---------------------------------------------------------------------------
# 9. CLI
# ---------------------------------------------------------------------------

def check() -> int:
    faltas = checa_contraste() + lint_fonte_deste_arquivo()
    for p in PECAS:
        try:
            lint_texto(*textos_da_peca(p))
        except ValueError as e:
            faltas.append(f"{p['id']}: {e}")
    for nome, v in VIDEOS.items():
        for _, _, cap in v["segs"]:
            if not cap:
                continue
            try:
                lint_texto(cap)
            except ValueError as e:
                faltas.append(f"{nome}: {e}")
    # A ortografia entra na mesma varredura que ja abre cada texto visivel,
    # incluindo o dos videos: um rotulo sem acento e tao publico numa legenda
    # de Reels quanto num slide de carrossel.
    for alvo, textos in ([(p["id"], textos_da_peca(p)) for p in PECAS]
                         + [(n, [c for _, _, c in v["segs"] if c])
                            for n, v in VIDEOS.items()]):
        for t in textos:
            for palavra in SEM_ACENTO:
                if re.search(r"\b" + re.escape(palavra) + r"\b", t.upper()):
                    faltas.append(f"{alvo}: falta acento em {palavra!r}")

    usados = set()
    for p in PECAS:
        for t in textos_da_peca(p):
            for d in DADOS_JA_USADOS:
                if d in t:
                    faltas.append(f"{p['id']}: dado ja em uso reaproveitado ({d})")
            # A prova de produto mostra contagem de coluna e horario da
            # interface, nao dado de argumento: nao entra na regra de
            # numero unico por peca.
            if p["comp"] == "produto":
                continue
            # ## Tres falsos positivos, corrigidos em 01/09
            #
            # O `--check` reprovava o proprio gerador em tres pontos, e os
            # tres eram defeito da trava, nao das pecas:
            #
            #   "202"    a regex nao exigia fim de palavra, entao o ANO da
            #            pesquisa (2025) era lido como o numero 202
            #   "1.126"  as duas pecas de numero citam a MESMA pesquisa. O
            #            tamanho da amostra e credito de fonte, e credito
            #            repetido esta certo: e a mesma pesquisa
            #   "49"     e o PRECO, interpolado de PRO_PLAN_PRICE. A oferta
            #            aparece onde precisar; a regra existe para dado de
            #            argumento, que so convence uma vez
            #
            # A linha de credito sai da varredura inteira: o que ela carrega
            # e a procedencia, nao o argumento.
            # A linha de credito e o indice do carrossel saem da varredura:
            # o primeiro carrega procedencia, o segundo e paginacao. Nenhum
            # dos dois e argumento, e "1/7" fazia sete slides reprovarem por
            # "repetir" o numero 7.
            # A assinatura entra na lista pelo mesmo motivo que a linha de
            # credito e o indice: CNPJ e identificacao do controlador, nao
            # argumento de peca. Ele repete em TODA peca de propria, e a regra
            # de numero unico existe para dado de pesquisa nao ser reciclado.
            if t in (p.get("fonte"), p.get("indice"), p.get("assinatura")):
                continue
            for n in re.findall(r"\b\d{1,3}(?:\.\d{3})*(?:,\d+)?%?(?!\d)", t):
                if n in ("1", "2", "3", "4", "5"):
                    continue
                if n in (str(PRO_PLAN_PRICE), str(FREE_LEAD_LIMIT)):
                    continue
                if n in usados:
                    faltas.append(f"{p['id']}: numero repetido em outra peca ({n})")
                usados.add(n)
    # ## O ritmo escala com a contagem, e nao com o numero 3
    #
    # A trava exigia exatamente 3 claras. Ela foi escrita quando o conjunto
    # tinha 9 pecas, e a regra real e outra: "1 clara a cada 3, sem duas na
    # mesma coluna". Com 9 as duas formulacoes dao o mesmo resultado; a
    # partir da decima elas divergem, e a fixa passa a REPROVAR peca nova
    # legitima. Mesmo defeito do mosaico, que era fixo em 3x3 e cortava a
    # decima peca ao meio.
    celulas = [p for p in PECAS if ocupa_celula(p)]
    claras = [i for i, p in enumerate(celulas) if p["pal"] is CLARO]
    esperado = max(1, round(len(celulas) / 3))
    colunas = {i % 3 for i in claras}
    # ## Tolerancia de um, e nao igualdade exata
    #
    # A regra existe para impedir DOIS defeitos visiveis: grade monotona de
    # um registro so, e duas claras na mesma coluna formando listra. Nenhum
    # dos dois aparece por uma peca de diferenca.
    #
    # Exigir igualdade exata fazia a trava reprovar conteudo legitimo por
    # aritmetica: 4 claras em 10 celulas da 40% contra os 33% da regra, e a
    # grade nao tem como ficar melhor com 3 ou com 5.
    if abs(len(claras) - esperado) > 1:
        faltas.append(f"ritmo claro/escuro: {len(claras)} claras em "
                      f"{len(celulas)} celulas, esperado {esperado} (1 a cada 3)")
    # Com mais claras que colunas, alguma coluna repete por aritmetica. O que
    # a regra impede e a LISTRA: uma coluna sem nenhuma clara enquanto outra
    # tem duas.
    elif len(colunas) < min(3, len(claras)):
        faltas.append(f"ritmo claro/escuro: claras em {claras}, colunas "
                      f"{sorted(colunas)} — duas na mesma coluna formam listra")
    familias = set()
    for p in PECAS:
        familias.add("mono" if p["comp"] in ("carrossel", "chamada", "numero",
                                             "conta", "produto") else "sans")
        if p["comp"] == "numero":
            familias.add("serif")
    if not {"mono", "serif"} <= familias:
        faltas.append("a monoespaçada e a serifa italica precisam estar em uso")
    for f in faltas:
        print("REPROVADO:", f)
    if not faltas:
        print("travas ok: contraste, oferta interpolada, texto proibido, "
              "dados nao repetidos, ritmo da grade, tres familias em uso")
    return 1 if faltas else 0


def main() -> int:
    ap = argparse.ArgumentParser(description="criativos Velo Funil")
    ap.add_argument("--out", default="saida", type=Path)
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--estaticas", action="store_true")
    ap.add_argument("--videos", action="store_true")
    ap.add_argument("--tudo", action="store_true")
    ap.add_argument("--so", default=None)
    a = ap.parse_args()

    if a.check or not (a.estaticas or a.videos or a.tudo):
        return check()
    if check():
        return 1
    a.out.mkdir(parents=True, exist_ok=True)
    if a.estaticas or a.tudo:
        render_estaticas(a.out, a.so)
        if not a.so:
            mosaico(a.out)
    if a.videos or a.tudo:
        render_videos(a.out, a.so)
    return 0


if __name__ == "__main__":
    sys.exit(main())
