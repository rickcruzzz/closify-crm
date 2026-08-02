import { KanbanSquare, LayoutDashboard, Settings, Users } from 'lucide-react'

export type NavItem = {
  title: string
  href: string
  icon: typeof LayoutDashboard
}

export const navItems: NavItem[] = [
  { title: 'Pipeline', href: '/kanban', icon: KanbanSquare },
  { title: 'Leads', href: '/leads', icon: Users },
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { title: 'Configurações', href: '/settings', icon: Settings },
]
