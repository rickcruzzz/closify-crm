import Link from 'next/link'
import {
  Building2,
  CalendarDays,
  Contact,
  Filter,
  Headset,
  Infinity as InfinityIcon,
  LayoutDashboard,
  Users,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { DIAS_DE_TRIAL } from '@/lib/plans/trial'
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
    features: [
      { texto: 'Várias empresas no mesmo login', icone: Building2 },
      { texto: 'Colaboradores ilimitados', icone: Users },
      // Os dois "ilimitados" seguidos ganhariam ícones repetidos do Free
      // (Users e Contact) e a diferença entre os planos sumiria justamente na
      // linha que mais importa. O símbolo de infinito carrega o benefício.
      { texto: 'Contatos ilimitados', icone: InfinityIcon },
      { texto: 'Google Calendar e Gmail conectados', icone: CalendarDays },
      { texto: 'Suporte prioritário', icone: Headset },
    ],
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
            Teste tudo por {DIAS_DE_TRIAL} dias. Depois você decide.
          </h2>
          {/* Dizia "Grátis pra sempre até 50 contatos", que descrevia o produto
              anterior à migration 0051. Toda empresa nova nasce com Pro completo
              por sete dias — a página estava vendendo menos do que o sistema
              entrega, e quem criava conta descobria sozinho. */}
          <p className="text-muted-foreground text-lg text-balance">
            Sua empresa começa com o Pro completo, sem cartão. Passados os{' '}
            {DIAS_DE_TRIAL} dias, ou você assina, ou fica no plano grátis. Nunca
            cobramos sem você escolher.
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
                  'h-full transition-[transform,box-shadow] duration-300',
                  'pointer:hover:-translate-y-1 pointer:hover:shadow-lg',
                  plan.highlighted
                    ? 'ring-primary shadow-primary/10 shadow-lg ring-2'
                    : 'ring-border ring-1',
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
                  <Link
                    href={plan.href}
                    className={cn(
                      buttonVariants({
                        variant: plan.highlighted ? 'default' : 'outline',
                      }),
                      'mt-auto min-h-11 w-full',
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
