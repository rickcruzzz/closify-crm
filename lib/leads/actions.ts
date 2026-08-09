'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { csvLeadSchema, leadSchema, type CsvLeadValues } from '@/lib/validations/lead'
import { activitySchema } from '@/lib/validations/activity'
import { canAddLead, remainingLeadSlots } from '@/lib/limits'
import { CSV_MAX_BYTES, parseCsvLeads } from '@/lib/leads/csv'
import { FREE_LEAD_LIMIT } from '@/lib/plans'

async function getActiveWorkspaceId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  // Sem order by, o Postgres pode escolher um workspace diferente entre
  // requests para quem participa de mais de um — gravaria no workspace errado.
  const { data } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .order('workspace_id', { ascending: true })
    .limit(1)
    .maybeSingle()

  return data?.workspace_id ?? null
}

// owner_id não é validado pela RLS de leads (a policy só confere workspace_id
// da linha) — sem checar aqui, qualquer membro autenticado poderia atribuir
// um lead a um user_id de fora do workspace, só adivinhando/vazando o UUID.
async function isWorkspaceMember(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  userId: string,
) {
  const { data } = await supabase
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle()

  return !!data
}

export async function createLead(values: unknown) {
  const parsed = leadSchema.safeParse(values)
  if (!parsed.success) {
    return { error: 'Dados inválidos.' }
  }

  const supabase = await createClient()
  const workspaceId = await getActiveWorkspaceId(supabase)
  if (!workspaceId) {
    return { error: 'Workspace não encontrado.' }
  }

  if (!(await isWorkspaceMember(supabase, workspaceId, parsed.data.ownerId))) {
    return { error: 'Responsável inválido.' }
  }

  const limit = await canAddLead(workspaceId)
  if (!limit.allowed) {
    return { error: limit.reason }
  }

  const { error } = await supabase.from('leads').insert({
    workspace_id: workspaceId,
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    company: parsed.data.company,
    status: parsed.data.status,
    owner_id: parsed.data.ownerId,
    value: parsed.data.value,
  })

  if (error) {
    console.error('createLead falhou', error)
    return { error: 'Não foi possível criar o lead.' }
  }

  revalidatePath('/leads')
  return { success: true }
}

export async function updateLead(leadId: string, values: unknown) {
  const parsed = leadSchema.safeParse(values)
  if (!parsed.success) {
    return { error: 'Dados inválidos.' }
  }

  const supabase = await createClient()
  const workspaceId = await getActiveWorkspaceId(supabase)
  if (!workspaceId) {
    return { error: 'Workspace não encontrado.' }
  }

  if (!(await isWorkspaceMember(supabase, workspaceId, parsed.data.ownerId))) {
    return { error: 'Responsável inválido.' }
  }

  const { error } = await supabase
    .from('leads')
    .update({
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      company: parsed.data.company,
      status: parsed.data.status,
      owner_id: parsed.data.ownerId,
      value: parsed.data.value,
    })
    .eq('id', leadId)
    .eq('workspace_id', workspaceId)

  if (error) {
    console.error('updateLead falhou', error)
    return { error: 'Não foi possível atualizar o lead.' }
  }

  revalidatePath('/leads')
  revalidatePath(`/leads/${leadId}`)
  return { success: true }
}

export type ResultadoImportacao = {
  importados: number
  ignorados: number
  /** Mensagens por linha descartada, para a pessoa corrigir a planilha. */
  avisos: string[]
}

/**
 * Importa leads de um CSV simples (Nome, Telefone, E-mail, Valor).
 *
 * O texto do arquivo é lido no cliente e chega aqui como string — todo o
 * parse, validação e limite de plano acontece no servidor, porque o cliente
 * pode mandar qualquer coisa nesta chamada, inclusive sem passar pela tela.
 */
export async function importLeadsFromCsv(
  csvText: unknown,
): Promise<{ error: string } | ResultadoImportacao> {
  if (typeof csvText !== 'string') {
    return { error: 'Arquivo inválido.' }
  }

  // Limite antes de qualquer trabalho: o parser percorre caractere a
  // caractere, e um texto de dezenas de MB seguraria a função à toa.
  if (Buffer.byteLength(csvText, 'utf8') > CSV_MAX_BYTES) {
    return { error: 'Arquivo grande demais. O limite é 512 KB por importação.' }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Sessão expirada.' }
  }

  const workspaceId = await getActiveWorkspaceId(supabase)
  if (!workspaceId) {
    return { error: 'Workspace não encontrado.' }
  }

  const { linhas, erros } = parseCsvLeads(csvText)
  const avisos = [...erros]

  if (linhas.length === 0) {
    return {
      error:
        avisos[0] ??
        'Nenhuma linha válida encontrada. Confira o cabeçalho: Nome, Telefone, E-mail, Valor.',
    }
  }

  // Revalida com o mesmo schema do resto do app: o parser cuida do formato do
  // arquivo, o zod cuida do formato do dado (e-mail principalmente).
  const validos: { linha: number; dados: CsvLeadValues }[] = []
  for (const linha of linhas) {
    const parsed = csvLeadSchema.safeParse({
      name: linha.name,
      email: linha.email,
      phone: linha.phone,
      value: linha.value,
    })
    if (!parsed.success) {
      avisos.push(
        `Linha ${linha.linha}: ${parsed.error.issues[0]?.message ?? 'dado inválido.'}`,
      )
      continue
    }
    validos.push({ linha: linha.linha, dados: parsed.data })
  }

  if (validos.length === 0) {
    return { error: 'Nenhuma linha válida encontrada no arquivo.' }
  }

  // Duplicata contra o que já existe no workspace. A consulta é limitada aos
  // e-mails do próprio arquivo, então não cresce com o tamanho da base.
  const { data: jaExistem } = await supabase
    .from('leads')
    .select('email')
    .eq('workspace_id', workspaceId)
    .in(
      'email',
      validos.map((v) => v.dados.email),
    )

  const emailsExistentes = new Set((jaExistem ?? []).map((l) => l.email.toLowerCase()))

  const novos = validos.filter((v) => {
    if (emailsExistentes.has(v.dados.email)) {
      avisos.push(`Linha ${v.linha}: ${v.dados.email} já existe neste workspace.`)
      return false
    }
    return true
  })

  if (novos.length === 0) {
    return { error: 'Todos os leads do arquivo já existem neste workspace.' }
  }

  const vagas = await remainingLeadSlots(workspaceId)
  if (vagas === 0) {
    return {
      error: `Plano Free permite no máximo ${FREE_LEAD_LIMIT} leads. Faça upgrade para o Pro para importar mais.`,
    }
  }

  // Corta no limite em vez de recusar o arquivo inteiro: importar o que cabe
  // e dizer o que ficou de fora é mais útil do que não importar nada.
  const aInserir = vagas === null ? novos : novos.slice(0, vagas)
  if (vagas !== null && novos.length > vagas) {
    avisos.push(
      `O plano Free comporta mais ${vagas} lead(s): ${novos.length - vagas} linha(s) ficaram de fora.`,
    )
  }

  const { error } = await supabase.from('leads').insert(
    aInserir.map((v) => ({
      workspace_id: workspaceId,
      name: v.dados.name,
      email: v.dados.email,
      phone: v.dados.phone,
      // O CSV não traz empresa; a coluna aceita nulo e a tela já mostra
      // "Sem empresa" nesse caso.
      company: null,
      status: 'novo' as const,
      // Quem importou vira responsável — é membro do workspace por definição,
      // então não precisa da checagem de `isWorkspaceMember` do createLead.
      owner_id: user.id,
      value: v.dados.value,
    })),
  )

  if (error) {
    console.error('importLeadsFromCsv falhou', error)
    return { error: 'Não foi possível importar os leads.' }
  }

  revalidatePath('/leads')
  revalidatePath('/dashboard')

  return {
    importados: aInserir.length,
    ignorados: linhas.length - aInserir.length + erros.length,
    avisos,
  }
}

export async function createActivity(leadId: string, values: unknown) {
  const parsed = activitySchema.safeParse(values)
  if (!parsed.success) {
    return { error: 'Dados inválidos.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Sessão expirada.' }
  }

  const workspaceId = await getActiveWorkspaceId(supabase)
  if (!workspaceId) {
    return { error: 'Workspace não encontrado.' }
  }

  // Confere que o lead pertence ao workspace ativo antes de gravar —
  // a RLS de activities.insert também confere isso, mas falhar aqui com
  // mensagem clara é melhor do que deixar a RLS rejeitar silenciosamente.
  const { data: lead } = await supabase
    .from('leads')
    .select('id')
    .eq('id', leadId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (!lead) {
    return { error: 'Lead não encontrado.' }
  }

  const { error } = await supabase.from('activities').insert({
    workspace_id: workspaceId,
    lead_id: leadId,
    author_id: user.id,
    type: parsed.data.type,
    description: parsed.data.description,
  })

  if (error) {
    console.error('createActivity falhou', error)
    return { error: 'Não foi possível registrar a atividade.' }
  }

  revalidatePath(`/leads/${leadId}`)
  return { success: true }
}

export async function deleteLead(leadId: string) {
  const supabase = await createClient()
  const workspaceId = await getActiveWorkspaceId(supabase)
  if (!workspaceId) {
    return { error: 'Workspace não encontrado.' }
  }

  const { error } = await supabase
    .from('leads')
    .delete()
    .eq('id', leadId)
    .eq('workspace_id', workspaceId)

  if (error) {
    console.error('deleteLead falhou', error)
    return { error: 'Não foi possível excluir o lead.' }
  }

  revalidatePath('/leads')
  return { success: true }
}
