import { z } from 'zod'

/**
 * Faixa aceita para o prazo da tarefa.
 *
 * O piso era `2000-01-01`, copiado do `dealSchema`, cuja justificativa é
 * "cobre compromisso antigo importado". **Tarefa não é importada**: ela só
 * nasce deste formulário, para ser feita. O piso largo deixou entrar em
 * produção uma tarefa marcada para `2000-11-11`, criada em 2026, que a tela
 * anunciava como "atrasada há 9411 dias".
 *
 * Agora o piso é relativo a hoje. Um ano para trás ainda aceita quem registra
 * algo que esqueceu de lançar na semana passada, e recusa o dedo escorregado
 * no ano, que é o caso real que aconteceu.
 *
 * O teto continua largo: agendar com muita antecedência é raro, mas legítimo.
 */
const UM_ANO_EM_MS = 365 * 24 * 60 * 60 * 1000
const LIMITE_SUPERIOR = new Date('2100-01-01T00:00:00.000Z')

export const taskSchema = z
  .object({
    title: z.string().trim().min(2, 'Descreva a tarefa.').max(200, 'Título longo demais.'),
    /**
     * `nota` continua sendo aceita, mas não é mais OFERECIDA.
     *
     * Tarefa é compromisso com hora marcada; nota é registro do que já
     * aconteceu, e este schema exige `dueAt` — nota agendada para semana que
     * vem faz `/hoje` cobrar ação de algo que não é ação. A lista veio inteira
     * do `ActivityType` da timeline (onde nota cabe) e foi reusada sem filtrar.
     *
     * Recusar `nota` aqui quebraria a tarefa que JÁ existe em produção com esse
     * tipo: editar o título dela passaria a falhar na validação, ou pior,
     * salvaria trocando o tipo sem ninguém pedir. Quem restringe a criação é
     * `taskTypesCriaveis`, que é o que o seletor do formulário oferece.
     */
    // `whatsapp` entra aqui, mas NAO no seletor da tela. A diferenca importa:
    // a tarefa "Responder no WhatsApp" nasce do webhook com esse tipo, e o
    // usuario precisa poder mexer no prazo e no responsavel dela sem que o
    // formulario recuse o proprio valor que ja estava gravado.
    //
    // Diferente da ATIVIDADE, que e registro do que o cliente escreveu e nao
    // se edita: a tarefa e trabalho de quem usa o produto, e trabalho se
    // reorganiza.
    type: z.enum(['ligacao', 'email', 'reuniao', 'nota', 'whatsapp'], {
      error: 'Selecione um tipo.',
    }),

    // Chega da tela como texto do <input type="datetime-local">, que não tem
    // fuso. `coerce.date` interpreta no fuso do navegador, que é o fuso de
    // quem digitou, e é exatamente o que se quer aqui: "amanhã 9h" é 9h de
    // quem marcou, não 9h em UTC.
    dueAt: z.coerce
      .date({ error: 'Informe a data e a hora.' })
      .max(LIMITE_SUPERIOR, 'Data fora do intervalo aceito.')
      // Comparado com o relógio de QUEM VALIDA, não com uma constante de
      // módulo: constante seria calculada uma vez, quando o processo subiu, e
      // num servidor de vida longa o piso iria envelhecendo junto.
      .refine((data) => data.getTime() >= Date.now() - UM_ANO_EM_MS, {
        error: 'Essa data já passou faz muito tempo. Confira o ano.',
      }),

    assigneeId: z.uuid('Selecione um responsável.'),

    leadId: z.uuid().nullish(),
    dealId: z.uuid().nullish(),
  })
  // Espelha o check `tasks_alvo_minimo` da migration 0029. O banco é quem
  // manda, esta validação existe para a mensagem chegar boa na tela em vez de
  // virar "Não foi possível salvar" vindo de um erro de constraint.
  .refine((v) => Boolean(v.leadId) || Boolean(v.dealId), {
    error: 'A tarefa precisa estar ligada a um lead ou a um negócio.',
    path: ['leadId'],
  })

export type TaskFormInput = z.input<typeof taskSchema>
export type TaskFormValues = z.output<typeof taskSchema>
