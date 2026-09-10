import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { FREE_LEAD_LIMIT, PRO_PLAN_PRICE } from '@/lib/plans'
import { cn } from '@/lib/utils'
import { PipelinePreviewCard } from '@/components/landing/pipeline-preview-card'
import { SegmentBadge } from '@/components/landing/segment-badge'
import { ScrollLink } from '@/components/landing/scroll-link'

export function HeroSection() {
  return (
    <section className="relative overflow-hidden px-4 pt-20 pb-24 md:px-6 md:pt-28 md:pb-32">
      <div
        aria-hidden
        className="glow-radial pointer-events-none absolute top-0 left-1/2 -z-10 h-96 w-[42rem] -translate-x-1/2"
      />
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-8">
        <div className="flex flex-col items-center gap-6 text-center lg:items-start lg:text-left">
          {/* Duração CONSTANTE mais atraso crescente, e não duração crescente.
              O hero usava 650/750/800/850/900ms com todos os elementos
              começando em t=0: isso não escalona nada, só deixa os últimos
              mais lentos — a diferença entre "a tela entra em ordem" e "os
              elementos de baixo demoram mais para chegar", que é como estava.
              Os tokens `delay-passo-*` vivem no globals.css e são os mesmos
              das telas de autenticação, para as duas metades do site terem o
              mesmo ritmo em vez de coincidirem por acaso.

              Uma distância só (12px) para a sequência inteira: variar o
              percurso além do atraso faz os elementos parecerem brigar, em vez
              de uma tela entrando junto. */}
          {/* Sem pílula, e a COR é o que a substitui no trabalho dela.
              Medido em 29/08: das oito landings de referência abertas no
              navegador, NENHUMA usa pílula acima do h1 — Linear, Pipedrive,
              Vercel, Notion e Clay não têm eyebrow nenhum; Attio, Stripe e
              Resend usam só texto.

              A caixa cinza mantinha este texto subordinado ao h1. Tirando a
              caixa sem baixar a cor, um quase-branco de 18,97:1 passaria a
              competir com a manchete, que é a tese da página.
              A cor da marca dá 8,37:1 no escuro e 4,96:1 no claro, os dois
              acima do mínimo de 4,5. E a hierarquia continua vindo do
              TAMANHO — 12px contra 60px do h1, cinco vezes maior —, não da
              cor: o título segue sendo a tese. O claro é o ponto mais
              apertado da página, com 0,46 de folga.

              O mono e as maiúsculas FICAM: a barra da janela do mock, logo ao
              lado, diz `funil de vendas · Acme Corp` em mono. A letra rima com
              a página — a caixa é que não rimava. */}
          <SegmentBadge className="animate-entrada fade-in slide-in-from-bottom-3 fill-mode-both ease-entrada duration-entrada delay-passo-1 text-primary font-mono text-xs tracking-wide uppercase" />
          {/* Nome e categoria continuam DENTRO do h1, mas só para quem lê por
              texto: leitor de tela e o verificador de marca do Google, que
              compara o nome do app no consent screen com o heading principal
              da home e reprovava sem isso.

              Ficam invisíveis por decisão do dono, o Hero pedia menos ruído
              acima da headline. O que sustenta a verificação continua na tela:
              o parágrafo logo abaixo já diz "O Velo Funil mostra, numa tela
              só...", e title/og:site_name/meta description seguem intactos.

              Sem o `mb-3` que separava as duas linhas: o h1 voltou a ser uma
              linha visível, e o `gap-6` do flex pai governa o ritmo de novo.

              Tracking fica mais negativo quanto maior o texto, é o que separa
              um título "de template" de um desenhado. Ver também o h2 das
              demais seções, em -0.02em. */}
          {/* ## Por que a headline fala de WhatsApp

              A anterior era "Pare de perder venda por esquecimento". Boa frase
              — verbo imperativo, seis palavras, nomeia a consequência —, mas
              apontada para o inimigo errado.

              Medido na 12ª Pesquisa Pulso do Sebrae (2026): **82% dos pequenos
              negócios brasileiros têm o WhatsApp como principal canal de
              venda**, 76% vendem por lá. A página inteira, por outro lado,
              atacava a planilha. Quem lê "largue a planilha" e não tem planilha
              não se reconhece — e não clica num anúncio pago.

              A dor com número em cima: responder em 5 minutos em vez de 30 dá
              21x mais chance de qualificar (estudo InsideSales/MIT), e a
              auditoria da HBR em 2.241 empresas achou tempo médio de PRIMEIRA
              resposta de 42 horas.

              ## E em 02/09 ela saiu, com o WhatsApp junto

              A headline anterior era "O WhatsApp guarda a conversa. Não guarda
              o cliente." Ela funcionava, e o dado do Sebrae continua verdadeiro
              — o que deixou de ser verdade é a promessa embutida nela.

              `FASE_DO_WHATSAPP = 'migrando'`: a ponte não oficial saiu de
              operação e a API da Meta depende de App Review. O único WhatsApp
              que este produto entrega é o link `wa.me`, que abre a conversa a
              partir do contato. Isso é um botão, não uma tese, e uma página
              inteira construída sobre ele promete o que não existe.

              Numa página orgânica isso custa decepção. Numa que recebe TRÁFEGO
              PAGO, custa dinheiro: a decepção acontece depois do clique, com
              ele já cobrado.

              ## Por que ESTA frase, e não outra

              O diferencial que sobra é o único que nenhum concorrente copia
              sem mudar a própria receita. Medido em 02/09 contra a fonte:

                  RD Station    R$ 59,40/usuario   gratis ate 4 usuarios
                  Agendor       R$ 53 a 59/usuario  conta gratis
                  Ploomes       ~R$ 75/usuario      sem gratis
                  Pipedrive     US$ 12,50/usuario

              Os quatro cobram por pessoa, e três têm plano grátis. Ou seja:
              "grátis" não diferencia nada, e o Free daqui (2 pessoas) é mais
              restrito que o do RD Station (4). O que diferencia é o preço
              fixo, e ele estava enterrado atrás do gancho de WhatsApp.

              A frase mantém a forma que funcionava: concede o que é verdade
              (a planilha organiza) e nomeia o que ela não faz (avisar). O
              inimigo volta a ser a planilha porque é ela que a importação
              resolve — e importação é coisa que o produto ENTREGA.

              O WhatsApp volta para cá quando voltar a entregar. Não antes. */}
          {/* Três degraus, e o primeiro existe por medição, não por gosto.
              A frase nova tem 47 caracteres contra 38 da anterior; em 390px,
              com `text-titulo-lg` (44px), ela ocupava CINCO linhas e empurrava
              o botão para debaixo do banner de consentimento — exatamente o
              defeito corrigido em 23/08, reaparecendo por outra causa.

              Em telefone o título cede tamanho para o CTA caber na dobra:
              headline grande que esconde o botão não converte ninguém. */}
          {/* ## Sem `fade-in`, e essa é a única diferença para os irmãos
              Este h1 é o candidato a LCP da página que recebe o tráfego pago.
              Com `fade-in` + `fill-mode-both` ele nasce em `opacity: 0`, e
              elemento transparente NÃO conta como pintado: o LCP não podia
              acontecer antes de 70ms de atraso + 600ms de duração ≈ 670ms.
              Medido em produção em 02/09, com a página pronta muito antes —
              TTFB 127ms, DOMContentLoaded 555ms. Meio segundo de métrica
              jogado fora por decisão de CSS, sem nenhuma causa de rede.
              O `slide-in-from-bottom-3` FICA: deslocar não esconde o pixel, e
              o movimento de entrada continua existindo. Só a opacidade sai. */}
          <h1 className="animate-entrada slide-in-from-bottom-3 fill-mode-both ease-entrada duration-entrada delay-passo-2 text-titulo-md text-balance sm:text-titulo-lg md:text-titulo-xl">
            <span className="sr-only">Velo Funil, CRM para pequenos negócios. </span>
            A planilha organiza. Ela não avisa quem está esperando.
          </h1>
          {/* Era de 47 palavras e terminava em três negações. Referência de
              conversão põe a sub do hero entre 15 e 25 — acima disso ela deixa
              de ser lida e passa a ser pulada.

              ## Por que ela fala de ORÇAMENTO desde 09/09

              Esta linha é a primeira coisa que confirma — ou desmente — o que a
              pessoa acabou de ler antes de clicar. A mensagem de prospecção que
              sai para os cinco nichos diz, com estas palavras: *"cada orçamento
              vira um card, com a data do retorno"*. Medido em 09/09, a landing
              que o link abre mencionava "orçamento" UMA vez em 191 KB de HTML.

              É o mesmo defeito que a auditoria de 04/09 achou nos seis criativos
              da Meta: seis promessas apontando para uma porta que não repetia
              nenhuma. E aqui custa mais caro, porque a lista é de um tiro só —
              a própria mensagem promete "não te procuro de novo", então prospect
              que chega e não reconhece a promessa está perdido para sempre.

              A frase é o eco literal da mensagem, de propósito. E ela só ficou
              honesta em 08/09: até então o orçamento não existia no produto. */}
          <p className="text-muted-foreground animate-entrada fade-in slide-in-from-bottom-3 fill-mode-both ease-entrada duration-entrada delay-passo-3 max-w-xl text-lg text-balance">
            Cada orçamento vira um card com a data do retorno. Quando o prazo
            está acabando, o sistema lembra você de dar o retorno.
          </p>
          {/* `items-stretch` é o padrão do flex, e é por ser padrão que
              ninguém percebe quando some. É ele que dá aos dois botões a mesma
              largura no celular: o container encolhe até o filho mais largo, e
              os dois esticam nele.

              Basta alguém acrescentar `items-center` aqui um dia, para
              centralizar um ícone qualquer, e as larguras se separam sem que a
              mudança pareça ter relação. Escrito, é decisão; implícito, é
              acidente esperando. Acima de `sm` os botões vão lado a lado e o
              alinhamento passa a ser vertical. */}
          {/* `w-full sm:w-auto` no container é o que dá largura de verdade aos
              CTAs no celular. Sem ele o pai (`items-center`) encolhe esta
              linha até o botão mais largo, e os dois ficavam com 148px dentro
              de um container de 343px, medido: 43% da largura disponível, o
              que faz o CTA principal parecer secundário.

              `items-stretch` é o padrão do flex, e é por ser padrão que
              ninguém percebe quando some. É ele que dá aos dois botões a mesma
              largura no celular. Basta alguém acrescentar `items-center` aqui
              um dia, para centralizar um ícone qualquer, e as larguras se
              separam sem que a mudança pareça ter relação. Escrito, é decisão;
              implícito, é acidente esperando. Acima de `sm` os botões voltam a
              ter a largura do próprio conteúdo, lado a lado. */}
          <div className="animate-entrada fade-in slide-in-from-bottom-3 fill-mode-both ease-entrada duration-entrada delay-passo-4 order-1 mt-2 flex w-full flex-col items-stretch gap-3 sm:order-none sm:w-auto sm:flex-row sm:items-center">
            <Link
              id="hero-cta"
              href="/cadastro"
              className={cn(buttonVariants({ size: 'lg' }), 'gap-2')}
            >
              Começar grátis
              <ArrowRight className="size-4" />
            </Link>
            {/* `ghost`, não `outline`: página de CTA único converte 13,5%
                contra 10,5% de página com CTAs concorrendo. Este não pode
                sumir — é a âncora para quem quer ver o produto antes de
                decidir —, mas dois botões com contorno na mesma dobra dividem
                a atenção em vez de ordená-la. Sem contorno, ele lê como o
                segundo caminho que é. */}
            <ScrollLink
              href="#como-funciona"
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'lg' }),
                'active:translate-y-0',
              )}
            >
              Ver como funciona
            </ScrollLink>
          </div>
          {/* ## A linha embaixo do botão é onde a fricção morre ou sobrevive

              Ela dizia "Grátis para começar, com 50 contatos" — abrindo pelo
              TETO. Copywriter não anuncia a limitação antes da promessa, e o
              diferencial real (preço por empresa) ficava enterrado no fim.

              Pior: ela descrevia um produto que não existe mais. Desde a
              migration 0051 toda empresa nasce com sete dias de Pro
              COMPLETO, e a landing seguia vendendo o freemium antigo. Quem
              criava conta recebia mais do que a página prometeu e nunca ficava
              sabendo — depois perdia recurso que não sabia que tinha.

              A ordem agora é a do Pipedrive na mesma posição ("Teste grátis de
              14 dias, não requer cartão de crédito"): oferta, prazo, e a
              remoção da única fricção que trava o cadastro. O cartão é a
              objeção nº 1 de teste grátis, e não pedimos.

              O preço fica na frase seguinte, curto, porque o teto do Free
              continua dito na seção de planos e na FAQ —
              três lugares, nenhum deles o hero. */}
          {/* Duas linhas, não uma corrida, e com PESO no que vende.

              A frase estava certa na ordem e errada na hierarquia: era a
              informação comercialmente mais forte da página escrita no menor
              tamanho e na cor mais apagada dela — o mesmo defeito que a
              legenda "por empresa" já teve nos cards de preço e que foi
              corrigido lá.

              Medido em 24/08: o primeiro "R$ 49" da página aparece aqui, a
              0,7 tela, ou seja, na dobra. Quem só olha o topo já podia sair
              sabendo quanto custa — só não conseguia LER. Separar em duas
              linhas e dar peso ao preço e ao "pela empresa inteira" resolve
              sem mexer na posição, que já estava certa. */}
          {/* Uma frase só, com o peso DENTRO dela.

              A primeira tentativa quebrou em duas linhas com `gap`, e a
              segunda — justamente a do preço — caía embaixo do banner de
              consentimento na primeira visita: banner em 646px, linha do
              preço em 656px, medido. O CTA já tinha sido protegido disso em
              23/08; empurrar informação nova para o mesmo buraco seria repetir
              o defeito num alvo diferente.

              A ordem continua sendo a do Pipedrive (oferta, depois preço) —
              copywriter não anuncia a limitação antes da promessa. O que muda
              é só a hierarquia: "R$ 49" e "pela empresa inteira" ganham peso e
              cor dentro da mesma linha, em vez de virarem um parágrafo à
              parte. É a informação comercialmente mais forte da dobra, e
              estava no menor tamanho e na cor mais apagada da página.

              No TELEFONE ela aparece ANTES dos botões (`order-1` no bloco de
              CTAs, revertido em `sm:`). Abaixo deles, ela cai na faixa que o
              banner de consentimento ocupa — e comprimir o banner até liberá-la
              exigiria botões de alvo menor que 44px, o que troca um problema de
              leitura por um de acessibilidade. Acima, ela é lida sempre, e a
              ordem de leitura continua correta: oferta, preço, botão.

              A frase foi encurtada até CABER acima do banner de consentimento,
              medido em 390px: com "nunca por vendedor a mais" no fim ela ia a
              três linhas e sobrepunha 46px. "Pela empresa inteira" já carrega
              o mesmo sentido, e a conta completa (cinco pessoas a R$ 53 = R$
              265) vive na seção de planos, onde há espaço para ela. */}
          <p className="text-muted-foreground animate-entrada fade-in slide-in-from-bottom-3 fill-mode-both ease-entrada duration-entrada delay-passo-4 text-sm text-balance">
            Grátis até {FREE_LEAD_LIMIT} contatos, sem cartão. Pro por{' '}
            <span className="text-foreground font-semibold">R$ {PRO_PLAN_PRICE}/mês</span>{' '}
            <span className="text-primary font-medium">pela empresa inteira</span>.
          </p>

          {/* A saída, na dobra.
              
              O argumento existe na página desde sempre — `ConfiancaSection` tem
              "A porta de saída fica aberta" e a FAQ responde "posso cancelar
              quando quiser?". O problema era POSIÇÃO: os dois moram no meio da
              página, e quem chega de anúncio decide na primeira tela.

              Sete concorrentes brasileiros já anunciam "preço fixo, sem cobrar
              por usuário" (medido em 06/09) — um deles com estas palavras. O
              que continua sem dono é a saída, e ela é a objeção número um do
              mercado: as reclamações públicas contra os CRMs grandes são de
              cancelamento e cobrança, não de preço por assento. */}
          <p className="text-muted-foreground animate-entrada fade-in slide-in-from-bottom-3 fill-mode-both ease-entrada duration-entrada delay-passo-4 text-sm text-balance">
            Cancela sozinho, sem multa, e leva seus contatos em CSV.
          </p>
        </div>

        <div className="animate-entrada fade-in slide-in-from-bottom-3 fill-mode-both ease-entrada duration-entrada delay-passo-5">
          <PipelinePreviewCard />
        </div>
      </div>
    </section>
  )
}
