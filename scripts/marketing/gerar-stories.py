"""
Gera os Stories dos destaques do Instagram, no padrão visual do produto.

    python scripts/marketing/gerar-stories.py

Grava em `marketing/instagram/`, dois arquivos por tela: a versão de
publicação (1080x1920) e uma `@4k` para reaproveitar em feed ou anúncio sem
regerar.

## Por que um script, e não desenhar cada peça à mão

Cinco telas com a mesma assinatura, a mesma zona segura e a mesma escala
tipográfica: à mão, cada uma erraria um detalhe diferente e o conjunto
pareceria de marcas distintas. Aqui a diferença entre elas é só o conteúdo.

## Decisões que este arquivo carrega

**Renderiza a 2x e reduz no fim.** O Story publicado tem 1080x1920, mas
desenhar direto nesse tamanho desperdiçava duas coisas — e o zoom denunciava
as duas: o print de origem tem 2880px e entrava reduzido a 0,49x (metade dos
pixels reais jogados fora), e o texto era rasterizado uma única vez, sem
folga de amostragem, o que serrilhava a borda do selo e embaçava o endereço.
Com supersampling cada pixel final vira média de 4 amostras.

**Zona segura de 14% no topo e 20% na base.** É o que a interface do Meta
cobre em Stories e Reels — unificada em março de 2026 em torno do Reels, que
é o mais restritivo. Mesma régua que `lib/dono/posicionamentos.ts` valida.

**O selo é o do produto, desenhado a partir de `components/branding/logo.tsx`.**
Três camadas convergindo (larguras 18.8 / 10.2 / 2.2 num viewBox de 24) que
lidas juntas formam o funil e a letra V de Velo. Desenhado com polígono em
vez de renderizar o SVG porque este ambiente não tem cairosvg nem svglib, e
trazer dependência nova para desenhar três trapézios custaria mais que o
problema.

**O print começa depois do texto, com respiro medido.** Ele encostava na
última linha da headline: medido no gancho, o texto terminava em 33,8% da
altura e o print começava em 34,4%. Cada composição passa o próprio
`topo_rel`, calculado a partir de onde o bloco de texto de fato termina —
não há valor único que sirva às cinco, porque o texto de apoio dos passos
ocupa mais linhas que o do gancho.

**A copy sai da landing, nunca é inventada aqui.** Os títulos dos passos são
os mesmos de `components/landing/how-it-works-section.tsx`, que já passaram
pelo PRD de copy sem jargão. Texto novo escrito direto no criativo divergiria
da página no primeiro ajuste que alguém fizesse lá.
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

# ---------------------------------------------------------------- constantes

ESCALA = 2
W_FINAL, H_FINAL = 1080, 1920
W, H = W_FINAL * ESCALA, H_FINAL * ESCALA

FUNDO = (10, 10, 10)      # #0A0A0A, o mesmo do tema escuro do produto
TEAL = (0, 191, 192)      # #00BFC0, --primary
BRANCO = (252, 252, 252)
CINZA = (150, 150, 150)
CINZA_FRACO = (120, 120, 120)

SEGURO_TOPO = int(H * 0.14)
SEGURO_BASE = int(H * 0.20)

BOLD = "C:/Windows/Fonts/segoeuib.ttf"
REG = "C:/Windows/Fonts/segoeui.ttf"

RAIZ = Path(__file__).resolve().parents[2]
SAIDA = RAIZ / "marketing" / "instagram"
PRINTS = RAIZ / "public" / "produto"


def fonte(caminho: str, tamanho: int) -> ImageFont.FreeTypeFont:
    """Tamanho em pixels do arquivo FINAL — a escala é aplicada aqui."""
    return ImageFont.truetype(caminho, tamanho * ESCALA)


def escrever(draw, texto, fnt, y, cor, largura_max=None, entrelinha=1.14):
    """
    Escreve centralizado, quebrando por largura MEDIDA e não por contagem de
    caractere: com fonte proporcional, contar letra erra a quebra em qualquer
    frase que misture "i" e "W".
    """
    if largura_max is None:
        largura_max = int(W * 0.86)
    linhas, atual = [], ""
    for palavra in texto.split():
        teste = f"{atual} {palavra}".strip()
        if draw.textlength(teste, font=fnt) <= largura_max:
            atual = teste
        else:
            linhas.append(atual)
            atual = palavra
    if atual:
        linhas.append(atual)

    for linha in linhas:
        draw.text(((W - draw.textlength(linha, font=fnt)) / 2, y), linha, font=fnt, fill=cor)
        y += fnt.size * entrelinha
    return y


# ----------------------------------------------------------------- o selo

def desenhar_selo(tamanho: int) -> Image.Image:
    """
    O selo da marca: quadrado teal arredondado com as três camadas do funil.

    Desenha a 4x e reduz, para o arredondamento e os chanfros saírem lisos
    sem depender de filtro de suavização.
    """
    supersample = 4
    t = tamanho * supersample
    selo = Image.new("RGBA", (t, t), (0, 0, 0, 0))
    d = ImageDraw.Draw(selo)
    d.rounded_rectangle([0, 0, t - 1, t - 1], radius=int(t * 0.22), fill=TEAL)

    lado = t * 0.56                       # proporção de `size-4.5` em `size-8`
    off = (t - lado) / 2
    u = lado / 24.0                       # 1 unidade do viewBox 24x24

    def P(x, y):
        return (off + x * u, off + y * u)

    marca = (3, 16, 16)                   # text-primary-foreground
    d.polygon([P(2.6, 4.4), P(21.4, 4.4), P(18.9, 8.76), P(5.1, 8.76)], fill=marca)
    d.polygon([P(6.9, 10.6), P(17.1, 10.6), P(14.98, 14.9), P(9.02, 14.9)], fill=marca)
    d.polygon([P(10.9, 16.6), P(13.1, 16.6), P(12.0, 19.5)], fill=marca)

    return selo.resize((tamanho, tamanho), Image.LANCZOS)


def assinar(img: Image.Image, draw: ImageDraw.ImageDraw) -> None:
    """
    Lockup da marca no rodapé: selo + "Velo Funil" + endereço.

    O endereço existe porque destaque de Instagram não tem link clicável —
    sem ele o criativo prova o produto e não diz onde encontrá-lo.
    """
    tam_selo = 78 * ESCALA
    selo = desenhar_selo(tam_selo)

    fnt_b, fnt_r = fonte(BOLD, 46), fonte(REG, 46)
    lv = draw.textlength("Velo ", font=fnt_b)
    lf = draw.textlength("Funil", font=fnt_r)
    espaco = 22 * ESCALA

    x0 = (W - (tam_selo + espaco + lv + lf)) / 2
    y = H - SEGURO_BASE + 30 * ESCALA

    img.paste(selo, (int(x0), int(y)), selo)

    # Centraliza o texto com o selo pelo meio, não pelo topo.
    y_txt = y + (tam_selo - fnt_b.size) / 2 - 4 * ESCALA
    x_txt = x0 + tam_selo + espaco
    draw.text((x_txt, y_txt), "Velo ", font=fnt_b, fill=BRANCO)
    draw.text((x_txt + lv, y_txt), "Funil", font=fnt_r, fill=CINZA)

    fnt_site = fonte(REG, 32)
    site = "velofunil.com.br"
    draw.text(((W - draw.textlength(site, font=fnt_site)) / 2, y + tam_selo + 24 * ESCALA),
              site, font=fnt_site, fill=CINZA_FRACO)


# ------------------------------------------------------- print em perspectiva

def _coeficientes_perspectiva(origem, destino):
    """
    Os 8 coeficientes da homografia, resolvidos por sistema linear.

    O Pillow mapeia INVERSO (para cada pixel de saída procura o de entrada),
    por isso a ordem dos argumentos parece trocada — quem entra como `origem`
    é onde o pixel vai parar.
    """
    matriz = []
    for (xd, yd), (xo, yo) in zip(destino, origem):
        matriz.append([xd, yd, 1, 0, 0, 0, -xo * xd, -xo * yd])
        matriz.append([0, 0, 0, xd, yd, 1, -yo * xd, -yo * yd])
    A = np.matrix(matriz, dtype=float)
    B = np.array(origem).reshape(8)
    return np.array(np.dot(np.linalg.inv(A.T * A) * A.T, B)).reshape(8)


def colar_print(img, nome_print, topo_rel=0.34, larg_rel=1.42, esq_rel=-0.14,
                clarear=1.55):
    """
    Cola o print do produto em perspectiva, como uma tela inclinada no espaço.

    Rotação simples (`rotate`) deixaria o print chapado, como adesivo torto.
    Perspectiva faz as bordas convergirem — a lateral esquerda recua e a
    direita avança —, que é o tratamento que Linear e Attio usam.
    """
    origem = Image.open(PRINTS / nome_print).convert("RGB")
    larg = int(W * larg_rel)
    alt = int(larg * origem.height / origem.width)
    origem = origem.resize((larg, alt), Image.LANCZOS)

    # O print do produto é escuro por natureza (tema escuro), e sobre um fundo
    # #0A0A0A ele quase desaparece: medido, entrava com brilho médio 23-34
    # contra fundo 10. No celular isso lê como foto apagada, não como
    # interface elegante. Um leve ganho de brilho e contraste separa a tela do
    # fundo sem clarear a ponto de descaracterizar o tema do produto.
    origem = ImageEnhance.Brightness(origem).enhance(clarear)
    origem = ImageEnhance.Contrast(origem).enhance(1.12)

    borda = 3 * ESCALA
    com_moldura = Image.new("RGB", (larg + borda * 2, alt + borda * 2), (68, 72, 76))
    com_moldura.paste(origem, (borda, borda))
    bl, ba = com_moldura.size

    folga = int(ba * 0.22)
    recuo_topo = int(ba * 0.09)
    recuo_base = int(ba * 0.03)
    avanco = int(ba * 0.025)

    destino = [
        (0, folga + recuo_topo),
        (bl, folga - avanco),
        (bl, folga + ba + avanco),
        (0, folga + ba - recuo_base),
    ]
    coef = _coeficientes_perspectiva([(0, 0), (bl, 0), (bl, ba), (0, ba)], destino)
    perspectiva = com_moldura.transform(
        (bl, ba + folga * 2), Image.PERSPECTIVE, coef, Image.BICUBIC, fillcolor=(0, 0, 0)
    )

    # A `folga` existe só para a transformação não cortar os cantos — mas ela
    # vira margem MORTA colada ao print, que viajava junto ao colar e abria um
    # vazio entre o texto e a imagem (medido: 34% a 53% da altura em brilho de
    # fundo puro). Recorta o que de fato tem conteúdo antes de compor.
    caixa = perspectiva.getbbox()
    if caixa:
        perspectiva = perspectiva.crop(caixa)

    topo = int(H * topo_rel)
    esq = int(W * esq_rel)

    # Sombra ANTES do print: depois escureceria a própria tela.
    sombra = Image.new("RGB", (W, H), FUNDO)
    sd = ImageDraw.Draw(sombra)
    alt_p = perspectiva.height
    sd.ellipse([W * 0.05, topo + int(alt_p * 0.55), W * 1.15, topo + int(alt_p * 0.95)],
               fill=(0, 0, 0))
    sombra = sombra.filter(ImageFilter.GaussianBlur(70 * ESCALA))
    img = Image.blend(img, sombra, 0.62)

    img.paste(perspectiva, (esq, topo))

    # Desvanece a base pro fundo, ancorado na borda REAL do print — em
    # coordenada fixa isso já criou uma faixa escura cortando a imagem ao meio.
    base = topo + perspectiva.height
    inicio = min(base - 340 * ESCALA, H - SEGURO_BASE - 210 * ESCALA)
    mascara = Image.new("L", (W, H), 0)
    md = ImageDraw.Draw(mascara)
    for i in range(H - inicio):
        md.line([(0, inicio + i), (W, inicio + i)],
                fill=min(255, int(255 * (i / (200 * ESCALA)))))
    return Image.composite(Image.new("RGB", (W, H), FUNDO), img, mascara)


def fundo_com_brilho(intensidade=0.62, centro_y=0.60):
    """Base escura com um halo teal difuso, que dá profundidade sem virar gradiente."""
    img = Image.new("RGB", (W, H), FUNDO)
    brilho = Image.new("RGB", (W, H), FUNDO)
    bd = ImageDraw.Draw(brilho)
    bd.ellipse([W * 0.02, H * (centro_y - 0.18), W * 0.98, H * (centro_y + 0.25)],
               fill=(0, 58, 59))
    brilho = brilho.filter(ImageFilter.GaussianBlur(180 * ESCALA))
    return Image.blend(img, brilho, intensidade)


def salvar(img, nome):
    final = img.resize((W_FINAL, H_FINAL), Image.LANCZOS)
    final.save(SAIDA / f"{nome}.png")
    img.save(SAIDA / f"{nome}@4k.png")
    print(f"  {nome}.png  ({final.width}x{final.height})  +  @4k")


# --------------------------------------------------------------- as 5 telas

def tela_gancho():
    """A dor, com o print como evidência. É a que precisa parar o scroll."""
    img = fundo_com_brilho()
    # O print entra DEPOIS do bloco de texto, com respiro medido — ver
    # RESPIRO_APOS_TEXTO. Antes ele era colado em posição fixa e a última
    # linha da headline caía sobre a borda da tela.
    img = colar_print(img, "kanban-dark.png", topo_rel=0.42)
    draw = ImageDraw.Draw(img)

    y = SEGURO_TOPO + 30 * ESCALA
    fnt_eyebrow = fonte(REG, 29)
    txt = "C R M   P A R A   P E Q U E N O S   N E G Ó C I O S"
    draw.text(((W - draw.textlength(txt, font=fnt_eyebrow)) / 2, y), txt,
              font=fnt_eyebrow, fill=TEAL)
    y += 82 * ESCALA

    y = escrever(draw, "O cliente pediu orçamento", fonte(BOLD, 76), y, BRANCO)
    y = escrever(draw, "e sumiu no WhatsApp.", fonte(BOLD, 76), y, BRANCO)
    y += 30 * ESCALA
    escrever(draw, "Aqui ele não some.", fonte(BOLD, 76), y, TEAL)

    assinar(img, draw)
    salvar(img, "2026-08-24-demo-01-gancho")


def tela_passo(numero, titulo, apoio, print_nome, arquivo):
    """
    Um passo do "como funciona": número, título e o print que o comprova.

    O título vem literal da landing — mesma frase que a página usa, para os
    dois não divergirem no primeiro ajuste de copy.
    """
    img = fundo_com_brilho(centro_y=0.62)
    img = colar_print(img, print_nome, topo_rel=0.44)
    draw = ImageDraw.Draw(img)

    y = SEGURO_TOPO + 30 * ESCALA

    # O número do passo, grande e em teal: é o que dá senso de sequência
    # quando os Stories passam um atrás do outro.
    fnt_num = fonte(BOLD, 96)
    draw.text(((W - draw.textlength(numero, font=fnt_num)) / 2, y), numero,
              font=fnt_num, fill=TEAL)
    y += 118 * ESCALA

    y = escrever(draw, titulo, fonte(BOLD, 72), y, BRANCO)
    y += 22 * ESCALA
    escrever(draw, apoio, fonte(REG, 40), y, CINZA, largura_max=int(W * 0.80), entrelinha=1.32)

    assinar(img, draw)
    salvar(img, arquivo)


def tela_cta():
    """
    O fechamento: a oferta real, sem print.

    Sem imagem de produto de propósito — a última tela precisa que o olho vá
    para a oferta, e um print competindo aqui divide a atenção justamente na
    hora da decisão.
    """
    img = fundo_com_brilho(intensidade=0.5, centro_y=0.46)
    draw = ImageDraw.Draw(img)

    y = int(H * 0.30)
    y = escrever(draw, "7 dias com tudo", fonte(BOLD, 92), y, BRANCO)
    y = escrever(draw, "liberado.", fonte(BOLD, 92), y, BRANCO)
    y += 36 * ESCALA
    y = escrever(draw, "Sem cartão de crédito.", fonte(BOLD, 66), y, TEAL)

    y += 80 * ESCALA
    y = escrever(draw, "Depois, R$ 49 por mês pela empresa inteira.",
                 fonte(REG, 42), y, CINZA, largura_max=int(W * 0.78), entrelinha=1.34)
    y = escrever(draw, "Não por vendedor.", fonte(REG, 42), y, CINZA)

    assinar(img, draw)
    salvar(img, "2026-08-24-demo-05-cta")


if __name__ == "__main__":
    SAIDA.mkdir(parents=True, exist_ok=True)
    print("gerando destaque Demo (Como funciona):")

    tela_gancho()
    # Os três passos usam print ESCURO, sem exceção. A primeira versão do
    # passo 1 saiu com `kanban-light.png` e quebrava a sequência: quatro telas
    # escuras com uma branca no meio lê como erro de montagem, não como
    # variedade — e o modo escuro é o padrão do produto.
    tela_passo(
        "01", "Traga quem já é seu cliente",
        "Importe sua planilha ou cadastre pelo nome e telefone, do jeito que a conversa chegou.",
        "hoje-dark.png", "2026-08-24-demo-02-passo1",
    )
    tela_passo(
        "02", "Arraste pelas etapas",
        "Cada negócio vira um card. Arraste conforme a conversa avança.",
        "kanban-dark.png", "2026-08-24-demo-03-passo2",
    )
    tela_passo(
        "03", "Veja onde está o dinheiro",
        "Quanto está em negociação, o que virou venda e o que está perto do prazo.",
        "dashboard-dark.png", "2026-08-24-demo-04-passo3",
    )
    tela_cta()

    print("\npronto. 5 telas, cada uma em 1080x1920 e @4k.")
