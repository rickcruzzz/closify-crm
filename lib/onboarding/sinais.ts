import { createClient } from '@/lib/supabase/server'
import type { SinaisDeAtivacao } from '@/lib/onboarding/checklist'

/**
 * As contagens que o checklist precisa: três `count` e uma leitura, em
 * paralelo.
 *
 * `head: true` com `count: 'exact'` pede ao PostgREST só o número, sem trazer
 * linha nenhuma. Buscar os leads para chamar `.length` traria o workspace
 * inteiro só para descobrir se ele é maior que zero, e este código roda em
 * toda abertura do Dashboard.
 */
export async function lerSinaisDeAtivacao(workspaceId: string): Promise<SinaisDeAtivacao> {
  const supabase = await createClient()

  const contar = (tabela: 'leads' | 'deals' | 'tasks') =>
    supabase
      .from(tabela)
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)

  const [leads, negocios, tarefas, empresa] = await Promise.all([
    contar('leads'),
    contar('deals'),
    contar('tasks'),
    supabase.from('workspaces').select('name, segmento').eq('id', workspaceId).maybeSingle(),
  ])

  return {
    leads: leads.count ?? 0,
    negocios: negocios.count ?? 0,
    tarefas: tarefas.count ?? 0,
    empresa: {
      name: empresa.data?.name ?? null,
      segmento: empresa.data?.segmento ?? null,
    },
  }
}
