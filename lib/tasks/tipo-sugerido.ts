import type { DealStage } from '@/lib/deals/types'

/**
 * Os tipos que o formulário de tarefa oferece.
 *
 * `nota` fica de fora, e a diferença é a que separa tarefa de registro: tarefa
 * é compromisso com hora marcada, e o formulário exige "Quando". Nota é o que
 * já aconteceu — agendar uma nota para semana que vem faz `/hoje` cobrar ação
 * de algo que não é ação. A lista veio inteira do `ActivityType` da timeline
 * (onde nota cabe, e continua cabendo) e foi reusada aqui sem filtrar.
 */
export const taskTypesCriaveis = ['ligacao', 'email', 'reuniao'] as const

export type TaskTypeCriavel = (typeof taskTypesCriaveis)[number]

/**
 * O tipo que já vem escolhido, conforme a etapa em que o negócio está.
 *
 * Não trava nada: a pessoa troca no seletor à vontade. O que isto poupa é o
 * clique do caso comum — negócio em Negociação quase sempre pede reunião, e
 * abrir tudo em "Ligação" fazia o padrão estar errado justamente onde o
 * acompanhamento é mais caro de esquecer.
 *
 * Sem etapa (tarefa criada pela página do lead ou pela tela Hoje, onde não há
 * negócio) cai em ligação, que é o primeiro contato.
 */
export function tipoSugerido(stage: DealStage | undefined): TaskTypeCriavel {
  switch (stage) {
    // Negociação é conversa: preço, prazo e objeção não se resolvem por texto.
    case 'negociacao':
      return 'reuniao'
    // Proposta na mão do cliente: quem cobra resposta liga, e-mail vira fila.
    case 'proposta_enviada':
      return 'ligacao'
    default:
      return 'ligacao'
  }
}
