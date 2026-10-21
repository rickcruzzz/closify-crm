import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PainelDeEventos } from '@/components/enterprise/painel-de-eventos'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUserAndWorkspace } from '@/lib/supabase/workspace'

export const metadata: Metadata = { title: 'Radar de eventos | Enterprise' }

export default async function EventosEnterprisePage() {
  const [{ workspaceId }, supabase] = await Promise.all([
    getCurrentUserAndWorkspace(),
    createClient(),
  ])
  const { data: autorizado } = await supabase.rpc('enterprise_vigente', {
    target_workspace_id: workspaceId,
  })
  if (autorizado !== true) notFound()

  const { data: eventos, error } = await supabase
    .from('enterprise_eventos')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('prioridade', { ascending: false })
    .order('data_inicio', { ascending: true })
    .limit(100)

  return (
    <PainelDeEventos
      eventos={eventos ?? []}
      erro={error ? 'Não foi possível carregar as oportunidades agora.' : null}
    />
  )
}
