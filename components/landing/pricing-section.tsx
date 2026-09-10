import {
  ArrowLeftRight,
  BellRing,
  Building2,
  CalendarDays,
  Check,
  Contact,
  Filter,
  LayoutDashboard,
  Mail,
  Send,
  Users,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { RevealOnScroll } from '@/components/landing/reveal-on-scroll'
import { CtaDoPlano } from '@/components/landing/cta-do-plano'
import { EventoAoVer } from '@/components/analytics/evento-ao-ver'
import {
  FREE_LEAD_LIMIT,
  FREE_MEMBER_LIMIT,
  FREE_PLAN_PRICE,
  FREE_ORCAMENTO_LIMIT,
  FREE_WORKSPACE_LIMIT,
  PRECOS_CONFERIDOS_EM,
  PRECO_MEDIANA_POR_USUARIO,
  PRO_WORKSPACE_LIMIT,
  PRO_PLAN_PRICE,
} from '@/lib/plans'

type Plan = {
  name: string
  price: string
  period?: string
  // Frase curta embaixo do preço, usada só no Pro pra deixar explícito que
  // R$49 é da EMPRESA, não por pessoa. Todo concorrente mapeado na pesquisa
  // de mercado (RD Station, Agendor, Ploomes, PipeRun, Pipedrive, Kommo)
  // cobra por usuário; é a vantagem estrutural mais forte que o produto tem
  // e a lista de benefícios sozinha não deixa isso óbvio.
  precoLegenda?: string
  description: string
  /**
   * Cada benefício carrega o próprio ícone.
   *
   * Antes os dez usavam o mesmo `Check`, que confirma que o item existe mas
   * não diz o que ele é: a lista virava uma coluna de marcas d'água iguais e
   * o olho tinha que ler tudo para diferenciar os planos. Com ícone
   * semântico, dá para bater o olho e entender.
   */
  features: { texto: string; icone: LucideIcon }[]
  cta: string
  /**
   * Para onde o botao leva quem JA TEM sessao, e o que ele passa a dizer.
   *
   * So o Pro define: o CTA do Free leva a `/cadastro`, e quem ja tem conta nao
   * tem o que fazer la. Ausente, o botao nao muda com a sessao.
   */
  logado?: { href: string; cta: string }
  /**
   * A ultima frase antes do botao.
   *
   * Existe nos DOIS cartoes por medida, nao por simetria: o Pro cresceu com a
   * lista nova e o Free ficou com 144px de vao morto contra 16px do Pro,
   * medido. Vao desse tamanho le como cartao inacabado.
   *
   * O que preenche e verdade, nao enchimento — cada um responde a objecao do
   * seu plano.
   */
  fecho?: string
  href: string
  highlighted?: boolean
  delay: number
}

const plans: Plan[] = [
  {
    name: 'Free',
    price: `R$${FREE_PLAN_PRICE}`,
    description: 'Pra sempre, sem cartão e sem prazo pra decidir.',
    // Números vêm das constantes, não escritos à mão: a landing anunciava "Até
    // 2 colaboradores" sem citar o limite de empresa, e um texto fixo aqui
    // volta a divergir do produto na primeira mudança de plano.
    features: [
      /**
       * Este item lidera o cartão de propósito, e a ordem é a decisão.
       *
       * Ele é o único da lista que descreve o que NENHUM concorrente faz —
       * medido em 09/09 sobre 25 geradores de orçamento: 88% geram o PDF, 60%
       * mandam pelo WhatsApp, 48% guardam a validade e **0% avisam antes de
       * vencer**. Os outros itens (funil, painel, contatos) são a categoria
       * inteira; este é a razão de existir.
       *
       * E ele é a parede do Pro desde a 0079. Item que a pessoa vai encostar é
       * o que precisa estar visível ANTES de ela criar a conta: encontrar o
       * limite depois de importar a base é o que faz parecer armadilha.
       */
      {
        texto: `Até ${FREE_ORCAMENTO_LIMIT} orçamentos com lembrete automático`,
        icone: BellRing,
      },
      { texto: `${FREE_WORKSPACE_LIMIT} empresa`, icone: Building2 },
      { texto: `Até ${FREE_MEMBER_LIMIT} colaboradores`, icone: Users },
      { texto: `Até ${FREE_LEAD_LIMIT} contatos`, icone: Contact },
      { texto: 'Funil visual, arrasta e solta', icone: Filter },
      { texto: 'Painel de resultados', icone: LayoutDashboard },
      /**
       * Estes dois entraram por MEDIDA, e sao verdade.
       *
       * Com o Pro indo de 5 para 7 linhas, o cartao do Free ficou com 188px de
       * vao entre o ultimo item e a frase de fecho, contra 16px do Pro —
       * medido em 768 e 1440. Vao desse tamanho le como cartao inacabado, que
       * e o mesmo defeito que fez a frase de fecho nascer nos dois cartoes.
       *
       * O que preenche e verdade conferida, nao enchimento:
       *
       *     convite por e-mail   o teto de 2 colaboradores e o limite, mas
       *                          convidar E do Free (0050 so libera ACIMA do
       *                          teto para quem tem Pro)
       *     importar/exportar    nenhum gate de plano no caminho, conferido
       *                          em `api/leads/exportar` e no dialogo de
       *                          importacao
       *
       * E os dois trabalham a favor: contra quem nao usa CRM nenhum, o grátis
       * nao e isca, e o produto. "Traga e leve seus contatos" responde a
       * objecao de ficar preso antes de ela ser feita.
       */
      { texto: 'Convites por e-mail', icone: Send },
      {
        // "Traga e leve" e nao "Importe e exporte": o verbo importa aqui.
        //
        // O raciocinio certo estava escrito no comentario acima desde que este
        // cartao nasceu — "responde a objecao de ficar preso antes de ela ser
        // feita" — e a TELA nunca disse. Medido em 07/09: "importar" aparecia
        // em seis superficies com frase propria, e "exportar" numa unica, como
        // item de lista sem frase nenhuma.
        //
        // A assimetria dizia o contrario do que o produto faz: a porta de
        // entrada anunciada seis vezes e a de saida escondida e o desenho de
        // quem quer prender.
        texto: 'Traga e leve seus contatos, em CSV',
        icone: ArrowLeftRight,
      },
    ],
    // A pergunta que trava quem considera um plano gratis e sempre a mesma:
    // "e se eu bater no limite, perco o que ja cadastrei?". A trigger da 0023
    // recusa o INSERT novo com 42501 e nao apaga nada — dizer isso remove a
    // objecao com a verdade, em vez de deixar a pessoa supor o pior.
    fecho: `Chegando aos ${FREE_LEAD_LIMIT} contatos, nada some: você só não cadastra novos.`,
    cta: 'Começar grátis',
    href: '/cadastro',
    delay: 0,
  },
  {
    name: 'Pro',
    // Derivado, e nao 'R$49' escrito a mao como esteve ate 10/09.
    //
    // O literal sobreviveu a duas auditorias porque a linha 571 do mesmo
    // arquivo JA lia `PRO_PLAN_PRICE` — o cartao e a comparacao mostravam o
    // mesmo numero por coincidencia, nao por construcao. Na troca de 49 para
    // 97 os dois teriam discordado DENTRO DA MESMA SECAO, com o cartao
    // dizendo 49 e a frase logo abaixo comparando 97 com a mediana.
    price: `R$${PRO_PLAN_PRICE}`,
    period: '/mês',
    precoLegenda: 'Da empresa inteira, nunca por vendedor a mais.',
    description:
      // ## O "por dia" e DERIVADO, e ele estava errado ate 10/09
      //
      // Dizia "Menos de R$2 por dia", escrito a mao quando o plano custava
      // R$ 49 (R$ 1,63/dia). Com R$ 97 sao R$ 3,23 — a frase virou falsa por
      // aritmetica, sem ninguem toca-la, e ficaria mentindo dentro do proprio
      // cartao que anuncia o preco certo logo acima.
      //
      // `Math.ceil` e nao `toFixed`: "Menos de R$4 por dia" continua verdade
      // no arredondamento para cima, enquanto "R$ 3,23 por dia" seria preciso
      // e pior de ler. A palavra "menos" so e honesta com o teto.
      `Menos de R$${Math.ceil(PRO_PLAN_PRICE / 30)} por dia. Um cliente perdido por esquecimento custa mais que isso no ano inteiro.`,
    /**
     * Ordenada pelo que o Free NAO FAZ, e nao pelo que ele faz menos.
     *
     * A lista anterior comecava por limites — "colaboradores ilimitados",
     * "contatos ilimitados" — contra o "ate 50" do Free. Isso diz *voce vai
     * bater num muro*, nao *voce ganha algo*: descreve o mesmo produto com
     * numero maior, e numero maior nao move quem ainda nem chegou perto do
     * teto.
     *
     * Calendar e Gmail sobem ao topo porque sao a UNICA coisa que o Free
     * simplesmente nao tem. E nao e promessa nova: os dois foram verificados
     * funcionando em producao, com o OAuth aprovado pelo Google em 24/08.
     *
     * Os dois primeiros dizem o que a pessoa FAZ ("marcar reuniao", "responder
     * o cliente"), nao o nome da integracao — o nome so importa depois de a
     * pessoa querer a coisa.
     *
     * ## "Tudo do Free" abre a lista, e conserta uma omissao
     *
     * O cartao do Pro NUNCA dizia que o Pro tem o funil e o painel: os dois so
     * apareciam do lado do Free. Quem lia a coluna da direita de cima a baixo
     * via integracao, limite e suporte — e nao encontrava a coisa central do
     * produto. O cartao mais caro descrevia os extras e omitia o principal.
     *
     * A linha nao e beneficio, e a ponte que torna o resto legivel. Por isso
     * vem primeiro, e por isso nao leva "sem os limites": as tres linhas de
     * ilimitado logo abaixo ja mostram isso, e dizer mais mostrar a mesma
     * coisa gasta uma linha.
     *
     * ## Nao ha linha de suporte aqui, e ela NAO deve voltar como "prioritario"
     *
     * Ja existiu, e era FALSO: nao ha fila, SLA nem sistema de chamado —
     * Free e Pro escrevem para o mesmo endereco e chegam na mesma pessoa. Foi
     * removida de tres superficies por isso, virou prazo por um dia, e o dono
     * decidiu tirar de vez.
     *
     * Se alguem quiser vender suporte aqui de novo, o unico texto honesto e um
     * PRAZO que a pessoa cumpra — nunca uma palavra que descreva um mecanismo
     * inexistente. Mesma classe do "contatos ilimitados" removido em 23/08 e do
     * CNPJ exibido como prova estando baixado.
     */
    features: [
      { texto: 'Tudo do Free', icone: Check },
      { texto: 'Marque a reunião no Google Calendar sem sair do funil', icone: CalendarDays },
      { texto: 'Responda o cliente por e-mail, e fica no histórico dele', icone: Mail },
      /**
       * Os tres limites do Free, respondidos um a um, COM OS MESMOS ICONES.
       *
       * Antes eram uma linha so (`Contatos e colaboradores ilimitados`, com o
       * simbolo de infinito), e o comentario de entao dizia que separa-los
       * gastava duas das cinco linhas para a mesma ideia. Com "Tudo do Free"
       * assumindo o trabalho de listar o que se herda, as linhas sobraram.
       *
       * E "empresa" ficava de fora: "Varias empresas no mesmo login" nao diz
       * ilimitado, e diz. Conferido na 0057 — o teto de 1 empresa so existe
       * `if not tem_plano_pro`; com Pro nao ha teto nenhum. Mesma conferencia
       * para contatos (0052) e colaboradores (0050), porque esta pagina tem
       * uma secao chamada "O que a gente garante por escrito".
       *
       * O reuso de `Building2`, `Users` e `Contact` — os mesmos tres icones do
       * cartao do Free — e o desenho, nao economia de import: as duas colunas
       * passam a rimar linha a linha, e o olho compara sem ler.
       *
       *     [empresa] 1 empresa           [empresa] Ate 5 empresas
       *     [pessoas] Ate 2 colaboradores [pessoas] Colaboradores ilimitados
       *     [contato] Ate 50 contatos     [contato] Contatos ilimitados
       *
       * Isso responde a objecao registrada acima contra icone repetido ("viram
       * enfeite"): aqui o icone CARREGA a comparacao, nao decora.
       *
       * **A ORDEM e parte do desenho, nao gosto.** A primeira versao listava
       * contatos, colaboradores, empresas — o espelho do Free —, e visto na
       * tela os icones apareciam em sequencia invertida: o olho tinha que
       * cruzar as colunas para parear. Segue a mesma ordem do Free.
       */
      // ## "Ilimitadas" era falso duas vezes, e foi corrigido em 09/09
      //
      // O plano e do WORKSPACE: quem pagava criava a segunda empresa e ela
      // nascia Free, com teto de 50 contatos dentro de um plano ja comprado.
      // Nem eram ilimitadas, nem eram Pro.
      //
      // A 0078 fez o Pro cobrir cinco empresas do mesmo dono, todas com os
      // recursos Pro — e o texto passou a dizer o numero, que e o que a
      // pessoa consegue conferir.
      { texto: `Ate ${PRO_WORKSPACE_LIMIT} empresas, todas com os recursos Pro`, icone: Building2 },
      { texto: 'Colaboradores ilimitados', icone: Users },
      { texto: 'Contatos ilimitados', icone: Contact },
      // Espelha o primeiro item do Free, e por isso usa o MESMO ícone: os dois
      // cartões ficam lado a lado, e o par é o que faz a diferença ser lida
      // sem comparar palavra por palavra.
      { texto: 'Orçamentos com lembrete, sem limite', icone: BellRing },
    ],
    // Dizia "Voce ja esta usando tudo isso nos seus 7 dias", verdade enquanto
    // a empresa nascia com trial. Com a 0057 deixou de ser, e frase que
    // descreve estado vira mentira no momento em que o estado muda.
    //
    // O que ficou e o argumento que nao depende de trial nenhum: cancelar sem
    // multa tira o risco da decisao, que e a objecao real de quem hesita em
    // por o cartao. E verdade — `cancelarAssinatura` encerra no Asaas e o
    // acesso segue ate o fim do ciclo ja pago.
    fecho: 'Cancela quando quiser, sem multa. O acesso vai até o fim do mês pago.',
    // Dizia "Assinar Pro", e o clique **não assina nada**: leva à mesma tela de
    // criar conta grátis do botão ao lado. O checkout só existe depois do
    // formulário, do e-mail de confirmação e do assistente — ou seja, o rótulo
    // prometia uma cobrança que não acontece ali.
    //
    // Num funil pago isso custa dos dois lados: quem esperava pagar acha que
    // errou de botão, e quem não queria pagar ainda hesita em clicar. "Começar
    // com o Pro" descreve o que o clique faz de verdade, e o `?plano=pro`
    // abaixo continua carregando a intenção até o checkout.
    cta: 'Começar com o Pro',
    // O `?plano=pro` é o que faz o clique valer alguma coisa. Sem ele, este
    // botão levava ao MESMO destino do plano Free, e a intenção de compra
    // morria ali: a pessoa terminava no dashboard em Free, tendo que descobrir
    // Configurações → Cobrança sozinha. O parâmetro vira cookie no cadastro e
    // atravessa a ida ao e-mail de confirmação, para o checkout abrir assim
    // que a empresa nascer.
    href: '/cadastro?plano=pro',
    /**
     * Quem JA criou a conta gratis clicava aqui e caia no painel.
     *
     * O `middleware.ts:168` desvia quem tem sessao de `/cadastro` para
     * `/dashboard` — o que esta certo, e transformava este botao num beco: a
     * pessoa decidiu pagar, clicou em "Comecar com o Pro", e chegou no produto
     * em Free, tendo que descobrir Configuracoes -> Cobranca sozinha.
     *
     * E o pior momento possivel para perder alguem: e o unico instante do
     * funil em que a pessoa esta com o cartao na mao.
     *
     * `?assinar=1` e o mesmo destino que o e-mail de fim de trial usa, e abre o
     * dialogo de CPF/CNPJ direto. `?pagar=1` seria o outro caminho, de quem JA
     * tem assinatura esperando pagamento — nao e este caso.
     */
    logado: { href: '/settings/billing?assinar=1', cta: 'Assinar o Pro' },
    highlighted: true,
    delay: 160,
  },
]

export function PricingSection() {
  return (
    // "Viu o preço" é o sinal de intenção mais barato que esta página produz,
    // e o único de topo com volume suficiente para uma campanha nova aprender
    // — `Purchase` fez 7 em 17 dias, e a Meta pede ~50/semana para sair da
    // fase de aprendizado.
    //
    // O wrapper fica FORA da `<section>` para não mexer no `id="planos"`, que
    // é destino de âncora (`#planos`) em três lugares da landing.
    <EventoAoVer evento="ViewContent">
      {/* `overflow-x-clip` segura o brilho decorativo abaixo, que é mais largo
          que a viewport no mobile e gerava scroll horizontal na página inteira. */}
      <section id="planos" className="relative overflow-x-clip px-4 py-20 md:px-6 md:py-28">
      <div
        aria-hidden
        className="glow-radial pointer-events-none absolute top-1/3 left-1/2 -z-10 h-72 w-[36rem] -translate-x-1/2"
      />
      <div className="mx-auto max-w-4xl">
        <RevealOnScroll className="mx-auto mb-12 flex max-w-2xl flex-col items-center gap-3 text-center">
          <span className="text-muted-foreground inline-flex items-center gap-2 font-mono text-xs tracking-wide uppercase">
            <span aria-hidden className="bg-primary h-px w-4" />
            Planos
            <span aria-hidden className="bg-primary h-px w-4" />
          </span>
          <h2 className="text-titulo-md md:text-titulo-lg">
            Comece de graça. Assine quando fizer sentido.
          </h2>
          {/* Esta página já vendeu duas histórias diferentes, e as duas
              estavam certas na época.

              Até 24/08 dizia "Grátis pra sempre até 50 contatos" — e estava
              ERRADA desde a 0051, que fez toda empresa nascer com Pro por sete
              dias: a página vendia menos do que o sistema entregava.

              Em 29/08 o dono cortou o trial (migration 0057): empresa nova
              volta a nascer no Free. A promessa dos sete dias saiu daqui na
              mesma leva — anunciar o que o produto não dá mais é a mesma
              classe do "contatos ilimitados" e do "suporte prioritário"
              corrigidos nesta semana.

              As empresas que JÁ estavam em avaliação terminam os sete dias
              delas. Isso não aparece na página de propósito: é regra de
              transição, não oferta. */}
          <p className="text-muted-foreground text-lg text-balance">
            O grátis não expira e não pede cartão: {FREE_LEAD_LIMIT} contatos,
            funil e resultados. Quando a empresa crescer, o Pro custa o mesmo
            para uma pessoa ou para dez.
          </p>
        </RevealOnScroll>

        {/* `max-w-2xl` deixava os dois cards com 324px de largura num monitor
            de 1440px, medido, enquanto o Hero da mesma página usa `max-w-6xl`
            (1152px). O salto de escala entre as seções é o que fazia o bloco
            de planos parecer encolhido. `max-w-3xl` mantém a leitura
            confortável sem esticar o card a ponto de a lista de benefícios
            virar uma linha solta e larga. */}
        <div className="mx-auto grid max-w-3xl grid-cols-1 gap-6 sm:grid-cols-2">
          {plans.map((plan) => (
            <RevealOnScroll key={plan.name} delay={plan.delay}>
              <Card
                className={cn(
                  // ## Por que o cartao NAO se move no hover
                  //
                  // Era `pointer:hover:-translate-y-1`: o cartao subia 4px,
                  // medido. Reportado pelo dono como "fica mexendo estranho
                  // quando clica no desktop", e o mecanismo explica: o botao
                  // que ele esta mirando vai junto, entao o alvo se desloca
                  // enquanto a mao ja esta a caminho.
                  //
                  // Cartao de plano e superficie de COMPARACAO, nao alvo
                  // clicavel — o que se clica e o botao dentro. Elevar o
                  // cartao inteiro o trata como botao, que ele nao e.
                  //
                  // Medido em cinco paginas de preco de referencia, com as
                  // media features de mouse real emuladas (sem isso a
                  // variante `pointer:` nem aplica e a medicao mente):
                  //
                  //     Linear, Attio, Vercel, Resend   deslocam 0px
                  //
                  // Nenhuma move o cartao. O feedback de clique fica onde o
                  // clique acontece: o botao ja tem `active:translate-y-px`.
                  'h-full transition-colors duration-200',
                  plan.highlighted
                    ? 'ring-primary shadow-primary/10 shadow-lg ring-2'
                    // Cor da borda em vez de deslocamento: da o sinal de
                    // "isto responde" sem mexer em um pixel de layout.
                    : 'ring-border pointer:hover:ring-muted-foreground/40 ring-1',
                )}
              >
                <CardHeader className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{plan.name}</span>
                    {/* "Recomendado", e nao "Popular".
                        Popular afirma que MUITA GENTE escolheu — prova social,
                        e nao existe: nao ha um cliente externo pagante nesta
                        base. Mesma classe da metrica inventada que a
                        `StatsSection` ja teve e da promessa de "suporte
                        prioritario" removida daqui.
                        Recomendado e primeira pessoa: quem faz o produto diz
                        qual plano indica. Nao depende de ninguem ter comprado,
                        e e o que a tela de cobranca (`plan-comparison-table`)
                        ja dizia — a landing e que estava fora de passo. */}
                    {plan.highlighted && <Badge>Recomendado</Badge>}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-semibold tracking-tight">
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className="text-muted-foreground text-sm">{plan.period}</span>
                    )}
                  </div>
                  {/* Era `text-xs text-muted-foreground`: a informação
                      comercialmente mais forte da página escrita no menor
                      tamanho e na cor mais apagada dela. Preço por EMPRESA, e
                      não por usuário, é o que separa este produto de todos os
                      concorrentes mapeados na pesquisa (ver comentário do tipo
                      `precoLegenda` acima) — quem tem três vendedores paga o
                      mesmo que quem tem um, e isso muda a conta na cabeça de
                      quem está decidindo.

                      Ganhou a cor da marca e uma superfície própria. Continua
                      afirmando o NOSSO modelo, sem citar concorrente: dizer o
                      que os outros cobram seria afirmação sobre terceiro que
                      não temos como provar na página. */}
                  {plan.precoLegenda && (
                    <p className="bg-primary/10 text-primary ring-primary/20 mt-1 w-fit rounded-md px-2 py-1 text-xs font-medium ring-1">
                      {plan.precoLegenda}
                    </p>
                  )}
                  <p className="text-muted-foreground text-sm">{plan.description}</p>
                </CardHeader>
                {/* `flex-1` no conteúdo e `mt-auto` no botão: o `h-full` do
                    card já igualava a ALTURA dos dois, mas o conteúdo do Free
                    é mais curto (o Pro tem legenda de preço e descrição mais
                    longa), então sobrava um vão morto embaixo do botão do
                    Free enquanto o do Pro encostava na base. Com o botão
                    ancorado embaixo, os dois CTAs ficam na mesma linha e a
                    diferença de conteúdo vira respiro no meio, que é onde ela
                    não incomoda. */}
                <CardContent className="flex flex-1 flex-col gap-4">
                  {/* `gap-2.5` e `items-start` em vez de `items-center`: com
                      ícone semântico o texto pode quebrar em duas linhas no
                      celular, e centralizado o ícone descolaria da primeira
                      linha. `mt-px` alinha o traço do ícone com a altura-x da
                      fonte, que `items-start` sozinho não acerta.

                      Cor herdada do texto (`text-muted-foreground`), não o
                      verde que o Check usava: dez ícones coloridos viram
                      enfeite e competem com o preço, que é o elemento que
                      precisa ganhar a atenção no card. */}
                  <ul className="flex flex-col gap-2.5">
                    {plan.features.map((feature) => (
                      <li key={feature.texto} className="flex items-start gap-2.5 text-sm">
                        <feature.icone
                          aria-hidden
                          strokeWidth={2}
                          className="text-muted-foreground mt-px size-4 shrink-0"
                        />
                        {feature.texto}
                      </li>
                    ))}
                  </ul>
                  {plan.fecho && (
                    <p className="text-muted-foreground mt-auto text-sm text-pretty">
                      {plan.fecho}
                    </p>
                  )}
                  {/* O unico pedaco de cliente deste cartao, e so por causa
                      do destino: quem JA tem sessao precisa ir para o
                      pagamento, nao para `/cadastro` (de onde o middleware o
                      manda ao painel). A secao continua Server Component, que
                      e o que preserva o LCP da pagina que recebe trafego pago
                      — ver o cabecalho de `cta-do-plano.tsx`. */}
                  <CtaDoPlano
                    hrefDeslogado={plan.href}
                    textoDeslogado={plan.cta}
                    hrefLogado={plan.logado?.href}
                    textoLogado={plan.logado?.cta}
                    variant={plan.highlighted ? 'default' : 'outline'}
                    // `mt-auto` so quando NAO ha fecho: com os dois, o espaco
                    // sobraria entre a frase e o botao em vez de acima dela, e
                    // os dois cartoes deixariam de alinhar.
                    className={plan.fecho ? 'min-h-11 w-full' : 'mt-auto min-h-11 w-full'}
                  />
                </CardContent>
              </Card>
            </RevealOnScroll>
          ))}
        </div>

        {/* ## Por que a comparação entra aqui

            É a nossa única vantagem que o concorrente não consegue igualar sem
            mudar o próprio modelo de negócio — e a landing a sussurrava numa
            legenda, no menor tamanho de fonte da página.

            Os números são de tabela pública, conferidos em 24/08: Agendor a
            partir de R$ 53 POR USUÁRIO; PipeRun de R$ 499,90 a R$ 1.099,90/mês;
            Ploomes a partir de ~R$ 225/mês para 3 usuários. Não é prova social
            inventada — é preço publicado por eles, e por isso pode ser dito.

            Fica logo abaixo dos cards de propósito: o número R$ 49 acabou de ser
            lido, e é nesse instante que o cérebro procura uma âncora para saber
            se é caro. Sem âncora, ele usa "R$ 0", e qualquer preço perde. Com
            ela, R$ 49 é comparado com R$ 265.

            Nomes de concorrente ficam de fora de propósito: comparação nominal
            em página de venda convida processo e ainda ensina o nome deles a
            quem não conhecia. O modelo de cobrança é o que importa. */}
        <RevealOnScroll delay={280} className="mx-auto mt-12 max-w-2xl">
          <div className="border-border bg-muted/30 rounded-xl border p-6 text-center">
            <p className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
              A conta que ninguém faz antes de assinar
            </p>
            <p className="mt-3 text-balance">
              A maioria dos CRMs cobra <strong>por vendedor</strong>. A conta sobe toda
              vez que você contrata alguém.
            </p>

            {/* ## Por que uma TABELA e não a frase que estava aqui

                O texto anterior citava um ponto só da curva: cinco pessoas a
                R$ 53 dão R$ 265. Verdadeiro, e fraco como argumento — quem tem
                dois vendedores hoje lê "cinco pessoas" e conclui que não é o
                caso dele.

                O que converte é ver a diferença CRESCER. Uma linha constante ao
                lado de uma que sobe diz sozinha o que dois parágrafos tentavam
                dizer, e cada pessoa encontra a própria coluna.

                A mediana de R$ 60 sai de tabela pública conferida em 31/08:
                Agendor R$ 53, Moskit R$ 59, RD Station ~R$ 60, Ploomes ~R$ 75
                (R$ 225 para 3), Pipedrive ~R$ 80 (US$ 14,90). Preço publicado
                por eles, então pode ser dito — não é prova social inventada.

                **Preço de concorrente envelhece**, e é a mesma classe do CNPJ
                baixado que ficou 17 dias no ar. A data da conferência fica no
                código e na tela: quem revisar daqui a três meses sabe que
                precisa reconferir. */}
            <table className="mx-auto mt-5 w-full max-w-sm border-separate border-spacing-y-1 text-sm">
              <caption className="sr-only">
                Comparação de custo mensal por tamanho de equipe
              </caption>
              <thead>
                <tr className="text-muted-foreground text-xs">
                  <th scope="col" className="text-left font-normal">
                    Equipe
                  </th>
                  <th scope="col" className="text-right font-normal">
                    Cobrando por pessoa
                  </th>
                  <th scope="col" className="text-right font-normal">
                    Aqui
                  </th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {[1, 3, 5, 10].map((pessoas) => (
                  <tr key={pessoas}>
                    <th
                      scope="row"
                      className="text-muted-foreground text-left font-normal"
                    >
                      {pessoas === 1 ? '1 pessoa' : `${pessoas} pessoas`}
                    </th>
                    <td className="text-muted-foreground text-right">
                      R$ {PRECO_MEDIANA_POR_USUARIO * pessoas}
                    </td>
                    <td className="text-foreground text-right font-semibold">
                      R$ {PRO_PLAN_PRICE}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="text-muted-foreground mt-4 text-xs text-balance">
              Preço de tabela pública dos CRMs que cobram por usuário, conferido em{' '}
              {PRECOS_CONFERIDOS_EM}. Aqui a equipe inteira cabe na mesma mensalidade.
            </p>
          </div>
        </RevealOnScroll>
        </div>
      </section>
    </EventoAoVer>
  )
}
