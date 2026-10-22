import type { DadosDoEvento } from './eventos'

/** Pesquisa manual conferida nas páginas oficiais em 21/10/2026; revalidar antes de abordar. */
export const AGENDA_SALVADOR = {
  nome: 'Centro de Convenções Salvador',
  cidade: 'Salvador',
  tipo: 'centro_de_convencoes' as const,
  url: 'https://ccs-salvador.com.br/agenda/',
}

export type EventoPesquisado = DadosDoEvento & {
  tipo: string
  fonte_contato_url: string | null
  fontes: { tipo: 'evento' | 'organizador' | 'contato' | 'publico'; url: string; titulo: string }[]
}

export const PESQUISA_SALVADOR: EventoPesquisado[] = [
  {
    nome: '25ª Conferência Nacional da Advocacia Brasileira',
    data_inicio: '2026-11-23',
    cidade: 'Salvador',
    fonte_url: 'https://conferencia.oab.org.br/',
    organizador: 'Conselho Federal da OAB e OAB Bahia',
    contato_nome: 'Fernanda Del Bosco de Araujo',
    contato_email: 'conferencianacional@oab.org.br',
    contato_telefone: '(61) 99610-1970',
    publico_estimado: 20000,
    perfil_publico: 'Profissionais da advocacia e expositores',
    tipo: 'congresso',
    fonte_contato_url: 'https://www.conferencia.oab.org.br/doc/Plano%20de%20Comercializa%C3%A7%C3%A3o%20-%20Estandes.pdf',
    fontes: [
      { tipo: 'evento', url: 'https://conferencia.oab.org.br/', titulo: 'Site oficial da 25ª Conferência Nacional' },
      { tipo: 'contato', url: 'https://www.conferencia.oab.org.br/doc/Plano%20de%20Comercializa%C3%A7%C3%A3o%20-%20Estandes.pdf', titulo: 'Plano comercial da OAB com nome, telefone e e-mail da responsável' },
      { tipo: 'publico', url: 'https://www.conferencia.oab.org.br/doc/Plano%20de%20Comercializa%C3%A7%C3%A3o%20-%20Estandes.pdf', titulo: 'Expectativa declarada de cerca de 20 mil participantes' },
    ],
  },
  {
    nome: 'Salon du Chocolat Brasil 2026',
    data_inicio: '2026-12-10',
    cidade: 'Salvador',
    fonte_url: 'https://salonduchocolat.com.br/',
    perfil_publico: 'Produtores de cacau, marcas, chefs, distribuidores e visitantes',
    tipo: 'feira',
    fonte_contato_url: null,
    fontes: [
      { tipo: 'evento', url: 'https://salonduchocolat.com.br/', titulo: 'Site oficial do Salon du Chocolat Brasil' },
    ],
  },
  {
    nome: 'Bahia Oil & Gas Energy 2027',
    data_inicio: '2027-06-02',
    cidade: 'Salvador',
    fonte_url: 'https://www.bahiaoilgasenergy.com.br/',
    contato_nome: 'Fernanda Lima',
    contato_email: 'comercial@bahiaoilgasenergy.com.br',
    contato_telefone: '+55 84 99850 8782',
    perfil_publico: 'Profissionais de energia, fornecedores, investidores e instituições',
    tipo: 'feira',
    fonte_contato_url: 'https://www.bahiaoilgasenergy.com.br/',
    fontes: [
      { tipo: 'evento', url: 'https://www.bahiaoilgasenergy.com.br/', titulo: 'Site oficial Bahia Oil & Gas Energy 2027' },
      { tipo: 'contato', url: 'https://www.bahiaoilgasenergy.com.br/', titulo: 'Contato comercial divulgado no site oficial' },
    ],
  },
]
