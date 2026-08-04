import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { getLeadsPage, getWorkspaceMembers } from '@/lib/leads/queries'
import type { LeadStatus } from '@/lib/leads/types'
import { LeadsPageClient } from '@/components/leads/leads-page-client'

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; cursor?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!membership) {
    redirect('/onboarding')
  }

  const status = params.status as LeadStatus | undefined

  const [{ leads, nextCursor }, members] = await Promise.all([
    getLeadsPage(membership.workspace_id, {
      search: params.search,
      status,
      cursor: params.cursor,
    }),
    getWorkspaceMembers(membership.workspace_id),
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
