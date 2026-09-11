"""
As artes do Perfil da Empresa no Google.

    python scripts/marketing/gerar-perfil-google.py

## Por que um gerador separado, e não mais um formato no de feed

O Perfil não é rede social, e a diferença mexe na composição, não só na medida.

    Instagram   a peca aparece SOZINHA, em tela cheia, e o dedo para nela
    Perfil      a peca aparece em MINIATURA, ao lado do nome, da nota e do
                telefone — competindo com a interface do proprio Google

Numa miniatura de ~180px, a manchete de quatro linhas do feed vira mancha
cinza. Aqui o texto é curto por construção, e a peça foi desenhada para ser
lida reduzida.

**E a capa tem uma regra que nenhum outro formato deste projeto tem:** o Google
recorta ela de forma imprevisível — 16:9 no desktop, perto de 1:1 no app do
Maps, tomando o centro. Nada essencial pode ficar fora do quadrado central, e
`conferir_quadrado_central` falha a geração quando fica.

## Os formatos, e de onde saem

    capa            1024x576   16:9, o topo do perfil
    produto         1080x1080  1:1, ver a nota em `produto()` sobre 720
    atualizacao      1200x900   4:3, os posts do perfil

São os tamanhos que o próprio Google publica na Central de Ajuda. Gerar maior
não melhora — ele reamostra para estes.

## O que NÃO entra

**Foto, de banco ou de IA.** Mesma razão que fez `marketing/instagram/fundos/`
existir sem ser usado: num SaaS a prova é a tela do produto, e foto compete com
o print em vez de sustentá-lo. Medido sobre 20 guias de criativo B2B SaaS,
fotografia aparece em 2.

**Preço escrito à mão.** Os números vêm de `lib/plans.ts` pelo módulo comum,
como no resto do projeto. O preço deste produto já mudou uma vez, e arte com
valor digitado passa a mentir sozinha no dia seguinte.
"""

import importlib.util
import sys
from pathlib import Path

from PIL import Image, ImageDraw

# Mesmo mecanismo do gerador de feed: o módulo de Stories é a base, e as
# funções dele leem as dimensões como globais resolvidas em tempo de chamada.
_spec = importlib.util.spec_from_file_location(
    "gerar_stories", Path(__file__).resolve().parent / "gerar-stories.py"
)
g = importlib.util.module_from_spec(_spec)
sys.modules["gerar_stories"] = g
_spec.loader.exec_module(g)

# ## O gerador de feed entra só por `_print_no_claro`
#
# Ele resolve uma coisa que `card_com_print` do módulo base não resolve:
# amostrar uma REGIÃO do print em vez da tela inteira. Sem isso, a tela de
# 1440px de CSS cabe numa coluna de ~1000px a 0,60x, e texto de 14px vira
# 8,4px — ilegível, e é o "borrado ao dar zoom" que o dono já relatou em 09/09.
#
# Importar tem um efeito colateral conhecido: o módulo do feed reconfigura as
# dimensões globais (1080x1350) no import. Fica inofensivo porque toda peça
# daqui chama `_formato()` antes de desenhar — mas é a razão de o import ficar
# AQUI, depois do módulo base e antes de qualquer uso.
_spec_feed = importlib.util.spec_from_file_location(
    "gerar_feed", Path(__file__).resolve().parent / "gerar-feed.py"
)
feed = importlib.util.module_from_spec(_spec_feed)
sys.modules["gerar_feed"] = feed
_spec_feed.loader.exec_module(feed)


SAIDA = g.RAIZ / "marketing" / "google-perfil"


def _formato(w_final, h_final, seguro_topo, seguro_base):
    """
    Reconfigura o módulo base, com as derivadas junto.

    `W`, `MARGEM_ESQ` e `LARGURA_TEXTO` foram computadas uma vez no import e não
    se atualizam sozinhas — reatribuir só `W_FINAL` deixaria metade do módulo
    desenhando na medida antiga. O gerador de feed já documenta isso; aqui há
    TRÊS formatos em vez de um, então o erro teria três chances de acontecer.
    """
    g.W_FINAL, g.H_FINAL = w_final, h_final
    g.W, g.H = g.W_FINAL * g.ESCALA, g.H_FINAL * g.ESCALA
    g.SEGURO_TOPO = int(g.H * seguro_topo)
    g.SEGURO_BASE = int(g.H * seguro_base)
    g.MARGEM_ESQ = int(g.W * 0.08)
    g.LARGURA_TEXTO = int(g.W * 0.84)
    # O rascunho guarda a altura do formato anterior; deixá-lo mediria o bloco
    # contra uma tela que não é esta.
    g._RASCUNHO = None


def conferir_quadrado_central(base_do_texto, nome):
    """
    O Google recorta a capa e nunca avisa como.

    Desktop mostra 16:9 inteiro; o app do Maps corta para perto de 1:1 tomando
    o CENTRO. Capa desenhada só para 16:9 perde o texto no segundo caso — e é o
    caso de quem procura a empresa pelo celular, que é a maioria.

    A conferência aqui é vertical: numa peça 16:9, o quadrado central tem a
    altura inteira, e o que se perde é largura. Como o texto começa na margem
    esquerda, o risco real é ele passar do meio para a direita.
    """
    lado = min(g.W, g.H)
    limite_dir = (g.W - lado) // 2 + lado
    if g.MARGEM_ESQ + g.LARGURA_TEXTO > limite_dir:
        raise SystemExit(
            f"\n  {nome}: a coluna de texto passa de {limite_dir}px e o corte "
            f"1:1 do app do Maps ia decepar o fim das linhas.\n"
        )
    if base_do_texto > g.H - g.SEGURO_BASE:
        raise SystemExit(
            f"\n  {nome}: o texto termina em {int(base_do_texto)}px e invade a "
            f"zona da assinatura (comeca em {g.H - g.SEGURO_BASE}px).\n"
        )


def capa():
    """
    O topo do perfil: o que a empresa faz, em uma linha.

    Uma frase, não três. Esta peça é vista por quem já procurou o nome e está
    conferindo se a empresa existe — ela responde *"é isto mesmo"*, não *"por
    que comprar"*. O argumento fica nas atualizações, que têm espaço para ele.
    """
    _formato(1024, 576, seguro_topo=0.12, seguro_base=0.24)

    # ## A coluna encolhe para o quadrado central, e isso NÃO é detalhe
    #
    # `_formato` dá a margem padrão dos outros formatos (8% / 84%), que numa
    # peça 16:9 chega a 1883px — e o corte 1:1 do app do Maps termina em 1600.
    # A guarda abaixo reprovou a primeira geração por isso.
    #
    # A saída não é só estreitar: é CENTRAR no quadrado. Alinhada à esquerda e
    # estreita, a frase ficaria encostada na borda esquerda no desktop e
    # centrada no celular — duas composições diferentes da mesma peça.
    lado = min(g.W, g.H)
    g.MARGEM_ESQ = (g.W - lado) // 2 + int(lado * 0.09)
    g.LARGURA_TEXTO = lado - int(lado * 0.18)

    img = g.fundo_marca(escuro_extra=0.04)
    draw = ImageDraw.Draw(img)

    topo, _base = g.faixa_livre()

    # ## Duas linhas, não quatro — e a peça é que manda, não o gosto
    #
    # 16:9 é o formato mais BAIXO deste projeto: 576px contra os 1350 do feed.
    # A versão longa ("O CRM que lembra de dar o retorno do orçamento") quebrava
    # em quatro linhas e a guarda reprovou duas vezes, mesmo com a base ampliada.
    #
    # Encurtar é a resposta certa, não diminuir: esta capa aparece a ~180px de
    # largura na ficha da empresa, e quatro linhas ali são um bloco cinza. O
    # realce fica em "sem retorno" porque é a dor, não o recurso.
    tam = int(g.W_FINAL * 0.055)
    y = g.escrever_com_realce(
        draw,
        [("Seu orçamento não fica ", False), ("sem retorno", True)],
        g.fonte("SemiBold", tam),
        g.fonte("SemiBold", tam),
        topo,
        g.cor_titulo(),
        g.cor_destaque(),
    )

    # Sete palavras, não doze. A guarda reprovou a versão longa ("...e não quer
    # perder o cliente no esquecimento") por 43px, e encurtar é melhor resposta
    # que diminuir a fonte: esta peça é lida a ~180px de largura na busca, e
    # texto miúdo ali não é lido — é ruído cinza embaixo do título.
    y = g.escrever_esq(
        draw,
        "Para quem vive de mandar orçamento.",
        g.fonte("Regular", int(g.W_FINAL * 0.030)),
        y + int(g.H * 0.05),
        g.cor_corpo(),
    )

    conferir_quadrado_central(y, "capa")

    # ## A margem VOLTA ao normal antes de assinar, e o motivo custou uma peça
    #
    # `assinar_discreto` desenha o filete de `MARGEM_ESQ` a `W - MARGEM_ESQ`, e
    # põe a marca numa ponta e o domínio na outra. Com a margem centrada no
    # quadrado (551px de cada lado), as duas pontas se encontraram: "Velo Funil"
    # saiu impresso POR CIMA de "velofunil.com.br".
    #
    # E está certo assim, não é remendo: o texto se protege do corte 1:1 porque
    # ele É o conteúdo; a assinatura ocupa a largura inteira de propósito,
    # porque no recorte quadrado ela pode sair sem prejuízo — quem vê a capa
    # cortada já está na ficha da empresa, com o nome e o site ao lado.
    g.MARGEM_ESQ = int(g.W * 0.08)
    g.assinar_discreto(img, draw)
    return img, "capa"


def produto():
    """
    A tela do produto, que é a prova que um SaaS tem para mostrar.

    Print em tema CLARO, de propósito: a miniatura aparece sobre o fundo branco
    da interface do Google, e o print escuro vira um bloco preto ilegível a
    180px.
    """
    # ## `_TEMA_CLARO`, e não só `fundo_claro()` — a primeira versão saiu ilegível
    #
    # As cores de texto saem de `cor_titulo()` / `cor_corpo()`, que leem a global
    # `_TEMA_CLARO`. Chamar `fundo_claro()` pinta o fundo e NÃO troca as cores:
    # a peça saiu com título branco sobre fundo branco, visível só porque eu
    # abri o PNG. É a mesma classe do `_LUZ_ATUAL` que o gerador de feed já
    # documenta — tema em variável de módulo, resolvido em cadeia.
    #
    # `0.20` de base porque a assinatura desenha ~110px abaixo da própria linha,
    # e numa peça de 720px os 14% do feed a empurravam para fora — foi o que
    # cortou "Velo Funil" no meio na primeira geração.
    # ## 1080 e não 720, e a razão é a assinatura
    #
    # 720x720 é o mínimo que o Google aceita, e foi o primeiro palpite. Mas
    # `assinar_discreto` foi desenhada para 1080 de largura: a 720 os dois
    # extremos do rodapé se encontram e "Velo Funil" sai impresso por cima de
    # "www.velofunil.com.br" — conferido abrindo o PNG, porque nenhuma guarda
    # mede colisão horizontal de texto.
    #
    # Encolher a fonte da assinatura resolveria a colisão e criaria outra: o
    # rodapé ficaria menor aqui do que nas outras peças, e é a MESMA marca. O
    # Google aceita 1080 e reamostra se precisar, então a peça se adapta ao
    # sistema em vez do contrário.
    _formato(1080, 1080, seguro_topo=0.07, seguro_base=0.18)
    g._TEMA_CLARO = True
    g._LUZ_ATUAL = 0.30

    img = g.fundo_claro(escuro_extra=0.0)
    draw = ImageDraw.Draw(img)

    topo, base = g.faixa_livre()
    y = g.escrever_esq(
        draw,
        "O retorno vira tarefa",
        g.fonte("SemiBold", int(g.W_FINAL * 0.070)),
        topo,
        g.cor_titulo(),
    )
    y = g.escrever_esq(
        draw,
        "Dois dias antes de o prazo vencer.",
        g.fonte("Regular", int(g.W_FINAL * 0.032)),
        y + int(g.H * 0.025),
        g.cor_corpo(),
    )

    # ## O print mostra a TAREFA, não o menu
    #
    # `card_com_print` do módulo base encaixa a tela inteira: numa coluna de
    # ~1000px, os 1440px de CSS caem para 0,60x e o texto de 14px do app vira
    # 8,4px. O resultado é a tela do produto ilegível na peça que existe para
    # mostrar a tela do produto.
    #
    # `_print_no_claro` amostra uma REGIÃO da origem — `(x, y, largura)` — e o
    # recorte abaixo é o mesmo já usado no carrossel de orçamento: começa depois
    # da barra lateral, que ocupa um sexto da largura e não diz nada sobre
    # orçamento. O que prova a promessa é a tarefa vencida com hora e nome.
    #
    # A escala sobe de 0,60x para ~0,89x, e `_print_no_claro` FALHA a geração
    # se cair abaixo de 0,80x — a guarda que nasceu junto com a correção.
    feed._print_no_claro(
        img,
        "hoje-light.png",
        y + int(g.H * 0.05),
        base - y - int(g.H * 0.11),
        recorte=(530, 285, 2200),
    )
    g.assinar_discreto(img, draw)

    # O tema volta ao escuro: as peças seguintes leem a MESMA global, e deixá-la
    # ligada faria a próxima nascer com cor de texto de tema claro sobre fundo
    # escuro — o defeito acima, invertido.
    g._TEMA_CLARO = False
    return img, "produto"


def atualizacao_do_lembrete():
    """
    O post do perfil: o dado que nenhum concorrente tem.

    4:3 porque é o formato que o Google usa nas atualizações, e porque ele
    aparece em cima do texto do post — a arte carrega o número, o texto carrega
    o resto.
    """
    _formato(1200, 900, seguro_topo=0.10, seguro_base=0.16)
    img = g.fundo_marca(escuro_extra=0.02)
    draw = ImageDraw.Draw(img)

    topo, _base = g.faixa_livre()

    y = g.escrever_esq(
        draw,
        "0 de 25",
        g.fonte("Bold", int(g.W_FINAL * 0.13)),
        topo,
        g.cor_destaque(),
    )
    y = g.escrever_esq(
        draw,
        "sistemas de orçamento avisam você antes de o prazo vencer",
        g.fonte("SemiBold", int(g.W_FINAL * 0.045)),
        y + int(g.H * 0.02),
        g.cor_titulo(),
    )
    g.escrever_esq(
        draw,
        "25 geradores de orçamento brasileiros, lidos em 09/09/2026.",
        g.fonte("Regular", int(g.W_FINAL * 0.022)),
        y + int(g.H * 0.04),
        g.cor_fonte_dado(),
    )

    g.assinar_discreto(img, draw)
    return img, "atualizacao-lembrete"


def main():
    SAIDA.mkdir(parents=True, exist_ok=True)
    print()
    for fabricar in (capa, produto, atualizacao_do_lembrete):
        img, nome = fabricar()
        destino = SAIDA / f"{nome}.png"
        img.resize((g.W_FINAL, g.H_FINAL), Image.LANCZOS).save(destino)
        print(f"  {destino.relative_to(g.RAIZ)}   {g.W_FINAL}x{g.H_FINAL}")
    print()
    print("  Publique em business.google.com -> Fotos")
    print()


if __name__ == "__main__":
    main()
