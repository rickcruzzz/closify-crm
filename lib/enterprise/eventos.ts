import { diaEmSaoPaulo } from '@/lib/tasks/buckets'

export type DadosDoEvento = {
  nome: string
  data_inicio: string
  cidade: string
  fonte_url: string
  organizador?: string | null
  contato_nome?: string | null
  contato_email?: string | null
  contato_telefone?: string | null
  publico_estimado?: number | null
}

/** Prioridade de pesquisa, não probabilidade estatística de fechar contrato. */
export function avaliarEvento(evento: DadosDoEvento, agora = new Date()) {
  const hoje = diaEmSaoPaulo(agora)
  const dias = Math.round(
    (Date.parse(`${evento.data_inicio}T12:00:00Z`) - Date.parse(`${hoje}T12:00:00Z`)) /
      86_400_000,
  )
  const motivos: string[] = []
  let prioridade = 0

  if (evento.fonte_url.startsWith('https://')) {
    prioridade += 20
    motivos.push('Página pública do evento informada para conferência.')
  }
  if (dias >= 0) {
    prioridade += 20
    motivos.push('Evento ainda vai acontecer.')
  } else {
    motivos.push('Data do evento já passou; confirme a próxima edição.')
  }
  if (dias >= 15 && dias <= 120) {
    prioridade += 20
    motivos.push('Há de 15 a 120 dias para planejar a campanha.')
  } else if (dias >= 0 && dias < 15) {
    motivos.push('Prazo curto para negociar e produzir a campanha.')
  }
  if (evento.organizador?.trim()) {
    prioridade += 10
    motivos.push('Organizador identificado.')
  }
  if (evento.contato_email?.trim() || evento.contato_telefone?.trim()) {
    prioridade += 15
    motivos.push('Canal direto de contato informado.')
  } else {
    motivos.push('Ainda falta confirmar um canal de contato.')
  }
  if ((evento.publico_estimado ?? 0) >= 1000) {
    prioridade += 15
    motivos.push('Público estimado de pelo menos mil pessoas.')
  } else if ((evento.publico_estimado ?? 0) >= 100) {
    prioridade += 8
    motivos.push('Público estimado de pelo menos cem pessoas.')
  } else {
    motivos.push('Público estimado ainda não foi confirmado.')
  }

  return { prioridade, justificativa: motivos.join(' ') }
}
