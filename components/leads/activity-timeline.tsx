import { FileText, Mail, Phone, Users } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { Activity, ActivityType } from '@/lib/leads/types'

const activityConfig: Record<ActivityType, { label: string; icon: typeof Phone; className: string }> = {
  ligacao: { label: 'Ligação', icon: Phone, className: 'bg-blue-500/10 text-blue-500' },
  email: { label: 'E-mail', icon: Mail, className: 'bg-violet-500/10 text-violet-500' },
  reuniao: { label: 'Reunião', icon: Users, className: 'bg-amber-500/10 text-amber-500' },
  nota: { label: 'Nota', icon: FileText, className: 'bg-muted-foreground/10 text-muted-foreground' },
}

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

export function ActivityTimeline({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) {
    return (
      <p className="text-muted-foreground py-6 text-center text-sm">
        Nenhuma atividade registrada ainda.
      </p>
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
                <span className="text-muted-foreground text-xs whitespace-nowrap">
                  {dateTimeFormatter.format(new Date(activity.createdAt))}
                </span>
              </div>
              <p className="text-muted-foreground text-sm">{activity.description}</p>
              <span className="text-muted-foreground text-xs">por {activity.author}</span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
