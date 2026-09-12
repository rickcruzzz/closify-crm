"""
As cinco pecas que acompanham a mensagem de prospeccao no WhatsApp.

    python scripts/marketing/gerar-peca-prospeccao.py

## Por que cinco, e nao uma

Nenhuma medicao deste projeto diz qual angulo fecha. O que existe sao numeros
soltos, cada um sustentando um argumento diferente — e a unica forma honesta de
descobrir qual vence e mandar os cinco para o dono escolher, e depois deixar a
taxa de resposta decidir.

Cada peca carrega UM argumento, e cada argumento e um numero que foi medido:

    1. A DOR       "cliente pediu orcamento e sumiu" aparece em 6 de 10 titulos
                   que o mercado escreve sobre o tema (Exa, 09/09)
    2. A LACUNA    0 de 25 geradores de orcamento AVISAM antes de vencer.
                   88% geram PDF, 60% mandam no WhatsApp, 48% guardam a
                   validade — e nenhum avisa (09/09)
    3. O PRECO     o nosso preco pela empresa TODA contra 85 a 156 reais POR
                   USUARIO do Agendor e do Ploomes. Quatro pessoas: 332 reais
                   la, o preco de um plano aqui
    4. A PROVA     o print real da tela /hoje, sem ilustracao nenhuma
    5. O RISCO     o orcamento que vence sem retorno e dinheiro que ja saiu

## Por que quadrado, e nao 4:5

No WhatsApp a imagem aparece dentro do balao, com largura fixa e altura
proporcional. Peca alta e cortada na previa e forca o toque para ver inteira —
e um toque a mais e onde a atencao morre. 1080x1080 cabe inteira na previa.

## O que NAO fazer aqui, e ja esta medido em outro lugar

Nada de arte generica de IA. `docs/estado-atual.md` registra a decisao de
30/08: **sem prova social inventada**. Uma foto de banco de imagens de "equipe
sorrindo" nao prova nada e e reconhecivel como enfeite; o print da tela prova
que o software faz o que a mensagem promete.

A peca 4 existe justamente para testar isso contra as outras quatro.
"""

import importlib.util
import sys
from pathlib import Path

from PIL import Image, ImageDraw

# Mesmo mecanismo dos outros geradores: o modulo de Stories e a base, e as
# funcoes dele leem as dimensoes como globais resolvidas em tempo de chamada.
_spec = importlib.util.spec_from_file_location(
    "gerar_stories", Path(__file__).resolve().parent / "gerar-stories.py"
)
g = importlib.util.module_from_spec(_spec)
sys.modules["gerar_stories"] = g
_spec.loader.exec_module(g)

# O gerador de feed entra so por `_print_no_claro`, que amostra uma REGIAO do
# print em vez da tela inteira — sem isso texto de 14px vira 8,4px, que foi o
# "borrado ao dar zoom" relatado em 09/09.
_spec_feed = importlib.util.spec_from_file_location(
    "gerar_feed", Path(__file__).resolve().parent / "gerar-feed.py"
)
feed = importlib.util.module_from_spec(_spec_feed)
sys.modules["gerar_feed"] = feed
_spec_feed.loader.exec_module(feed)

SAIDA = g.RAIZ / "public" / "prospeccao"

# ## Nenhum preço é digitado aqui, e o teste do projeto obriga isso
#
# `lib/marketing/oferta-nas-artes.test.ts` recusa qualquer `R$ <número>` no
# código de um gerador, e recusou este na primeira vez que rodou — eu tinha
# escrito `R$ 97` e `R$ 332` à mão.
#
# A regra não é estética. O preço deste produto já mudou uma vez (R$ 49 para
# R$ 97, em 10/09), e o caso que trava `PRO_PLAN_PRICE` registra o efeito: na
# troca, TODA arte publicada continua mostrando o preço velho até ser regerada.
# Arte com número digitado não avisa quando passa a mentir.
PESSOAS_NA_EQUIPE = 4

# ## De onde sai o preço do concorrente
#
# Mediana medida em 09/09 sobre os dois CRMs brasileiros que cobram por
# assento: Agendor (R$ 59 a R$ 156 por usuário) e Ploomes (R$ 85). Fica como
# constante nomeada, e não solta no texto, porque é dado de terceiro que
# envelhece — preço de concorrente é o número que muda mais rápido de todos, e
# a página de comparação do site já carrega a data em que foi lido pelo mesmo
# motivo.
POR_USUARIO_DO_CONCORRENTE = 83
CONTA_DO_CONCORRENTE = POR_USUARIO_DO_CONCORRENTE * PESSOAS_NA_EQUIPE

# A manchete diz o número por EXTENSO, que lê melhor que o algarismo numa
# frase de duas palavras. O mapa existe para os dois não divergirem: trocar a
# constante sem trocar a palavra deixaria "Quatro vendedores" sobre a conta de
# cinco, e nada falharia.
_POR_EXTENSO = {2: "Dois", 3: "Três", 4: "Quatro", 5: "Cinco", 6: "Seis"}
EQUIPE_POR_EXTENSO = _POR_EXTENSO[PESSOAS_NA_EQUIPE]

# ## `public/` e nao `marketing/`, e e decisao
#
# A Evolution precisa de uma URL PUBLICA para `sendMedia`. Os prints do produto
# ja moram em `public/produto/` e sao servidos em 200 pelo Next — a peca segue
# o mesmo caminho em vez de inventar hospedagem.
#
# Consequencia que fica dita: qualquer um com o endereco abre a peca. Ela e
# material de marketing, feita para ser vista, entao isso e o comportamento
# desejado e nao um vazamento.


def _formato(w_final, h_final, seguro_topo, seguro_base):
    """
    Reconfigura o modulo base, com as derivadas junto.

    `W`, `MARGEM_ESQ` e `LARGURA_TEXTO` foram computadas uma vez no import e
    nao se atualizam sozinhas — reatribuir so `W_FINAL` deixaria metade do
    modulo desenhando na medida antiga.
    """
    g.W_FINAL, g.H_FINAL = w_final, h_final
    g.W, g.H = g.W_FINAL * g.ESCALA, g.H_FINAL * g.ESCALA
    g.SEGURO_TOPO = int(g.H * seguro_topo)
    g.SEGURO_BASE = int(g.H * seguro_base)
    g.MARGEM_ESQ = int(g.W * 0.08)
    g.LARGURA_TEXTO = int(g.W * 0.84)
    g._RASCUNHO = None


def _salvar(img, nome):
    SAIDA.mkdir(parents=True, exist_ok=True)
    destino = SAIDA / nome
    img.resize((g.W_FINAL, g.H_FINAL), Image.LANCZOS).save(destino, quality=95)
    print(f"  {nome}  {g.W_FINAL}x{g.H_FINAL}  {destino.stat().st_size // 1024} KB")


def _quadrado(claro=True):
    _formato(1080, 1080, seguro_topo=0.08, seguro_base=0.16)
    g._TEMA_CLARO = claro
    g._LUZ_ATUAL = 0.30 if claro else 0.0
    img = g.fundo_claro(escuro_extra=0.0) if claro else g.fundo_marca(escuro_extra=0.0)
    return img, ImageDraw.Draw(img)


def dor():
    """
    1. A DOR, na lingua que o proprio cliente digita.

    *"cliente pediu orcamento e sumiu"* apareceu em 6 de 10 titulos que o
    mercado escreve sobre o tema — medido no Exa em 09/09. Nao e "follow-up",
    que e jargao de vendedor; e a frase que a pessoa usa quando esta irritada.
    """
    img, draw = _quadrado(claro=True)
    topo, base = g.faixa_livre()

    def corpo(d, y):
        y = g.escrever_esq(
            d, "Mandou o orçamento.", g.fonte("Bold", 78), y, g.cor_titulo()
        )
        y = g.escrever_esq(
            d, "E aí?", g.fonte("Bold", 78), y + int(g.H * 0.005), g.cor_destaque()
        )
        y = g.escrever_esq(
            d,
            "O cliente some, a semana passa, e você não lembra "
            "quem ficou de responder.",
            g.fonte("Regular", 40),
            y + int(g.H * 0.045),
            g.cor_corpo(),
        )
        return g.escrever_esq(
            d,
            "O Velo Funil marca a data do retorno e te avisa "
            "dois dias antes de vencer.",
            g.fonte("Medium", 40),
            y + int(g.H * 0.035),
            g.cor_titulo(),
        )

    corpo(draw, g.centrar(topo, base, g.medir(corpo)))
    g.assinar_discreto(img, draw)
    _salvar(img, "1-dor.png")


def lacuna():
    """
    2. A LACUNA, que e o unico numero que nenhum concorrente pode copiar hoje.

    Medido em 09/09 sobre 25 geradores de orcamento — a categoria que este
    cliente de fato procura, e nao "CRM":

        88%  geram o PDF          -> e commodity
        60%  mandam no WhatsApp   -> e o canal, nao o produto
        48%  guardam a validade   -> guardar NAO diferencia
         0%  AVISAM antes de vencer

    O zero e o argumento. Ele vai grande, sozinho, porque um numero que o
    leitor precisa procurar na frase nao e um numero — e um adjetivo.
    """
    img, draw = _quadrado(claro=False)
    topo, base = g.faixa_livre()

    def corpo(d, y):
        y = g.escrever_esq(
            d, "25 sistemas de", g.fonte("Regular", 52), y, g.cor_corpo()
        )
        y = g.escrever_esq(
            d, "orçamento testados.", g.fonte("Regular", 52), y, g.cor_corpo()
        )
        y = g.escrever_esq(
            d, "0", g.fonte("Bold", 210), y + int(g.H * 0.03), g.cor_destaque()
        )
        y = g.escrever_esq(
            d,
            "avisam você antes do prazo vencer.",
            g.fonte("Bold", 52),
            y + int(g.H * 0.005),
            g.cor_titulo(),
        )
        return g.escrever_esq(
            d,
            "Quase todos geram o PDF. Metade guarda a validade. "
            "Nenhum lembra de cobrar.",
            g.fonte("Regular", 36),
            y + int(g.H * 0.045),
            g.cor_corpo(),
        )

    corpo(draw, g.centrar(topo, base, g.medir(corpo)))
    g.assinar_discreto(img, draw)
    _salvar(img, "2-lacuna.png")


def preco():
    """
    3. O PRECO, e o unico jeito de ele virar vantagem.

    O preco antigo, de 49, era fraco porque so ganhava a partir de 4 ou 5
    pessoas — para a marcenaria de dois, o Bitrix24 sai por 22 reais. No preco
    de hoje o argumento so funciona COMPARADO, e a comparacao e o que a peca
    mostra (valores em reais, medidos em 09/09):

        Agendor   59 a 156   POR USUARIO
        Ploomes   85         POR USUARIO
        Velo      o plano    a empresa inteira

    Quatro pessoas: 332 la, um plano so aqui. O numero da tabela faz o
    trabalho que o adjetivo "barato" nao faz.

    ## O fecho de graca, acrescentado em 11/09

    Pedido do dono, e a medicao concorda: a peca mostrava preco e nenhuma
    porta de entrada, obrigando a pessoa a decidir sobre GASTAR antes de ter
    visto o produto rodar. A regra ja estava escrita em `eco-da-peca.ts` desde
    04/09 — diante da decisao, "gratis, sem cartao" vale mais que beneficio.
    """
    img, draw = _quadrado(claro=True)
    topo, base = g.faixa_livre()

    linhas = [
        ("Outro CRM, por usuário", f"R$ {CONTA_DO_CONCORRENTE}/mês", False),
        ("Velo Funil, a empresa toda", f"R$ {g.PRO_PLAN_PRICE}/mês", True),
    ]

    def corpo(d, y):
        y = g.escrever_esq(
            d,
            f"{EQUIPE_POR_EXTENSO} vendedores.",
            g.fonte("Bold", 66),
            y,
            g.cor_titulo(),
        )
        y += int(g.H * 0.05)
        for rotulo, valor, destaque in linhas:
            g.escrever_esq(d, rotulo, g.fonte("Regular", 38), y, g.cor_corpo())
            fnt = g.fonte("Bold", 58)
            cor = g.cor_destaque() if destaque else g.cor_titulo()
            larg = d.textlength(valor, font=fnt)
            d.text((g.W - g.MARGEM_ESQ - larg, y - int(g.H * 0.012)),
                   valor, font=fnt, fill=cor)
            y += int(g.H * 0.095)
        y = g.escrever_esq(
            d,
            "Preço fixo, não por vendedor. Coloque a equipe inteira "
            "sem a conta subir.",
            g.fonte("Medium", 38),
            y + int(g.H * 0.02),
            g.cor_titulo(),
        )
        # ## A porta de entrada fecha a peça, e ela é o que faltava
        #
        # Pedido do dono em 11/09, e a medição concorda: uma peça que mostra
        # SÓ preço faz a pessoa decidir sobre gastar antes de ter visto o
        # produto funcionar. `eco-da-peca.ts` já registra a regra em 04/09 —
        # todo eco repete o removedor de atrito, porque diante da decisão
        # "grátis, sem cartão" vale mais que benefício.
        #
        # E o número sai de `FREE_LEAD_LIMIT`, não da minha memória: a bio do
        # Instagram anunciou "grátis até 300 contatos" por meses depois de o
        # teto virar 50, e é esse defeito que a leitura de `lib/plans.ts`
        # existe para impedir.
        return g.escrever_esq(
            d,
            f"Comece grátis, até {g.FREE_LEAD_LIMIT} contatos, sem cartão.",
            g.fonte("Bold", 40),
            y + int(g.H * 0.045),
            g.cor_destaque(),
        )

    corpo(draw, g.centrar(topo, base, g.medir(corpo)))
    g.assinar_discreto(img, draw)
    _salvar(img, "3-preco.png")


def prova():
    """
    4. A PROVA: o print real, sem uma palavra de promessa.

    Existe para ser comparada com as outras quatro. A tese e que um dono de
    marcenaria decidindo se responde acredita mais no que ele VE funcionando do
    que em qualquer frase — e a unica forma de saber e testar.

    Region do `/hoje` e nao a tela inteira: a regiao util tem ~1100px de CSS, e
    numa coluna de 862px isso da 0,60x, com texto de 14px virando 8,4px. O
    recorte sobe a escala para ~0,89x. O porque inteiro esta em `gerar-feed.py`.
    """
    img, draw = _quadrado(claro=True)
    topo, base = g.faixa_livre()

    y = g.escrever_esq(
        draw,
        "Cada orçamento vira uma tarefa com data.",
        g.fonte("Bold", 56),
        topo,
        g.cor_titulo(),
    )

    feed._print_no_claro(
        img,
        "hoje-light.png",
        topo=y + int(g.H * 0.085),
        # ## A altura é MENOR que o espaço livre, de propósito
        #
        # Com a altura cheia o print entra inteiro — e a tela `/hoje` acaba na
        # terceira lista, então o quinto inferior do card sai BRANCO. Card com
        # vazio dentro lê como render que não terminou de carregar.
        #
        # Cortando, `_print_no_claro` aplica o esmaecimento até o branco da
        # moldura, e a borda que some diz "continua fora do quadro" — que é o
        # que se quer dizer sobre uma lista de tarefas.
        altura_alvo=int(g.H * 0.45),
        recorte=(530, 285, 2200),
    )

    g.assinar_discreto(img, draw)
    _salvar(img, "4-prova.png")


def risco():
    """
    5. O RISCO, que e a dor traduzida em dinheiro.

    A dor da peca 1 e chateacao; esta e prejuizo. O orcamento que vence sem
    retorno nao e neutro — o trabalho de levantar, medir e cotar ja foi feito e
    ja custou.

    Sem numero inventado: nao existe medicao de quanto vale o orcamento medio
    deste ICP, entao a peca fala do que e verdade sem cifra.
    """
    img, draw = _quadrado(claro=False)
    topo, base = g.faixa_livre()

    def corpo(d, y):
        y = g.escrever_esq(
            d, "Orçamento vencido não é", g.fonte("Bold", 70), y, g.cor_titulo()
        )
        y = g.escrever_esq(
            d, "venda perdida.", g.fonte("Bold", 70), y, g.cor_titulo()
        )
        y = g.escrever_esq(
            d,
            "É trabalho que você já fez",
            g.fonte("Bold", 70),
            y + int(g.H * 0.02),
            g.cor_destaque(),
        )
        y = g.escrever_esq(
            d, "e não cobrou.", g.fonte("Bold", 70), y, g.cor_destaque()
        )
        return g.escrever_esq(
            d,
            "Medir, cotar, montar a proposta: tudo isso já custou "
            "antes de o cliente sumir.",
            g.fonte("Regular", 36),
            y + int(g.H * 0.05),
            g.cor_corpo(),
        )

    corpo(draw, g.centrar(topo, base, g.medir(corpo)))
    g.assinar_discreto(img, draw)
    _salvar(img, "5-risco.png")


def main():
    print("\n  Peças de prospecção para o WhatsApp\n")
    dor()
    lacuna()
    preco()
    prova()
    risco()
    print(f"\n  em {SAIDA.relative_to(g.RAIZ)}\n")


if __name__ == "__main__":
    main()
