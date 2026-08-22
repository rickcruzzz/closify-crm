import { z } from 'zod'

import { CSV_MAX_LINHAS } from '@/lib/leads/csv'

/**
 * A regra de contato do formulário, alinhada à do banco.
 *
 * A migration 0025 tirou o `not null` de `leads.email` e pôs no lugar a
 * constraint `leads_contato_minimo`: e-mail OU telefone, nunca nenhum dos
 * dois. O raciocínio dela vale palavra por palavra aqui: "o que importa num
 * CRM não é ter e-mail, é HAVER COMO FALAR com a pessoa".
 *
 * O comentário daquela migration dizia que o formulário manual seguiria
 * exigindo os dois, porque "quem digita um lead tem a informação na mão".
 * Era verdade quando só a importação de planilha criava lead sem e-mail — e
 * a importação não passa por este schema.
 *
 * Deixou de ser em 22/08, quando o WhatsApp entrou: o webhook cria lead com
 * `email: null` e só telefone (é tudo o que uma mensagem recebida oferece).
 * Esses leads caem na mesma tela de edição, e o efeito medido foi:
 * "BLOQUEADO -> Informe o e-mail." — abrir um contato que chegou pelo
 * WhatsApp para mudar o status, corrigir o nome ou atribuir um responsável
 * era impossível, porque o formulário cobrava um e-mail que o cliente nunca
 * deu. Isso trancava justamente o fluxo que a integração existe para criar.
 *
 * Não é afrouxar validação: e-mail informado continua tendo que ser um
 * e-mail válido, e um contato sem NENHUMA forma de falar continua recusado,
 * agora com a mesma régua que o banco aplica.
 */
export const leadSchema = z
  .object({
    name: z.string().min(2, 'Informe o nome completo.'),
    // Vazio é permitido; preenchido tem que ser válido. `z.email()` sozinho
    // recusaria a string vazia, daí o `union`.
    email: z.union([z.literal(''), z.email('E-mail inválido.')]).optional(),
    phone: z.union([z.literal(''), z.string().min(8, 'Informe um telefone válido.')]).optional(),
    company: z.string().min(2, 'Informe a empresa.'),
    status: z.enum(
      ['novo', 'contato_realizado', 'proposta_enviada', 'negociacao', 'fechado_ganho', 'fechado_perdido'],
      { error: 'Selecione um status.' },
    ),
    ownerId: z.uuid('Selecione um responsável.'),
    value: z.coerce.number().min(0, 'O valor não pode ser negativo.'),
  })
  .refine((dados) => Boolean(dados.email?.trim() || dados.phone?.trim()), {
    // O erro aponta para o e-mail porque é o primeiro dos dois campos na
    // tela — mensagem de formulário sem campo associado não aparece perto de
    // nada.
    path: ['email'],
    message: 'Informe pelo menos um contato: e-mail ou telefone.',
  })

export type LeadFormInput = z.input<typeof leadSchema>
export type LeadFormValues = z.output<typeof leadSchema>

/** Colunas que a importação sabe preencher. Espelha `CampoDestino`. */
const campoDestino = z.enum(['name', 'email', 'phone', 'company', 'value', 'status'])

/**
 * O que a tela de importação manda para o servidor.
 *
 * Só a FORMA é validada aqui, que veio matriz de texto e um mapeamento de
 * coluna. O conteúdo de cada linha é reinterpretado no servidor por
 * `interpretarPlanilha`, porque esta Server Action é um endpoint HTTP: dá para
 * chamá-la sem passar pela tela, mandando qualquer coisa.
 *
 * O teto de células existe antes de qualquer trabalho. Sem ele, uma matriz de
 * dezenas de milhares de colunas seguraria a função à toa, o limite de linhas
 * sozinho não impede isso, porque a largura também é livre.
 */
const MAX_COLUNAS = 60
const MAX_CELULAS = CSV_MAX_LINHAS * MAX_COLUNAS

export const planilhaSchema = z.object({
  matriz: z
    .array(z.array(z.string().max(2000, 'Célula longa demais.')).max(MAX_COLUNAS, 'Planilha com colunas demais.'))
    // +1 pelo cabeçalho, que também vem na matriz.
    .min(2, 'A planilha não tem nenhuma linha além do cabeçalho.')
    .max(CSV_MAX_LINHAS + 1, `A planilha passa de ${CSV_MAX_LINHAS} linhas.`)
    .refine(
      (m) => m.reduce((total, linha) => total + linha.length, 0) <= MAX_CELULAS,
      'Planilha grande demais.',
    ),
  mapeamento: z.record(campoDestino, z.number().int().min(0).max(MAX_COLUNAS - 1)),
  /**
   * O que fazer com quem já está cadastrado.
   *
   * O padrão é `ignorar` de propósito: quem não escolheu nada não pode ter a
   * base sobrescrita. Reimportar atualizando é o que dá a sensação de planilha
   * conectada, a pessoa corrige o arquivo, sobe de novo e o CRM acompanha,
   * sem manter a planilha viva como fonte da verdade.
   */
  duplicados: z.enum(['ignorar', 'atualizar']).default('ignorar'),
})

export type PlanilhaPayload = z.output<typeof planilhaSchema>
