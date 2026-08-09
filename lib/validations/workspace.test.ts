import { describe, expect, it } from 'vitest'

import { inviteMemberSchema, updateWorkspaceNameSchema, uuidSchema } from './workspace'

/**
 * Regressão do convite que não enviava.
 *
 * O `Select` de papel usava `watch` + `setValue` sem registrar o campo no
 * formulário. Quando `role` não chegava ao resolver, o zod reprovava — e como
 * a tela não renderizava erro para esse campo, o clique em "Enviar convite"
 * não fazia absolutamente nada: sem toast, sem fechar o diálogo, sem pista.
 *
 * Mesmo modo de falha do bug do reset de senha: schema exige um campo que a
 * interface não mostra. Todo campo obrigatório precisa de um lugar visível
 * para o erro aparecer.
 */

describe('inviteMemberSchema', () => {
  it('aceita convite completo', () => {
    expect(
      inviteMemberSchema.safeParse({ email: 'pessoa@empresa.com.br', role: 'membro' })
        .success,
    ).toBe(true)
    expect(
      inviteMemberSchema.safeParse({ email: 'pessoa@empresa.com.br', role: 'admin' })
        .success,
    ).toBe(true)
  })

  it('exige role; a tela precisa registrar esse campo e exibir o erro', () => {
    const r = inviteMemberSchema.safeParse({ email: 'pessoa@empresa.com.br' })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0]?.path).toEqual(['role'])
    }
  })

  it('recusa papel fora do enum', () => {
    const r = inviteMemberSchema.safeParse({
      email: 'pessoa@empresa.com.br',
      role: 'superadmin',
    })
    expect(r.success).toBe(false)
  })

  it('recusa e-mail vazio ou inválido', () => {
    expect(inviteMemberSchema.safeParse({ email: '', role: 'membro' }).success).toBe(false)
    expect(
      inviteMemberSchema.safeParse({ email: 'sem-arroba', role: 'membro' }).success,
    ).toBe(false)
  })
})

describe('updateWorkspaceNameSchema', () => {
  it('exige nome com pelo menos 2 caracteres', () => {
    expect(updateWorkspaceNameSchema.safeParse({ name: 'Acme' }).success).toBe(true)
    expect(updateWorkspaceNameSchema.safeParse({ name: 'A' }).success).toBe(false)
    expect(updateWorkspaceNameSchema.safeParse({ name: '' }).success).toBe(false)
  })
})

describe('uuidSchema', () => {
  it('aceita uuid e recusa lixo', () => {
    // Server Action é endpoint HTTP: o tipo do parâmetro não protege nada em
    // runtime, e mandar string arbitrária ao Postgres devolve erro de cast cru.
    expect(uuidSchema.safeParse('11111111-1111-4111-8111-111111111111').success).toBe(true)
    expect(uuidSchema.safeParse('abc').success).toBe(false)
  })
})
