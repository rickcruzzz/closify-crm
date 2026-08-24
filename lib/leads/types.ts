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

/**
 * Os rótulos das seis etapas, como aparecem na tela.
 *
 * ## "A contatar", não "Novo Lead" (24/08)
 *
 * "Lead" é jargão de quem vende software de vendas, não de quem vende serviço.
 * O `prd-copy-sem-jargao.md` já tinha banido a palavra e a renomeação de 19/08
 * a tirou do menu — mas ela sobreviveu aqui, que é justamente onde mais gente
 * a lê: é a primeira coluna do funil, visível em toda visita ao Kanban.
 *
 * O substituto não é "Novo contato", que seria a tradução literal: seguido de
 * "Contato Realizado", viraria contato → contato, e a pessoa não saberia o que
 * separa uma coluna da outra. "A contatar" nomeia a AÇÃO PENDENTE, que é o que
 * a coluna de fato significa, e a progressão para "Contato Realizado" passa a
 * se explicar sozinha.
 *
 * A chave do enum continua `novo` — ela é `deal_stage` no Postgres, usada em
 * 22 arquivos, e renomeá-la seria migration para trocar uma palavra que
 * ninguém digita.
 */
export const leadStatusLabels: Record<LeadStatus, string> = {
  novo: 'A contatar',
  contato_realizado: 'Contato Realizado',
  proposta_enviada: 'Proposta Enviada',
  negociacao: 'Negociação',
  fechado_ganho: 'Fechado Ganho',
  fechado_perdido: 'Fechado Perdido',
}
