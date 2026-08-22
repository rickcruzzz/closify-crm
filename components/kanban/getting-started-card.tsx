import Link from 'next/link'
import { KanbanSquare, Plus, UserPlus, Users, type LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

// Este guia vivia no Dashboard e escondia o funil e a tabela de prazos até o
// workspace ter dados. Duas coisas davam errado ali: o recém-chegado nunca via
// a forma do produto, e o layout mudava debaixo dele assim que o primeiro
// negócio entrava.
//
// Aqui no Pipeline ele fica no lugar onde a ação acontece, a pessoa lê o que
// fazer na mesma tela em que vai fazer, e some sozinho quando existe negócio.
type Step = {
  icon: LucideIcon
  title: string
  description: string
  action: { tipo: 'link'; href: string; label: string } | { tipo: 'dica'; label: string }
}

const STEPS: Step[] = [
  {
    icon: Users,
    title: 'Cadastre seu primeiro contato',
    description: 'Quem é o contato e de qual empresa. É o ponto de partida do funil.',
    action: { tipo: 'link', href: '/leads', label: 'Ir para Leads' },
  },
  {
    icon: KanbanSquare,
    title: 'Crie um negócio',
    description:
      'Dê um valor e um prazo, e arraste o card entre as etapas conforme avança.',
    // Sem link: o botão "Novo negócio" já está nesta mesma tela, logo acima.
    action: { tipo: 'dica', label: 'Use o botão "Novo negócio" acima' },
  },
  {
    icon: UserPlus,
    title: 'Convide seu time',
    description: 'Colaboradores veem o mesmo funil e assumem seus próprios negócios.',
    action: { tipo: 'link', href: '/settings', label: 'Ir para Configurações' },
  },
]

export function GettingStartedCard() {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Primeiros passos</CardTitle>
        <CardDescription>
          Sua empresa está pronta. Três passos para sair da planilha.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((step) => (
            <li
              key={step.title}
              className="flex flex-col items-start gap-2 rounded-xl border p-4"
            >
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-medium"
                >
                  {STEPS.indexOf(step) + 1}
                </span>
                <step.icon aria-hidden className="text-muted-foreground size-4" />
              </div>
              <p className="text-sm font-medium">{step.title}</p>
              <p className="text-muted-foreground text-sm text-pretty">
                {step.description}
              </p>
              {step.action.tipo === 'link' ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-auto"
                  render={<Link href={step.action.href}>{step.action.label}</Link>}
                />
              ) : (
                <p className="text-muted-foreground mt-auto flex items-center gap-1.5 pt-1 text-xs">
                  <Plus aria-hidden className="size-3" />
                  {step.action.label}
                </p>
              )}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}
