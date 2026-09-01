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
/**
 * ## A ordem foi invertida em 01/09, e a razão é medida
 *
 * A lista começava por "Configurar a empresa": nome, segmento e dados de
 * contato. O rodapé do card anunciava isso como **próximo passo**, e é a
 * primeira coisa que alguém lê ao entrar no produto.
 *
 * É trabalho administrativo que não devolve nada. Preenchido o formulário
 * inteiro, a pessoa continua com um CRM vazio — e a auditoria daquele dia
 * mediu onde essa fila termina: **25 das 42 empresas nunca criaram um
 * contato**, enquanto 88% concluem o assistente de onboarding.
 *
 * O primeiro passo passou a ser o primeiro contato, que é o único item da
 * lista depois do qual o produto tem o que mostrar: a partir dele o funil tem
 * card, a tela Hoje tem o que cobrar, e Resultados deixa de somar zero.
 *
 * "Configurar a empresa" continua na lista, no fim. Ela importa (o nome
 * aparece nos convites e nos e-mails), só não é o que faz alguém voltar no
 * dia seguinte.
 *
 * **"Funil pronto" segue em segundo, e segue nascendo concluído.** Ele não é
 * tarefa, é resposta: tira do caminho a dúvida "preciso montar meu funil
 * antes?". Movê-lo para o fim o transformaria em item pendente que ninguém
 * pode fazer, e deixá-lo em primeiro faria a lista abrir com algo que a
 * pessoa não fez.
 */
export function montarChecklist(sinais: SinaisDeAtivacao): ItemDoChecklist[] {
  return [
    {
      chave: 'lead',
      titulo: 'Cadastrar o primeiro contato',
      descricao: 'Quem é o contato e de qual empresa.',
      href: '/leads',
      concluido: sinais.leads > 0,
    },
    {
      chave: 'pipeline',
      titulo: 'Funil pronto',
      descricao: 'Seu funil já vem com as 6 etapas configuradas.',
      href: '/kanban',
      concluido: true,
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
    {
      chave: 'empresa',
      titulo: 'Configurar a empresa',
      descricao: 'Nome, segmento e dados de contato.',
      href: '/settings',
      concluido: Boolean(sinais.empresa.name) && Boolean(sinais.empresa.segmento),
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
