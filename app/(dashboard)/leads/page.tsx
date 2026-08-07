import type { Metadata } from 'next'
import { getLeadsPage, getWorkspaceMembers } from '@/lib/leads/queries'
import type { LeadStatus } from '@/lib/leads/types'
import { getCurrentUserAndWorkspace } from '@/lib/supabase/workspace'
import { LeadsPageClient } from '@/components/leads/leads-page-client'

export const metadata: Metadata = { title: 'Leads' }

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; cursor?: string }>
}) {
  const params = await searchParams
  const { workspaceId } = await getCurrentUserAndWorkspace()

  const status = params.status as LeadStatus | undefined

  const [{ leads, nextCursor }, members] = await Promise.all([
    getLeadsPage(workspaceId, {
      search: params.search,
      status,
      cursor: params.cursor,
    }),
    getWorkspaceMembers(workspaceId),
  ])

  return (
    <LeadsPageClient
      leads={leads}
      members={members}
      nextCursor={nextCursor}
      search={params.search ?? ''}
      status={status ?? 'todos'}
    />
  )
}
