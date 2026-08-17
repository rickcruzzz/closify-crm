'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { resolverWorkspaceAtivo } from '@/lib/workspace/ativo'
import { obterAccessTokenValido } from '@/lib/integrations/token'
import { criarEventoDeCalendario, enviarEmailGmail } from '@/lib/integrations/google'
import { emailMessageSchema } from '@/lib/validations/email'

type Sessao = {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  workspaceId: string
}

// Mesmo preâmbulo de lib/tasks/actions.ts, Server Action é endpoint HTTP,
// nada aqui pode assumir sessão vinda da tela.
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
 * Confere se o Pro ainda vale ANTES de gastar a ida ao Google/Meta.
 *
 * A migration 0037 só gateou conectar/reconectar (`insert`/`update` em
 * `integration_connections`), quem já tinha conectado enquanto Pro continua
 * usando pra sempre, porque `obterAccessTokenValido` lê e renova o token com
 * service role (ignora RLS de propósito, já que o segredo só existe no
 * servidor). Sem esta checagem aqui, "integração é Pro" vira mentira depois
 * do primeiro vencimento.
 */
async function exigirProVigente(sessao: Sessao): Promise<{ error: string } | null> {
  const { data: podeUsar } = await sessao.supabase.rpc('pro_vigente', {
    target_workspace_id: sessao.workspaceId,
  })
  if (!podeUsar) {
    return { error: 'Seu Pro venceu. Reative o plano para continuar usando integrações.' }
  }
  return null
}

/**
 * Cria um evento no Google Calendar a partir de uma tarefa já existente.
 *
 * Reusa data/hora/título da tarefa em vez de abrir um formulário novo: a
 * pessoa já decidiu quando é o compromisso ao agendar a próxima ação, pedir
 * de novo aqui seria o mesmo dado duas vezes. Duração fixa de 30 minutos,
 * ajustável depois no próprio Google Calendar se precisar de mais tempo.
 */
export async function agendarReuniaoNoGoogleCalendar(taskId: string) {
  const sessao = await abrirSessao()
  if ('error' in sessao) return sessao

  const erroDePlano = await exigirProVigente(sessao)
  if (erroDePlano) return erroDePlano

  const { data: task } = await sessao.supabase
    .from('tasks')
    .select('id, title, due_at, lead_id, deal_id')
    .eq('id', taskId)
    .eq('workspace_id', sessao.workspaceId)
    .maybeSingle()

  if (!task) return { error: 'Tarefa não encontrada.' }

  const token = await obterAccessTokenValido(sessao.workspaceId, 'google_calendar')
  if ('error' in token) {
    return { error: 'Conecte o Google Calendar em Configurações → Integrações.' }
  }

  const inicio = new Date(task.due_at)
  const fim = new Date(inicio.getTime() + 30 * 60 * 1000)

  try {
    const evento = await criarEventoDeCalendario(token.accessToken, {
      titulo: task.title,
      inicioIso: inicio.toISOString(),
      fimIso: fim.toISOString(),
      timezone: 'America/Sao_Paulo',
    })

    // Registra na timeline do lead, mesmo espírito de `concluirTarefa`: o
    // evento criado é o tipo de coisa que precisa aparecer no histórico, não
    // só existir na agenda do Google.
    if (task.lead_id) {
      const { error: erroAtividade } = await sessao.supabase.from('activities').insert({
        workspace_id: sessao.workspaceId,
        lead_id: task.lead_id,
        author_id: sessao.userId,
        type: 'reuniao',
        description: `Reunião agendada no Google Calendar: ${task.title} (${evento.htmlLink})`,
        integration_provider: 'google_calendar',
      })
      if (erroAtividade) {
        console.error('agendarReuniaoNoGoogleCalendar: atividade não registrada', erroAtividade)
      }
    }

    revalidatePath('/kanban')
    if (task.lead_id) revalidatePath(`/leads/${task.lead_id}`)

    return { success: true, htmlLink: evento.htmlLink }
  } catch (err) {
    console.error('agendarReuniaoNoGoogleCalendar falhou', err)
    return { error: 'Não foi possível criar o evento no Google Calendar.' }
  }
}

/**
 * Envia um e-mail pelo Gmail conectado da empresa e registra a atividade.
 *
 * Texto simples, sem anexo, o produto não vira um cliente de e-mail
 * completo (decisão do plano de integrações). Recusa se o lead não tiver
 * e-mail cadastrado, em vez de mandar para um destinatário vazio.
 */
export async function enviarEmailViaGmail(leadId: string, values: unknown) {
  const parsed = emailMessageSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }

  const sessao = await abrirSessao()
  if ('error' in sessao) return sessao

  const erroDePlano = await exigirProVigente(sessao)
  if (erroDePlano) return erroDePlano

  const { data: lead } = await sessao.supabase
    .from('leads')
    .select('id, email')
    .eq('id', leadId)
    .eq('workspace_id', sessao.workspaceId)
    .maybeSingle()

  if (!lead) return { error: 'Lead não encontrado.' }
  if (!lead.email) return { error: 'Este lead não tem e-mail cadastrado.' }

  const token = await obterAccessTokenValido(sessao.workspaceId, 'gmail')
  if ('error' in token) {
    return { error: 'Conecte o Gmail em Configurações → Integrações.' }
  }

  try {
    await enviarEmailGmail(token.accessToken, {
      destinatario: lead.email,
      assunto: parsed.data.assunto,
      corpo: parsed.data.corpo,
    })

    const { error: erroAtividade } = await sessao.supabase.from('activities').insert({
      workspace_id: sessao.workspaceId,
      lead_id: lead.id,
      author_id: sessao.userId,
      type: 'email',
      description: `${parsed.data.assunto}\n\n${parsed.data.corpo}`,
      integration_provider: 'gmail',
    })
    if (erroAtividade) {
      console.error('enviarEmailViaGmail: atividade não registrada', erroAtividade)
    }

    revalidatePath(`/leads/${leadId}`)
    return { success: true }
  } catch (err) {
    console.error('enviarEmailViaGmail falhou', err)
    return { error: 'Não foi possível enviar o e-mail. Tente novamente.' }
  }
}
