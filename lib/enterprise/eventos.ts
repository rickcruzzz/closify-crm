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
  perfil_publico?: string | null
}

/** Prioridade de pesquisa, não probabilidade estatística de fechar contrato. */
export function avaliarEvento(
  evento: DadosDoEvento,
  agora = new Date(),
  espacos: { cidade: string; regiao: string | null; nome: string }[] = [],
) {
  const hoje = diaEmSaoPaulo(agora)
  const dias = Math.round(
    (Date.parse(`${evento.data_inicio}T12:00:00Z`) - Date.parse(`${hoje}T12:00:00Z`)) /
      86_400_000,
  )
  const motivos: string[] = []
  const informacoes_faltantes: string[] = []
  let prioridade = 0

  if (evento.fonte_url.startsWith('https://')) {
    prioridade += 15
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
  } else {
    informacoes_faltantes.push('Organizador do evento')
  }
  if (evento.contato_email?.trim() || evento.contato_telefone?.trim()) {
    prioridade += 15
    motivos.push('Canal direto de contato informado.')
  } else {
    motivos.push('Ainda falta confirmar um canal de contato.')
    informacoes_faltantes.push('Contato público do organizador')
  }
  if ((evento.publico_estimado ?? 0) >= 1000) {
    prioridade += 10
    motivos.push('Público estimado de pelo menos mil pessoas.')
  } else if ((evento.publico_estimado ?? 0) >= 100) {
    prioridade += 5
    motivos.push('Público estimado de pelo menos cem pessoas.')
  } else {
    motivos.push('Público estimado ainda não foi confirmado.')
    informacoes_faltantes.push('Tamanho do público com fonte verificável')
  }

  if (!evento.perfil_publico?.trim()) {
    informacoes_faltantes.push('Perfil do público para adequar a campanha')
  }

  const espacosCompativeis = espacos.filter(
    (espaco) => espaco.cidade.trim().toLocaleLowerCase('pt-BR') === evento.cidade.trim().toLocaleLowerCase('pt-BR'),
  )
  let compatibilidade_espacos: string
  if (espacosCompativeis.length > 0) {
    prioridade += 10
    compatibilidade_espacos = `${espacosCompativeis.length} espaço(s) cadastrado(s) em ${evento.cidade}: ${espacosCompativeis.map((espaco) => espaco.nome).join(', ')}. A adequação ao público e a disponibilidade ainda exigem conferência.`
    motivos.push('Há espaços cadastrados na cidade do evento.')
  } else if (espacos.length === 0) {
    compatibilidade_espacos = 'Sem inventário de outdoor cadastrado; a compatibilidade não pode ser confirmada.'
    informacoes_faltantes.push('Pontos de outdoor e formatos realmente disponíveis')
  } else {
    compatibilidade_espacos = `Nenhum espaço cadastrado em ${evento.cidade}.`
    motivos.push('Não há espaço cadastrado na cidade do evento.')
  }

  return { prioridade, justificativa: motivos.join(' '), informacoes_faltantes, compatibilidade_espacos }
}
