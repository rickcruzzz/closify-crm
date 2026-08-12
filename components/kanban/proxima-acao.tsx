'use client'

import * as React from 'react'
import { CircleAlert, Mail, Phone, StickyNote, Users } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { ActivityType } from '@/lib/leads/types'
import { rotuloDePrazo } from '@/lib/tasks/buckets'
import type { ProximaAcaoRow } from '@/lib/tasks/types'

const iconePorTipo: Record<ActivityType, typeof Phone> = {
  ligacao: Phone,
  email: Mail,
  reuniao: Users,
  nota: StickyNote,
}

/**
 * A próxima ação de um negócio, no canto do card do Kanban.
 *
 * Ocupa o lugar que era do prazo do negócio (`deal.due_date`), e não uma linha
 * a mais. Duas datas num card de 288px brigam: prazo é previsão, próxima ação
 * é ordem, e só uma das duas dá para cumprir hoje. O prazo continua visível no
 * painel de detalhe.
 *
 * Sem tarefa aberta, avisa. Negócio sem próximo passo é o que morre calado no
 * funil, e essa é a informação mais valiosa que o card pode dar — mais até do
 * que uma data.
 */
export function ProximaAcao({ task }: { task: ProximaAcaoRow | undefined }) {
  // O relógio nasce no cliente: o servidor da Vercel roda em UTC, e "atrasada"
  // calculada lá erraria por três horas todo fim de tarde.
  const [agora, setAgora] = React.useState<Date | null>(null)

  React.useEffect(() => {
    setAgora(new Date())
  }, [])

  if (!task) {
    return (
      <span className="text-muted-foreground flex items-center gap-1 text-xs font-medium whitespace-nowrap">
        <CircleAlert aria-hidden className="size-3" />
        Sem próxima ação
      </span>
    )
  }

  const Icone = iconePorTipo[task.type]

  // Antes de o efeito rodar não há relógio confiável. Mostra o ícone sem o
  // rótulo em vez de arriscar escrever "atrasada" para algo que não está.
  if (!agora) {
    return (
      <span className="text-muted-foreground flex items-center gap-1 text-xs whitespace-nowrap">
        <Icone aria-hidden className="size-3" />
      </span>
    )
  }

  const atrasada = new Date(task.due_at).getTime() < agora.getTime()

  return (
    <span
      title={task.title}
      className={cn(
        'flex items-center gap-1 text-xs font-medium whitespace-nowrap',
        atrasada ? 'text-destructive' : 'text-muted-foreground',
      )}
    >
      <Icone aria-hidden className="size-3" />
      {rotuloDePrazo(task.due_at, agora)}
    </span>
  )
}
