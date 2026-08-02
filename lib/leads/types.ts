export type LeadStatus =
  | 'novo'
  | 'contato_realizado'
  | 'proposta_enviada'
  | 'negociacao'
  | 'fechado_ganho'
  | 'fechado_perdido'

export type Lead = {
  id: string
  name: string
  email: string
  phone: string
  company: string
  status: LeadStatus
  owner: string
  value: number
  createdAt: string
}

export type ActivityType = 'ligacao' | 'email' | 'reuniao' | 'nota'

export type Activity = {
  id: string
  leadId: string
  type: ActivityType
  description: string
  author: string
  createdAt: string
}

export const leadStatusLabels: Record<LeadStatus, string> = {
  novo: 'Novo Lead',
  contato_realizado: 'Contato Realizado',
  proposta_enviada: 'Proposta Enviada',
  negociacao: 'Negociação',
  fechado_ganho: 'Fechado Ganho',
  fechado_perdido: 'Fechado Perdido',
}
