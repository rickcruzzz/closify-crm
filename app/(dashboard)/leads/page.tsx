import type { Metadata } from 'next'
import { getLeadsPage, getWorkspaceMembers } from '@/lib/leads/queries'
import type { LeadStatus } from '@/lib/leads/types'
import { getCurrentUserAndWorkspace } from '@/lib/supabase/workspace'
import { LeadsPageClient } from '@/components/leads/leads-page-client'
import { remainingLeadSlots } from '@/lib/limits'

export const metadata: Metadata = { title: 'Contatos' }

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; cursor?: string }>
}) {
  const params = await searchParams
  const { workspaceId } = await getCurrentUserAndWorkspace()

  const status = params.status as LeadStatus | undefined

  // Terceira consulta no MESMO `Promise.all`: em série custaria uma ida de
  // rede por navegação, e a doutrina daqui é paralelizar o que não depende.
  const [{ leads, nextCursor }, members, vagasNoPlano] = await Promise.all([
    getLeadsPage(workspaceId, {
      search: params.search,
      status,
      cursor: params.cursor,
    }),
    getWorkspaceMembers(workspaceId),
    remainingLeadSlots(workspaceId),
  ])

  return (
    <LeadsPageClient
      // Quantas vagas o plano ainda tem, para o diálogo de importação dizer
      // ANTES o que vai acontecer — em vez de importar 12 de 300 e mostrar
      // 288 ignorados no relatório final. `remainingLeadSlots` é a MESMA
      // função que a Server Action consulta antes de inserir.
      vagasNoPlano={vagasNoPlano}
      leads={leads}
      members={members}
      nextCursor={nextCursor}
      search={params.search ?? ''}
      status={status ?? 'todos'}
    />
  )
}
