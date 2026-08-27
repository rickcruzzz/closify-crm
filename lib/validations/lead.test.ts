import { describe, expect, it } from 'vitest'

import { leadSchema, planilhaSchema } from './lead'

/**
 * Regressão do contato que não podia ser editado.
 *
 * O webhook do WhatsApp cria lead com `email: null` e só telefone — é tudo o
 * que uma mensagem recebida oferece. Esses leads caem na mesma tela de edição
 * dos demais, e o schema exigia e-mail: abrir um contato que chegou pelo
 * WhatsApp para mudar o status ou atribuir responsável devolvia
 * "Informe o e-mail." e não deixava salvar. A integração criava o contato e o
 * formulário o trancava.
 *
 * A régua agora é a mesma do banco (`leads_contato_minimo`, migration 0025):
 * e-mail OU telefone.
 */

const base = {
  name: 'Maria Silva',
  company: 'Padaria Central',
  status: 'novo' as const,
  ownerId: '11111111-1111-4111-8111-111111111111',
  value: 0,
}

describe('leadSchema, contato mínimo', () => {
  it('aceita lead só com telefone, como o WhatsApp cria', () => {
    const r = leadSchema.safeParse({ ...base, email: '', phone: '5511999998888' })
    expect(r.success).toBe(true)
  })

  it('aceita lead só com e-mail, como uma planilha sem telefone traz', () => {
    const r = leadSchema.safeParse({ ...base, email: 'maria@exemplo.com', phone: '' })
    expect(r.success).toBe(true)
  })

  it('aceita os dois preenchidos', () => {
    const r = leadSchema.safeParse({
      ...base,
      email: 'maria@exemplo.com',
      phone: '5511999998888',
    })
    expect(r.success).toBe(true)
  })

  // A regra não afrouxou, só mudou de forma: contato sem NENHUMA maneira de
  // falar com a pessoa continua sendo lixo, e o banco recusaria de qualquer
  // jeito pela constraint.
  it('recusa lead sem e-mail e sem telefone', () => {
    const r = leadSchema.safeParse({ ...base, email: '', phone: '' })
    expect(r.success).toBe(false)
  })

  it('recusa lead com os dois campos ausentes', () => {
    const r = leadSchema.safeParse(base)
    expect(r.success).toBe(false)
  })

  it('e-mail preenchido continua tendo que ser válido', () => {
    const r = leadSchema.safeParse({ ...base, email: 'não-é-email', phone: '5511999998888' })
    expect(r.success).toBe(false)
  })

  it('telefone preenchido continua tendo que ter tamanho plausível', () => {
    const r = leadSchema.safeParse({ ...base, email: '', phone: '123' })
    expect(r.success).toBe(false)
  })
})

/**
 * Regressão da planilha que não importava.
 *
 * `mapeamento` era `z.record(campoDestino, ...)`. No Zod v4, `z.record` com
 * chave de enum virou EXAUSTIVO: passou a exigir as seis colunas. Quem subisse
 * uma planilha só com nome, e-mail e telefone recebia três `invalid_type` de
 * uma vez, e a tela mostrava o toast "Invalid input" — que não diz o que está
 * errado nem o que fazer.
 *
 * A quebra é silenciosa por construção: nenhuma linha de código mudou, só a
 * versão de uma dependência, e não havia teste desta parte do schema nem E2E
 * que exercitasse a importação. Foi achado em 27/08/2026 pelo primeiro teste
 * que subiu um CSV de verdade contra produção.
 */
describe('planilhaSchema, mapeamento parcial', () => {
  const matriz = [
    ['nome', 'email', 'telefone'],
    ['José Antônio', 'jose@exemplo.com.br', '11987654321'],
  ]

  // O caso que estava quebrado, e é o principal deste produto: a planilha do
  // público-alvo é lista de WhatsApp. A 0025 tornou `email` opcional
  // exatamente por isso.
  it('aceita planilha só com nome e telefone', () => {
    const r = planilhaSchema.safeParse({
      matriz,
      mapeamento: { name: 0, phone: 2 },
      duplicados: 'ignorar',
    })
    expect(r.success).toBe(true)
  })

  it('aceita as seis colunas mapeadas', () => {
    const r = planilhaSchema.safeParse({
      matriz,
      mapeamento: { name: 0, email: 1, phone: 2, company: 3, value: 4, status: 5 },
      duplicados: 'ignorar',
    })
    expect(r.success).toBe(true)
  })

  // As duas defesas que `partialRecord` NÃO pode ter afrouxado junto: esta
  // Server Action é endpoint HTTP e aceita qualquer coisa de quem a chame sem
  // passar pela tela.
  it('recusa campo de destino que não existe', () => {
    const r = planilhaSchema.safeParse({
      matriz,
      mapeamento: { name: 0, cpf: 1 },
      duplicados: 'ignorar',
    })
    expect(r.success).toBe(false)
  })

  it('recusa índice de coluna fora da faixa', () => {
    const r = planilhaSchema.safeParse({
      matriz,
      mapeamento: { name: 999 },
      duplicados: 'ignorar',
    })
    expect(r.success).toBe(false)
  })

  // `duplicados` tem `.default('ignorar')`: quem não escolheu nada não pode
  // ter a base sobrescrita.
  it('sem `duplicados`, o padrão é ignorar quem já existe', () => {
    const r = planilhaSchema.safeParse({ matriz, mapeamento: { name: 0 } })
    expect(r.success).toBe(true)
    expect(r.success && r.data.duplicados).toBe('ignorar')
  })
})
