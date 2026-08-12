import type { ActivityType } from '@/lib/leads/types'

/**
 * Uma tarefa como as telas precisam dela: já com o nome do cliente e do
 * responsável resolvidos, porque `tasks` só guarda os ids e nenhuma tela
 * mostra uuid para o usuário.
 */
export type TaskRow = {
  id: string
  title: string
  type: ActivityType
  due_at: string
  done_at: string | null
  lead_id: string | null
  deal_id: string | null
  assignee_id: string | null
  lead_name: string | null
  assignee_name: string | null
}

/**
 * O mínimo que o card do Kanban precisa: ícone, prazo e título no `title=`.
 *
 * Tipo separado porque o /kanban carrega todos os negócios abertos sem
 * paginar, e cada campo a mais é multiplicado pelo tamanho do funil. Medido em
 * produção com 100 negócios: `TaskRow` inteiro custa 315 B por negócio, esta
 * versão custa 198 B — 37% a menos, e a consulta de negócios que já existia
 * custa 292 B. Sem o corte, a próxima ação mais que dobraria o peso da rota.
 */
export type ProximaAcaoRow = {
  id: string
  title: string
  type: ActivityType
  due_at: string
  deal_id: string | null
}

/**
 * Os quatro grupos da tela /hoje, nesta ordem.
 *
 * `atrasada` vem primeiro de propósito: é o único grupo que representa uma
 * promessa já quebrada, e enterrá-lo embaixo de "hoje" seria esconder
 * justamente o que a tela existe para mostrar.
 */
export type TaskBucket = 'atrasada' | 'hoje' | 'semana' | 'depois'

export const taskBuckets: TaskBucket[] = ['atrasada', 'hoje', 'semana', 'depois']

export const taskBucketLabels: Record<TaskBucket, string> = {
  atrasada: 'Atrasadas',
  hoje: 'Hoje',
  // "Próximos 7 dias" e não "Esta semana": o grupo é uma janela de 7 dias a
  // partir de hoje, não a semana do calendário. Chamar de "esta semana"
  // deixaria o rótulo mentindo na sexta-feira, quando ele mostraria a semana
  // que vem inteira.
  semana: 'Próximos 7 dias',
  depois: 'Depois',
}

export const taskTypeLabels: Record<ActivityType, string> = {
  ligacao: 'Ligação',
  email: 'E-mail',
  reuniao: 'Reunião',
  nota: 'Nota',
}
