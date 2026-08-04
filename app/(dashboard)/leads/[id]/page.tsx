import { notFound, redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { getLeadById, getWorkspaceMembers } from '@/lib/leads/queries'
import { LeadDetailClient } from '@/components/leads/lead-detail-client'

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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

  const result = await getLeadById(membership.workspace_id, id)
  if (!result) {
    notFound()
  }

  const members = await getWorkspaceMembers(membership.workspace_id)

  return (
    <LeadDetailClient lead={result.lead} activities={result.activities} members={members} />
  )
}
