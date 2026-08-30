"""
Os 5 selos de destaque do perfil do Instagram.

    python scripts/marketing/gerar-selos.py

## O que estes selos substituem

Os anteriores vieram do Canva com **um ícone de banco em cada**: lâmpada para
"Dicas", engrenagem para "Bastidores", ponto de interrogação para "FAQ",
etiqueta de preço para "Planos". Só o de "Demo" era o funil da marca.

Lâmpada-igual-a-ideia e engrenagem-igual-a-bastidores são o clichê mais
gasto do gênero: qualquer empresa do mundo pode assinar aquele conjunto, e é
justamente isso que faz um perfil parecer template. Fora que quatro ilustrações
de origens diferentes não formam série nenhuma.

## O que entra no lugar, e por que não é outro ícone

**O símbolo da própria marca, nos cinco.** Trocar um ícone genérico por outro
ícone genérico não resolveria nada — o pedido do dono foi explícito nisso. O
funil não é ícone de banco: é o logotipo, o mesmo desenho de
`components/branding/logo.tsx`, e ele já era o selo do primeiro destaque.

Repetir a marca cinco vezes não apaga a distinção entre os destaques porque
**não é o círculo que distingue**: o Instagram mostra o rótulo logo abaixo
("Demo", "Planos", "Dicas", "Bastidores", "FAQ"), e essa é a função dele. O
círculo responde outra pergunta — *de quem é este perfil* —, e cinco respostas
diferentes para ela é o que produz um perfil sem cara.

**A série se distingue pelo tom, não pela forma.** Cada selo pega um degrau da
mesma paleta teal, do mais claro ao mais escuro, na ordem em que os destaques
aparecem. Vistos em fila, leem como um conjunto ordenado; vistos sozinhos,
qualquer um identifica a marca.

## O tamanho, e o que ele custa

1080×1920, o mesmo dos anteriores. O Instagram recorta o destaque num círculo
que sai do CENTRO da imagem, então o funil é desenhado centrado e ocupa 34% da
largura — grande o bastante para ler a 64px na fila do perfil, com folga para o
recorte circular não cortar as pontas.
"""

import importlib.util
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

_spec = importlib.util.spec_from_file_location(
    "gerar_stories", Path(__file__).resolve().parent / "gerar-stories.py"
)
g = importlib.util.module_from_spec(_spec)
sys.modules["gerar_stories"] = g
_spec.loader.exec_module(g)

LADO = 1080
ALTURA = 1920
ESCALA = 2
W, H = LADO * ESCALA, ALTURA * ESCALA

SAIDA = g.RAIZ / "marketing" / "instagram"

# Os cinco degraus da paleta, do mais claro ao mais escuro. São variações do
# `--primary` do produto (#00BFC0), não cores novas: um selo fora da paleta
# leria como peça de outra marca, que é o problema que estes selos existem
# para resolver.
#
# **A série é curta de propósito, e o piso foi medido.** A primeira tentativa
# descia até rgb(0,101,104), que dá **2,48:1** contra o fundo — e o halo, mais
# claro que o fundo, derruba ainda mais. O quinto selo sumia na fila do perfil,
# e selo que some não identifica nada. O degrau mais escuro agora fica em
# 4,4:1. Contraste vence gradiente bonito: a diferença entre os cinco existe
# para ler como conjunto ordenado, não para desafiar o olho.
TONS = [
    ("01-como-funciona", (168, 245, 246)),
    ("02-planos", (94, 232, 233)),
    ("03-dicas-de-venda", (0, 191, 192)),
    ("04-bastidores", (0, 168, 170)),
    ("05-perguntas", (0, 146, 148)),
]

# O fundo é o mesmo teal escuro dos Stories. Preto neutro não identifica
# ninguém, e a cor de marca no fundo marca a peça antes de qualquer leitura.
FUNDO = g.FUNDO_MARCA


def funil(draw, cx, cy, largura, cor):
    """
    As três camadas do funil, o mesmo desenho de `components/branding/logo.tsx`.

    Coordenadas do `viewBox` 24 do símbolo, escaladas — copiar os números à mão
    numa proporção diferente faria o logo do selo divergir do logo do produto,
    e ninguém notaria até alguém pôr os dois lado a lado.
    """
    u = largura / 24.0
    x0 = cx - largura / 2
    # 12 e o centro horizontal do viewBox; 11.95 e o centro optico vertical do
    # desenho (o bico puxa a massa para baixo).
    y0 = cy - 11.95 * u

    def P(x, y):
        return (x0 + x * u, y0 + y * u)

    draw.polygon([P(2.6, 4.4), P(21.4, 4.4), P(18.9, 8.76), P(5.1, 8.76)], fill=cor)
    draw.polygon([P(6.9, 10.6), P(17.1, 10.6), P(14.98, 14.9), P(9.02, 14.9)], fill=cor)
    draw.polygon([P(10.9, 16.6), P(13.1, 16.6), P(12.0, 19.5)], fill=cor)


def selo(nome, cor):
    img = Image.new("RGB", (W, H), FUNDO)

    # Um halo atrás do símbolo, na cor dele. Sobre fundo escuro a sombra não
    # aparece (mesma razão pela qual o tema claro do produto ganhou sombra no
    # cartão e o escuro teve a regra anulada); o que dá profundidade aqui é luz.
    halo = Image.new("RGB", (W, H), FUNDO)
    hd = ImageDraw.Draw(halo)
    hd.ellipse([W * 0.16, H * 0.34, W * 0.84, H * 0.66],
               fill=tuple(int(c * 0.42) for c in cor))
    halo = halo.filter(ImageFilter.GaussianBlur(140 * ESCALA))
    img = Image.blend(img, halo, 0.68)

    d = ImageDraw.Draw(img)
    # Descido 2,2% da largura: o centro GEOMÉTRICO do desenho lê como acima do
    # centro, porque a massa está no trapézio de cima e o bico quase não pesa.
    # É a mesma correção de centro óptico que `centrar()` faz nos Stories, aqui
    # no sentido contrário.
    #
    # 54% da largura. A primeira tentativa usou 34% e o funil virava um risco
    # no círculo de 64px da fila do perfil — que é o tamanho em que este
    # arquivo de fato é visto, não os 1080px em que ele é desenhado. 54% ainda
    # deixa folga para o recorte circular não cortar as pontas do trapézio de
    # cima, que é a parte mais larga do desenho.
    funil(d, W / 2, H / 2 + W * 0.022, W * 0.54, cor)

    final = img.resize((LADO, ALTURA), Image.LANCZOS)
    arquivo = SAIDA / f"2026-08-15-selo-{nome}.png"
    final.save(arquivo)
    print(f"  {arquivo.name}  ({final.width}x{final.height})  rgb{cor}")


def main():
    print("SELOS DE DESTAQUE — 1080x1920")
    for nome, cor in TONS:
        selo(nome, cor)
    print(f"\n5 selos em {SAIDA.relative_to(g.RAIZ)}")
    print("O nome do arquivo mantém a data da primeira versão: os destaques já")
    print("estão publicados no perfil, e trocar o nome quebraria a referência")
    print("do README, que é onde a ordem de publicação está registrada.")


if __name__ == "__main__":
    main()
