import { z } from '@/lib/validations/zod'

/**
 * O que a tela pode mandar ao registrar um orçamento.
 *
 * As três regras de formato de data são as MESMAS de `dealSchema.dueDate`, e a
 * repetição é proposital em vez de extraída: as duas datas do negócio respondem
 * perguntas diferentes (quando eu acho que fecha × até quando este preço vale)
 * e vão divergir. O que não pode divergir é o teto do valor, que sai da mesma
 * constante lá — por isso o comentário abaixo aponta para o defeito original.
 */

const DIA = /^\d{4}-\d{2}-\d{2}$/

export const orcamentoSchema = z
  .object({
    dealId: z.uuid('Negócio inválido.'),

    // Mesmo teto de `dealSchema.value`, e pela mesma razão medida em produção:
    // sem ele, um dígito a mais vira negócio de R$ 4,2 bilhões — dois deles
    // existiram, e fizeram o "Valor do Pipeline" do Dashboard mostrar "R$ 8,5
    // bi" para um funil de 4 negócios reais.
    //
    // A diferença para lá é o PISO: `dealSchema` aceita 0, aqui não.
    // `deals_orcamento_tem_valor` (0076) recusa no banco, e um orçamento de
    // R$ 0,00 sairia em PDF para o cliente do cliente — visível só depois de
    // enviado, que é tarde demais.
    valor: z.coerce
      .number()
      .positive('Informe o valor do orçamento.')
      .max(100_000_000, 'Valor muito alto, confira se não sobrou um dígito a mais.'),

    // Vazio é a forma de TIRAR o orçamento, e por isso é aceito: a alternativa
    // seria uma segunda action só para apagar, e duas portas para o mesmo dado
    // divergem.
    validade: z
      .union([z.literal(''), z.string()])
      .optional()
      .refine((v) => !v || DIA.test(v), 'Data inválida.')
      .refine((v) => {
        if (!v) return true
        const [ano, mes, dia] = v.split('-').map(Number)
        const d = new Date(ano!, mes! - 1, dia!)
        // Recusa data que não existe no calendário: 31/02 vira 3 de março
        // silenciosamente, e o orçamento passaria a vencer num dia que a
        // pessoa não escolheu.
        return d.getFullYear() === ano && d.getMonth() === mes! - 1 && d.getDate() === dia
      }, 'Essa data não existe.')
      .refine((v) => {
        if (!v) return true
        const ano = Number(v.slice(0, 4))
        return ano >= 2000 && ano <= 2100
      }, 'Informe um ano entre 2000 e 2100.'),

    // O teto espelha `deals_orcamento_descricao_cabe` (0076). Sem ele aqui, o
    // erro só apareceria como falha genérica de gravação, sem dizer qual campo.
    descricao: z
      .union([z.literal(''), z.string()])
      .optional()
      .refine((v) => !v || v.length <= 2000, 'Descrição longa demais (máximo 2.000 caracteres).'),
  })
  .strict()

export type OrcamentoInput = z.input<typeof orcamentoSchema>
export type OrcamentoValues = z.output<typeof orcamentoSchema>
