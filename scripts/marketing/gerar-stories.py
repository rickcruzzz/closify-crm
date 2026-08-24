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


# ================================================================ os layouts
#
# Três arranjos, não um. Repetir a mesma composição em todas as telas faria o
# destaque inteiro parecer a mesma imagem, e é a variação que segura quem está
# passando os Stories. Nenhum usa numeração de passo: quem entra num destaque
# pelo meio não viu o "01", e número solto sem contexto atrapalha mais do que
# ordena.


def tela_com_print(titulo, apoio, print_nome, arquivo, eyebrow=None,
                   destaque=None, topo_print=0.44, tam_titulo=72):
    """
    Headline em cima, print do produto embaixo.

    O formato que mais converte em anúncio B2B SaaS ("Bold Headline + Product
    UI"), com a regra que o faz funcionar: a headline descreve exatamente o
    que o print mostra. Print real prova; ilustração genérica não.
    """
    img = fundo_com_brilho()
    img = colar_print(img, print_nome, topo_rel=topo_print)
    draw = ImageDraw.Draw(img)

    y = SEGURO_TOPO + 30 * ESCALA
    if eyebrow:
        fnt = fonte(REG, 29)
        draw.text(((W - draw.textlength(eyebrow, font=fnt)) / 2, y), eyebrow,
                  font=fnt, fill=TEAL)
        y += 82 * ESCALA

    y = escrever(draw, titulo, fonte(BOLD, tam_titulo), y, BRANCO)
    if apoio:
        y += 22 * ESCALA
        y = escrever(draw, apoio, fonte(REG, 40), y, CINZA,
                     largura_max=int(W * 0.80), entrelinha=1.32)
    if destaque:
        y += 26 * ESCALA
        escrever(draw, destaque, fonte(BOLD, 60), y, TEAL)

    assinar(img, draw)
    salvar(img, arquivo)


def tela_dado(numero, unidade, explicacao, fonte_dado, arquivo):
    """
    Um número dominando a tela.

    Formato "Metric-First": número específico em tipografia display, com a
    fonte logo abaixo. A fonte não é rodapé burocrático — é o que separa dado
    verificável de número inventado, e inventar métrica é decisão travada
    contra neste projeto desde que a landing teve uma copiada de concorrente.
    """
    img = fundo_com_brilho(intensidade=0.55, centro_y=0.42)
    draw = ImageDraw.Draw(img)

    y = int(H * 0.24)
    fnt_num = fonte(BOLD, 200)
    draw.text(((W - draw.textlength(numero, font=fnt_num)) / 2, y), numero,
              font=fnt_num, fill=TEAL)
    y += 244 * ESCALA

    y = escrever(draw, unidade, fonte(BOLD, 60), y, BRANCO)
    y += 44 * ESCALA
    y = escrever(draw, explicacao, fonte(REG, 42), y, CINZA,
                 largura_max=int(W * 0.80), entrelinha=1.34)

    y += 38 * ESCALA
    escrever(draw, fonte_dado, fonte(REG, 28), y, CINZA_FRACO,
             largura_max=int(W * 0.76), entrelinha=1.28)

    assinar(img, draw)
    salvar(img, arquivo)


def tela_texto(titulo, corpo, arquivo, eyebrow=None, destaque=None, tam_titulo=80):
    """
    Só tipografia, sem imagem.

    Para pergunta e resposta, e para o fechamento: um print competindo com a
    oferta divide a atenção justamente na hora da decisão.
    """
    img = fundo_com_brilho(intensidade=0.5, centro_y=0.46)
    draw = ImageDraw.Draw(img)

    y = int(H * 0.24)
    if eyebrow:
        fnt = fonte(REG, 29)
        draw.text(((W - draw.textlength(eyebrow, font=fnt)) / 2, y), eyebrow,
                  font=fnt, fill=TEAL)
        y += 78 * ESCALA

    y = escrever(draw, titulo, fonte(BOLD, tam_titulo), y, BRANCO)
    y += 44 * ESCALA
    y = escrever(draw, corpo, fonte(REG, 44), y, CINZA,
                 largura_max=int(W * 0.80), entrelinha=1.36)
    if destaque:
        y += 44 * ESCALA
        escrever(draw, destaque, fonte(BOLD, 54), y, TEAL)

    assinar(img, draw)
    salvar(img, arquivo)


# ============================================================== os destaques

def destaque_demo():
    """Como funciona: a dor, o caminho, o resultado, a oferta."""
    print("\nDEMO — Como funciona")

    tela_com_print(
        "O cliente pediu orçamento e sumiu no WhatsApp.",
        None, "kanban-dark.png", "demo-1-gancho",
        eyebrow="C R M   P A R A   P E Q U E N O S   N E G Ó C I O S",
        destaque="Aqui ele não some.", topo_print=0.42,
    )
    tela_com_print(
        "Traga quem já é seu cliente",
        "Importe sua planilha ou cadastre pelo nome e telefone, do jeito que a conversa chegou.",
        "hoje-dark.png", "demo-2-trazer",
    )
    tela_com_print(
        "Arraste pelas etapas",
        "Cada negócio vira um card. Arraste conforme a conversa avança.",
        "kanban-dark.png", "demo-3-arrastar",
    )
    tela_com_print(
        "Veja onde está o dinheiro",
        "Quanto está em negociação, o que virou venda e o que está perto do prazo.",
        "dashboard-dark.png", "demo-4-resultado",
    )
    tela_texto(
        "7 dias com tudo liberado.",
        "Depois, R$ 49 por mês pela empresa inteira. Não por vendedor.",
        "demo-5-cta", destaque="Sem cartão de crédito.",
    )


def destaque_planos():
    """Planos: o que é grátis, o que é pago, e por que o preço é diferente."""
    print("\nPLANOS")

    tela_texto(
        "Comece de graça. Pague quando fizer sentido.",
        "Sua empresa começa com o Pro completo por 7 dias, sem cartão. Depois, você escolhe.",
        "planos-1-abertura", eyebrow="P L A N O S", tam_titulo=68,
    )
    tela_texto(
        "Grátis, para sempre",
        "1 empresa · até 2 colaboradores · até 50 contatos · funil visual e painel de resultados.",
        "planos-2-free", eyebrow="P L A N O   G R Á T I S",
        destaque="R$ 0", tam_titulo=76,
    )
    tela_com_print(
        "Pro: R$ 49 por mês",
        "Contatos e colaboradores ilimitados, várias empresas no mesmo login, Google Calendar e Gmail conectados.",
        "dashboard-dark.png", "planos-3-pro", eyebrow="P L A N O   P R O",
    )
    # A comparação é a única vantagem que o concorrente não iguala sem mudar o
    # próprio modelo de cobrança. Preço de tabela pública deles, por isso pode
    # ser dito — e sem citar nome, que convida processo e ainda ensina a marca
    # do concorrente a quem não conhecia.
    tela_texto(
        "A maioria cobra por vendedor.",
        "Cinco pessoas, a R$ 53 cada, dão R$ 265 por mês. E sobe toda vez que você contrata alguém.",
        "planos-4-comparacao", eyebrow="A   C O N T A   Q U E   N I N G U É M   F A Z",
        destaque="Aqui são R$ 49, com a equipe que quiser.", tam_titulo=72,
    )
    tela_texto(
        "Pix, boleto ou cartão.",
        "Cobrança recorrente pelo Asaas. Cancele quando quiser, sem multa e sem falar com ninguém.",
        "planos-5-pagamento", eyebrow="C O M O   P A G A R", tam_titulo=78,
    )


def destaque_dicas():
    """
    Dicas de venda: os números de mercado que justificam o produto.

    Cada número traz a fonte no próprio criativo. São dados de pesquisa
    pública, não medição nossa — dizer de onde vêm é o que os separa de
    número inventado.
    """
    print("\nDICAS DE VENDA")

    tela_dado(
        "21x", "mais chance de fechar",
        "Responder em 5 minutos, em vez de 30, multiplica por 21 a chance de qualificar o contato.",
        "Estudo InsideSales / MIT", "dicas-1-resposta-rapida",
    )
    tela_dado(
        "42h", "é a média do mercado",
        "O tempo que uma empresa leva, em média, para responder o primeiro contato. Quem responde em minutos já saiu na frente.",
        "Harvard Business Review — auditoria em 2.241 empresas",
        "dicas-2-media-do-mercado",
    )
    tela_dado(
        "82%", "vendem pelo WhatsApp",
        "É o principal canal de venda dos pequenos negócios brasileiros. O problema não é o canal: é o que some junto com a conversa.",
        "12ª Pesquisa Pulso dos Pequenos Negócios — Sebrae, 2026",
        "dicas-3-whatsapp",
    )
    tela_com_print(
        "Negócio sem próximo passo é o que morre calado",
        "Ele não dá erro, não avisa, não aparece em relatório. Só para de andar.",
        "kanban-dark.png", "dicas-4-proximo-passo",
        eyebrow="O   S I N A L   Q U E   N I N G U É M   O L H A", tam_titulo=64,
    )
    tela_texto(
        "O que você mede, você cobra.",
        "Sem funil, a pergunta sobre quanto você tem para fechar este mês só tem resposta no chute.",
        "dicas-5-medir", eyebrow="D I C A   F I N A L",
        destaque="Teste 7 dias, sem cartão.", tam_titulo=74,
    )


def destaque_perguntas():
    """
    FAQ: as seis perguntas reais que a landing responde.

    Texto vindo de `components/landing/faq-section.tsx` — reescrever aqui
    faria o Story divergir da página no primeiro ajuste feito lá.
    """
    print("\nPERGUNTAS")

    EYE = "P E R G U N T A S   F R E Q U E N T E S"

    tela_texto(
        "O que acontece depois dos 7 dias?",
        "Nada é cobrado sem você escolher: não pedimos cartão para começar. Depois, ou você assina, ou a conta passa para o plano grátis, que não expira.",
        "faq-1-depois-dos-7-dias", eyebrow=EYE, tam_titulo=70,
    )
    tela_texto(
        "Preciso instalar alguma coisa?",
        "Não. Roda inteiro no navegador, no computador ou no celular. Você cria a conta e já começa a usar.",
        "faq-2-instalar", eyebrow=EYE, tam_titulo=74,
    )
    tela_texto(
        "Consigo trazer os contatos da minha planilha?",
        "Sim. Exporte como .csv com Nome, Telefone, E-mail e Valor e importe direto. Contatos repetidos são ignorados automaticamente.",
        "faq-3-planilha", eyebrow=EYE, tam_titulo=62,
    )
    tela_texto(
        "Meus dados ficam separados dos de outras empresas?",
        "Ficam. É uma regra de segurança configurada no banco de dados, não uma tela que a gente pode esquecer de checar.",
        "faq-4-isolamento", eyebrow=EYE, tam_titulo=58,
    )
    tela_texto(
        "Quais são as formas de pagamento?",
        "Pix, boleto e cartão de crédito, com cobrança recorrente processada pelo Asaas.",
        "faq-5-pagamento", eyebrow=EYE,
        destaque="R$ 49 por mês, por empresa.", tam_titulo=70,
    )
    tela_texto(
        "Posso cancelar quando quiser?",
        "Pode, sem multa e sem falar com ninguém. A conta volta para o plano grátis e seus dados continuam lá.",
        "faq-6-cancelar", eyebrow=EYE, tam_titulo=74,
    )


if __name__ == "__main__":
    SAIDA.mkdir(parents=True, exist_ok=True)
    destaque_demo()
    destaque_planos()
    destaque_dicas()
    destaque_perguntas()
    print("\npronto — cada tela em 1080x1920 (publicar) e @4k (reserva).")
    print("\nBastidores fica de fora: exige conteúdo seu (rotina, processo,")
    print("decisões), que não existe no código e não dá para inventar.")
