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


def arte_numero(numero, unidade, explicacao, fonte_dado, arquivo, categoria, luz):
    """
    O número domina, a explicação sustenta, a fonte prova.

    Mesmo esqueleto de `tela_numero`, com duas diferenças que o formato exige:
    o corpo sobe em toda a peça, e a luz do fundo é passada por
    peça, não por destaque — no feed as cinco aparecem LADO A LADO na grade, e
    cinco fundos idênticos leem como uma imagem repetida cinco vezes.
    """
    g._LUZ_ATUAL = luz
    img = g.fundo_marca(escuro_extra=0.15)
    draw = ImageDraw.Draw(img)
    topo, base = g.faixa_livre()
    fnt_num = g.fonte(g.DISPLAY, 240)

    def bloco(d, y):
        y = capsula_vazia(d, categoria, y) + 54 * g.ESCALA
        # `textbbox` e não `fnt.size`: o corpo da fonte reserva espaço para
        # acento e descida que um número não usa, e avançar por ele deixava o
        # dado encostado na linha seguinte.
        d.text((g.MARGEM_ESQ, y), numero, font=fnt_num, fill=g.TEAL)
        _, _, _, fim = d.textbbox((g.MARGEM_ESQ, y), numero, font=fnt_num)
        y = fim + 26 * g.ESCALA
        y = g.escrever_esq(d, unidade, g.fonte(g.TITULO, 68), y, g.BRANCO)
        y += 34 * g.ESCALA
        y = g.escrever_esq(d, explicacao, g.fonte(g.CORPO, 44), y, (168, 190, 190),
                           entrelinha=1.34)
        y += 38 * g.ESCALA
        return g.escrever_esq(d, fonte_dado, g.fonte(g.CORPO, 29), y, (110, 132, 132),
                              entrelinha=1.26)

    bloco(draw, g.centrar(topo, base, g.medir(bloco)))
    g.assinar_discreto(img, draw)
    salvar(img, arquivo)


def arte_declaracao(categoria, titulo, corpo, arquivo, luz, remate=None):
    """
    Só tipografia, para a peça que não tem número.

    Sem imagem e sem ícone, a frase carrega sozinha — e é por isso que ela é a
    única das cinco em corpo 88. Numa grade de cinco, uma peça de ritmo
    diferente é o que impede o conjunto de parecer um template repetido.
    """
    g._LUZ_ATUAL = luz
    img = g.fundo_marca(escuro_extra=0.10)
    draw = ImageDraw.Draw(img)
    topo, base = g.faixa_livre()

    def bloco(d, y):
        y = capsula_vazia(d, categoria, y) + 54 * g.ESCALA
        y = g.escrever_esq(d, titulo, g.fonte(g.TITULO, 88), y, g.BRANCO, entrelinha=1.16)
        y += 30 * g.ESCALA
        y = g.escrever_esq(d, corpo, g.fonte(g.CORPO, 44), y, (168, 190, 190),
                           entrelinha=1.34)
        if remate:
            y += 28 * g.ESCALA
            y = g.escrever_esq(d, remate, g.fonte(g.FORTE, 46), y, g.TEAL, entrelinha=1.22)
        return y

    bloco(draw, g.centrar(topo, base, g.medir(bloco)))
    g.assinar_discreto(img, draw)
    salvar(img, arquivo)


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


def _peca(luz, escuro_extra, bloco):
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
    bloco(draw, topo)
    g.assinar_discreto(img, draw)
    return img


def card_gancho(partes, apoio, luz):
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
            d, partes, g.fonte(g.TITULO, 84), g.italica(96),
            y, g.BRANCO, g.TEAL, entrelinha=1.18,
        )
        if apoio:
            y += 40 * g.ESCALA
            y = g.escrever_esq(d, apoio, g.fonte(g.CORPO, 44), y, (168, 190, 190),
                               entrelinha=1.34)
        return y

    return _peca(luz, 0.12, bloco)


def card_dado(numero, unidade, explicacao, fonte_dado, categoria, luz):
    """O card de prova. Mesmo esqueleto de `arte_numero`, sem salvar."""
    fnt_num = g.fonte(g.DISPLAY, 220)

    def bloco(d, y):
        y = capsula_vazia(d, categoria, y) + 50 * g.ESCALA
        d.text((g.MARGEM_ESQ, y), numero, font=fnt_num, fill=g.TEAL)
        _, _, _, fim = d.textbbox((g.MARGEM_ESQ, y), numero, font=fnt_num)
        y = fim + 24 * g.ESCALA
        y = g.escrever_esq(d, unidade, g.fonte(g.TITULO, 62), y, g.BRANCO)
        y += 32 * g.ESCALA
        y = g.escrever_esq(d, explicacao, g.fonte(g.CORPO, 42), y, (168, 190, 190),
                           entrelinha=1.34)
        y += 34 * g.ESCALA
        return g.escrever_esq(d, fonte_dado, g.fonte(g.CORPO, 28), y, (110, 132, 132),
                              entrelinha=1.26)

    return _peca(luz, 0.15, bloco)


def card_causa(titulo, corpo, luz):
    """
    O card que explica. Só tipografia, corpo grande.

    Vem depois dos dados porque explicação antes de prova é opinião; depois de
    prova, é conclusão.
    """
    def bloco(d, y):
        y = g.escrever_esq(d, titulo, g.fonte(g.TITULO, 76), y, g.BRANCO, entrelinha=1.18)
        y += 32 * g.ESCALA
        return g.escrever_esq(d, corpo, g.fonte(g.CORPO, 44), y, (168, 190, 190),
                              entrelinha=1.34)

    return _peca(luz, 0.10, bloco)


def card_cta(chamada, apoio, luz):
    """
    O último card: o que fazer, e onde.

    O botão é DESENHADO, não escrito — a forma de botão é o que faz o olho
    entender "aqui se age" antes de ler. Os prints de referência fazem isso, e
    é o único elemento de interface que cabe num criativo: ele não finge ser
    uma tela do produto, ele é a chamada da peça.

    "Link na bio" logo abaixo porque o botão não é clicável, e o Instagram não
    dá link em post de feed. Sem essa linha, a peça pede uma ação impossível.
    """
    fnt_ch = g.fonte(g.TITULO, 76)
    fnt_bt = g.fonte(g.FORTE, 44)
    rotulo = "Comece grátis"

    def bloco(d, y):
        y = g.escrever_esq(d, chamada, fnt_ch, y, g.BRANCO, entrelinha=1.18)
        y += 30 * g.ESCALA
        y = g.escrever_esq(d, apoio, g.fonte(g.CORPO, 44), y, (168, 190, 190),
                           entrelinha=1.34)
        y += 56 * g.ESCALA

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

    return _peca(luz, 0.18, bloco)


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
    print("FEED — 1080x1350")
    SAIDA.mkdir(parents=True, exist_ok=True)
    conferir_zona_segura()
    print()

    arte_numero(
        "21x", "mais chance de qualificar",
        "Responder em 5 minutos em vez de 30. A conta não é sobre ser rápido: "
        "é sobre chegar enquanto a pessoa ainda está decidindo.",
        "Estudo InsideSales com o MIT sobre tempo de resposta a lead.",
        "feed-1-janela-de-5-minutos", "D A D O   D E   M E R C A D O", 0.30,
    )

    arte_numero(
        "42h", "é a média de primeira resposta",
        "Auditoria em 2.241 empresas. Quase dois dias entre o cliente pedir e "
        "alguém responder — e a janela dos 5 minutos passou no primeiro.",
        "Harvard Business Review, auditoria com 2.241 empresas.",
        "feed-2-media-do-mercado", "D A D O   D E   M E R C A D O", 0.24,
    )

    # A peça "82% vendem pelo WhatsApp" saiu em 31/08, por decisão do dono:
    # nenhum tema de WhatsApp nesta rodada do feed. Ela continua verdadeira e
    # continua sendo o eixo da landing — só não entra aqui agora.
    #
    # Sem esse eixo, o conteúdo volta para a dor que o produto resolve sem
    # depender de canal: o pedágio de digitação e a venda que morre parada.

    arte_numero(
        "3,4h", "por semana só digitando",
        "É o que um vendedor gasta alimentando CRM à mão. O tempo que viraria "
        "proposta vira cadastro — e é assim que a ferramenta é abandonada.",
        "Pesquisa de produtividade em equipes comerciais.",
        "feed-3-pedagio-de-digitacao", "D A D O   D E   M E R C A D O", 0.34,
    )

    arte_numero(
        "55%", "das implantações de CRM falham",
        "E 60% disso é adoção, não plataforma. O sistema funciona; quem "
        "precisa alimentar todo dia é que desiste na terceira semana.",
        "Levantamentos publicados sobre implantação de CRM.",
        "feed-6-implantacao-que-falha", "D A D O   D E   M E R C A D O", 0.26,
    )

    arte_declaracao(
        "A   O B J E Ç Ã O   M A I S   C O M U M",
        "O funil não mente. A memória mente.",
        "Guardar na cabeça funciona com cinco clientes. Com trinta, o que "
        "some não é o cliente que você lembra — é o que você esqueceu.",
        "feed-7-memoria-mente", 0.38,
    )

    arte_numero(
        "R$ 265", "é a conta de 5 pessoas",
        "A maioria dos CRMs cobra por vendedor. Cinco pessoas a R$ 53 fecham "
        "isso todo mês, e o sexto vendedor custa mais R$ 53.",
        "Preço de tabela pública de CRMs que cobram por usuário.",
        "feed-8-conta-por-vendedor", "A   C O N T A   Q U E   N I N G U É M   F A Z", 0.44,
    )

    arte_declaracao(
        "O   S I N A L   Q U E   N I N G U É M   O L H A",
        "Negócio sem próximo passo morre calado",
        "Ele não dá erro, não avisa e não aparece em relatório. Só para de "
        "andar. Quando alguém lembra, o cliente já comprou de outro.",
        "feed-4-morre-calado", 0.20,
    )

    arte_numero(
        "R$ 49", "por mês, pela empresa inteira",
        "Não por vendedor. A maioria dos CRMs cobra por pessoa, e cinco "
        "pessoas a R$ 53 fecham a conta em R$ 265 todo mês.",
        "Preço de tabela pública de CRMs que cobram por usuário.",
        "feed-5-preco-por-empresa", "A   C O N T A   Q U E   N I N G U É M   F A Z", 0.36,
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
            luz=0.16,
        ),
        card_dado(
            "3,4h", "por semana só digitando",
            "É o que um vendedor gasta alimentando CRM à mão — tempo que "
            "viraria proposta e vira cadastro.",
            "Pesquisa de produtividade em equipes comerciais.",
            "D A D O   D E   M E R C A D O", luz=0.28,
        ),
        card_dado(
            "55%", "das implantações falham",
            "E 60% disso é adoção, não plataforma. O problema quase nunca é o "
            "sistema que foi escolhido.",
            "Levantamentos publicados sobre implantação de CRM.",
            "D A D O   D E   M E R C A D O", luz=0.36,
        ),
        card_causa(
            "O sistema funciona. Quem desiste é a pessoa.",
            "Toda ferramenta cobra um pedágio de digitação antes de devolver "
            "qualquer coisa. Quem paga esse pedágio todo dia é quem deveria "
            "estar vendendo — e na terceira semana ele para de pagar.",
            luz=0.42,
        ),
        card_cta(
            "Um funil que cabe num dia de trabalho.",
            "Grátis até 50 contatos, sem cartão. R$ 49 por mês pela empresa "
            "inteira quando precisar de mais — não por vendedor.",
            luz=0.46,
        ),
    ])

    print()
    # `@4k` e a mesma arte em dobro, nao uma peca a mais: contar o glob cru
    # daria o dobro. O numero literal que estava aqui virou mentira no dia
    # em que a lista mudou de tamanho — 31/08, quando passou de 5 para 8.
    quantas = len([f for f in SAIDA.glob("*.png") if not f.stem.endswith("@4k")])
    print()
    print(f"{quantas} artes em {SAIDA.relative_to(g.RAIZ)}")


if __name__ == "__main__":
    main()
