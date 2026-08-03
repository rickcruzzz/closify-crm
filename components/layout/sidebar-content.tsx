import Link from 'next/link'

import { SidebarNav } from '@/components/layout/sidebar-nav'
import { WorkspaceSwitcher } from '@/components/layout/workspace-switcher'
import { Logo } from '@/components/branding/logo'

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-4 p-3">
      <Link href="/dashboard" className="px-1.5 py-2">
        <Logo size="sm" />
      </Link>
      <WorkspaceSwitcher />
      <SidebarNav onNavigate={onNavigate} />
    </div>
  )
}
