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
# Os posicionamentos do Meta se resolvem em três proporções, e isso já está
# registrado em `lib/dono/formatos-do-meta.ts` desde 20/08. Agora saem as três:
#
#     4:5  1080x1350   feed do Instagram e do Facebook. Ocupa mais tela, e
#                      altura e a unica variavel que aumenta o tempo que a
#                      peca fica na frente de quem rola.
#
#     1:1  1080x1080   Explorar, Marketplace, coluna da direita, resultados de
#                      busca, notificacoes, caixa do Messenger, Audience
#                      Network. Sete posicionamentos, todos com o dedo em
#                      movimento e nenhum com a peca ocupando a tela inteira.
#
#     9:16 1080x1920   Stories e Reels, nos dois aplicativos.
#
# ## O 1:1 foi DESCARTADO em 02/09 e o motivo virou a correcao
#
# O comentario que ficou aqui dizia: "as composicoes posicionam blocos a partir
# de `c.h` com recuos calibrados para 1350", e o quadrado saia com o rotulo do
# eixo ("PESSOAS NO TIME") sobreposto a linha de fonte.
#
# Estava certo no diagnostico. `metricas_da_proporcao` fechou a causa: os
# recuos deixaram de ser globais de 1350 e passam a viajar com a `Tela`.
#
# ## Por que valia a rodada, medido
#
# Dos 19 posicionamentos que a conta alcanca, apenas 4 recebiam a peca na
# medida certa. Nos outros 15 o Meta RECORTA o 4:5 sozinho — e recorte
# automatico nao sabe onde esta o texto. Advantage+ placements (que e a
# configuracao que barateia o CPM com orcamento baixo) so vale a pena com as
# tres proporcoes existindo.
#
# ## O 9:16 estatico entra, e a ressalva continua de pe
#
# Stories e Reels rendem mais com MOVIMENTO, e o gerador ja tem `--videos`.
# Imagem parada ali e a segunda melhor opcao. Mas a alternativa hoje nao e
# video: e o Meta recortando um 4:5 para 9:16, que perde 44% da altura e nao
# olha onde corta. Estatico desenhado para a medida perde do video e ganha do
# recorte cego.
FORMATOS = {
    "4x5": (1080, 1350),
    "1x1": (1080, 1080),
    "9x16": (1080, 1920),
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
    # ## Era `declaracao`, e 30% da peca era VAZIO
    #
    # Medido em 03/09, a pedido do dono: a arte tinha o claim grande em cima e
    # 327px de nada embaixo — 30% da peca. E a mesma classe do commit
    # `c3ea81e` ("cinco dos sete slides estavam com metade da peca vazia"),
    # que voltou por outro caminho.
    #
    # O que preenche com VALOR e a tela real. Esta peca combate o vies de
    # status quo ("o que eu tenho ja funciona"), e a objecao por tras dele nao
    # e a planilha: e o medo de migrar. Nenhuma frase responde isso tao bem
    # quanto ver o produto lendo a planilha e acertando as colunas sozinho.
    #
    # ## O recorte e o MAPEAMENTO, e nao o dialogo inteiro
    #
    # O dialogo completo e quase quadrado (1.03) e a caixa desta composicao e
    # 2.48 — encaixar um no outro cortaria metade dele. O mapeamento sozinho
    # da 2.61, que casa quase exato, e por acaso e a parte que PROVA: as
    # colunas do arquivo aparecem reconhecidas, uma a uma, com exemplo real de
    # cada uma ao lado.
    dict(id="a3_objecao_planilha", comp="passo", pal=vf.ESCURO,
         rotulo="IMPORTAR EM UM MINUTO", indice="",
         claim="Sua planilha entra.",
         realce="O funil monta sozinho.",
         captura="11-importar-desktop-dark.png",
         # ## O corte cai DENTRO de um vao sem texto, nas duas pontas
         #
         # Medido o perfil de brilho do dialogo. A primeira tentativa comecou
         # em 0.252 e partiu a linha "contatos.csv - 6 linha(s)" ao meio, o
         # que le como imagem quebrada.
         #
         # ## E um recorte POR FORMATO, pelo mesmo motivo da a6
         #
         # A caixa vai de 2.14 (1:1) a 1.50 (4:5). Com um foco unico de 2.78 o
         # 4:5 cortava a largura e o e-mail do contato saia pela metade
         # ("juliana@vidaplena.com.b"). Cada base abaixo cai num vao: 0.570 no
         # de 0.5694..0.6072, e 0.697 no de 0.6897..0.7450.
         #
         # O 4:5, por ser mais alto, ganha a PREVIA de brinde — as tres
         # primeiras linhas ja prontas, que e a prova depois da promessa.
         foco={
             "1x1": (0.300, 0.271, 0.700, 0.570),
             "4x5": (0.300, 0.270, 0.700, 0.697),
         },
         # `comp_passo` escreve "ARRASTE" quando nao recebe rodape, e anuncio
         # de imagem unica nao arrasta — a trava de `conferir_texto_de_anuncio`
         # reprovaria a peca. O dominio ocupa o mesmo lugar e diz algo util.
         rodape=D.upper(),
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
    # ## Era `declaracao`, e 41% da peca era VAZIO — o pior dos seis
    #
    # ## A tela de Integracoes foi capturada e REJEITADA
    #
    # Era a candidata obvia e falha por dois motivos, os dois visiveis so ao
    # abrir a captura: os cards de Google Calendar e Gmail dizem "Nao
    # conectado" — o produto sem usar a integracao que o anuncio promete — e o
    # bloco do WhatsApp traz "Em breve" com a explicacao da migracao, que e
    # exatamente a promessa retirada do marketing em 02/09.
    #
    # O painel do negocio mostra a ACAO em vez do estado da conexao: o botao
    # "Google Calendar" ao lado da proxima acao, dentro do produto.
    #
    # ## O logo do Google continua FORA, e isso e regra e nao gosto
    #
    # A Meta reprova criativo cujo visual sugira endosso ou parceria nao
    # autorizada, e logo de terceiro na arte e o caso tipico. Aqui o nome
    # aparece como rotulo de um botao NOSSO, que e o produto se descrevendo —
    # e a integracao existe de verdade, com verificacao OAuth aprovada pelo
    # proprio Google em 24/08.
    dict(id="a6_google", comp="passo", pal=vf.ESCURO,
         rotulo="SEM APRENDER FERRAMENTA NOVA", indice="",
         claim="Marca no seu Google.",
         realce="Manda do seu Gmail.",
         # ## A captura e a de TELEFONE, e nao a de desktop
         #
         # No desktop o painel e uma coluna estreita colada na borda direita:
         # o titulo da tarefa sai truncado ("Reuniao de alinh...") e o botao
         # fica a um passo da margem, onde a sangria do card o parte ao meio.
         #
         # No telefone o painel ocupa a largura toda. "Reuniao de alinhamento"
         # aparece inteiro e os dois botoes cabem lado a lado, longe da borda.
         captura="12-negocio-telefone-dark.png",
         # Um recorte por formato: a caixa vai de 2.14 (1:1) a 1.50 (4:5), e
         # um foco unico corta o botao numa das duas. Os dois enquadramentos
         # terminam em 0.788, logo abaixo dos botoes; o de 4:5, mais alto,
         # ganha o "Movimento" de brinde.
         foco={
             "1x1": (0.257, 0.630, 0.964, 0.783),
             "4x5": (0.257, 0.570, 0.964, 0.788),
         },
         rodape=D.upper(),
         dominio=D),

    dict(id="a5_oferta", comp="chamada", pal=vf.ESCURO,
         rotulo="SEM CARTÃO PARA COMEÇAR",
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


# ---------------------------------------------------------------------------
# O 9:16, e por que ele NAO e desenhado nativamente
# ---------------------------------------------------------------------------
#
# A primeira tentativa desenhou direto em 1080x1920, com os recuos que
# `metricas_da_proporcao` devolve para a zona segura. Tecnicamente correto e
# **feio**: aberto e olhado em 02/09, o conteudo empilhava a partir do topo e o
# rodape ancorava na base, deixando ~800px de vazio no meio de toda peca. Le
# como arte que nao carregou.
#
# A causa nao e ajustavel por recuo: estas composicoes tem altura de conteudo
# propria, e "distribuir" exigiria medir cada bloco antes de desenhar — ou
# seja, reescrever as cinco.
#
# O que resolve e mais simples e mais seguro: desenhar a peca em 4:5, que e a
# medida provada, e assenta-la na banda segura do 9:16 sobre o fundo da
# paleta. A arte que vai ao ar e byte a byte a mesma que foi conferida no
# feed, e a zona coberta pela interface fica vazia porque nada foi desenhado
# nela — em vez de ficar vazia porque o Meta cortou por cima.
#
# ## A conta da banda
#
#     zona segura   269 no topo (14%), 384 na base (20%)  -> 1267px uteis
#     arte 4:5      1080x1350, reduzida para caber        -> 1013x1267
#     lateral       (1080 - 1013) / 2 = 33px de cada lado
#
# Reduzir e melhor que cortar: 4:5 dentro de 9:16 sempre perde altura ou
# largura, e largura e onde mora o texto.
BANDA_9X16 = (vf.MARGENS_ESTATICA["topo"], vf.MARGENS_ESTATICA["base"])


def compor_em_banda(arte, tamanho: tuple, pal) -> "vf.Image.Image":
    """Assenta a arte 4:5 na banda segura de uma tela mais alta."""
    larg, alt = tamanho
    topo, base = BANDA_9X16
    util = alt - topo - base
    k = util / arte.height
    nova = arte.resize((int(arte.width * k), util), vf.Image.LANCZOS)
    fundo = vf.Image.new("RGB", (larg, alt), pal.fundo)
    fundo.paste(nova, ((larg - nova.width) // 2, topo))
    return fundo


# ---------------------------------------------------------------------------
# O recorte da captura muda com a proporcao, e nao podia ser um so
# ---------------------------------------------------------------------------
#
# `comp_passo` faz o card SANGRAR pela direita e corta o excedente. O que
# sobra depende de qual dimensao limita, e isso muda com a proporcao da peca:
#
#     foco MAIS LARGO que a caixa    corta a LARGURA (some o lado direito)
#     foco MAIS ALTO que a caixa     corta a ALTURA  (some a base)
#
# E a caixa varia muito entre os tres formatos, porque o texto acima dela
# ocupa a mesma altura enquanto a peca cresce:
#
#     1:1    984x460   proporcao 2.14
#     4:5    984x656   proporcao 1.50
#     9:16   983x757   proporcao 1.30
#
# Um foco unico, portanto, e certeza de cortar algo em duas das tres. Foi o
# que aconteceu: com um recorte calibrado para 2.48 o botao "Google Calendar"
# — o elemento que a peca existe para mostrar — saiu partido pela borda em
# 1:1, e o e-mail do contato saiu cortado em 4:5.
#
# `foco` passa a aceitar um dicionario por formato. Tupla continua valendo
# para peca cujo recorte tolera corte em qualquer lado.
def foco_do_formato(peca: dict, formato: str):
    foco = peca.get("foco")
    if isinstance(foco, dict):
        if formato not in foco:
            raise KeyError(
                f"{peca['id']}: falta o foco de {formato}. Um recorte por "
                f"formato existe porque a caixa muda de proporcao entre eles.")
        return foco[formato]
    return foco


def render(formato: str, tamanho: tuple, so: str | None = None) -> list:
    pasta = SAIDA / formato
    pasta.mkdir(parents=True, exist_ok=True)
    em_banda = formato == "9x16"
    feitas = []
    for p in PECAS:
        if so and so != p["id"]:
            continue
        conferir_texto_de_anuncio(p)
        desenho = FORMATOS["4x5"] if em_banda else tamanho
        # O 9:16 e desenhado em 4:5 e assentado na banda: o recorte que vale
        # para ele e o de 4:5, nao o da medida final.
        p = {**p, "foco": foco_do_formato(p, "4x5" if em_banda else formato)}
        c = vf.Tela(desenho[0], desenho[1], p["pal"])
        vf.COMPOSICOES[p["comp"]](c, p)
        caminho = pasta / f"{p['id']}.png"
        if em_banda:
            # `c.im` e o supersample (2x), nao `c.imagem()`: reduzir de 2700
            # para 1267 numa passagem so preserva mais detalhe que reduzir
            # 2700->1350 e depois 1350->1267. A tipografia mono de 21px do
            # rodape e onde a diferenca aparece primeiro.
            compor_em_banda(c.im, tamanho, p["pal"]).save(
                caminho, "PNG", optimize=True)
        else:
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
