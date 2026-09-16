import {
  Calendar,
  CalendarCheck,
  KanbanSquare,
  LayoutDashboard,
  MessageCircle,
  Plug,
  Smartphone,
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
  /**
   * O cabeçalho da seção. `null` renderiza sem cabeçalho nenhum.
   *
   * Os três grupos da barra são rotulados desde 16/09. Antes o primeiro vinha
   * sem rótulo, com o raciocínio de que "o principal não precisa se
   * apresentar" — e o efeito era o oposto: sem o rótulo, "CONFIGURAÇÕES" no
   * meio da lista parecia o começo da estrutura, e os seis itens de cima
   * ficavam soltos, sem nome coletivo. Rotular os três custa uma linha de 12px
   * cada e faz a barra ser lida como três blocos, que é o que ela é.
   */
  title: string | null
  items: NavItem[]
}

/**
 * ## A ordem, e por que ela não muda sozinha
 *
 * `lib/nav-items.test.ts` trava a lista inteira — grupos, ordem e rótulos —
 * contra o que foi aprovado em 16/09. Item de menu é a superfície mais fácil de
 * mexer sem querer (um `push`, um copiar e colar), e reordenar a navegação de
 * quem já usa o produto todo dia é caro: a pessoa clica por memória muscular,
 * não por leitura.
 *
 * O teste não impede mudar a ordem. Impede mudar sem perceber.
 */
export const navGroups: NavGroup[] = [
  {
    title: 'Principal',
    items: [
      // Primeira da lista porque é a tela de abrir de manhã: ela responde "o
      // que eu faço agora", que é a pergunta que traz a pessoa de volta todo
      // dia. O Pipeline continua sendo a identidade do produto e fica logo
      // abaixo.
      { title: 'Hoje', href: '/hoje', icon: CalendarCheck },
      // "Funil", não "Pipeline". A rota segue `/kanban` de propósito: renomear
      // quebraria link salvo e favorito para trocar uma palavra que ninguém
      // digita. O que a pessoa lê muda; o endereço não.
      // Logo depois de Hoje, e antes do Funil: é a segunda pergunta da manhã,
      // "quem está esperando resposta agora". Fica acima do Funil porque
      // conversa sem resposta vira venda perdida em minutos, enquanto negócio
      // parado no funil espera dias sem piorar.
      { title: 'Conversas', href: '/conversas', icon: MessageCircle },
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
      {
        title: 'Integrações',
        href: '/settings?aba=integracoes',
        icon: Plug,
        aba: 'integracoes',
      },
      // Rota PRÓPRIA, e não uma aba de Preferências como as duas acima.
      //
      // O motivo é o mesmo que tirou o WhatsApp de Integrações: ele não é uma
      // integração gateada em `pro_vigente()` — é o plano Max, com conexão por
      // empresa, estado que cai sozinho e um QR que precisa de tela inteira.
      // Uma aba dentro de Preferências esconderia justamente o que a pessoa
      // procura depois de pagar por ele.
      { title: 'WhatsApp', href: '/settings/whatsapp', icon: Smartphone },
      // Era "Configurações" — renomeado porque a página guarda dados da
      // empresa (logo, CNPJ, endereço), "Preferências" descreve melhor o
      // conteúdo do que um rótulo que soa como "todo o resto de config".
      { title: 'Preferências', href: '/settings', icon: Settings },
    ],
  },
]
