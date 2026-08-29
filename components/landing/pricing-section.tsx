import Link from 'next/link'
import {
  Building2,
  CalendarDays,
  Contact,
  Filter,
  Headset,
  Infinity as InfinityIcon,
  LayoutDashboard,
  Mail,
  Users,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { RevealOnScroll } from '@/components/landing/reveal-on-scroll'
import {
  FREE_LEAD_LIMIT,
  FREE_MEMBER_LIMIT,
  FREE_WORKSPACE_LIMIT,
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
    price: 'R$0',
    description: 'Pra sempre, sem cartão e sem prazo pra decidir.',
    // Números vêm das constantes, não escritos à mão: a landing anunciava "Até
    // 2 colaboradores" sem citar o limite de empresa, e um texto fixo aqui
    // volta a divergir do produto na primeira mudança de plano.
    features: [
      { texto: `${FREE_WORKSPACE_LIMIT} empresa`, icone: Building2 },
      { texto: `Até ${FREE_MEMBER_LIMIT} colaboradores`, icone: Users },
      { texto: `Até ${FREE_LEAD_LIMIT} contatos`, icone: Contact },
      { texto: 'Funil visual, arrasta e solta', icone: Filter },
      { texto: 'Painel de resultados', icone: LayoutDashboard },
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
    price: 'R$49',
    period: '/mês',
    precoLegenda: 'Da empresa inteira, nunca por vendedor a mais.',
    description:
      'Menos de R$2 por dia. Um cliente perdido por esquecimento custa mais que isso no ano inteiro.',
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
     */
    features: [
      { texto: 'Marque a reunião no Google Calendar sem sair do funil', icone: CalendarDays },
      { texto: 'Responda o cliente por e-mail, e fica no histórico dele', icone: Mail },
      // Os dois "ilimitados" na mesma linha: separados, gastavam duas das
      // cinco linhas para dizer a mesma ideia, e empurravam para baixo o que
      // o Free nao tem. O simbolo de infinito carrega o beneficio sem repetir
      // os icones de Users e Contact que o cartao do Free ja usa.
      { texto: 'Contatos e colaboradores ilimitados', icone: InfinityIcon },
      { texto: 'Várias empresas no mesmo login', icone: Building2 },
      /**
       * Era "Suporte prioritário", e era FALSO.
       *
       * Nao existe fila, SLA nem sistema de chamado no produto: suporte e
       * `suporte@velofunil.com.br` encaminhando para uma caixa pessoal. Free
       * e Pro escrevem para o mesmo endereco e chegam na mesma pessoa — nao
       * ha o que priorizar.
       *
       * Mesma classe do "contatos ilimitados" removido daqui em 23/08 e do
       * CNPJ exibido como prova estando baixado. E esta pagina tem uma secao
       * chamada "O que a gente garante por escrito", que convida a conferir.
       *
       * O que ficou e verdade E mais forte: quem responde e quem faz o
       * produto. Concorrente grande nao consegue prometer isso.
       */
      { texto: 'Suporte direto com quem faz o produto', icone: Headset },
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
    cta: 'Assinar Pro',
    // O `?plano=pro` é o que faz o clique valer alguma coisa. Sem ele, este
    // botão levava ao MESMO destino do plano Free, e a intenção de compra
    // morria ali: a pessoa terminava no dashboard em Free, tendo que descobrir
    // Configurações → Cobrança sozinha. O parâmetro vira cookie no cadastro e
    // atravessa a ida ao e-mail de confirmação, para o checkout abrir assim
    // que a empresa nascer.
    href: '/cadastro?plano=pro',
    highlighted: true,
    delay: 160,
  },
]

export function PricingSection() {
  return (
    // `overflow-x-clip` segura o brilho decorativo abaixo, que é mais largo
    // que a viewport no mobile e gerava scroll horizontal na página inteira.
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
                    {plan.highlighted && <Badge>Popular</Badge>}
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
                  <Link
                    href={plan.href}
                    className={cn(
                      buttonVariants({
                        variant: plan.highlighted ? 'default' : 'outline',
                      }),
                      // `mt-auto` so quando nao ha o fecho: com os dois, o
                      // espaco sobraria entre a frase e o botao em vez de
                      // acima dela, e os dois cartoes deixariam de alinhar.
                      // `mt-auto` so quando NAO ha fecho: com os dois, o espaco
                      // sobraria entre a frase e o botao em vez de acima dela.
                      plan.fecho ? 'min-h-11 w-full' : 'mt-auto min-h-11 w-full',
                    )}
                  >
                    {plan.cta}
                  </Link>
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
              A maioria dos CRMs cobra <strong>por vendedor</strong>. Uma equipe de cinco
              pessoas, a R$ 53 cada, custa{' '}
              <strong className="text-foreground">R$ 265 por mês</strong>, e sobe toda
              vez que você contrata alguém.
            </p>
            <p className="mt-3 text-balance">
              Aqui são <strong className="text-foreground">R$ 49</strong>, com a equipe
              que você quiser. Contratar mais gente não aumenta a mensalidade.
            </p>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  )
}
