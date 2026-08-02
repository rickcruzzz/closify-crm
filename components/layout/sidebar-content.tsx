import Link from 'next/link'

import { SidebarNav } from '@/components/layout/sidebar-nav'
import { WorkspaceSwitcher } from '@/components/layout/workspace-switcher'

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-4 p-3">
      <Link href="/dashboard" className="flex items-center gap-2 px-1.5 py-2">
        <span className="text-lg font-semibold tracking-tight">Closify</span>
      </Link>
      <WorkspaceSwitcher />
      <SidebarNav onNavigate={onNavigate} />
    </div>
  )
}
