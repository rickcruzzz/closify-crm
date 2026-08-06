import Link from 'next/link'
import { KanbanSquare, UserPlus, Users, type LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const STEPS: {
  icon: LucideIcon
  title: string
  description: string
  href: string
  cta: string
}[] = [
  {
    icon: Users,
    title: 'Cadastre seu primeiro lead',
    description: 'Quem é o contato e de qual empresa. É o ponto de partida do funil.',
    href: '/leads',
    cta: 'Ir para Leads',
  },
  {
    icon: KanbanSquare,
    title: 'Crie um negócio no pipeline',
    description: 'Dê um valor e um prazo, e arraste entre as etapas conforme avança.',
    href: '/kanban',
    cta: 'Ir para o Pipeline',
  },
  {
    icon: UserPlus,
    title: 'Convide seu time',
    description: 'Colaboradores veem o mesmo funil e assumem seus próprios negócios.',
    href: '/settings',
    cta: 'Ir para Configurações',
  },
]

export function GettingStartedCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Primeiros passos</CardTitle>
        <CardDescription>
          Seu workspace está pronto. Três passos para sair da planilha.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li
              key={step.href}
              className="flex flex-col items-start gap-2 rounded-xl border p-4"
            >
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium"
                >
                  {index + 1}
                </span>
                <step.icon aria-hidden className="text-muted-foreground size-4" />
              </div>
              <p className="text-sm font-medium">{step.title}</p>
              <p className="text-muted-foreground text-sm text-pretty">
                {step.description}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-auto"
                render={<Link href={step.href}>{step.cta}</Link>}
              />
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}
