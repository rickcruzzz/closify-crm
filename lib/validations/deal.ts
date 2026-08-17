import { z } from 'zod'

export const dealSchema = z.object({
  title: z.string().min(2, 'Informe o título do negócio.'),
  leadId: z.uuid('Selecione um lead.'),
  // Sem teto, um dígito a mais (ou o teclado mashing puro) vira negócio de
  // R$4,2 bilhões, visto em produção (workspace real, dois negócios com
  // exatamente esse valor), o suficiente pra fazer "Valor do Pipeline" no
  // Dashboard mostrar "R$ 8,5 bi" pra um funil de 4 negócios reais.
  // R$100 milhões cobre o maior contrato plausível pra PME de serviço
  // (o público do produto) sem inventar regra que a pessoa não entenderia,
  // mesmo raciocínio já aplicado ao ano de `dueDate` logo abaixo.
  value: z.coerce
    .number()
    .min(0, 'O valor não pode ser negativo.')
    .max(100_000_000, 'Valor muito alto, confira se não sobrou um dígito a mais.'),
  stage: z.enum(
    [
      'novo',
      'contato_realizado',
      'proposta_enviada',
      'negociacao',
      'fechado_ganho',
      'fechado_perdido',
    ],
    { error: 'Selecione uma etapa.' },
  ),
  ownerId: z.uuid('Selecione um responsável.'),
  // Um `<input type="date">` aceita qualquer ano, inclusive 0111, digitar o
  // ano com o teclado é fácil de errar, e o campo não reclama. Isso encheu o
  // banco de prazos como 0111-11-11 e 2000-11-11, que a tela exibia como
  // "atrasado há 699.346 dias".
  //
  // A faixa vai de 2000 a 2100: cobre negócio antigo importado de planilha e
  // contrato de longo prazo, e barra o erro de digitação sem inventar uma
  // regra que o usuário não entenderia.
  dueDate: z
    .string()
    .min(1, 'Informe o prazo.')
    .refine((valor) => /^\d{4}-\d{2}-\d{2}$/.test(valor), 'Data inválida.')
    .refine((valor) => {
      const [ano, mes, dia] = valor.split('-').map(Number)
      const data = new Date(ano!, mes! - 1, dia!)
      // Rejeita data que não existe no calendário (31/02 vira 3 de março).
      return (
        data.getFullYear() === ano && data.getMonth() === mes! - 1 && data.getDate() === dia
      )
    }, 'Essa data não existe.')
    .refine((valor) => {
      const ano = Number(valor.slice(0, 4))
      return ano >= 2000 && ano <= 2100
    }, 'Informe um ano entre 2000 e 2100.'),
})

export type DealFormInput = z.input<typeof dealSchema>
export type DealFormValues = z.output<typeof dealSchema>
