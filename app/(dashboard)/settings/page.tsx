import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/page-header'
import { WorkspaceNameCard } from '@/components/settings/workspace-name-card'
import { MembersCard } from '@/components/settings/members-card'
import { PlanCard } from '@/components/settings/plan-card'
import { getCurrentUserAndWorkspace } from '@/lib/supabase/workspace'
import { getWorkspaceSettingsData } from '@/lib/workspace/queries'

export const metadata: Metadata = { title: 'Configurações' }

export default async function SettingsPage() {
  const { user, workspaceId } = await getCurrentUserAndWorkspace()
  const { workspace, members, invites } = await getWorkspaceSettingsData(workspaceId)

  const currentMember = members.find((m) => m.user_id === user.id)
  const isAdmin = currentMember?.role === 'admin'

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Configurações" description="Workspace, colaboradores e plano." />

      <WorkspaceNameCard initialName={workspace?.name ?? ''} isAdmin={isAdmin} />

      <MembersCard
        currentUserId={user.id}
        isAdmin={isAdmin}
        members={members}
        invites={invites}
        plan={workspace?.plan ?? 'free'}
      />

      <PlanCard plan={workspace?.plan ?? 'free'} />
    </div>
  )
}
