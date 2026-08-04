import { redirect } from 'next/navigation'

import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUserAndWorkspace } from '@/lib/supabase/workspace'
import type { WorkspacePlan } from '@/types/supabase'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getCurrentUserAndWorkspace()
  const supabase = await createClient()

  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id, workspaces (id, name, plan)')
    .eq('user_id', user.id)

  const workspaces = (memberships ?? [])
    .map((m) => m.workspaces)
    .filter((w): w is { id: string; name: string; plan: WorkspacePlan } => w !== null)

  if (workspaces.length === 0) {
    redirect('/onboarding')
  }

  const currentUser = {
    name: (user.user_metadata?.name as string | undefined) ?? user.email ?? 'Usuário',
    email: user.email ?? '',
    initials: ((user.user_metadata?.name as string | undefined) ?? user.email ?? 'U')
      .split(' ')
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase(),
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar workspaces={workspaces} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar workspaces={workspaces} currentUser={currentUser} />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
