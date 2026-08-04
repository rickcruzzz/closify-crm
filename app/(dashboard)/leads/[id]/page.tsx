import { notFound } from 'next/navigation'

import { getLeadById, getWorkspaceMembers } from '@/lib/leads/queries'
import { getCurrentUserAndWorkspace } from '@/lib/supabase/workspace'
import { LeadDetailClient } from '@/components/leads/lead-detail-client'

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { workspaceId } = await getCurrentUserAndWorkspace()

  const [result, members] = await Promise.all([
    getLeadById(workspaceId, id),
    getWorkspaceMembers(workspaceId),
  ])
  if (!result) {
    notFound()
  }

  return (
    <LeadDetailClient lead={result.lead} activities={result.activities} members={members} />
  )
}
