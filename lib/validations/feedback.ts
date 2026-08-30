import { z } from '@/lib/validations/zod'

/**
 * O que o cliente manda ao falar com o suporte de dentro do produto.
 *
 * ## Por que o tipo é escolha e não texto livre
 *
 * Os dois casos têm urgências opostas: sugestão espera dias sem custo nenhum,
 * problema é cliente travado — pagando — e o dono sem saber. É esse campo que
 * decide se um e-mail sai. Deduzir isso do texto ("parece reclamação?") seria
 * adivinhação, e errar para o lado errado significa um cliente esperando dias
 * por uma resposta que ninguém viu chegar.
 *
 * Os mesmos dois valores estão no `check` da migration 0060. Regra que só vive
 * na Server Action não é regra — a doutrina do projeto, paga em três defeitos
 * (autoupgrade, limite de leads, autoconvite).
 */
export const TIPOS_DE_FEEDBACK = ['problema', 'sugestao'] as const

export type TipoDeFeedback = (typeof TIPOS_DE_FEEDBACK)[number]

/**
 * Mínimo de 10 caracteres, e este número tem motivo.
 *
 * Não é para dificultar: é que "não funciona" tem 13 e já passa, enquanto
 * "oi", "teste" e um toque acidental no botão não passam. O piso existe contra
 * o envio vazio, não contra o relato curto — quem escreve pouco costuma ser
 * justamente quem está com pressa por estar travado.
 *
 * O teto de 4000 é o mesmo do `check` no banco. Folgado para relato humano e
 * suficiente para impedir que uma chamada encha a tabela com um texto só.
 */
export const feedbackSchema = z.object({
  tipo: z.enum(TIPOS_DE_FEEDBACK),
  mensagem: z
    .string()
    .trim()
    .min(10, 'Conte um pouco mais para conseguirmos ajudar.')
    .max(4000, 'Mensagem muito longa. Resuma em até 4000 caracteres.'),
  /**
   * A rota de onde a pessoa abriu o diálogo.
   *
   * Vem do cliente porque só ele sabe em que tela estava — e é tratada como
   * INFORMAÇÃO, não prova: entra num campo de texto que ninguém usa para
   * decidir nada, com teto de tamanho. Medição do navegador é informação,
   * autorização é do servidor, e essa lição já foi paga em 20/08, quando um
   * arquivo de 720×720 declarado como 1080×1080 passou pela validação.
   *
   * Todo o resto do contexto (empresa, plano, navegador, usuário) é lido no
   * servidor, onde não dá para mentir.
   */
  rota: z.string().trim().max(200).optional(),
})

export type FeedbackValues = z.infer<typeof feedbackSchema>
