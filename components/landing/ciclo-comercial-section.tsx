import { BarChart3, Radar, Users, Workflow } from 'lucide-react'

import { RevealOnScroll } from '@/components/landing/reveal-on-scroll'

/**
 * O ciclo inteiro, logo abaixo do hero.
 *
 * Ocupa a faixa que era da `StatsSection`, cujos quatro números ("50 contatos
 * no plano grátis", "2 min para criar a conta", "R$ 97 por mês") descreviam o
 * funil de cadastro que a página deixou de oferecer em 22/10.
 *
 * O trabalho da faixa passou a ser outro: dizer em uma linha que o Radar e o
 * CRM são UM produto. Encontrar e acompanhar são as duas metades, e quem lê
 * só o topo da página precisa sair sabendo que elas se ligam.
 *
 * Continua valendo a regra que a `StatsSection` registrou: nenhuma métrica de
 * resultado aqui. São etapas do que o produto faz, não promessas.
 */
const etapas = [
  {
    titulo: 'Encontre',
    descricao: 'O Radar busca oportunidades no perfil que você definiu.',
    icone: Radar,
  },
  {
    titulo: 'Centralize',
    descricao: 'Contatos, empresas, fontes e histórico numa base só.',
    icone: Users,
  },
  {
    titulo: 'Gerencie',
    descricao: 'Cada etapa da prospecção ao fechamento, com tarefas e lembretes.',
    icone: Workflow,
  },
  {
    titulo: 'Acompanhe',
    descricao: 'Valor em negociação, conversões e o que travou no caminho.',
    icone: BarChart3,
  },
]

export function CicloComercialSection() {
  return (
    <section className="border-border/60 relative border-y px-4 py-14 md:px-6 md:py-16">
      <ol className="mx-auto grid max-w-5xl grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4">
        {etapas.map((etapa, i) => (
          <RevealOnScroll
            key={etapa.titulo}
            delay={i * 130}
            as="li"
            className="flex flex-col items-center gap-2 text-center"
          >
            <span className="bg-primary/10 flex size-10 items-center justify-center rounded-lg">
              <etapa.icone aria-hidden className="text-primary size-5" />
            </span>
            <span className="font-semibold">{etapa.titulo}</span>
            <span className="text-muted-foreground max-w-[22ch] text-sm leading-relaxed">
              {etapa.descricao}
            </span>
          </RevealOnScroll>
        ))}
      </ol>
    </section>
  )
}
