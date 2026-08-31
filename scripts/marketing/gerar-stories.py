"""
Gera os Stories dos destaques do Instagram, no padrão visual do produto.

    python scripts/marketing/gerar-stories.py

Grava em `marketing/instagram/`, dois arquivos por tela: a versão de
publicação (1080x1920) e uma `@4k` para reaproveitar em feed ou anúncio sem
regerar.

## Por que um script, e não desenhar cada peça à mão

Quinze telas com a mesma assinatura, a mesma zona segura e a mesma escala
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

**A fonte é Geist, a do produto — não a do sistema operacional.** Ver o bloco
"a tipografia" abaixo: até 24/08 estas telas saíam em Segoe UI, o padrão do
Windows, e essa era a causa nº 1 de o conjunto parecer genérico.

**O símbolo da marca é estrutura do fundo, não enfeite.** Ver
`marca_dagua_do_funil`: em escala 2,6× a largura do quadro, sangrando pelos
dois lados, ele dá textura e direção sem se anunciar como logotipo.

**O selo é o do produto, desenhado a partir de `components/branding/logo.tsx`.**
Três camadas convergindo (larguras 18.8 / 10.2 / 2.2 num viewBox de 24) que
lidas juntas formam o funil e a letra V de Velo. Desenhado com polígono em
vez de renderizar o SVG porque este ambiente não tem cairosvg nem svglib, e
trazer dependência nova para desenhar três trapézios custaria mais que o
problema.

**O bloco é medido antes de ser desenhado.** A primeira leva ancorava tudo no
topo e deixava o resto cair onde caísse — a tela de lista terminava em 45% da
altura, com metade do Story vazia. Ver `medir()`: as mesmas funções desenham
num rascunho descartável, devolvem o `y` final, e só então o bloco real é
posicionado. Nenhum `topo_rel` chutado a olho sobreviveria a título de duas,
três ou quatro linhas, que é o que estas telas de fato têm.

**O print sangra pela direita** (`card_com_print`). Encaixá-lo entre as duas
margens deixava o card com 29% da altura e um vazio embaixo. A janela do app
continuando para fora do enquadramento diz que existe mais tela do que cabe
ali — o oposto do que um retângulo inteiro e pequeno comunica.

**A headline descreve exatamente o que o print mostra.** É a regra que faz o
formato "Bold Headline + Product UI" funcionar, e foi por ela que a tela 2
deixou de usar o print de "Hoje": ela promete importar contatos e mostrava
tarefas. Print que não casa com a frase enfraquece as duas coisas.

**A copy sai da landing, nunca é inventada aqui.** Os títulos dos passos são
os mesmos de `components/landing/how-it-works-section.tsx`, que já passaram
pelo PRD de copy sem jargão. Texto novo escrito direto no criativo divergiria
da página no primeiro ajuste que alguém fizesse lá.
"""

import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

# ---------------------------------------------------------------- constantes

ESCALA = 2
W_FINAL, H_FINAL = 1080, 1920
W, H = W_FINAL * ESCALA, H_FINAL * ESCALA

TEAL = (0, 191, 192)      # #00BFC0, --primary
BRANCO = (252, 252, 252)

SEGURO_TOPO = int(H * 0.14)
SEGURO_BASE = int(H * 0.20)

RAIZ = Path(__file__).resolve().parents[2]
SAIDA = RAIZ / "marketing" / "instagram"
PRINTS = RAIZ / "public" / "produto"


# ------------------------------------------------------------------ a oferta
#
# ## Por que a oferta é LIDA de `lib/plans.ts` em vez de escrita aqui
#
# Até 31/08 estas artes traziam a oferta em texto solto, e quatro delas
# anunciavam **"7 dias com o Pro completo"** — o reverse trial que a migration
# 0057 removeu em 29/08. Uma delas, `planos-1-teste.png`, ia além e prometia
# "Contatos e colaboradores ILIMITADOS", que é exatamente a promessa falsa que
# a landing removeu em 23/08: o Free tem teto de 50.
#
# Nada quebrou, porque imagem não compila. As artes ficaram prontas no disco
# esperando publicação, e teriam anunciado uma oferta morta para os 10 mil
# seguidores do perfil.
#
# É a terceira vez que esta classe aparece neste projeto — a bio do Instagram
# vendendo "300 contatos" meses depois do Free virar 50, os prints da landing
# mostrando o vocabulário que a própria página baniu, e agora os Stories.
# O que as três têm em comum: texto de marca que vive FORA do alcance de
# `tsc`, `lint` e `test`.
#
# Ler daqui protege contra mudança de VALOR. Não protege contra mudança de
# OFERTA — se o conceito inteiro sumir de novo, a interpolação continua
# funcionando e vira mentira em silêncio. Por isso existe também
# `oferta_test.py`, que PROÍBE as palavras da oferta aposentada em vez de
# conferir o número da vigente.
def _constante_de_plans(nome: str) -> int:
    """Lê um `export const NOME = <int>` de `lib/plans.ts`.

    Regex e não parser de TypeScript de propósito: são cinco constantes
    numéricas simples, e trazer uma dependência para ler cinco inteiros
    custaria mais do que o problema que resolve. Se a linha mudar de forma,
    o `KeyError` estoura na geração — alto, que é onde se quer o erro.
    """
    fonte = (RAIZ / "lib" / "plans.ts").read_text(encoding="utf-8")
    achado = re.search(rf"export const {nome}\s*=\s*(\d+)", fonte)
    if not achado:
        raise KeyError(f"{nome} não encontrado em lib/plans.ts")
    return int(achado.group(1))


FREE_LEAD_LIMIT = _constante_de_plans("FREE_LEAD_LIMIT")
PRO_PLAN_PRICE = _constante_de_plans("PRO_PLAN_PRICE")

#: A oferta vigente, numa frase. Usada onde a arte precisa dizer o que custa.
OFERTA_CURTA = f"Grátis até {FREE_LEAD_LIMIT} contatos, sem cartão."

#: A oferta com o preço do Pro. `pela empresa inteira` não é enfeite: é a
#: única vantagem que nenhum concorrente mapeado tem, e some se for cortada.
OFERTA_COMPLETA = (
    f"Grátis até {FREE_LEAD_LIMIT} contatos, sem cartão. "
    f"R$ {PRO_PLAN_PRICE} por mês pela empresa inteira."
)

#: Preço por usuário dos CRMs que cobram por vendedor — mediana de tabela
#: PÚBLICA, não o nosso preço, e por isso não sai de `lib/plans.ts`. Fica
#: nomeado porque aparece em três peças e a conta de cinco pessoas é derivada
#: dele: escrito à mão nos três lugares, bastaria corrigir dois para a arte
#: passar a mentir sozinha.
PRECO_POR_USUARIO = 53

#: O domínio, sempre canônico. Sem `www` custa 980ms contra 255ms, medido em
#: 25/08 — é um redirecionamento a mais para quem digita o que leu na arte.
SITE_CANONICO = "www.velofunil.com.br"

# ------------------------------------------------------------ a tipografia
#
# **A fonte é a do produto, não a do sistema operacional.** Até 24/08 estas
# telas saíam em Segoe UI — a fonte padrão do Windows. Nada identifica menos
# uma marca do que o tipo que já vem instalado na máquina de quem desenhou: é
# o default absoluto, e ele aparece em qualquer slide de qualquer empresa.
#
# `app/fonts/GeistVF.woff` é a MESMA fonte que o produto e a landing servem
# (`app/layout.tsx`), e o Pillow abre WOFF direto — nenhuma dependência nova.
# Sendo variável, ela traz nove pesos (Thin a UltraBlack) onde antes havia
# dois. Isso importa mais do que parece: com só `bold` e `regular`, todo bloco
# ou grita ou sussurra, e a hierarquia interna do texto tem que ser feita no
# TAMANHO. Com peso de verdade, "82%" pode ser UltraBlack sem virar gigante, e
# a etiqueta de categoria pode ser Medium sem sumir.

GEIST = str(RAIZ / "app" / "fonts" / "GeistVF.woff")

# ## A serifada itálica, e por que ela vive no repositório
#
# A Geist é variável e expõe só PESOS — Thin a UltraBlack, conferido em 31/08.
# Não tem itálico, e nenhum peso substitui um: o que a itálica traz é contraste
# de FORMA, que é o que faz uma palavra saltar dentro de uma frase sem precisar
# de outra cor.
#
# Ela entra por causa do modelo de carrossel: a palavra-chave do gancho ganha
# desenho próprio, em vez de só mudar de tom. É o mesmo recurso que o
# @ploomescrm usa em "mais leads" e "uma tela" — a estrutura vale, e a
# execução aqui é outra (fonte diferente, cor da nossa marca).
#
# **No repositório, e não em `C:\Windows\Fonts`.** Georgia e Constantia
# existem nesta máquina e não na próxima: o gerador passaria a produzir arte
# diferente conforme onde roda, e o `@4k` de reserva deixaria de bater com o
# arquivo publicado. `GeistVF.woff` já é versionado ao lado; esta segue o mesmo
# caminho. Instrument Serif, licença OFL.
SERIFA_ITALICA = str(RAIZ / "app" / "fonts" / "InstrumentSerif-Italic.ttf")

_SERIFA: dict[int, ImageFont.FreeTypeFont] = {}


def italica(tamanho: int) -> ImageFont.FreeTypeFont:
    """
    A serifada itálica, no tamanho pedido (em pixels do arquivo final).

    Cache por tamanho pelo mesmo motivo de `fonte()`: evita reabrir o arquivo a
    cada palavra. Aqui não há chave de peso porque a família tem um corte só —
    e é justamente isso que a torna previsível.
    """
    if tamanho not in _SERIFA:
        _SERIFA[tamanho] = ImageFont.truetype(SERIFA_ITALICA, tamanho * ESCALA)
    return _SERIFA[tamanho]

# Os pesos, pelo papel que cada um cumpre — não pelo número, que não diz nada
# a quem lê a chamada.
DISPLAY = "UltraBlack"   # o número que domina a tela
TITULO = "Bold"          # headline
FORTE = "SemiBold"       # trecho em destaque dentro de uma frase
ROTULO = "Medium"        # etiqueta de categoria, marca no rodapé
CORPO = "Regular"        # texto de apoio

_FONTES: dict[tuple[str, int], ImageFont.FreeTypeFont] = {}


def fonte(peso: str, tamanho: int) -> ImageFont.FreeTypeFont:
    """
    Geist no peso pedido. Tamanho em pixels do arquivo FINAL — a escala do
    supersampling é aplicada aqui, num lugar só.

    O cache não é otimização prematura: `set_variation_by_name` MUTA o objeto
    da fonte, então dois usos do mesmo tamanho em pesos diferentes trocariam o
    peso um do outro se o objeto fosse compartilhado sem chave de peso. O bug
    seria silencioso — o texto sai, só que no peso errado.
    """
    chave = (peso, tamanho)
    if chave not in _FONTES:
        f = ImageFont.truetype(GEIST, tamanho * ESCALA)
        f.set_variation_by_name(peso)
        _FONTES[chave] = f
    return _FONTES[chave]


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


def salvar(img, nome):
    final = img.resize((W_FINAL, H_FINAL), Image.LANCZOS)
    final.save(SAIDA / f"{nome}.png")
    img.save(SAIDA / f"{nome}@4k.png")
    print(f"  {nome}.png  ({final.width}x{final.height})  +  @4k")


# ------------------------------------------------------------- o manifesto
#
# A Central do Dono precisa saber em QUAL destaque cada tela entra e em que
# ordem — subir "planos-4" antes de "planos-2" quebra a leitura de quem abre
# o destaque, e o Instagram exibe na ordem em que os Stories foram postados.
#
# Esse mapa é escrito aqui, e não digitado na tela, porque aqui é onde a copy
# de fato vive: um título mudado no criativo e não no painel viraria duas
# versões da mesma frase, e a versão errada é sempre a que alguém lê.

MANIFESTO: list[dict] = []
_DESTAQUE_ATUAL: dict | None = None


def abrir_destaque(identificador, nome, resumo):
    global _DESTAQUE_ATUAL, _LUZ_ATUAL
    _LUZ_ATUAL = LUZ_DO_DESTAQUE.get(identificador, 0.30)
    _DESTAQUE_ATUAL = {"id": identificador, "nome": nome, "resumo": resumo,
                       "telas": []}
    MANIFESTO.append(_DESTAQUE_ATUAL)
    print(f"\n{nome.upper()}")


def registrar(arquivo, titulo, layout):
    if _DESTAQUE_ATUAL is None:
        raise RuntimeError("registrar() antes de abrir_destaque()")
    _DESTAQUE_ATUAL["telas"].append({
        "ordem": len(_DESTAQUE_ATUAL["telas"]) + 1,
        "arquivo": f"{arquivo}.png",
        "arquivo4k": f"{arquivo}@4k.png",
        "titulo": titulo,
        "layout": layout,
    })


def gravar_manifesto():
    """
    Grava o mapa e copia as telas para onde a Central as serve.

    A cópia acontece aqui, e não à mão, pelo mesmo motivo de sempre neste
    projeto: passo manual entre gerar e publicar é passo que um dia não é
    dado, e a tela some do painel sem ninguém entender por quê. `criativos/`
    está fora do Git de propósito (ver `lib/dono/criativos.ts`).
    """
    import json
    import shutil

    (SAIDA / "destaques.json").write_text(
        json.dumps({"destaques": MANIFESTO}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    painel = RAIZ / "criativos" / "organico"
    painel.mkdir(parents=True, exist_ok=True)
    copiadas = 0
    for destaque in MANIFESTO:
        for tela in destaque["telas"]:
            for chave in ("arquivo", "arquivo4k"):
                shutil.copy2(SAIDA / tela[chave], painel / tela[chave])
                copiadas += 1

    total = sum(len(d["telas"]) for d in MANIFESTO)
    print(f"\ndestaques.json: {len(MANIFESTO)} destaques, {total} telas")
    print(f"copiadas para criativos/organico/: {copiadas} arquivos")


# ================================================================ os layouts
#
# ## O que mudou depois de auditar os Stories do Agendor (24/08)
#
# Três telas reais deles foram lidas lado a lado com as nossas, e quatro
# técnicas explicam por que as deles parecem mais acabadas:
#
# 1. **A cor de marca domina o fundo.** Eles usam o azul da marca em tela
#    cheia; nós usávamos preto neutro, que não identifica ninguém. Adotado com
#    uma diferença: o teal do produto (#00BFC0) é claro demais para receber
#    texto branco, então entra a versão ESCURA dele como base. Mantém o modo
#    escuro — que é a identidade do produto e da landing — e ainda assim
#    marca a peça como nossa antes de qualquer leitura.
#
# 2. **O print vive num card com respiro, reto.** O nosso entrava inclinado em
#    perspectiva, sangrando pela borda. Bonito, mas a versão reta com padding
#    lê melhor: o conteúdo da tela fica legível, e o card comunica "isto é um
#    software" sem precisar do truque 3D.
#
# 3. **Pill de categoria no topo.** Eles abrem com "Para vendedores" numa
#    cápsula. É contexto em um segundo, antes da headline. Nós tínhamos só um
#    eyebrow espaçado, que some no meio do fundo.
#
# 4. **Lista alinhada à esquerda, com marcadores.** Tudo centralizado — que era
#    o nosso caso — atrapalha justamente onde a informação é enumerada: o olho
#    perde a coluna de retorno a cada linha.
#
# O que NÃO foi copiado: a paleta clara e o azul vibrante. Copiar a cor de um
# concorrente é o caminho mais curto para parecer a versão barata dele.

FUNDO_MARCA = (4, 32, 33)      # teal escuro: a cor da marca, legível como base
CARD = (18, 20, 21)            # superfície do card, um degrau acima do fundo
BORDA_CARD = (42, 46, 48)


def marca_dagua_do_funil(img, forca=0.055):
    """
    O símbolo da marca em escala gigante, sangrando pelo canto direito.

    ## Por que existe

    O fundo era uma chapa com um halo, igual nas vinte telas — passar o
    destaque era ver a mesma imagem cinco vezes. E o símbolo do funil, que é a
    marca, só aparecia a 26px no rodapé: uma forma forte sem nenhum uso.

    Aqui ele vira ESTRUTURA, não enfeite. Três camadas convergindo é a
    geometria do produto (um funil de vendas), e em escala grande ela dá
    textura ao fundo sem competir com o texto — o que resolve as duas coisas
    de uma vez.

    ## Por que tão fraco

    5,5% de opacidade parece pouco escrito, e é exatamente o ponto: a régua de
    SaaS B2B é restrição. Marca-d'água legível vira ruído atrás da headline e
    é o erro mais comum do gênero. Ela tem que ser sentida, não lida — quem
    olhar direto percebe o funil; quem só passar sente que o fundo tem
    profundidade e não sabe dizer por quê.

    Sangra pela direita porque a esquerda é a coluna de leitura: todo texto
    destas telas começa em `MARGEM_ESQ`, e a forma cruzando essa coluna
    disputaria com a primeira palavra de cada linha.
    """
    ## Por que ENORME e cortado, e não inteiro num canto

    # A primeira tentativa colocou o símbolo inteiro, em tamanho pouco maior
    # que a largura da tela. Não leu como marca-d'água: leu como mancha. Um
    # símbolo inteiro e reconhecível num canto é adesivo, e a boca do funil —
    # o trapézio mais largo — virava uma faixa diagonal solta no fundo, que o
    # olho classifica como artefato de render.
    #
    # Em escala muito maior, sangrando pelos dois lados, nenhuma das três
    # camadas cabe no quadro por inteiro: o que sobra são arestas que dão
    # direção e textura ao fundo sem se anunciarem como logotipo. É a mesma
    # lógica do card do print sangrando — forma cortada sugere continuação,
    # forma inteira e pequena vira selo.
    lado = int(W * 2.6)
    camada = Image.new("RGBA", (lado, lado), (0, 0, 0, 0))
    d = ImageDraw.Draw(camada)

    u = lado / 24.0                       # 1 unidade do viewBox 24 do símbolo
    tinta = (*TEAL, int(255 * forca))

    def P(x, y):
        return (x * u, y * u)

    d.polygon([P(2.6, 4.4), P(21.4, 4.4), P(18.9, 8.76), P(5.1, 8.76)], fill=tinta)
    d.polygon([P(6.9, 10.6), P(17.1, 10.6), P(14.98, 14.9), P(9.02, 14.9)], fill=tinta)
    d.polygon([P(10.9, 16.6), P(13.1, 16.6), P(12.0, 19.5)], fill=tinta)

    # Desfoque leve: aresta perfeitamente nítida a 5% de opacidade é o que
    # denuncia a forma como elemento colado. Com a borda suave ela se comporta
    # como luz na superfície, que é o que o fundo já faz nos halos.
    camada = camada.filter(ImageFilter.GaussianBlur(6 * ESCALA))

    img.paste(camada, (int(-W * 0.30), int(-H * 0.16)), camada)
    return img


# Cada destaque ancora o halo num ponto diferente. Não é variar por variar: o
# Instagram exibe os Stories de um destaque em sequência, então a repetição
# aparece dentro de UM destaque, não entre eles — e a mesma luz nas cinco telas
# seguidas é o que faz o conjunto parecer uma imagem só, repetida.
LUZ_DO_DESTAQUE = {
    "demo": 0.30,
    "planos": 0.44,
    "dicas": 0.22,
    # Mais escuro que "planos" e mais claro que "dicas": o destaque de
    # perguntas é lido depois dos dois, e repetir a luz de um deles faria a
    # sequência inteira parecer um bloco só ao passar rápido.
    "perguntas": 0.26,
}
_LUZ_ATUAL = 0.30


def fundo_marca(escuro_extra=0.0):
    """
    Base na cor da marca, não em preto neutro, com duas fontes de luz.

    Um halo só deixava o degradê previsível — claro em cima, escuro embaixo,
    como qualquer template. Com uma segunda luz, menor e deslocada, o fundo
    ganha direção: a claridade não desce em linha reta, ela vem de um lugar.
    É o mesmo princípio do `glow-radial` da landing, com uma camada a mais.
    """
    img = Image.new("RGB", (W, H), FUNDO_MARCA)

    halo = Image.new("RGB", (W, H), FUNDO_MARCA)
    hd = ImageDraw.Draw(halo)
    centro = _LUZ_ATUAL
    hd.ellipse([-W * 0.3, H * (centro - 0.52), W * 1.3, H * (centro + 0.22)],
               fill=(0, 78, 79))
    # A segunda luz é menor e mais fria, à direita: dá a direção que uma
    # elipse centralizada sozinha não consegue dar.
    hd.ellipse([W * 0.45, H * (centro + 0.02), W * 1.5, H * (centro + 0.46)],
               fill=(0, 92, 94))
    halo = halo.filter(ImageFilter.GaussianBlur(200 * ESCALA))
    img = Image.blend(img, halo, 0.62)

    img = marca_dagua_do_funil(img)

    if escuro_extra:
        preto = Image.new("RGB", (W, H), (6, 14, 15))
        img = Image.blend(img, preto, escuro_extra)
    return img


def pill(draw, texto, y, x=None):
    """
    Cápsula de categoria, no topo da tela.

    Contexto em um segundo, antes da headline — quem abre o Story sabe do que
    se trata sem ler a frase inteira.

    ## O que mudou, e por quê

    A primeira versão era um retângulo preto chapado com texto teal. Lia como
    etiqueta colada: a forma não pertencia ao resto da peça, porque nada mais
    na tela é preto puro — o fundo é teal escuro e o card do print tem borda.

    Três correções, todas emprestadas do próprio produto:

    **Contorno em vez de bloco.** A cápsula ganha uma borda teal a baixa
    opacidade e um preenchimento quase transparente, que é como o `Badge` do
    shadcn se comporta no tema escuro. Contorno delimita sem pesar; bloco
    preto disputa contraste com a headline que vem logo abaixo.

    **Sem marcador dentro.** Havia um ponto teal antes do texto, emprestado
    dos indicadores do Kanban. Ele saiu em 30/08 por pedido do dono: num
    criativo de rede social o ponto não codifica estado nenhum — ali não há
    item para estar ativo ou parado —, então ele era enfeite, e enfeite dentro
    de uma etiqueta é o que faz uma peça parecer template.

    **O espaço do ponto saiu junto com o ponto.** Manter o recuo produziria
    uma cápsula com vão à esquerda e o texto empurrado, que lê como imagem que
    não carregou — pior do que o ponto que se queria remover.

    **Caixa alta com tracking.** Rótulo em corpo baixo compete com a headline
    pela mesma leitura; em maiúsculas espaçadas ele vira sinalização, não
    frase. É o padrão que a landing usa nos eyebrows de seção.
    """
    texto = texto.upper()
    fnt = fonte(ROTULO, 26)
    tracking = 3.2 * ESCALA

    # ## A cápsula saiu. Sobrou o rótulo. — 31/08
    #
    # Havia um retângulo arredondado com borda teal em volta do texto. Saiu por
    # pedido do dono, que o apontou duas vezes com uma palavra só: não é
    # profissional.
    #
    # Ele tem razão, e dá para dizer por quê. Pílula com contorno é o vocabulário
    # de INTERFACE — `Badge` do shadcn, tag, chip —, onde a forma existe para
    # delimitar um elemento clicável no meio de outros. Num criativo não há
    # outro elemento: o rótulo já está sozinho no topo, sobre fundo vazio, e a
    # borda não separa de nada. Ela só acrescenta uma forma que o olho precisa
    # processar antes de chegar ao número, que é o que importa.
    #
    # E é a marca registrada do template: a régua que este projeto persegue —
    # Linear, Stripe, Vercel — usa eyebrow em caixa alta com tracking e mais
    # nada. O espaçamento entre letras já faz o trabalho de dizer "isto é
    # rótulo, não frase", que é a única função que a cápsula tinha.
    #
    # O recuo horizontal saiu junto com a borda, pelo mesmo motivo que o ponto
    # levou o dele em 30/08: mantido, empurraria o rótulo para dentro enquanto
    # todo o resto da peça começa em `MARGEM_ESQ`, e a coluna de leitura
    # perderia o alinhamento — que é justamente o que faz a composição parecer
    # cuidada.
    pad_y = 17 * ESCALA
    alt = fnt.size + pad_y * 2
    if x is None:
        x = MARGEM_ESQ

    # Letra a letra: o Pillow não tem `letter-spacing`, e escrever a string
    # inteira devolveria o rótulo sem o espaçamento que o faz ler como
    # sinalização.
    tx = x
    ty = y + pad_y - 2 * ESCALA
    for letra in texto:
        draw.text((tx, ty), letra, font=fnt, fill=(150, 236, 236))
        tx += draw.textlength(letra, font=fnt) + tracking

    return y + alt


MARGEM_ESQ = int(W * 0.09)
LARGURA_TEXTO = int(W * 0.82)


def escrever_esq(draw, texto, fnt, y, cor, largura_max=None, entrelinha=1.16):
    """
    Escreve alinhado à esquerda.

    Título e lista ficam à esquerda porque é onde o olho volta a cada linha;
    centralizar enumeração faz cada item começar num ponto diferente e custa
    leitura. Centralizado continua existindo (`escrever`) para as telas de
    número e de fechamento, onde há uma frase só.
    """
    if largura_max is None:
        largura_max = LARGURA_TEXTO
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
        draw.text((MARGEM_ESQ, y), linha, font=fnt, fill=cor)
        y += fnt.size * entrelinha
    return y


def escrever_com_realce(draw, partes, fnt, fnt_realce, y, cor, cor_realce,
                        largura_max=None, entrelinha=1.16):
    """
    Escreve uma frase em que ALGUMAS palavras estão em outra fonte e cor.

    `partes` é uma lista de `(texto, realce)`:

        [("Você comprou um CRM. Quem ", False), ("alimenta", True),
         (" ele?", False)]

    ## Por que uma função, e não duas chamadas de `escrever_esq`

    A quebra de linha precisa enxergar a frase INTEIRA. Escrever o trecho
    normal, medir onde parou e emendar o itálico funcionaria enquanto a troca
    caísse no meio de uma linha — e sairia torto no dia em que a palavra
    realçada caísse na virada. Que é justamente onde ela tende a cair: é a
    palavra mais longa e a mais importante da frase.

    Aqui cada palavra carrega a própria fonte, e a medição soma palavra a
    palavra. A linha vira uma sequência de pedaços, cada um desenhado com o seu
    tipo, na posição que o anterior deixou.

    ## O espaço vive ENTRE as palavras, não dentro delas

    O texto é quebrado por `split()`, que descarta os espaços, e eles voltam na
    hora de desenhar — medidos na fonte da palavra que vem ANTES. Medir na
    fonte errada desalinha a linha inteira por alguns pixels, e o erro só
    aparece na arte pronta.
    """
    if largura_max is None:
        largura_max = LARGURA_TEXTO

    palavras = [
        (palavra, realce)
        for texto, realce in partes
        for palavra in texto.split()
    ]

    def largura(palavra, realce):
        return draw.textlength(palavra, font=fnt_realce if realce else fnt)

    def largura_espaco(realce):
        return draw.textlength(" ", font=fnt_realce if realce else fnt)

    # Monta as linhas medindo com a fonte de cada palavra.
    linhas, atual, larg_atual = [], [], 0.0
    for palavra, realce in palavras:
        w = largura(palavra, realce)
        espaco = largura_espaco(realce) if atual else 0
        if atual and larg_atual + espaco + w > largura_max:
            linhas.append(atual)
            atual, larg_atual = [(palavra, realce)], w
        else:
            atual.append((palavra, realce))
            larg_atual += espaco + w

    if atual:
        linhas.append(atual)

    # A altura da linha vem da fonte MAIOR das duas: a itálica costuma ter
    # corpo diferente da sans no mesmo tamanho nominal, e usar só uma das duas
    # faria linhas com realce encostarem na de baixo.
    altura = max(fnt.size, fnt_realce.size) * entrelinha

    for linha in linhas:
        x = MARGEM_ESQ
        for i, (palavra, realce) in enumerate(linha):
            f = fnt_realce if realce else fnt
            if i:
                x += draw.textlength(" ", font=f)
            draw.text((x, y), palavra, font=f,
                      fill=cor_realce if realce else cor)
            x += draw.textlength(palavra, font=f)
        y += altura

    return y


def card_com_print(img, nome_print, topo, altura_alvo):
    """
    O print dentro de um card que SANGRA pela direita, preenchendo a altura.

    Encaixar a tela inteira dentro das duas margens deixava o card com 29% da
    altura do Story e um vazio embaixo dele — o defeito que a primeira leva de
    telas mostrou. Aqui o card começa na margem esquerda e continua para fora
    do quadro: o print cresce até ocupar toda a faixa livre, e o que passa da
    borda direita é cortado pelo próprio limite da imagem.

    Sangrar não é só preencher espaço. A janela do app continuando para fora
    do enquadramento diz que existe mais tela do que cabe ali, que é o oposto
    do que um retângulo inteiro e pequeno comunica.
    """
    # Luz atrás do card, restrita à faixa do card.
    #
    # Profundidade por LUZ, não por sombra: sobre fundo escuro, sombra preta
    # não aparece — é a mesma razão pela qual o tema claro do produto ganhou
    # sombra no cartão e o escuro teve a regra anulada. A landing resolve isso
    # com `glow-radial`, e é esse o efeito reproduzido aqui.
    #
    # **A faixa não é detalhe de implementação, é a correção de um defeito.**
    # A primeira versão fazia o blend na imagem INTEIRA, e como a headline é
    # desenhada ANTES do card, o brilho passava por cima dela: o branco virava
    # cinza-esverdeado e a tela inteira parecia desbotada. Mesmo defeito que
    # esta sessão já tinha pago uma vez, por composição fora de ordem. Recortar
    # a faixa abaixo do texto torna impossível repetir — o que está acima de
    # `topo` não é alcançável daqui.
    faixa_topo = int(topo)
    if faixa_topo < H:
        faixa = img.crop((0, faixa_topo, W, H))
        brilho = Image.new("RGB", (W, H - faixa_topo), (0, 0, 0))
        ImageDraw.Draw(brilho).ellipse(
            [MARGEM_ESQ - W * 0.12, -H * 0.03, W * 1.15, altura_alvo * 0.75],
            fill=(0, 96, 98),
        )
        brilho = brilho.filter(ImageFilter.GaussianBlur(120 * ESCALA))
        img.paste(Image.blend(faixa, brilho, 0.26), (0, faixa_topo))

    origem = Image.open(PRINTS / nome_print).convert("RGB")
    pad = 14 * ESCALA

    # A largura vem da ALTURA disponível, não do contrário: é a altura que
    # está sobrando, e a proporção do print decide o resto.
    larg_minima = W - MARGEM_ESQ * 2
    larg_interna = int(origem.width * (altura_alvo - pad * 2) / origem.height)
    larg_interna = max(larg_minima - pad * 2, min(larg_interna, int(larg_minima * 1.9)))

    alt_interna = int(origem.height * larg_interna / origem.width)
    origem = origem.resize((larg_interna, alt_interna), Image.LANCZOS)

    # Clareia: o print é escuro por natureza e some sobre a base da marca.
    origem = ImageEnhance.Brightness(origem).enhance(1.42)
    origem = ImageEnhance.Contrast(origem).enhance(1.10)

    # Sobrou altura depois do teto de ampliação? Corta pela base — a barra
    # lateral e o topo do app, que é o que identifica a tela, ficam.
    if alt_interna > altura_alvo - pad * 2:
        alt_interna = int(altura_alvo - pad * 2)
        origem = origem.crop((0, 0, larg_interna, alt_interna))

        # O corte caía no meio de uma linha da tabela, e meia linha de texto
        # não lê como "continua", lê como render quebrado. Esmaecer os
        # últimos pixels resolve pela percepção: borda dura afirma que ali
        # acaba a tela; borda que some diz que ela segue fora do quadro.
        fade = min(110 * ESCALA, alt_interna // 3)
        base = Image.new("RGB", (larg_interna, fade), CARD)
        rampa = Image.new("L", (1, fade))
        rampa.putdata([int(255 * (i / max(fade - 1, 1)) ** 1.5) for i in range(fade)])
        rampa = rampa.resize((larg_interna, fade))
        recorte = origem.crop((0, alt_interna - fade, larg_interna, alt_interna))
        origem.paste(Image.composite(base, recorte, rampa), (0, alt_interna - fade))

    largura_card = larg_interna + pad * 2
    altura_card = alt_interna + pad * 2
    card = Image.new("RGB", (largura_card, altura_card), CARD)
    cd = ImageDraw.Draw(card)
    cd.rounded_rectangle([0, 0, largura_card - 1, altura_card - 1],
                         radius=20 * ESCALA, outline=BORDA_CARD, width=2 * ESCALA)
    card.paste(origem, (pad, pad))

    # Máscara de canto arredondado, para o card não ter quina quadrada por cima
    # do fundo colorido.
    mascara = Image.new("L", (largura_card, altura_card), 0)
    ImageDraw.Draw(mascara).rounded_rectangle(
        [0, 0, largura_card - 1, altura_card - 1], radius=20 * ESCALA, fill=255
    )
    img.paste(card, (MARGEM_ESQ, int(topo)), mascara)
    return topo + altura_card


def assinar_discreto(img, draw):
    """
    Assinatura no rodapé: selo, marca e endereço, sobre um filete.

    ## Duas correções de escala, em sentidos opostos

    A versão anterior encolheu por reação: o lockup original era grande e
    centralizado e competia com o conteúdo, então virou selo de 52px com texto
    de 32. Passou do ponto — em 1080px de largura, num aplicativo visto a
    braço estendido, 32px é o corpo de uma legenda, e a marca sumia. O
    endereço, que é a ÚNICA forma de alguém chegar ao produto (destaque de
    Instagram não tem link clicável), era o texto mais apagado da peça.

    Agora selo de 66px e texto de 38, com o endereço no mesmo peso da marca em
    vez de dois degraus abaixo. Continua discreta — ocupa a faixa que a zona
    segura do Meta já reserva —, mas é legível sem esforço, que é o mínimo
    para o que precisa ser lido e digitado depois.

    **O filete acima resolve o que o tamanho sozinho não resolvia.** Sem ele a
    assinatura flutuava no vazio da base e parecia sobra de composição. Uma
    linha de 1px atravessando a largura útil, num teal quase apagado, fecha a
    peça: transforma o rodapé em rodapé em vez de "coisas soltas embaixo".
    """
    y_linha = H - SEGURO_BASE + 20 * ESCALA
    draw.line([(MARGEM_ESQ, y_linha), (W - MARGEM_ESQ, y_linha)],
              fill=(0, 74, 76), width=max(1, int(1.5 * ESCALA)))

    # ## A assinatura é TIPOGRÁFICA, sem o selo — decisão de 31/08
    #
    # Até aqui o rodapé colava `desenhar_selo()`: um quadrado teal com as três
    # camadas do funil dentro. Pedido do dono, olhando a peça pronta: tirar o
    # ícone.
    #
    # A leitura dele tem fundamento, e é a mesma que este projeto já aplicou
    # em outro lugar. O funil dentro do quadrado é lido como forma dentro de
    # forma — em 66px, a três metros, as três barras não se resolvem como
    # funil, e o que sobra é um bloco com algo indistinto dentro. Marca que
    # precisa de lupa para ser reconhecida não está identificando nada; está
    # ocupando espaço e chamando atenção para si.
    #
    # É o mesmo raciocínio da decisão travada para e-mail transacional ("Logo
    # do e-mail é tipografia, não imagem"), por motivo diferente mas com o
    # mesmo desfecho: o nome escrito identifica melhor que o símbolo pequeno.
    #
    # O símbolo NÃO sai da marca — ele continua na marca-d'água do fundo, a
    # 5,5%, onde tem escala para funcionar como estrutura em vez de enfeite. O
    # que sai é a repetição dele em miniatura no canto.
    #
    # Vale para Story E feed de propósito: `gerar-feed.py` importa esta
    # função. Duas assinaturas diferentes fariam as duas famílias divergirem
    # na primeira manutenção — o defeito que a cápsula já pagou neste mesmo
    # arquivo, quando existiam duas cópias de `pill()`.
    fnt_b, fnt_r = fonte(FORTE, 38), fonte(CORPO, 38)
    x = MARGEM_ESQ
    y = y_linha + 40 * ESCALA
    tam = 66 * ESCALA                     # a altura da faixa, que o selo dava
    y_txt = y + (tam - fnt_b.size) / 2 - 3 * ESCALA
    lv = draw.textlength("Velo ", font=fnt_b)
    draw.text((x, y_txt), "Velo ", font=fnt_b, fill=BRANCO)
    draw.text((x + lv, y_txt), "Funil", font=fnt_r, fill=(150, 172, 172))

    # O endereço é o call-to-action da peça, não um crédito de rodapé: sem ele
    # o Story prova o produto e não diz onde encontrá-lo. Ganha a cor da marca
    # em vez do cinza mais apagado da paleta.
    fnt_site = fonte(ROTULO, 36)
    site = SITE_CANONICO
    draw.text((W - MARGEM_ESQ - draw.textlength(site, font=fnt_site), y_txt),
              site, font=fnt_site, fill=(122, 214, 214))


# -------------------------------------------------- medir antes de desenhar

_RASCUNHO = None


def medir(desenhar) -> float:
    """
    Roda o bloco num rascunho descartável só para saber a altura dele.

    A primeira leva de telas ancorava tudo no topo e deixava o resto cair onde
    caísse: a tela de lista terminava em 45% da altura, com metade do Story
    vazia. Não dá para centralizar sem saber a altura, e não dá para saber a
    altura sem quebrar as linhas — que é trabalho de `ImageDraw`. Daí a
    passada seca: as MESMAS funções desenham num rascunho, devolvem o y final,
    e só então o bloco real é posicionado. Uma cópia só da composição.
    """
    global _RASCUNHO
    if _RASCUNHO is None:
        _RASCUNHO = Image.new("RGB", (W, H))
    return desenhar(ImageDraw.Draw(_RASCUNHO), 0.0)


def faixa_livre():
    """
    Onde o conteúdo pode viver: entre as duas zonas seguras do Meta.

    A cápsula NÃO é âncora de topo, é a primeira linha do bloco, e desce
    junto com ele. Fixá-la no alto deixava uma etiqueta solta a 14% da altura
    e o título só a 33%, com um vão morto entre os dois que lia como erro de
    montagem — e a etiqueta existe justamente para dizer do que o título
    trata, o que só funciona colada nele.
    """
    return SEGURO_TOPO + 20 * ESCALA, H - SEGURO_BASE - 30 * ESCALA


def centrar(topo, base, altura):
    """
    Centro óptico, não geométrico: 42% do vão sobra em cima, 58% embaixo.

    O olho lê um bloco como "centrado" quando ele está um pouco ACIMA da
    metade — e aqui a assinatura no rodapé já pesa para baixo. Meio exato
    deixaria a tela com cara de caída.
    """
    return topo + max(0.0, (base - topo - altura) * 0.42)


# ---------------------------------------------------------------- as telas


def tela_produto(categoria, titulo, apoio, print_nome, arquivo, destaque=None):
    """
    Headline à esquerda, print sangrando pela direita logo abaixo.

    Aqui o bloco NÃO é centrado: o texto fica no topo e o card come toda a
    faixa que sobra até a assinatura. É o formato que mais converte em anúncio
    B2B SaaS ("Bold Headline + Product UI"), e ele depende de o print ser
    grande — centralizar sobraria vão em cima e embaixo do card.
    """
    img = fundo_marca()
    draw = ImageDraw.Draw(img)
    topo, base = faixa_livre()

    def texto(d, y):
        y = pill(d, categoria, y) + 46 * ESCALA
        y = escrever_esq(d, titulo, fonte(TITULO, 72), y, BRANCO)
        if apoio:
            y += 22 * ESCALA
            y = escrever_esq(d, apoio, fonte(CORPO, 38), y, (168, 190, 190),
                             entrelinha=1.34)
        if destaque:
            y += 20 * ESCALA
            y = escrever_esq(d, destaque, fonte(FORTE, 54), y, TEAL)
        return y

    y = texto(draw, topo) + 54 * ESCALA
    card_com_print(img, print_nome, y, altura_alvo=base - y)

    assinar_discreto(img, draw)
    salvar(img, arquivo)
    registrar(arquivo, titulo, "produto")


def tela_lista(categoria, titulo, itens, arquivo):
    """
    Título e uma lista com marcadores.

    Formato tirado direto da referência: cada item ganha um marcador circular
    na cor da marca, e a parte que importa vem em peso maior dentro da própria
    frase — hierarquia sem precisar de outra linha.
    """
    img = fundo_marca()
    draw = ImageDraw.Draw(img)
    topo, base = faixa_livre()

    fnt = fonte(CORPO, 42)
    fnt_forte = fonte(FORTE, 42)
    raio = 15 * ESCALA
    recuo = MARGEM_ESQ + 56 * ESCALA
    larg = W - recuo - MARGEM_ESQ

    def bloco(d, y):
        y = pill(d, categoria, y) + 46 * ESCALA
        y = escrever_esq(d, titulo, fonte(TITULO, 76), y, BRANCO)
        y += 64 * ESCALA

        for texto, forte in itens:
            cx, cy = MARGEM_ESQ + raio, y + fnt.size * 0.55
            d.ellipse([cx - raio, cy - raio, cx + raio, cy + raio], fill=TEAL)

            # Quebra manual respeitando o trecho em destaque: medir a frase
            # inteira e só depois decidir onde cortar evita que a palavra
            # forte fique órfã numa linha só dela.
            linha, linhas = "", []
            for p in texto.split():
                teste = f"{linha} {p}".strip()
                if d.textlength(teste, font=fnt) <= larg:
                    linha = teste
                else:
                    linhas.append(linha)
                    linha = p
            if linha:
                linhas.append(linha)

            for l in linhas:
                if forte and forte in l:
                    antes, depois = l.split(forte, 1)
                    x = recuo
                    d.text((x, y), antes, font=fnt, fill=(206, 224, 224))
                    x += d.textlength(antes, font=fnt)
                    d.text((x, y), forte, font=fnt_forte, fill=BRANCO)
                    x += d.textlength(forte, font=fnt_forte)
                    d.text((x, y), depois, font=fnt, fill=(206, 224, 224))
                else:
                    d.text((recuo, y), l, font=fnt, fill=(206, 224, 224))
                y += fnt.size * 1.32
            y += 40 * ESCALA
        return y

    bloco(draw, centrar(topo, base, medir(bloco)))

    assinar_discreto(img, draw)
    salvar(img, arquivo)
    registrar(arquivo, titulo, "lista")


def tela_numero(numero, unidade, explicacao, fonte_dado, arquivo,
                categoria="D A D O   D E   M E R C A D O"):
    """Um número dominando a tela, com a fonte logo abaixo."""
    img = fundo_marca(escuro_extra=0.15)
    draw = ImageDraw.Draw(img)
    topo, base = faixa_livre()

    fnt_num = fonte(DISPLAY, 230)

    def bloco(d, y):
        y = pill(d, categoria, y) + 60 * ESCALA
        # Avançar por `fnt.size` deixava "82%" encostando na linha de baixo:
        # o corpo da fonte inclui espaço para acento e descida, que um número
        # não usa. `textbbox` devolve a marca de tinta REAL, e é dela que a
        # próxima linha se afasta.
        d.text((MARGEM_ESQ, y), numero, font=fnt_num, fill=TEAL)
        _, _, _, fim = d.textbbox((MARGEM_ESQ, y), numero, font=fnt_num)
        y = fim + 30 * ESCALA

        y = escrever_esq(d, unidade, fonte(TITULO, 62), y, BRANCO)
        y += 40 * ESCALA
        y = escrever_esq(d, explicacao, fonte(CORPO, 42), y, (168, 190, 190),
                         entrelinha=1.34)

        # A fonte separa dado verificável de número inventado — e inventar
        # métrica é decisão travada contra neste projeto desde que a landing
        # teve uma copiada de concorrente.
        y += 40 * ESCALA
        return escrever_esq(d, fonte_dado, fonte(CORPO, 28), y, (110, 132, 132),
                            entrelinha=1.26)

    bloco(draw, centrar(topo, base, medir(bloco)))

    assinar_discreto(img, draw)
    salvar(img, arquivo)
    registrar(arquivo, f"{numero} {unidade}", "numero")


def tela_declaracao(categoria, titulo, corpo, arquivo, destaque=None, tam=80):
    """Só tipografia: pergunta e resposta, ou o fechamento."""
    img = fundo_marca(escuro_extra=0.10)
    draw = ImageDraw.Draw(img)
    topo, base = faixa_livre()

    def bloco(d, y):
        y = pill(d, categoria, y) + 46 * ESCALA
        y = escrever_esq(d, titulo, fonte(TITULO, tam), y, BRANCO)
        y += 44 * ESCALA
        y = escrever_esq(d, corpo, fonte(CORPO, 42), y, (168, 190, 190),
                         entrelinha=1.36)
        if destaque:
            y += 46 * ESCALA
            y = escrever_esq(d, destaque, fonte(FORTE, 54), y, TEAL)
        return y

    bloco(draw, centrar(topo, base, medir(bloco)))

    assinar_discreto(img, draw)
    salvar(img, arquivo)
    registrar(arquivo, titulo, "declaracao")


# ============================================================== os destaques


def destaque_demo():
    abrir_destaque(
        "demo", "Como funciona",
        "A porta de entrada do perfil: a dor, o caminho e a oferta. "
        "É o destaque que alguém abre primeiro, então ele responde "
        "o que é isso sem depender dos outros quatro.",
    )

    tela_produto(
        "Como funciona",
        "O cliente pediu orçamento e sumiu no WhatsApp.",
        None, "kanban-dark.png", "demo-1-gancho",
        destaque="Aqui ele não some.",
    )
    tela_produto(
        "Seus contatos",
        "Traga quem já é seu cliente",
        "Importe sua planilha ou cadastre pelo nome e telefone, do jeito que a conversa chegou.",
        "contatos-dark.png", "demo-2-trazer",
    )
    tela_produto(
        "O funil",
        "Arraste pelas etapas",
        "Cada negócio vira um card. Arraste conforme a conversa avança.",
        "kanban-dark.png", "demo-3-arrastar",
    )
    tela_produto(
        "Os números",
        "Veja onde está o dinheiro",
        "Quanto está em negociação, o que virou venda e o que está perto do prazo.",
        "dashboard-dark.png", "demo-4-resultado",
    )
    tela_declaracao(
        "Comece agora",
        f"Grátis até {FREE_LEAD_LIMIT} contatos.",
        f"Depois, R$ {PRO_PLAN_PRICE} por mês pela empresa inteira. "
        "Não por vendedor.",
        "demo-5-cta", destaque="Sem cartão de crédito.",
    )


def destaque_planos():
    abrir_destaque(
        "planos", "Planos",
        "Abre pela OFERTA, não pelo piso. A comparação (tela 4) é a única "
        "vantagem que o concorrente não iguala sem mudar o próprio modelo "
        "de cobrança.",
    )

    # ## Por que este destaque não abre mais com "Grátis, para sempre"
    #
    # Abria. E era o mesmo defeito que a landing já tinha pago em 24/08:
    # anunciar a limitação antes da promessa. Duas razões, as duas de
    # conversão e nenhuma de gosto:
    #
    # **Ancoragem.** Quem lê "R$ 0" na primeira tela passa a comparar tudo
    # com zero — e contra zero, qualquer preço perde. A âncora certa é o
    # TETO: o que a pessoa vai ter enquanto testa. Depois dela, R$ 49 lê
    # como o preço de continuar com o que já está usando, não como o preço
    # de começar.
    #
    # **Sinal de categoria.** Em B2B, "grátis para sempre" na abertura diz
    # "ferramenta de hobby". Quem tem orçamento para R$ 49/mês e uma carteira
    # de clientes para proteger lê isso e conclui que o produto é para outra
    # pessoa — exatamente o público que se quer atrair.
    #
    # O plano grátis **não some**: seria mentira, ele existe (migration 0052,
    # 50 contatos). Ele muda de PAPEL — deixa de ser a oferta e vira a rede
    # de segurança, dita no fechamento, onde responde à objeção "e se eu não
    # quiser pagar depois?" em vez de criar a objeção "por que eu pagaria?".
    # ## Esta tela vendia um trial que não existe mais
    #
    # Até 31/08 ela dizia "7 dias com o Pro completo" e listava "Contatos e
    # colaboradores ILIMITADOS". Duas mentiras numa arte só: a migration 0057
    # removeu o reverse trial em 29/08, e o teto de 50 contatos do Free vale
    # desde o primeiro instante — "ilimitados" é a promessa exata que a landing
    # removeu em 23/08.
    #
    # O plano grátis assume o papel que era do trial. Ele não é pior como
    # oferta: não tem prazo, não tem contagem regressiva, e responde à objeção
    # "e quando acabar?" antes que ela exista.
    tela_lista(
        "Comece agora",
        f"Grátis até {FREE_LEAD_LIMIT} contatos",
        [
            ("Sem cartão de crédito", "Sem cartão"),
            ("Sem prazo para decidir", "Sem prazo"),
            ("Funil, contatos e tarefas desde o primeiro dia", "desde o primeiro dia"),
            ("Nada é cobrado sem você escolher", "Nada é cobrado"),
        ],
        "planos-1-teste",
    )
    tela_lista(
        "Quando precisar de mais",
        f"R$ {PRO_PLAN_PRICE} por mês",
        [
            ("Da empresa inteira, nunca por vendedor a mais", "empresa inteira"),
            ("Contatos e colaboradores ilimitados", "ilimitados"),
            ("Google Calendar e Gmail conectados", "Google Calendar e Gmail"),
            ("Suporte prioritário", "Suporte prioritário"),
        ],
        "planos-2-preco",
    )
    tela_produto(
        "O que você leva",
        "Tudo liberado, pela empresa inteira",
        "Sem limite de contatos, sem limite de gente. O preço não muda quando o time cresce.",
        "dashboard-dark.png", "planos-3-produto",
    )
    # Sem citar nome de concorrente: citar convida processo e ainda ensina a
    # marca deles a quem não conhecia. O que importa é o modelo de cobrança.
    tela_declaracao(
        "A conta que ninguém faz",
        "A maioria cobra por vendedor.",
        f"Cinco pessoas, a R$ {PRECO_POR_USUARIO} cada, dão "
        f"R$ {PRECO_POR_USUARIO * 5} por mês. E sobe toda vez que você "
        "contrata alguém.",
        "planos-4-comparacao",
        destaque=f"Aqui são R$ {PRO_PLAN_PRICE}, com a equipe que quiser.",
        tam=72,
    )
    # O fechamento carrega as duas objeções que travam a assinatura, nesta
    # ordem: "e se eu quiser sair?" (cancelamento) e "e se eu não quiser
    # pagar?" (o plano grátis). Aqui o grátis TRABALHA a favor — é a prova
    # de que ninguém fica preso, e não mais a oferta que desvaloriza o Pro.
    tela_declaracao(
        "Sem pegadinha",
        "Cancele quando quiser.",
        "Pix, boleto ou cartão, com cobrança recorrente pelo Asaas. Sem multa e sem falar com ninguém.",
        "planos-5-pagamento",
        destaque="Se não assinar, a conta continua no plano grátis.", tam=76,
    )


def destaque_dicas():
    abrir_destaque(
        "dicas", "Dicas de venda",
        "Os números de mercado que justificam o produto, cada um com "
        "a FONTE no próprio criativo. Serve para quem ainda não "
        "aceitou que tem um problema.",
    )

    tela_numero(
        "21x", "mais chance de fechar",
        "Responder em 5 minutos, em vez de 30, multiplica por 21 a chance de qualificar o contato.",
        "Estudo InsideSales / MIT", "dicas-1-resposta-rapida",
    )
    tela_numero(
        "42h", "é a média do mercado",
        "O tempo que uma empresa leva, em média, para responder o primeiro contato.",
        "Harvard Business Review, auditoria em 2.241 empresas",
        "dicas-2-media-do-mercado",
    )
    tela_numero(
        "82%", "vendem pelo WhatsApp",
        "É o principal canal de venda dos pequenos negócios brasileiros. O problema não é o canal: é o que some junto com a conversa.",
        "12ª Pesquisa Pulso dos Pequenos Negócios / Sebrae, 2026",
        "dicas-3-whatsapp",
    )
    tela_produto(
        "O sinal que ninguém olha",
        "Negócio sem próximo passo é o que morre calado",
        "Ele não dá erro, não avisa, não aparece em relatório. Só para de andar.",
        "kanban-dark.png", "dicas-4-proximo-passo",
    )
    tela_declaracao(
        "Dica final",
        "O que você mede, você cobra.",
        "Sem funil, a pergunta sobre quanto você tem para fechar este mês só tem resposta no chute.",
        "dicas-5-medir", destaque=OFERTA_CURTA, tam=74,
    )


def destaque_perguntas():
    """
    As objeções que travam a venda, respondidas pelo GANHO.

    ## O defeito da primeira versão, e ele é de produto, não de texto

    As cinco manchetes eram negações: "Nada é cobrado", "Não. Abre no
    navegador", "Cada empresa só enxerga o que é dela", "Cancele quando
    quiser". Lidas em sequência, ensinavam que **nada de ruim acontece** — e
    nada de bom. É a armadilha clássica de FAQ: trata objeção e nunca vende.

    A correção não é adjetivo. É trocar o que cada CAMADA carrega:

      a pergunta (cápsula)  continua sendo a objeção, porque é ela que faz
                            alguém abrir o destaque
      a manchete            passa a carregar o GANHO, não a ausência de perda
      o corpo               continua com o fato honesto que remove a objeção

    Nenhuma promessa nova entrou. "Você sai com tudo o que colocou" e "Cancele
    quando quiser" descrevem exatamente a mesma regra; a primeira diz o que a
    pessoa ganha, a segunda o que ela deixa de perder.

    ## Por que a de segurança mudou de ângulo

    A pergunta continua sendo "e a segurança?", e o isolamento entre empresas
    continua no corpo. Mas a manchete passou a ser a dor que a pesquisa deste
    projeto achou como a mais forte da PME brasileira: **o vendedor sai e leva
    a carteira junto**, porque o histórico mora no celular dele.

    É verdade conferível no código, não retórica: `activities` pertence ao
    workspace e guarda `author_id`. A empresa é dona do histórico e sabe quem
    atendeu, independentemente de quem saiu.

    Esquecer uma venda dói uma vez; perder a carteira não tem conserto. Medo
    move compra com muito menos objeção de preço do que conveniência.

    ## A cadência das cinco é escolhida, não sobra

    As primeiras palavras são: Você / Pronto / A carteira / Seus clientes /
    Você. Antes eram Você / Você / Sua / Seus / Você — cinco aberturas com
    pronome de segunda pessoa, três delas com a palavra "Você" literal. Uma
    tela por vez ninguém nota; em SEQUÊNCIA, que é como o Instagram entrega,
    isso lê como template e o olho para de registrar a diferença.

    "Você" agora emoldura o conjunto: abre a primeira e fecha a última, com
    três ritmos diferentes no meio. Se alguém for "padronizar" as manchetes um
    dia, é isto que estará desfazendo.

    ## A ordem, e o arco que ela desenha

    começar -> usar onde você já está -> trazer o que já é seu -> manter o que
    é seu -> sair com tudo. Cada tela entrega uma coisa a mais, e a última
    fecha no CTA.

    A de pagamento fica fora de propósito: já é a tela 5 de Planos, e destaque
    que repete outro ensina a pular os dois.
    """
    abrir_destaque(
        "perguntas", "Perguntas",
        "As objeções que travam a venda, respondidas pelo que a pessoa GANHA "
        "em vez do que ela deixa de perder. É o destaque que alguém abre "
        "quando já gostou e está procurando o motivo para não assinar.",
    )

    tela_declaracao(
        "É grátis mesmo?",
        "Você começa com tudo ligado.",
        "Sete dias com o Pro inteiro, sem pedir cartão. Depois, ou você "
        "assina, ou a conta passa para o plano grátis, que não expira. Seus "
        "dados continuam lá nos dois casos.",
        "perguntas-1-gratis", destaque="Sem cartão para começar.", tam=74,
    )

    # Sem dizer em qual aparelho é melhor, de propósito. A versão anterior
    # dizia "abre no celular, onde você já vende": verdade sobre o canal de
    # venda, mas empurrava para a experiência PIOR — arrastar cartão no funil,
    # ler tabela e comparar gráfico rendem mais no computador. Uma peça de
    # venda que direciona para o lado fraco do produto trabalha contra ele.
    #
    # O ganho aqui é TEMPO ATÉ COMEÇAR, que independe de aparelho, e a objeção
    # real da PME não é "instalar": é o medo de projeto de implantação, com
    # semanas de espera e técnico marcando visita.
    tela_declaracao(
        "Preciso instalar?",
        "Pronto no primeiro acesso.",
        "Funciona pelo navegador, em qualquer aparelho, sem baixar e sem "
        "instalar nada. Não existe projeto de implantação nem espera por "
        "técnico.",
        "perguntas-2-instalar", tam=72,
    )

    tela_lista(
        "E o que eu já tenho?",
        "A carteira inteira entra de uma vez.",
        [
            ("Exporte sua planilha como .csv", ".csv"),
            ("Colunas: Nome, Telefone, E-mail e Valor", "Nome, Telefone, E-mail e Valor"),
            ("Importe direto na tela de Contatos", "Contatos"),
            ("Contato repetido é ignorado sozinho", "ignorado sozinho"),
        ],
        "perguntas-3-importar",
    )

    tela_declaracao(
        "E a segurança?",
        "Seus clientes ficam com a empresa.",
        "O histórico fica na conta, não no aparelho de quem atendeu. E cada "
        "empresa só enxerga os próprios dados, por regra no banco, não por "
        "tela que alguém pode esquecer de conferir.",
        "perguntas-4-isolamento", tam=68,
    )

    tela_declaracao(
        "E se eu quiser sair?",
        "Você sai com tudo o que colocou.",
        "Sem multa e sem falar com ninguém. A conta volta para o plano "
        "grátis, e contatos, negócios e histórico continuam lá.",
        "perguntas-5-cancelar",
        destaque=OFERTA_CURTA, tam=72,
    )


if __name__ == "__main__":
    SAIDA.mkdir(parents=True, exist_ok=True)
    destaque_demo()
    destaque_planos()
    destaque_dicas()
    destaque_perguntas()
    gravar_manifesto()
    print("\npronto — cada tela em 1080x1920 (publicar) e @4k (reserva).")
    print("\nBastidores fica de fora: exige conteúdo seu (rotina, processo,")
    print("decisões), que não existe no código e não dá para inventar.")
