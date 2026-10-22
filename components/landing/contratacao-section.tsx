import {
  ArrowLeftRight,
  BellRing,
  Contact,
  FileSearch,
  Filter,
  KanbanSquare,
  LayoutDashboard,
  MessageSquareText,
  Radar,
  Sparkles,
  Target,
  Users,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { RevealOnScroll } from '@/components/landing/reveal-on-scroll'
import {
  linkDoContatoComercial,
  type MotivoDoContato,
} from '@/lib/marketing/contato-comercial'

/**
 * Como contratar, no lugar dos cartões de preço.
 *
 * ## Por que a página inicial não mostra mais Free, Pro e Max (22/10)
 *
 * O reposicionamento para CRM B2B + Radar levou toda a contratação para uma
 * conversa com a equipe (decisão do dono). Cartão com preço e botão de
 * cadastro ao lado de "fale com a equipe" seriam dois funis brigando na
 * mesma tela.
 *
 * Os planos NÃO deixaram de existir: `pricing-section.tsx` continua no
 * repositório, a tela de Cobrança continua vendendo, e quem já é cliente não
 * muda nada. Só a vitrine da home mudou.
 *
 * ## O que cada cartão afirma
 *
 * Só o que existe. O CRM lista o que a grade de funcionalidades já prova; o
 * Radar segue o texto do cartão Enterprise de 21/10 — "prioridade explicada
 * por sinais verificáveis", "sua equipe revisa e decide" —, generalizado sem
 * nicho. Nenhum dos dois promete volume de leads.
 */
type Oferta = {
  nome: string
  legenda: string
  descricao: string
  itens: { texto: string; icone: LucideIcon }[]
  cta: string
  motivo: MotivoDoContato
  destaque?: boolean
  delay: number
}

const ofertas: Oferta[] = [
  {
    nome: 'CRM comercial',
    legenda: 'A base da operação de vendas.',
    descricao: 'Para organizar a prospecção que a sua equipe já faz e acompanhar cada negociação.',
    itens: [
      { texto: 'Funil visual, arrasta e solta', icone: Filter },
      { texto: 'Histórico de cada contato, com a empresa', icone: Contact },
      { texto: 'Tarefas e lembretes de retorno', icone: BellRing },
      { texto: 'Painel de resultados', icone: LayoutDashboard },
      { texto: 'Equipe com permissões por papel', icone: Users },
      { texto: 'Traga e leve seus contatos, em CSV', icone: ArrowLeftRight },
    ],
    cta: 'Falar sobre o CRM',
    motivo: 'crm',
    delay: 0,
  },
  {
    nome: 'Radar de Prospecção',
    legenda: 'Sob consulta, com escopo definido com você.',
    descricao: 'Para encontrar novas oportunidades no perfil que a sua empresa quer alcançar.',
    itens: [
      { texto: 'Tudo do CRM comercial', icone: KanbanSquare },
      { texto: 'Busca configurada para o perfil comercial da empresa', icone: Target },
      { texto: 'Fonte e contato registrados em cada oportunidade', icone: FileSearch },
      { texto: 'Prioridade explicada por sinais verificáveis, sem porcentagens inventadas', icone: Radar },
      { texto: 'IA prepara a abordagem; sua equipe revisa e decide quando enviar', icone: MessageSquareText },
      { texto: 'Fontes, região e volume definidos na implantação', icone: Sparkles },
    ],
    cta: 'Falar com a equipe',
    motivo: 'radar',
    destaque: true,
    delay: 160,
  },
]

export function ContratacaoSection() {
  return (
    <section id="contratacao" className="relative overflow-x-clip px-4 py-20 md:px-6 md:py-28">
      <div
        aria-hidden
        className="glow-radial pointer-events-none absolute top-1/3 left-1/2 -z-10 h-72 w-[36rem] -translate-x-1/2"
      />
      <div className="mx-auto max-w-4xl">
        <RevealOnScroll className="mx-auto mb-12 flex max-w-2xl flex-col items-center gap-3 text-center">
          <span className="text-muted-foreground inline-flex items-center gap-2 font-mono text-xs tracking-wide uppercase">
            <span aria-hidden className="bg-primary h-px w-4" />
            Contratação
            <span aria-hidden className="bg-primary h-px w-4" />
          </span>
          <h2 className="text-titulo-md md:text-titulo-lg">
            Uma conversa para desenhar a solução da sua empresa
          </h2>
          <p className="text-muted-foreground text-lg text-balance">
            Conte o segmento, a região, o volume de oportunidades que procura e os critérios
            que importam. A equipe avalia a viabilidade e apresenta uma proposta.
          </p>
        </RevealOnScroll>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {ofertas.map((oferta) => (
            <RevealOnScroll key={oferta.nome} delay={oferta.delay}>
              {/* Mesmo cartão da antiga seção de planos, inclusive a regra de
                  não se mover no hover: o que se clica é o botão, não o cartão
                  (ver o comentário em `pricing-section.tsx`). */}
              <Card
                className={cn(
                  'h-full transition-colors duration-200',
                  oferta.destaque
                    ? 'ring-primary shadow-primary/10 shadow-lg ring-2'
                    : 'ring-border pointer:hover:ring-muted-foreground/40 ring-1',
                )}
              >
                <CardHeader className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{oferta.nome}</span>
                    {oferta.destaque && <Badge>Diferencial</Badge>}
                  </div>
                  <p className="bg-primary/10 text-primary ring-primary/20 mt-1 w-fit rounded-md px-2 py-1 text-xs font-medium ring-1">
                    {oferta.legenda}
                  </p>
                  <p className="text-muted-foreground text-sm">{oferta.descricao}</p>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4">
                  <ul className="flex flex-col gap-2.5">
                    {oferta.itens.map((item) => (
                      <li key={item.texto} className="flex items-start gap-2.5 text-sm">
                        <item.icone
                          aria-hidden
                          strokeWidth={2}
                          className="text-muted-foreground mt-px size-4 shrink-0"
                        />
                        {item.texto}
                      </li>
                    ))}
                  </ul>
                  <a
                    href={linkDoContatoComercial(oferta.motivo)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      buttonVariants({
                        variant: oferta.destaque ? 'default' : 'outline',
                        size: 'lg',
                      }),
                      'mt-auto min-h-11 w-full',
                    )}
                  >
                    {oferta.cta}
                  </a>
                </CardContent>
              </Card>
            </RevealOnScroll>
          ))}
        </div>

        <RevealOnScroll delay={280} className="mx-auto mt-10 max-w-2xl">
          <p className="text-muted-foreground text-center text-sm text-balance">
            Não prometemos quantidade fixa de leads antes de entender o seu mercado: o
            volume depende das fontes disponíveis para o seu segmento e a sua região.
          </p>
        </RevealOnScroll>
      </div>
    </section>
  )
}
