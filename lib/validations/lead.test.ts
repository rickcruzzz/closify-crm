import { describe, expect, it } from 'vitest'

import { leadSchema } from './lead'

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
