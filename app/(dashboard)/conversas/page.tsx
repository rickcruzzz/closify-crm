import type { Metadata } from 'next'

import { PageHeader } from '@/components/layout/page-header'
import { ConversasClient } from '@/components/conversas/conversas-client'
import { getConversas, getMensagensDaConversa } from '@/lib/conversas/queries'
import { getCurrentUserAndWorkspace } from '@/lib/supabase/workspace'
import { getWorkspaceMembers } from '@/lib/leads/queries'

export const metadata: Metadata = { title: 'Conversas' }

/**
 * Quem está esperando resposta agora.
 *
 * A conversa aberta vem por query string (`?c=`) e não por rota aninhada de
 * propósito: `/conversas/[id]` faria a lista inteira remontar a cada troca de
 * conversa, e a lista é a parte cara desta tela. Com query string o Next
 * reaproveita o layout e só o painel muda.
 *
 * É o mesmo padrão que `/settings?aba=` já usa neste projeto.
 */
export default async function ConversasPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>
}) {
  const { c } = await searchParams
  const { user, workspaceId } = await getCurrentUserAndWorkspace()

  // As três em paralelo: nenhuma depende do resultado das outras, e em série
  // seriam três idas de rede empilhadas na tela mais aberta do produto.
  const [conversas, aberta, membros] = await Promise.all([
    getConversas(workspaceId),
    c ? getMensagensDaConversa(c) : Promise.resolve(null),
    getWorkspaceMembers(workspaceId),
  ])

  // Nome de quem assumiu a conversa, para o aviso de colisão dizer QUEM está
  // respondendo em vez de "alguém". `WorkspaceMember.id` já é o `user_id`,
  // que é como `getWorkspaceMembers` monta a lista.
  const nomesPorUsuario: Record<string, string> = {}
  for (const m of membros) {
    if (m.id && m.name) nomesPorUsuario[m.id] = m.name
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Conversas"
        description="Quem está esperando resposta, do que espera há mais tempo para o mais recente."
      />

      <ConversasClient
        conversas={conversas}
        conversaAberta={aberta ? c! : null}
        mensagens={aberta?.mensagens ?? []}
        usuarioId={user.id}
        nomesPorUsuario={nomesPorUsuario}
      />
    </div>
  )
}
