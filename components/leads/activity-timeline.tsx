import { FileText, History, Mail, Phone, Users } from 'lucide-react'

import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/ui/empty-state'
import { ActivityActions } from '@/components/leads/activity-actions'
import type { ActivityType } from '@/lib/leads/types'

type ActivityRow = {
  id: string
  type: ActivityType
  description: string
  created_at: string
  author_id: string | null
  author_name: string | null
}

const activityConfig: Record<
  ActivityType,
  { label: string; icon: typeof Phone; className: string }
> = {
  // Mesmo ajuste de `lead-status-badge`: no claro o ícone carregava o
  // contraste sozinho contra um fundo de 10% sobre branco, e sem par `dark:`
  // o tom claro ainda vazava para o tema escuro.
  ligacao: {
    label: 'Ligação',
    icon: Phone,
    className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  },
  email: {
    label: 'E-mail',
    icon: Mail,
    className: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  },
  reuniao: {
    label: 'Reunião',
    icon: Users,
    className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  },
  nota: {
    label: 'Nota',
    icon: FileText,
    className: 'bg-muted-foreground/10 text-muted-foreground',
  },
}

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

export function ActivityTimeline({
  activities,
  currentUserId,
  isAdmin,
}: {
  activities: ActivityRow[]
  currentUserId: string
  /** Admin corrige registro de qualquer membro; os demais, só o próprio. */
  isAdmin: boolean
}) {
  if (activities.length === 0) {
    return (
      <EmptyState
        icon={History}
        size="sm"
        title="Nenhuma atividade ainda"
        description="Registre ligações, e-mails, reuniões e notas para manter o histórico do contato."
      />
    )
  }

  return (
    <ol className="flex flex-col gap-6">
      {activities.map((activity, index) => {
        const config = activityConfig[activity.type]
        const Icon = config.icon
        return (
          <li key={activity.id} className="relative flex gap-3">
            {index < activities.length - 1 && (
              <span className="bg-border absolute top-8 left-4 h-[calc(100%-1rem)] w-px" />
            )}
            <span
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-full',
                config.className,
              )}
            >
              <Icon className="size-4" />
            </span>
            <div className="flex flex-1 flex-col gap-0.5 pb-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{config.label}</span>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground text-xs whitespace-nowrap">
                    {dateTimeFormatter.format(new Date(activity.created_at))}
                  </span>
                  <ActivityActions
                    activityId={activity.id}
                    tipoAtual={activity.type}
                    descricaoAtual={activity.description}
                    podeEditar={isAdmin || activity.author_id === currentUserId}
                  />
                </div>
              </div>
              <p className="text-muted-foreground text-sm">{activity.description}</p>
              <span className="text-muted-foreground text-xs">
                por {activity.author_name ?? 'Desconhecido'}
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
