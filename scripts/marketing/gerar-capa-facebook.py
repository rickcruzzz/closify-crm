"""
A capa do Facebook — Página e perfil.

    python scripts/marketing/gerar-capa-facebook.py

## A armadilha desta peça, e é o motivo de ela existir como script

Capa de Facebook não é uma imagem: são TRÊS recortes da mesma imagem, e o que
some é diferente em cada um.

    upload            1640 x 924
    desktop mostra    a faixa central, ~1640 x 624 — some topo e base
    celular mostra    uma coluna estreita, ~640 de largura — some as laterais

Quem desenha para o desktop perde as pontas no celular. Quem centraliza tudo
desperdiça metade da peça no desktop. A única saída é uma **zona segura**: o
que precisa ser lido cabe no retângulo que sobrevive aos dois cortes.

Aqui isso não é conselho, é trava — `conferir_zona_segura()` falha se o texto
passar dela.

## E a foto de perfil come um canto

No perfil pessoal e na Página, o avatar redondo fica sobre o canto inferior
ESQUERDO da capa, e leva junto ~230px de largura por ~120px de altura. Texto
ali fica atrás de uma bolha.

Por isso a composição é **alinhada à esquerda mas ancorada acima** da faixa do
avatar: a coluna de leitura continua onde o olho ocidental começa, sem entrar
na área ocupada.

## Por que não reusa o gerador de feed

O feed é retrato (1080x1350) e vive de um número gigante. A capa é paisagem
extrema (16:9 achatado), lida de relance e a três metros, e não tem segunda
tela para explicar. São composições diferentes com a mesma marca — o que se
reusa é o fundo, a tipografia e a paleta, não o layout.
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


# ------------------------------------------------------------- o formato
#
# 1640x924 é o que a Meta pede no upload. Enviar menor faz o Facebook ampliar,
# e ampliação de bitmap numa peça que é 90% tipografia aparece na hora — borda
# de letra serrilhada é o defeito mais visível que uma capa pode ter.

# ## Supersampling em 3x, não nos 2x do resto da família
#
# Esta peça é quase inteiramente tipografia sobre fundo liso, vista em telas
# grandes de desktop. Nessa combinação, a borda serrilhada de uma letra é o
# defeito mais visível que existe — não há textura nem imagem para escondê-la.
#
# Desenhar em 4920x2772 e reduzir para 1640x924 com LANCZOS dá três amostras
# por pixel final. Custa segundos a mais numa peça gerada uma vez por mês.
g.ESCALA = 3
g.W_FINAL, g.H_FINAL = 1640, 924
g.W, g.H = g.W_FINAL * g.ESCALA, g.H_FINAL * g.ESCALA

# A zona que sobrevive aos DOIS cortes, medida do centro para fora.
#
# Largura: o celular mostra ~640 de 1640, então sobra 39% central.
# Altura: o desktop corta topo e base, sobrando ~624 de 924, os 68% do meio.
#
# ## 640, e a primeira versão errou isto
#
# Escrevi 1090 aqui por conveniência, com o argumento de que 640 seria "o pior
# caso absoluto" e desperdiçaria o desktop. Depois simulei os dois cortes lado
# a lado e olhei: no celular o título saía como "uma venda morre" e
# "cimento." — cortado nas duas pontas.
#
# 640 não é o pior caso, é O caso: 39% de 1640 é o que o Facebook mostra em
# QUALQUER celular, e celular é onde a maioria vê um perfil.
#
# O custo é real e aceito: o texto fica menor e o desktop tem mais respiro em
# volta. Respiro no desktop é composição; texto cortado no celular é defeito.
SEGURO_LARG = int(640 * g.ESCALA)
SEGURO_ALT = int(600 * g.ESCALA)

# O avatar redondo cobre este canto. Medido no layout atual do Facebook.
AVATAR_LARG = int(240 * g.ESCALA)
AVATAR_ALT = int(130 * g.ESCALA)

g.MARGEM_ESQ = (g.W - SEGURO_LARG) // 2
g.LARGURA_TEXTO = SEGURO_LARG
g._RASCUNHO = None

SAIDA = g.RAIZ / "marketing" / "facebook"


def conferir_zona_segura(caixa_texto):
    """
    O texto cabe no que sobrevive aos dois cortes?

    Falha em vez de avisar, pela mesma razão do gerador de feed: margem é o
    tipo de número que alguém ajusta por gosto meses depois, e o prejuízo —
    headline cortada no celular de quem visita — não aparece na máquina de
    quem desenhou.
    """
    x0, y0, x1, y1 = caixa_texto
    lim_x0 = (g.W - SEGURO_LARG) // 2
    lim_x1 = lim_x0 + SEGURO_LARG
    lim_y0 = (g.H - SEGURO_ALT) // 2
    lim_y1 = lim_y0 + SEGURO_ALT

    problemas = []
    if x0 < lim_x0 or x1 > lim_x1:
        problemas.append(f"largura: texto de {x0}..{x1}, seguro {lim_x0}..{lim_x1}")
    if y0 < lim_y0 or y1 > lim_y1:
        problemas.append(f"altura: texto de {y0}..{y1}, seguro {lim_y0}..{lim_y1}")

    # O canto do avatar, que só existe nesta peça.
    if x0 < AVATAR_LARG and y1 > g.H - AVATAR_ALT:
        problemas.append("texto entra na área coberta pela foto de perfil")

    if problemas:
        raise SystemExit("  zona segura violada:\n    " + "\n    ".join(problemas))

    print(f"  zona segura: {SEGURO_LARG // g.ESCALA}x{SEGURO_ALT // g.ESCALA} central, "
          f"folga de {(x0 - lim_x0) // g.ESCALA}px na esquerda")


def trama_de_pontos(img, passo=44, raio=1.5, forca=0.055):
    """
    Uma trama de pontos quase invisível sobre o fundo.

    ## Por que existe

    Fundo liso em peça grande lê como chapa — e chapa é o que separa arte feita
    de arte gerada. A trama dá TEXTURA sem dar assunto: ela não compete com o
    texto porque não tem forma reconhecível, só densidade.

    É o mesmo recurso do papel de impressão fina, e do fundo dos produtos que
    esta marca persegue como régua. A 5,5% de opacidade e 1,5px de raio, ela
    não é vista — é sentida quando alguém aproxima o olho e percebe que o fundo
    "tem alguma coisa".

    ## Por que ela some no lado do texto

    A densidade cai a zero na coluna de leitura. Trama atrás de letra reduz
    contraste de borda e faz a tipografia parecer suja — o oposto do que ela
    veio fazer.
    """
    camada = Image.new("RGBA", (g.W, g.H), (0, 0, 0, 0))
    d = ImageDraw.Draw(camada)
    r = raio * g.ESCALA
    salto = passo * g.ESCALA
    inicio_texto = (g.W - SEGURO_LARG) // 2
    fim_texto = inicio_texto + SEGURO_LARG

    for y in range(0, g.H, salto):
        for x in range(0, g.W, salto):
            # Esvazia sob a coluna de leitura, com transição em vez de corte.
            if inicio_texto - salto * 3 < x < fim_texto + salto * 3:
                dist = min(abs(x - (inicio_texto - salto * 3)),
                           abs(x - (fim_texto + salto * 3)))
                atenua = min(1.0, dist / (salto * 3))
                if atenua < 0.15:
                    continue
            else:
                atenua = 1.0
            d.ellipse([x - r, y - r, x + r, y + r],
                      fill=(*g.TEAL, int(255 * forca * atenua)))

    return Image.alpha_composite(img.convert("RGBA"), camada).convert("RGB")


def pipeline_abstrato(img, forca=0.30):
    """
    Três colunas de blocos: a geometria de um funil de vendas.

    ## Por que NÃO é um print falso de interface

    Critiquei exatamente isso nos criativos da concorrência — cards de UI
    flutuando sobre foto, inventando uma tela que não existe. A diferença aqui
    é o que a forma afirma.

    Card com texto falso e botão afirma "este é o produto", e mente. Retângulos
    sem rótulo, em três colunas decrescentes, afirmam "isto é um funil" — que é
    uma ideia, não uma captura de tela. Ninguém confunde com print, e é isso
    que o torna honesto.

    ## Por que decrescente e à direita

    Decrescente porque é a forma do funil: muitos entram, poucos fecham. É a
    mesma geometria da marca, dita em outra escala.

    À direita porque a coluna de leitura é a esquerda, e porque o corte do
    celular remove justamente esta faixa — a peça precisa funcionar sem ela.
    Ela é acabamento para quem vê no desktop, nunca informação.
    """
    camada = Image.new("RGBA", (g.W, g.H), (0, 0, 0, 0))
    d = ImageDraw.Draw(camada)

    larg_col = int(118 * g.ESCALA)
    folga_col = int(22 * g.ESCALA)
    alt_bloco = int(44 * g.ESCALA)
    folga_bloco = int(13 * g.ESCALA)
    raio = int(8 * g.ESCALA)

    # ## O x é CALCULADO, não escolhido
    #
    # A primeira versão usava `x = W * 0.735`, um número redondo que parecia
    # razoável. Três colunas de 150 mais duas folgas de 26 somam 502px, e
    # 0.735*1640 + 502 = 1707 numa peça de 1640: a terceira coluna saía cortada
    # pela borda.
    #
    # Agora a largura total é medida e ancorada pela DIREITA, com margem igual
    # à do texto. Mudar o tamanho dos blocos não pode voltar a estourar a peça.
    largura_total = larg_col * 3 + folga_col * 2
    margem_dir = int(60 * g.ESCALA)
    x = g.W - margem_dir - largura_total

    # E confere que não invade a coluna de leitura do celular.
    limite_texto = (g.W - SEGURO_LARG) // 2 + SEGURO_LARG
    if x < limite_texto + int(30 * g.ESCALA):
        raise SystemExit(
            f"  pipeline invade a zona de texto: comeca em {x // g.ESCALA}px, "
            f"o texto termina em {limite_texto // g.ESCALA}px"
        )

    topo = int(g.H * 0.30)

    for coluna, quantos in enumerate((4, 3, 2)):
        y = topo + coluna * int(30 * g.ESCALA)
        for i in range(quantos):
            # Cada bloco mais abaixo é mais apagado: a coluna se dissolve em
            # vez de terminar numa borda reta, que leria como corte.
            desvanece = 1 - (i / max(quantos, 2)) * 0.55
            alpha = int(255 * forca * desvanece)
            d.rounded_rectangle(
                [x, y, x + larg_col, y + alt_bloco],
                radius=raio,
                fill=(*g.TEAL, int(alpha * 0.16)),
                outline=(*g.TEAL, alpha),
                width=max(1, int(1.6 * g.ESCALA)),
            )
            y += alt_bloco + folga_bloco
        x += larg_col + folga_col

    return Image.alpha_composite(img.convert("RGBA"), camada).convert("RGB")


def funil_pela_direita(img, forca=0.09):
    """
    O símbolo em escala grande, sangrando pela borda direita.

    ## Por que um próprio, e não a marca-d'água do gerador de Stories

    A de lá é colada em `(-W*0.30, -H*0.16)` — canto superior ESQUERDO. Faz
    sentido no retrato, onde a coluna de leitura ocupa a metade de baixo. Nesta
    peça a coluna é o centro-esquerda, e a forma cairia exatamente sobre o
    texto.

    ## Por que ela é necessária aqui

    A zona segura obriga o texto a viver num retângulo central de 1090px. Numa
    peça de 1640, isso deixa ~350px mortos à direita — e vazio não é respiro
    quando está de um lado só: lê como imagem mal cortada.

    A forma equilibra sem competir. Ela não é decoração: é a mesma geometria do
    produto, e é o que faz a capa pertencer à marca mesmo se alguém cortar o
    endereço fora.

    ## Por que 9% e não os 5,5% do Stories

    Paisagem tem menos altura para a forma se desenvolver, e o gradiente do
    fundo é mais claro deste lado. A 5,5% ela some; a 9% é sentida sem ser
    lida, que é o mesmo alvo com outro número.
    """
    lado = int(g.H * 1.9)
    camada = Image.new("RGBA", (lado, lado), (0, 0, 0, 0))
    d = ImageDraw.Draw(camada)
    u = lado / 24.0
    tinta = (*g.TEAL, int(255 * forca))

    def P(x, y):
        return (x * u, y * u)

    d.polygon([P(2.6, 4.4), P(21.4, 4.4), P(18.9, 8.76), P(5.1, 8.76)], fill=tinta)
    d.polygon([P(6.9, 10.6), P(17.1, 10.6), P(14.98, 14.9), P(9.02, 14.9)], fill=tinta)
    d.polygon([P(10.9, 16.6), P(13.1, 16.6), P(12.0, 19.5)], fill=tinta)

    camada = camada.filter(ImageFilter.GaussianBlur(5 * g.ESCALA))
    # Sangra pela direita e pelo topo: a base fica livre porque é lá que o
    # avatar entra, e forma atrás de avatar vira sujeira.
    img.paste(camada, (int(g.W - lado * 0.62), int(-g.H * 0.34)), camada)
    return img


def escurecer_coluna_de_leitura(img, forca=0.55):
    """
    Gradiente escuro da esquerda, protegendo o texto da forma que passa atrás.

    ## O defeito que isto corrige, medido

    Com o funil a 9%, o fundo sob o título subiu para RGB(92,133,134). Medido
    em WCAG:

        titulo branco    4.0:1   passa raspando o minimo de texto grande (3.0)
        apoio cinza      2.5:1   REPROVA em qualquer criterio

    O caminho preguiçoso seria apagar a forma. Mas ela resolve o desequilíbrio
    da peça, e o problema não é ela existir — é ela existir DEBAIXO do texto.

    Scrim é a técnica padrão para isso: um véu escuro só do lado da leitura,
    com queda suave, que devolve o contraste sem apagar a estrutura do outro
    lado. É o que toda capa de filme faz com o título sobre a arte.

    A queda vai até 62% da largura porque a coluna de texto termina em ~1290px
    de 1640 — o véu precisa cobrir a leitura inteira e já ter sumido onde a
    forma vive.
    """
    veu = Image.new("RGBA", (g.W, g.H), (0, 0, 0, 0))
    d = ImageDraw.Draw(veu)
    fim = int(g.W * 0.78)
    passos = 160
    for i in range(passos):
        x0 = int(fim * i / passos)
        x1 = int(fim * (i + 1) / passos) + 1
        # Curva quadrática, não linear: linear deixa uma borda visível onde o
        # véu acaba, e borda reta num fundo liso lê como retângulo colado.
        t = 1 - (i / passos) ** 2
        d.rectangle([x0, 0, x1, g.H], fill=(2, 18, 19, int(255 * forca * t)))
    return Image.alpha_composite(img.convert("RGBA"), veu).convert("RGB")


def salvar(img, nome):
    SAIDA.mkdir(parents=True, exist_ok=True)
    final = img.resize((g.W_FINAL, g.H_FINAL), Image.LANCZOS)
    final.save(SAIDA / f"{nome}.png")
    print(f"  {nome}.png  ({final.width}x{final.height})")


def capa(titulo, apoio, arquivo, luz=0.30):
    """
    Uma frase grande, uma linha de apoio, o endereço. Nada mais.

    ## Por que tão pouco

    Capa é vista de relance, geralmente enquanto a pessoa rola para o que veio
    ver. Ela tem UM trabalho: dizer o que este perfil é, antes de a pessoa
    decidir se lê a bio. Frase longa ali não é lida — é ignorada junto com o
    resto do cabeçalho.

    A tentação é encher: recurso, preço, três diferenciais, um mockup. Todos
    somem no corte do celular, e o que sobra é ruído em volta de um texto
    pequeno demais.
    """
    g._LUZ_ATUAL = luz
    img = g.fundo_marca(escuro_extra=0.12)
    funil_pela_direita(img)
    img = trama_de_pontos(img)
    img = pipeline_abstrato(img)
    img = escurecer_coluna_de_leitura(img)
    draw = ImageDraw.Draw(img)

    fnt_tit = g.fonte(g.TITULO, 52)
    fnt_apo = g.fonte(g.CORPO, 27)
    fnt_end = g.fonte(g.ROTULO, 25)

    def quebrar(texto, fnt):
        """
        Quebra em linhas que cabem na zona segura.

        Existe porque a primeira versão quebrava só o TÍTULO e escrevia o apoio
        numa linha só — que vazou para fora da peça, cortando "vira um…" na
        borda direita. A trava não pegou porque também media apenas o título.

        Erro de duas partes, e a segunda é a que ensina: uma verificação que
        cobre parte do conteúdo dá a sensação de estar coberto, e é pior que
        não ter verificação nenhuma.
        """
        linhas, atual = [], ""
        for palavra in texto.split():
            teste = f"{atual} {palavra}".strip()
            if draw.textlength(teste, font=fnt) <= SEGURO_LARG:
                atual = teste
            else:
                linhas.append(atual)
                atual = palavra
        if atual:
            linhas.append(atual)
        return linhas

    linhas_tit = quebrar(titulo, fnt_tit)
    linhas_apo = quebrar(apoio, fnt_apo)

    alt_total = (
        len(linhas_tit) * fnt_tit.size * 1.18
        + 30 * g.ESCALA
        + len(linhas_apo) * fnt_apo.size * 1.34
        + 34 * g.ESCALA
        + fnt_end.size
    )

    y = (g.H - alt_total) / 2
    y0, x = y, g.MARGEM_ESQ

    for linha in linhas_tit:
        draw.text((x, y), linha, font=fnt_tit, fill=g.BRANCO)
        y += fnt_tit.size * 1.18

    y += 30 * g.ESCALA
    for linha in linhas_apo:
        draw.text((x, y), linha, font=fnt_apo, fill=(168, 190, 190))
        y += fnt_apo.size * 1.34

    y += 34 * g.ESCALA
    draw.text((x, y), "velofunil.com.br", font=fnt_end, fill=g.TEAL)
    y += fnt_end.size

    # Mede o MAIOR de tudo que foi desenhado, não só do título.
    largura_maior = max(
        [draw.textlength(l, font=fnt_tit) for l in linhas_tit]
        + [draw.textlength(l, font=fnt_apo) for l in linhas_apo]
        + [draw.textlength("velofunil.com.br", font=fnt_end)]
    )
    conferir_zona_segura((int(x), int(y0), int(x + largura_maior), int(y)))

    salvar(img, arquivo)


def main():
    print(f"CAPA DO FACEBOOK — {g.W_FINAL}x{g.H_FINAL}")
    print()

    # Sem WhatsApp, por decisão desta rodada. E sem preço: capa é
    # identificação, não oferta — preço aqui filtra antes de a pessoa saber o
    # que o produto faz.
    capa(
        "Nenhuma venda morre por esquecimento.",
        "CRM para pequenos negócios brasileiros. Cada pedido de orçamento vira "
        "um contato com prazo para responder.",
        "capa-facebook",
    )

    print()
    print(f"  em {SAIDA.relative_to(g.RAIZ)}")


if __name__ == "__main__":
    main()
