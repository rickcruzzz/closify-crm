import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PainelDeEventos } from '@/components/enterprise/painel-de-eventos'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUserAndWorkspace } from '@/lib/supabase/workspace'
import { contatoDoEventoCompleto } from '@/lib/enterprise/contato'

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
    .not('contato_email', 'is', null)
    .not('contato_telefone', 'is', null)
    .neq('contato_email', '')
    .neq('contato_telefone', '')
    .order('prioridade', { ascending: false })
    .order('data_inicio', { ascending: true })
    .limit(100)

  // Os registros antigos são preservados, mas incompletos não viram oportunidades visíveis.
  const qualificados = (eventos ?? []).filter(contatoDoEventoCompleto)
  const caminhos = Array.from(new Set(qualificados.map((evento) => evento.foto_path).filter((path): path is string => !!path)))
  const fotos = caminhos.length ? (await supabase.storage.from('avatares').createSignedUrls(caminhos, 3600)).data ?? [] : []
  const urls = new Map(fotos.map((foto) => [foto.path, foto.signedUrl]))

  return (
    <PainelDeEventos
      eventos={qualificados.map((evento) => ({
        ...evento,
        fotoUrl: evento.foto_path ? urls.get(evento.foto_path) ?? null : null,
      }))}
      erro={error ? 'Não foi possível carregar as oportunidades agora.' : null}
    />
  )
}
