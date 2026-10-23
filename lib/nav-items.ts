import {
  Calendar,
  CalendarCheck,
  KanbanSquare,
  LayoutDashboard,
  Plug,
  Radar,
  Settings,
  User,
  UserCog,
  Users,
} from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'
import { IconeWhatsapp } from '@/components/ui/icone-whatsapp'

export type NavItem = {
  title: string
  href: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  /** A aba diferencia as entradas que compartilham /settings. */
  aba?: string
  somenteEnterprise?: boolean
}
export type NavGroup = { title: string | null; items: NavItem[] }

/** Organização aprovada em 22/10: o trabalho comercial abre o produto. */
export const navGroups: NavGroup[] = [
  {
    title: 'Comercial',
    items: [
      { title: 'Funil', href: '/kanban', icon: KanbanSquare },
      {
        title: 'Prospecção',
        href: '/enterprise/eventos',
        icon: Radar,
        somenteEnterprise: true,
      },
      { title: 'Contatos', href: '/leads', icon: Users },
    ],
  },
  {
    title: 'Rotina',
    items: [
      { title: 'Hoje', href: '/hoje', icon: CalendarCheck },
      { title: 'WhatsApp', href: '/conversas', icon: IconeWhatsapp },
      { title: 'Calendário', href: '/calendario', icon: Calendar },
    ],
  },
  {
    title: 'Gestão',
    items: [
      { title: 'Resultados', href: '/dashboard', icon: LayoutDashboard },
      { title: 'Equipe', href: '/settings?aba=equipe', icon: UserCog, aba: 'equipe' },
    ],
  },
  {
    title: 'Configurações',
    items: [
      { title: 'Empresa', href: '/settings', icon: Settings },
      {
        title: 'Integrações',
        href: '/settings?aba=integracoes',
        icon: Plug,
        aba: 'integracoes',
      },
      { title: 'Perfil', href: '/perfil', icon: User },
    ],
  },
]

/** Visibilidade apenas; página e Actions continuam impondo o plano no servidor. */
export function gruposDeNavegacao(temEnterprise: boolean): NavGroup[] {
  return navGroups.map((grupo) => ({
    ...grupo,
    items: grupo.items.filter((item) => !item.somenteEnterprise || temEnterprise),
  }))
}

export function itemDeNavegacaoAtivo(
  item: NavItem,
  pathname: string,
  aba: string | null,
): boolean {
  const rota = item.href.split('?')[0]!
  if (pathname !== rota && !pathname.startsWith(rota + '/')) return false
  if (rota !== '/settings') return true
  return item.aba ? aba === item.aba : aba !== 'equipe' && aba !== 'integracoes'
}
