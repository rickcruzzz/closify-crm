import {
  Calendar,
  CalendarCheck,
  KanbanSquare,
  LayoutDashboard,
  Plug,
  Settings,
  User,
  UserCog,
  Users,
} from 'lucide-react'

export type NavItem = {
  title: string
  href: string
  icon: typeof LayoutDashboard
  /**
   * Só para itens que apontam pra `/settings`: qual aba conta como "ativo"
   * pra este item. `undefined` cobre as abas que não têm entrada própria no
   * menu (equipe/plano), sem isso, "Preferências" e "Integrações"
   * ficariam os dois marcados ativos ao mesmo tempo, ou nenhum dos dois.
   */
  aba?: string
}

export type NavGroup = {
  /** `null` renderiza sem cabeçalho — é o grupo principal, sem rótulo. */
  title: string | null
  items: NavItem[]
}

export const navGroups: NavGroup[] = [
  {
    title: null,
    items: [
      // Primeira da lista porque é a tela de abrir de manhã: ela responde "o
      // que eu faço agora", que é a pergunta que traz a pessoa de volta todo
      // dia. O Pipeline continua sendo a identidade do produto e fica logo
      // abaixo.
      { title: 'Hoje', href: '/hoje', icon: CalendarCheck },
      // "Funil", não "Pipeline". A rota segue `/kanban` de propósito: renomear
      // quebraria link salvo e favorito para trocar uma palavra que ninguém
      // digita. O que a pessoa lê muda; o endereço não.
      { title: 'Funil', href: '/kanban', icon: KanbanSquare },
      // "Contatos", não "Leads". O PRD de copy adiou esta troca temendo
      // prometer "contatos" na landing e a pessoa encontrar "Leads" depois de
      // pagar — mas a landing JÁ diz contatos, então renomear aqui fecha essa
      // distância em vez de criá-la.
      { title: 'Contatos', href: '/leads', icon: Users },
      // "Resultados", não "Dashboard": descreve o que a tela entrega (quanto
      // entrou, quanto está em aberto) em vez de nomear o tipo de tela.
      { title: 'Resultados', href: '/dashboard', icon: LayoutDashboard },
      // Monitoramento por data (o que tenho hoje, atrasado, previsto), não
      // conexão técnica com o Google — isso já vive em Integrações. Item
      // principal, não escondido: é onde a pessoa responde "o que vem por
      // aí".
      { title: 'Calendário', href: '/calendario', icon: Calendar },
    ],
  },
  {
    title: 'Configurações',
    items: [
      // Já existia como rota, só não tinha entrada na sidebar — vivia
      // escondido no menu do rodapé (user-menu.tsx). Dados da PESSOA, não
      // da empresa, por isso separado de "Preferências" abaixo.
      { title: 'Perfil', href: '/perfil', icon: User },
      // `UserCog`, não `Users`: o mesmo ícone servia "Contatos" e "Equipe" ao
      // mesmo tempo, e ícone repetido em menu curto anula a própria função do
      // ícone, que é dar um segundo caminho de reconhecimento além do texto.
      { title: 'Equipe', href: '/settings?aba=equipe', icon: UserCog, aba: 'equipe' },
      // Aponta pra mesma página de Preferências, só que já na aba certa,
      // evita duplicar a tela de integrações num lugar novo.
      { title: 'Integrações', href: '/settings?aba=integracoes', icon: Plug, aba: 'integracoes' },
      // Era "Configurações" — renomeado porque a página guarda dados da
      // empresa (logo, CNPJ, endereço), "Preferências" descreve melhor o
      // conteúdo do que um rótulo que soa como "todo o resto de config".
      { title: 'Preferências', href: '/settings', icon: Settings },
    ],
  },
]
