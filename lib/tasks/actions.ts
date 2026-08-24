'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { resolverWorkspaceAtivo } from '@/lib/workspace/ativo'
import { taskSchema } from '@/lib/validations/task'
import { getTasksNoIntervalo } from '@/lib/tasks/queries'
import type { TaskRow } from '@/lib/tasks/types'

const idSchema = z.uuid('Tarefa inválida.')
const diaSchema = z.iso.date('Data inválida.')

type Sessao = {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  workspaceId: string
}

/**
 * O preâmbulo que toda action daqui repete: sessão viva e empresa ativa.
 *
 * Server Action é endpoint HTTP, dá para chamá-la sem passar pela tela. Nada
 * abaixo pode assumir que veio da interface.
 */
async function abrirSessao(): Promise<Sessao | { error: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Sessão expirada.' }

  const workspaceId = await resolverWorkspaceAtivo(supabase, user.id)
  if (!workspaceId) return { error: 'Workspace não encontrado.' }

  return { supabase, userId: user.id, workspaceId }
}

/**
 * Confere que o lead, o negócio e o responsável informados são da empresa
 * ativa.
 *
 * A RLS de `tasks` só olha `workspace_id`, ela aceitaria uma tarefa da minha
 * empresa apontando para o `lead_id` de outra, ou atribuída a um `user_id`
 * fora da empresa. Isso não vaza dado (a leitura continua barrada pela RLS
 * de quem for lida), mas criaria linha com referência cruzada estranha: o
 * `join` da tela mostraria "Sem cliente" sem ninguém entender por quê, e uma
 * tarefa atribuída a alguém de fora nunca apareceria pra ninguém que
 * pudesse concluí-la.
 */
async function conferirAlvo(
  sessao: Sessao,
  leadId: string | null | undefined,
  dealId: string | null | undefined,
  assigneeId: string | null | undefined,
): Promise<string | null> {
  if (leadId) {
    const { data } = await sessao.supabase
      .from('leads')
      .select('id')
      .eq('id', leadId)
      .eq('workspace_id', sessao.workspaceId)
      .maybeSingle()

    if (!data) return 'Contato não encontrado.'
  }

  if (dealId) {
    const { data } = await sessao.supabase
      .from('deals')
      .select('id')
      .eq('id', dealId)
      .eq('workspace_id', sessao.workspaceId)
      .maybeSingle()

    if (!data) return 'Negócio não encontrado.'
  }

  if (assigneeId) {
    const { data } = await sessao.supabase
      .from('workspace_members')
      .select('user_id')
      .eq('user_id', assigneeId)
      .eq('workspace_id', sessao.workspaceId)
      .maybeSingle()

    if (!data) return 'Responsável não encontrado nesta empresa.'
  }

  return null
}

/**
 * As telas que mostram tarefa. Revalidadas juntas porque a mesma tarefa
 * aparece em três lugares, e ver "concluída" numa tela e "aberta" noutra é
 * pior do que não ter a funcionalidade.
 */
function revalidarTelasDeTarefa(leadId?: string | null) {
  revalidatePath('/hoje')
  revalidatePath('/kanban')
  if (leadId) revalidatePath(`/leads/${leadId}`)
}

export async function criarTarefa(values: unknown) {
  const parsed = taskSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }

  const sessao = await abrirSessao()
  if ('error' in sessao) return sessao

  const { title, type, dueAt, assigneeId, leadId, dealId } = parsed.data

  const problema = await conferirAlvo(sessao, leadId, dealId, assigneeId)
  if (problema) return { error: problema }

  const { error } = await sessao.supabase.from('tasks').insert({
    workspace_id: sessao.workspaceId,
    lead_id: leadId ?? null,
    deal_id: dealId ?? null,
    assignee_id: assigneeId,
    created_by: sessao.userId,
    title,
    type,
    due_at: dueAt.toISOString(),
  })

  if (error) {
    // A trigger do teto (0029) recusa com 42501. Sem tratar aqui, a mensagem
    // do Postgres morreria no log e a tela diria "Não foi possível salvar",
    // o mesmo defeito que a importação de planilha já pagou uma vez.
    if (error.code === '42501') {
      return { error: error.message }
    }
    console.error('criarTarefa falhou', error)
    return { error: 'Não foi possível criar a tarefa.' }
  }

  revalidarTelasDeTarefa(leadId)
  return { success: true }
}

export async function atualizarTarefa(taskId: unknown, values: unknown) {
  const id = idSchema.safeParse(taskId)
  if (!id.success) return { error: 'Tarefa inválida.' }

  const parsed = taskSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }

  const sessao = await abrirSessao()
  if ('error' in sessao) return sessao

  const { title, type, dueAt, assigneeId, leadId, dealId } = parsed.data

  const problema = await conferirAlvo(sessao, leadId, dealId, assigneeId)
  if (problema) return { error: problema }

  const { error } = await sessao.supabase
    .from('tasks')
    .update({
      title,
      type,
      due_at: dueAt.toISOString(),
      assignee_id: assigneeId,
      lead_id: leadId ?? null,
      deal_id: dealId ?? null,
    })
    .eq('id', id.data)
    .eq('workspace_id', sessao.workspaceId)

  if (error) {
    console.error('atualizarTarefa falhou', error)
    return { error: 'Não foi possível salvar a tarefa.' }
  }

  revalidarTelasDeTarefa(leadId)
  return { success: true }
}

/**
 * Conclui a tarefa e grava a atividade correspondente na timeline do lead.
 *
 * A atividade é o registro permanente: daqui a seis meses, quem abre o cliente
 * precisa ver que a ligação aconteceu, e a tarefa concluída não aparece em
 * lista nenhuma. Sem este espelho, o histórico teria buraco justamente no que
 * foi feito por follow-up.
 *
 * Só grava se a tarefa tiver lead, atividade é sempre de um lead (0001). E o
 * `.is('done_at', null)` faz o clique repetido não gerar duas atividades: o
 * segundo update não casa com nenhuma linha.
 */
export async function concluirTarefa(taskId: unknown) {
  const id = idSchema.safeParse(taskId)
  if (!id.success) return { error: 'Tarefa inválida.' }

  const sessao = await abrirSessao()
  if ('error' in sessao) return sessao

  const { data: concluida, error } = await sessao.supabase
    .from('tasks')
    .update({ done_at: new Date().toISOString() })
    .eq('id', id.data)
    .eq('workspace_id', sessao.workspaceId)
    .is('done_at', null)
    .select('id, title, type, lead_id')
    .maybeSingle()

  if (error) {
    console.error('concluirTarefa falhou', error)
    return { error: 'Não foi possível concluir a tarefa.' }
  }

  // Nenhuma linha: ou já estava concluída, ou é de outra empresa. Nos dois
  // casos não há o que fazer, e não há o que contar para quem chamou.
  if (!concluida) {
    revalidarTelasDeTarefa()
    return { success: true }
  }

  if (concluida.lead_id) {
    const { error: erroAtividade } = await sessao.supabase.from('activities').insert({
      workspace_id: sessao.workspaceId,
      lead_id: concluida.lead_id,
      author_id: sessao.userId,
      type: concluida.type,
      description: concluida.title,
    })

    // A tarefa já está concluída neste ponto. Falhar aqui não pode desfazer
    // isso nem virar erro na tela, perder a linha da timeline é ruim, mostrar
    // a tarefa de volta como aberta é pior.
    if (erroAtividade) {
      console.error('concluirTarefa: atividade não registrada', erroAtividade)
    }
  }

  revalidarTelasDeTarefa(concluida.lead_id)
  return { success: true }
}

/**
 * Reabre a tarefa. Não apaga a atividade que a conclusão gerou, a ligação
 * aconteceu de verdade, e reabrir o compromisso não desfaz o passado.
 */
export async function reabrirTarefa(taskId: unknown) {
  const id = idSchema.safeParse(taskId)
  if (!id.success) return { error: 'Tarefa inválida.' }

  const sessao = await abrirSessao()
  if ('error' in sessao) return sessao

  const { data, error } = await sessao.supabase
    .from('tasks')
    .update({ done_at: null })
    .eq('id', id.data)
    .eq('workspace_id', sessao.workspaceId)
    .select('lead_id')
    .maybeSingle()

  if (error) {
    console.error('reabrirTarefa falhou', error)
    return { error: 'Não foi possível reabrir a tarefa.' }
  }

  revalidarTelasDeTarefa(data?.lead_id)
  return { success: true }
}

/**
 * Busca tarefas de um intervalo fora dos 42 dias que `/calendario` carregou
 * no primeiro render — usada quando o modo Semana navega para fora do mês
 * carregado. Sem isso a Semana ficaria presa ao intervalo da carga inicial,
 * mostrando dia vazio para toda semana fora do mês aberto.
 */
export async function buscarTarefasNoIntervalo(
  desde: unknown,
  ate: unknown,
): Promise<{ tasks: TaskRow[] } | { error: string }> {
  const desdeParsed = diaSchema.safeParse(desde)
  const ateParsed = diaSchema.safeParse(ate)
  if (!desdeParsed.success || !ateParsed.success) return { error: 'Intervalo inválido.' }

  const sessao = await abrirSessao()
  if ('error' in sessao) return sessao

  const tasks = await getTasksNoIntervalo(
    sessao.workspaceId,
    `${desdeParsed.data}T00:00:00-03:00`,
    `${ateParsed.data}T23:59:59-03:00`,
  )

  return { tasks }
}

export async function excluirTarefa(taskId: unknown) {
  const id = idSchema.safeParse(taskId)
  if (!id.success) return { error: 'Tarefa inválida.' }

  const sessao = await abrirSessao()
  if ('error' in sessao) return sessao

  const { data, error } = await sessao.supabase
    .from('tasks')
    .delete()
    .eq('id', id.data)
    .eq('workspace_id', sessao.workspaceId)
    .select('lead_id')
    .maybeSingle()

  if (error) {
    console.error('excluirTarefa falhou', error)
    return { error: 'Não foi possível excluir a tarefa.' }
  }

  revalidarTelasDeTarefa(data?.lead_id)
  return { success: true }
}
