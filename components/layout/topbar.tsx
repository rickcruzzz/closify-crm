import { MobileSidebar } from '@/components/layout/mobile-sidebar'
import { ThemeToggle } from '@/components/theme-toggle'
import { UserMenu } from '@/components/layout/user-menu'

export function Topbar() {
  return (
    <header className="bg-background/80 sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b px-4 backdrop-blur-sm">
      <MobileSidebar />
      <div className="flex-1" />
      <ThemeToggle />
      <UserMenu />
    </header>
  )
}
