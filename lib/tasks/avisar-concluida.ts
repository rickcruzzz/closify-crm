import { toast } from 'sonner'

import { reabrirTarefa } from '@/lib/tasks/actions'

/**
 * O aviso de "tarefa concluída", com o desfazer junto — num lugar só.
 *
 * ## Por que centralizar
 *
 * Concluir tarefa acontece em três telas (`/hoje`, `/calendario` e o painel do
 * lead) e respondia de três jeitos diferentes: só `/hoje` oferecia "Desfazer".
 * Não foi decisão de produto — foi a primeira tela ter ganhado o desfazer e as
 * outras duas terem nascido antes, sem ninguém reconciliar depois.
 *
 * O gesto é o mesmo nas três: uma caixa de seleção pequena, num item de lista,
 * fácil de errar com o dedo no celular. Sem desfazer, reabrir só era possível
 * chamando `reabrirTarefa` pelo código — a tela não deixava rastro de que isso
 * existia.
 *
 * ## O que o desfazer NÃO faz
 *
 * Não apaga a atividade que a conclusão gerou no histórico do lead — a própria
 * `reabrirTarefa` documenta isso. Desfazer aqui é reabrir o compromisso, não
 * fingir que a ligação não aconteceu. É a leitura correta: o histórico é
 * registro do que houve, e mexer nele para esconder um clique errado tornaria
 * o histórico não confiável.
 *
 * O `aoDesfazer` existe porque cada tela reverte o próprio estado de um jeito:
 * `/hoje` devolve a tarefa à lista de onde ela sumiu, o calendário limpa o
 * `done_at` que pintou de cinza, e o painel do lead só revalida.
 */
export function avisarTarefaConcluida(taskId: string, aoDesfazer: () => void) {
  toast.success('Tarefa concluída.', {
    action: {
      label: 'Desfazer',
      onClick: async () => {
        const resultado = await reabrirTarefa(taskId)
        if ('error' in resultado) {
          toast.error(resultado.error)
          return
        }
        aoDesfazer()
      },
    },
  })
}
