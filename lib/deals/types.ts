import { leadStatusLabels, type LeadStatus } from '@/lib/leads/types'

export type DealStage = LeadStatus

export type Deal = {
  id: string
  title: string
  leadId: string
  value: number
  stage: DealStage
  owner: string
  dueDate: string
  createdAt: string
}

export const dealStageLabels = leadStatusLabels

export const dealStages: DealStage[] = [
  'novo',
  'contato_realizado',
  'proposta_enviada',
  'negociacao',
  'fechado_ganho',
  'fechado_perdido',
]
