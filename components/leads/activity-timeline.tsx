import { FileText, History, Mail, MessageCircle, Phone, Users } from 'lucide-react'

import { linkificar, rotuloDoLink } from '@/lib/leads/linkificar'
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
  // Verde do WhatsApp, e nao a cor do produto: aqui o reconhecimento vale mais
  // que a coerencia de marca. Quem bate o olho precisa saber de onde veio
  // antes de ler o rotulo.
  //
  // Ate a migration 0054 a conversa era gravada como `nota` com o texto
  // prefixado por "WhatsApp: ". O prefixo virava parte do que o cliente
  // escreveu em toda exportacao e busca; agora quem diz a origem e o tipo.
  whatsapp: {
    label: 'WhatsApp',
    icon: MessageCircle,
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
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
                  {/* Conversa de WhatsApp nao tem menu de acoes, nem para
                      admin. Ela e o registro do que o CLIENTE escreveu, e
                      editar ou apagar falsifica o historico — que e
                      exatamente o que o produto promete guardar. O tipo
                      `ActivityTypeManual` faz o compilador cobrar isso. */}
                  {activity.type !== 'whatsapp' ? (
                    <ActivityActions
                      activityId={activity.id}
                      tipoAtual={activity.type}
                      descricaoAtual={activity.description}
                      podeEditar={isAdmin || activity.author_id === currentUserId}
                    />
                  ) : null}
                </div>
              </div>
              {/* Link vira link, e o resto continua texto.
                  
                  `linkificar` devolve PEDAÇOS e não HTML: a descrição é escrita
                  por gente, e mandar isso para `dangerouslySetInnerHTML` seria
                  XSS clássico. Montando elementos React, o texto é escapado
                  sozinho e só o `href` que a função validou vira endereço.

                  `whitespace-pre-wrap` porque a nota da prospecção tem
                  parágrafos — sem isso ela vira um bloco só. */}
              <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                {linkificar(activity.description).map((pedaco, i) =>
                  pedaco.tipo === 'link' ? (
                    <a
                      key={i}
                      href={pedaco.valor}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="text-foreground underline underline-offset-2 hover:text-primary"
                    >
                      {rotuloDoLink(pedaco.valor)}
                    </a>
                  ) : (
                    <span key={i}>{pedaco.valor}</span>
                  ),
                )}
              </p>
              {/* "Desconhecido" era o autor de toda mensagem de WhatsApp:
                  ela nasce do webhook, sem usuario logado, entao `author_id`
                  e nulo. Dizer "Desconhecido" sugere falha de registro quando
                  na verdade a autoria e conhecida e obvia — foi o cliente. */}
              <span className="text-muted-foreground text-xs">
                {activity.type === 'whatsapp'
                  ? 'recebida pelo WhatsApp'
                  : `por ${activity.author_name ?? 'Desconhecido'}`}
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
