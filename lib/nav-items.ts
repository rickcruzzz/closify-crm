import {
  Calendar,
  CalendarCheck,
  KanbanSquare,
  LayoutDashboard,
  Plug,
  Settings,
  Users,
} from 'lucide-react'

export type NavItem = {
  title: string
  href: string
  icon: typeof LayoutDashboard
  /**
   * Só para itens que apontam pra `/settings`: qual aba conta como "ativo"
   * pra este item. `undefined` cobre as abas que não têm entrada própria no
   * menu (empresa/equipe/plano), sem isso, "Configurações" e "Integrações"
   * ficariam os dois marcados ativos ao mesmo tempo, ou nenhum dos dois.
   */
  aba?: string
}

export const navItems: NavItem[] = [
  // Primeira da lista porque é a tela de abrir de manhã: ela responde "o que
  // eu faço agora", que é a pergunta que traz a pessoa de volta todo dia. O
  // Pipeline continua sendo a identidade do produto e fica logo abaixo.
  { title: 'Hoje', href: '/hoje', icon: CalendarCheck },
  { title: 'Pipeline', href: '/kanban', icon: KanbanSquare },
  { title: 'Leads', href: '/leads', icon: Users },
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  // Monitoramento por data (o que tenho hoje, atrasado, previsto), não
  // conexão técnica com o Google — isso já vive em Integrações. Item
  // principal, não escondido: é onde a pessoa responde "o que vem por aí".
  { title: 'Calendário', href: '/calendario', icon: Calendar },
  { title: 'Configurações', href: '/settings', icon: Settings },
  // Aponta pra mesma página de Configurações, só que já na aba certa, evita
  // duplicar a tela de integrações num lugar novo. Fica logo abaixo de
  // Configurações de propósito: é a aba mais nova, e a mais provável de
  // alguém procurar direto sem passar pelas outras três primeiro.
  { title: 'Integrações', href: '/settings?aba=integracoes', icon: Plug, aba: 'integracoes' },
]
