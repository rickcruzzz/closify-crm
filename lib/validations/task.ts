import { z } from 'zod'

/**
 * Teto de data de tarefa. A faixa vai de 2000 a 2100 pela mesma razão do
 * `dealSchema`: cobre compromisso antigo importado e barra dedo escorregado no
 * ano, que geraria uma tarefa invisível em qualquer grupo da tela /hoje.
 */
const LIMITE_INFERIOR = new Date('2000-01-01T00:00:00.000Z')
const LIMITE_SUPERIOR = new Date('2100-01-01T00:00:00.000Z')

export const taskSchema = z
  .object({
    title: z.string().trim().min(2, 'Descreva a tarefa.').max(200, 'Título longo demais.'),
    type: z.enum(['ligacao', 'email', 'reuniao', 'nota'], { error: 'Selecione um tipo.' }),

    // Chega da tela como texto do <input type="datetime-local">, que não tem
    // fuso. `coerce.date` interpreta no fuso do navegador — que é o fuso de
    // quem digitou, e é exatamente o que se quer aqui: "amanhã 9h" é 9h de
    // quem marcou, não 9h em UTC.
    dueAt: z.coerce
      .date({ error: 'Informe a data e a hora.' })
      .min(LIMITE_INFERIOR, 'Data fora do intervalo aceito.')
      .max(LIMITE_SUPERIOR, 'Data fora do intervalo aceito.'),

    assigneeId: z.uuid('Selecione um responsável.'),

    leadId: z.uuid().nullish(),
    dealId: z.uuid().nullish(),
  })
  // Espelha o check `tasks_alvo_minimo` da migration 0029. O banco é quem
  // manda — esta validação existe para a mensagem chegar boa na tela em vez de
  // virar "Não foi possível salvar" vindo de um erro de constraint.
  .refine((v) => Boolean(v.leadId) || Boolean(v.dealId), {
    error: 'A tarefa precisa estar ligada a um lead ou a um negócio.',
    path: ['leadId'],
  })

export type TaskFormInput = z.input<typeof taskSchema>
export type TaskFormValues = z.output<typeof taskSchema>
