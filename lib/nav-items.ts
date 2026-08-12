import { CalendarCheck, KanbanSquare, LayoutDashboard, Settings, Users } from 'lucide-react'

export type NavItem = {
  title: string
  href: string
  icon: typeof LayoutDashboard
}

export const navItems: NavItem[] = [
  // Primeira da lista porque é a tela de abrir de manhã: ela responde "o que
  // eu faço agora", que é a pergunta que traz a pessoa de volta todo dia. O
  // Pipeline continua sendo a identidade do produto e fica logo abaixo.
  { title: 'Hoje', href: '/hoje', icon: CalendarCheck },
  { title: 'Pipeline', href: '/kanban', icon: KanbanSquare },
  { title: 'Leads', href: '/leads', icon: Users },
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { title: 'Configurações', href: '/settings', icon: Settings },
]
