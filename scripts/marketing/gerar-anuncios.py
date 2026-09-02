"""
As peças de ANÚNCIO do Meta. O primeiro criativo pago deste projeto.

    python scripts/marketing/gerar-anuncios.py

## Por que um arquivo separado do feed, se o desenho é o mesmo

Não é o desenho que muda, é o LEITOR. O feed do Instagram fala com quem já
segue o perfil: pode abrir com um dado, pedir "arraste", continuar um assunto
da semana passada. O anúncio fala com alguém que nunca ouviu o nome, está
rolando por outra razão, e decide em menos de dois segundos se o dedo para.

As consequências disso são concretas e todas aparecem no código abaixo:

    sem "ARRASTE"      anuncio de imagem unica nao arrasta, e a instrucao
                       falsa e a forma mais rapida de perder a confianca
    sem indice "1/2"   nao ha peca 2; quem ve esta ve so esta
    sem continuidade   nada pode depender de uma peca anterior
    a oferta na PECA   o botao do Meta fica FORA da imagem, e quem rola o
                       feed nao le botao; le a arte

## Um ângulo por peça, e por que não são cinco variações do mesmo

A Meta aprende comparando. Cinco peças com a mesma tese e cores diferentes não
dão ao algoritmo nada para comparar: ele testa a arte e conclui sobre a arte.
Cinco TESES diferentes fazem o teste responder a pergunta que importa:
por que essa pessoa compraria.

Cada peça abaixo é um mecanismo psicológico distinto, nomeado no comentário
dela. Se três morrerem e uma vender, a que vendeu diz qual argumento funciona,
e aí a variação de arte passa a fazer sentido.

## O que NÃO entra, e continua não entrando

A decisão travada contra prova social inventada vale aqui inteira, e no
anúncio ela é mais tentadora: "+500 empresas" rende, e seria mentira, porque não
existe cliente externo pagante. `lint_texto` do gerador reprova o arquivo se
alguém tentar, e as travas são as mesmas que já protegem o feed.

O que substitui a prova social é o que dá para conferir: preço de tabela
pública do mercado, dado de pesquisa com a fonte impressa na arte, e a tela
real do produto. Nenhum deles precisa de cliente para ser verdade.
"""

import importlib.util
import shutil
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]

# Importa o gerador em vez de copiar dele: duas famílias de arte que compartilham
# tipografia, paleta, marca d'água e travas divergem no primeiro ajuste, e a que
# diverge em silêncio é sempre a que ninguém está olhando. Mesmo caminho que
# `gerar-feed.py` usa desde 29/08.
_spec = importlib.util.spec_from_file_location(
    "velofunil_criativos",
    RAIZ / "marketing" / "claude-designer" / "velofunil_criativos.py",
)
vf = importlib.util.module_from_spec(_spec)
sys.modules["velofunil_criativos"] = vf
_spec.loader.exec_module(vf)


# ---------------------------------------------------------------------------
# Formatos
# ---------------------------------------------------------------------------
#
# Os dez posicionamentos do Meta se resolvem em três proporções, e isso já está
# registrado em `lib/dono/formatos-do-meta.ts` desde 20/08. Aqui saem duas:
#
#     4:5  1080x1350   feed do Instagram e do Facebook. Ocupa mais tela, e
#                      altura e a unica variavel que aumenta o tempo que a
#                      peca fica na frente de quem rola.
#
# ## Só 4:5, e o 1:1 foi tentado e DESCARTADO com o motivo medido
#
# `Tela` aceita qualquer tamanho, então gerar 1080x1080 parecia de graça. Não
# é: as composições posicionam blocos a partir de `c.h` com recuos calibrados
# para 1350. Gerado e OLHADO em 02/09, o quadrado saiu com o rótulo do eixo
# ("PESSOAS NO TIME") sobreposto à linha de fonte: legível na medição, ilegível
# na arte.
#
# Publicar quadrado quebrado é pior que não ter quadrado: o Meta recorta 4:5
# para os posicionamentos que pedem quadrado, e um recorte automático perde
# menos que um texto colidido. Fazer o 1:1 direito é reescrever as composições
# em altura relativa, que é rodada própria e não cabe antes da primeira
# campanha.
#
# 9:16 fica de fora pelo mesmo tipo de razão, mais uma: Stories e Reels pedem
# movimento, e imagem parada num formato que o dedo passa em 1,5s desperdiça o
# posicionamento mais barato do leilão. Vídeo ali é rodada própria, e o gerador
# já tem `--videos`.
FORMATOS = {
    "4x5": (1080, 1350),
}

SAIDA = RAIZ / "criativos" / "anuncio"


# ---------------------------------------------------------------------------
# As peças
# ---------------------------------------------------------------------------

D = vf.DOMAIN
BRL = vf.brl
PRECO = vf.PRO_PLAN_PRICE
MEDIANA = vf.SEAT_MEDIAN_PRICE
TIME = vf.TEAM_SIZE
TETO = vf.FREE_LEAD_LIMIT

PECAS = [
    # -----------------------------------------------------------------------
    # 1. ANCORAGEM + EFEITO DE CONTRASTE
    # -----------------------------------------------------------------------
    # O primeiro número que a pessoa vê governa todo julgamento seguinte. Sem
    # âncora, o cérebro compara o preço com ZERO, e contra zero qualquer valor
    # perde. Com a conta do concorrente na frente, ele compara com o valor de
    # mercado, e a diferença vira o argumento.
    #
    # É o ângulo mais forte que este produto tem, e o único que um concorrente
    # não copia sem mudar o próprio modelo de negócio: cobrar por assento é a
    # receita deles.
    dict(id="a1_ancora_preco", comp="conta", pal=vf.ESCURO,
         claim="Os outros cobram por pessoa. Aqui não existe por pessoa.",
         unidade="PESSOAS NO TIME",
         nota_escada=f"{TIME} pessoas em CRM que cobra por usuário.",
         nota_reta=f"{vf.PLAN_LABELS['pro']}, a empresa inteira, "
                   f"{BRL(PRECO)} por mês.",
         fonte=f"mediana pública de {BRL(MEDIANA)} por usuário por mês. "
               f"{TIME} pessoas. {vf.MONTHS} meses.",
         dominio=D),

    # -----------------------------------------------------------------------
    # 2. AVERSÃO À PERDA
    # -----------------------------------------------------------------------
    # Perder dói cerca de duas vezes mais do que ganhar o equivalente agrada.
    # "Organize seus contatos" é enquadramento de ganho e não move ninguém;
    # "a proposta de quinta você não lembra" nomeia uma perda que a pessoa já
    # viveu, e ela reconhece antes de terminar de ler.
    #
    # O número tem fonte impressa na arte porque é o que substitui prova
    # social aqui: dado público confere, depoimento inventado não.
    #
    # ## Trocado em 02/09: era sobre WhatsApp
    #
    # A versão anterior usava "97% abrem o WhatsApp todo dia" para dizer que a
    # proposta some no histórico. O dado é verdadeiro e a peça era boa, mas
    # `FASE_DO_WHATSAPP = 'migrando'`: o produto não lê conversa nenhuma, e um
    # anúncio que abre em WhatsApp cria a expectativa de que leia.
    #
    # O dado novo mede a MESMA dor sem prometer o que não roda, e ainda aponta
    # para o recurso que existe: a importação de planilha.
    dict(id="a2_perda_memoria", comp="numero", pal=vf.ESCURO,
         numero="42h",
         claim="é o tempo médio até a primeira resposta.",
         texto="Não é falta de vontade. É que a lista de quem está esperando "
               "não fica em lugar nenhum, e quem lembra primeiro é quem "
               "cobra.",
         fonte="Harvard Business Review, auditoria em 2.241 empresas.",
         dominio=D),

    # -----------------------------------------------------------------------
    # 3. VIÉS DE STATUS QUO
    # -----------------------------------------------------------------------
    # A objeção número um deste público não é preço nem recurso: é "mas eu já
    # uso WhatsApp". Trocar de ferramenta é caro em esforço e arriscado em
    # percepção, e um anúncio que peça a troca perde a discussão antes de
    # começar.
    #
    # Esta peça não compete com o WhatsApp: declara que ele fica. A objeção
    # deixa de existir em vez de ser combatida, que é a única forma de vencê-la
    # numa arte de duas linhas.
    #
    # ## Trocada em 02/09, pelo mesmo motivo da a2
    #
    # Dizia "Continue no WhatsApp. O funil fica do lado, não no lugar." A
    # frase tratava a objeção certa, e ainda trata: ninguém quer trocar de
    # ferramenta. O problema é o que ela sugere sobre integração.
    #
    # A objeção continua sendo de status quo, e a planilha ocupa o mesmo
    # lugar mental que o WhatsApp ocupava: "o que eu tenho já funciona". A
    # resposta é a mesma — não pedimos que largue nada. E aqui ela é
    # LITERALMENTE verdade, porque importar planilha é recurso entregue.
    dict(id="a3_objecao_planilha", comp="declaracao", pal=vf.ESCURO,
         claim="Sua planilha entra. O funil monta sozinho.",
         dominio=D),

    # -----------------------------------------------------------------------
    # 4. PROVA POR DEMONSTRAÇÃO
    # -----------------------------------------------------------------------
    # Sem cliente para depor, o produto depõe por si. Mostrar a tela responde
    # de uma vez às três perguntas que travam quem chega frio , como é, dá para
    # entender, e é simples mesmo? , e nenhuma delas cabe em texto.
    #
    # Os cards são cenário fictício de propósito: publicar tela com nome,
    # telefone e valor de negócio de cliente é tratamento de dado pessoal sem
    # base legal, e é a mesma regra que governa os prints da landing.
    # ## A ÚLTIMA coluna sai vazia sempre, e isso é do desenho, não um defeito
    #
    # `comp_produto` desenha a última coluna só como moldura, cortada pela
    # borda: é o "espia" que sugere que o funil continua à direita. Medido em
    # 02/09 tentando três colunas , a terceira ficou inteira na tela E vazia,
    # que lê como tela quebrada. Com quatro, ela sai cortada, e cortado lê
    # como continuação.
    #
    # Ou seja: são precisas QUATRO colunas de dado para ver TRÊS preenchidas.
    # Fica registrado porque a leitura natural é o contrário , parece que a
    # quarta não coube, quando na verdade ela é a que faz as outras três
    # parecerem parte de algo maior.
    #
    # O claim perdeu a contagem: "Quatro colunas" descrevia o desenho, e
    # número na copy que descreve desenho vira mentira quando o desenho muda.
    dict(id="a4_prova_produto", comp="produto", pal=vf.CLARO,
         claim="É isto. O funil inteiro, com o próximo passo e a data.",
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
         dominio=D),

    # -----------------------------------------------------------------------
    # 5. EFEITO PREÇO ZERO + REMOÇÃO DE FRICÇÃO
    # -----------------------------------------------------------------------
    # Grátis não é um preço baixo: é outra categoria mental. O salto de R$ 1
    # para R$ 0 vale mais que o de R$ 50 para R$ 1, e é o que faz alguém que
    # não estava procurando nada abrir uma conta.
    #
    # "Sem cartão" no rótulo trata AVERSÃO AO ARREPENDIMENTO, que é a objeção
    # que sobra depois do preço: quem já foi cobrado por um teste esquecido
    # hesita mesmo diante do grátis. Dizer isso na arte é mais barato que
    # explicar depois.
    # -----------------------------------------------------------------------
    # 6. ENERGIA DE ATIVACAO + AUTORIDADE POR ASSOCIACAO
    # -----------------------------------------------------------------------
    # A objecao que sobra depois de preco e de troca e "vou ter que aprender
    # outra ferramenta". Ela nao e sobre o produto: e sobre o custo de comecar,
    # e custo de comecar mata adocao mesmo quando tudo o mais convence.
    #
    # Google Agenda e Gmail respondem isso sem argumentar: a pessoa nao aprende
    # nada novo, o compromisso cai na agenda que ela ja abre e o e-mail sai da
    # caixa que ela ja usa. E o nome do Google empresta confianca que este
    # produto ainda nao tem por conta propria.
    #
    # ## Esta peca so existe porque as duas integracoes foram MEDIDAS
    #
    # Contra o banco de producao em 02/09: `google_calendar` com 3 conexoes,
    # 3 conectadas, 0 com erro; `gmail` com 1 conexao, 1 conectada, 0 com
    # erro. Credenciais de OAuth presentes, e a verificacao do Google
    # aprovada em 24/08 para `calendar.events.owned` e `gmail.send` — sem o
    # aviso de "app nao verificado" que assusta quem nao e desenvolvedor.
    #
    # Sem essa medicao esta peca seria a mesma classe do "em breve" que acabou
    # de sair da landing.
    # A frase e CURTA por medicao, nao por gosto: a primeira versao tinha 12
    # palavras ("O compromisso vai para a sua Agenda. O e-mail sai do seu
    # Gmail") e `comp_declaracao` a quebrou em SEIS linhas, com um "O" sozinho
    # na primeira. Gerado e olhado em 02/09. Esta composicao foi desenhada
    # para uma tese de uma respiracao, e passar disso vira parede de texto.
    dict(id="a6_google", comp="declaracao", pal=vf.ESCURO,
         claim="Marca no seu Google. Manda do seu Gmail.",
         dominio=D),

    dict(id="a5_oferta", comp="chamada", pal=vf.ESCURO,
         rotulo="SEM CARTAO PARA COMECAR",
         claim="O plano é o mesmo para uma pessoa",
         realce="ou para a equipe inteira.",
         pro=dict(
             nome=vf.PLAN_LABELS["pro"].upper(),
             selo="SEM COBRAR POR PESSOA",
             preco=BRL(PRECO), unidade="/mês",
             apoio="A empresa inteira. Quantas pessoas quiser.",
             # DOIS itens, e a guarda de altura de `comp_chamada` obriga: com
             # quatro eles viram duas linhas e a comparação de preço subia por
             # cima da borda do cartão. Mas o corte melhora a peça de qualquer
             # forma , num anúncio, cada item a mais é uma decisão a mais, e
             # decisão a mais é abandono.
             #
             # Os dois que ficaram respondem OBJEÇÃO; os que saíram
             # ("Importar planilha", "Google Agenda e Gmail") descrevem
             # recurso. Quem nunca ouviu falar do produto não está comparando
             # recursos , está decidindo se vale o risco.
             itens=["Contatos sem teto", "Cancela sem multa"],
             comparacao=f"Em CRM que cobra por vendedor, {TIME} pessoas custam",
             valor_deles=f"{BRL(MEDIANA * TIME)}/mês"),
         free=dict(
             nome=vf.PLAN_LABELS["free"].upper(),
             texto=f"Até {TETO} contatos, {vf.FREE_MEMBER_LIMIT} pessoas. "
                   "Sem cartão e sem prazo para decidir."),
         assinatura=vf.assinatura_legal("CRIE A CONTA GRÁTIS EM 2 MINUTOS"),
         dominio=D),
]


def conferir_texto_de_anuncio(p: dict) -> None:
    """As travas do gerador, MAIS as que só valem para anúncio.

    `lint_texto` já reprova prova social inventada, a oferta gratuita que foi
    aposentada em 29/08, e preço
    escrito à mão. O que ele não pega é instrução de carrossel: ela é correta
    no feed e falsa aqui, porque não há segunda peça para arrastar.

    Um anúncio que manda arrastar e não arrasta gasta a única coisa que ele
    tem , os dois segundos de atenção , para provar que mentiu.
    """
    vf.lint_texto(*vf.textos_da_peca(p))

    proibidos_no_anuncio = ("ARRASTE", "arraste", "deslize", "veja o próximo",
                            "1/2", "2/2", "continua")
    for chave, valor in p.items():
        if not isinstance(valor, str):
            continue
        for termo in proibidos_no_anuncio:
            if termo in valor:
                raise ValueError(
                    f"{p['id']}: '{termo}' em `{chave}` , anúncio é imagem "
                    f"única, não há para onde arrastar")

    # ## Teto de palavras no `claim`, e ele nasceu de duas quebras seguidas
    #
    # `comp_declaracao` desenha o claim em corpo grande, e passar de umas dez
    # palavras faz o texto quebrar em seis linhas com uma palavra solta na
    # primeira. Aconteceu DUAS VEZES na mesma sessão, em 02/09: primeiro na
    # peça do Google, depois na da planilha. Nas duas o defeito só apareceu ao
    # abrir o PNG.
    #
    # Contar palavra é grosseiro e é de propósito: medir a largura real exigia
    # instanciar fonte e canvas aqui, e a trava tem que rodar ANTES de desenhar
    # para o erro dizer o que fazer em vez de mostrar o estrago. Dez é o
    # tamanho das frases que couberam.
    #
    # O teto vale só para `declaracao`: `numero` e `chamada` têm o claim em
    # corpo menor e com mais espaço, e frases dessas peças passam de dez sem
    # quebrar nada.
    if p["comp"] == "declaracao":
        palavras = len(p["claim"].split())
        if palavras > 10:
            raise ValueError(
                f"{p['id']}: o claim tem {palavras} palavras e `declaracao` "
                f"desenha em corpo grande. Acima de 10 ele vira parede de "
                f"texto de seis linhas. Encurte: {p['claim']!r}")


def render(formato: str, tamanho: tuple, so: str | None = None) -> list:
    pasta = SAIDA / formato
    pasta.mkdir(parents=True, exist_ok=True)
    feitas = []
    for p in PECAS:
        if so and so != p["id"]:
            continue
        conferir_texto_de_anuncio(p)
        c = vf.Tela(tamanho[0], tamanho[1], p["pal"])
        vf.COMPOSICOES[p["comp"]](c, p)
        caminho = pasta / f"{p['id']}.png"
        c.salvar(caminho)
        feitas.append(caminho)
        print(f"  {formato}/{p['id']}.png")
    return feitas


def main() -> int:
    # A pasta `criativos/` fica FORA do Git (é onde a Central do dono lê as
    # peças enviadas), e `anuncio/` é a metade paga dela , a separação de
    # anúncio e orgânico existe desde 20/08 e continua valendo: são públicos
    # diferentes e uma peça não serve para as duas coisas.
    if vf.check():
        print("gerador reprovado nas travas; nada foi desenhado")
        return 1

    total = 0
    for formato, tamanho in FORMATOS.items():
        total += len(render(formato, tamanho))

    print(f"\n{total} arquivos em {SAIDA}")
    print("\nO que fazer com eles, e a ordem importa:")
    print(f"  1. abrir os PNG e OLHAR    nenhum portao ve dentro de imagem")
    print(f"  2. subir por /dono/criativos, que confere proporcao e resolucao")
    print(f"  3. criar o anuncio no Ads Manager, um por angulo")
    print(f"  4. otimizar por Lead nas primeiras semanas, nao por Purchase")
    return 0


if __name__ == "__main__":
    sys.exit(main())
