import { SidebarContent } from '@/components/layout/sidebar-content'

export function Sidebar() {
  return (
    <aside className="bg-sidebar border-sidebar-border hidden w-64 shrink-0 border-r md:block">
      <SidebarContent />
    </aside>
  )
}
