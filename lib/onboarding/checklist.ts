import type { DadosDaEmpresa } from '@/types/supabase'

export type ItemDoChecklist = {
  chave: 'empresa' | 'pipeline' | 'lead' | 'negocio' | 'tarefa'
  titulo: string
  descricao: string
  href: string
  concluido: boolean
}

/**
 * O que o checklist precisa saber. Só contagens e dois campos da empresa,
 * nada aqui exige carregar lead, negócio ou tarefa de verdade.
 */
export type SinaisDeAtivacao = {
  leads: number
  negocios: number
  tarefas: number
  empresa: Pick<DadosDaEmpresa, 'segmento'> & { name: string | null }
}

/**
 * Deriva o checklist do estado real do workspace.
 *
 * **Derivado, não marcado à mão.** Um `boolean` gravado quando a pessoa cria o
 * primeiro lead continuaria dizendo "feito" depois que ela apagasse esse lead
 *, o checklist mentiria sobre o próprio produto, que é pior do que não
 * existir. Contar custa três `count` e nunca discorda da tela.
 *
 * "Pipeline configurado" vem de graça: as 6 etapas existem desde a criação da
 * empresa. Está na lista porque some do caminho da pessoa a dúvida "preciso
 * montar meu funil antes?", a resposta é não, e mostrar isso feito responde
 * sem texto.
 */
export function montarChecklist(sinais: SinaisDeAtivacao): ItemDoChecklist[] {
  return [
    {
      chave: 'empresa',
      titulo: 'Configurar a empresa',
      descricao: 'Nome, segmento e dados de contato.',
      href: '/settings',
      concluido: Boolean(sinais.empresa.name) && Boolean(sinais.empresa.segmento),
    },
    {
      chave: 'pipeline',
      titulo: 'Funil pronto',
      descricao: 'Seu funil já vem com as 6 etapas configuradas.',
      href: '/kanban',
      concluido: true,
    },
    {
      chave: 'lead',
      titulo: 'Cadastrar o primeiro contato',
      descricao: 'Quem é o contato e de qual empresa.',
      href: '/leads',
      concluido: sinais.leads > 0,
    },
    {
      chave: 'negocio',
      titulo: 'Criar o primeiro negócio',
      descricao: 'Dê um valor e arraste pelo funil conforme avança.',
      href: '/kanban',
      concluido: sinais.negocios > 0,
    },
    {
      chave: 'tarefa',
      titulo: 'Agendar a primeira tarefa',
      descricao: 'A próxima ação aparece no card e na tela Hoje.',
      href: '/hoje',
      concluido: sinais.tarefas > 0,
    },
  ]
}

export function contarConcluidos(itens: ItemDoChecklist[]): number {
  return itens.filter((i) => i.concluido).length
}

/** Some quando tudo estiver feito, checklist cumprido não é mais ajuda, é ruído. */
export function checklistCumprido(itens: ItemDoChecklist[]): boolean {
  return itens.every((i) => i.concluido)
}

/** O primeiro item em aberto, para o botão de ação principal do cartão. */
export function proximoPasso(itens: ItemDoChecklist[]): ItemDoChecklist | null {
  return itens.find((i) => !i.concluido) ?? null
}
