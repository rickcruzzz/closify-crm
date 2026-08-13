import { describe, expect, it } from 'vitest'

import { inviteMemberSchema, updateWorkspaceNameSchema, uuidSchema } from './workspace'
import {
  FREE_LEAD_LIMIT,
  FREE_MEMBER_LIMIT,
  FREE_WORKSPACE_LIMIT,
} from '@/lib/plans'

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

  /**
   * O índice único de convites pendentes é `(workspace_id, email)` sobre o
   * texto cru. Sem normalizar na escrita, `ana@x.com` e `Ana@X.com` viravam
   * dois convites para a mesma pessoa — e cada um consome uma vaga do limite
   * de membros, porque `canAddMember` soma convites pendentes aos membros
   * ativos. No Free isso esgotava o plano com um convidado só.
   */
  it('normaliza o e-mail, para o índice único pegar o duplicado', () => {
    const r = inviteMemberSchema.safeParse({
      email: '  ANA@Exemplo.COM  ',
      role: 'membro',
    })

    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.email).toBe('ana@exemplo.com')
    }
  })

  // A ordem `trim → toLowerCase → email` não pode afrouxar a validação: se o
  // `.pipe(z.email())` saísse do fim da cadeia, lixo passaria normalizado.
  it('continua recusando e-mail inválido depois de normalizar', () => {
    expect(inviteMemberSchema.safeParse({ email: '  NAO É EMAIL  ', role: 'membro' }).success).toBe(
      false,
    )
    expect(inviteMemberSchema.safeParse({ email: '   ', role: 'membro' }).success).toBe(
      false,
    )
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

describe('limites do plano Free', () => {
  it('mantém 1 empresa, 2 colaboradores e 25 leads', () => {
    // O limite de workspaces não existia: o teto de colaboradores era por
    // empresa, então bastava criar uma empresa nova para cada dupla e ter
    // equipe ilimitada de graça. Um usuário de produção já tinha 4 workspaces
    // quando isto foi detectado.
    //
    // Se algum destes números mudar, a mensagem da RPC
    // `create_workspace_with_admin` (migration 0018) precisa mudar junto — ela
    // tem o texto embutido e a Server Action casa por substring.
    expect(FREE_WORKSPACE_LIMIT).toBe(1)
    expect(FREE_MEMBER_LIMIT).toBe(2)
    expect(FREE_LEAD_LIMIT).toBe(25)
  })
})
