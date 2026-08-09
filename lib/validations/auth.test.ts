import { describe, expect, it } from 'vitest'

import {
  definirSenhaSchema,
  loginSchema,
  resetPasswordSchema,
  signUpSchema,
} from './auth'

/**
 * Estes testes existem por causa de um bug real: `resetPasswordSchema` ganhou
 * `confirmPassword` e a tela de redefinição não foi atualizada. O resolver
 * falhava num campo que a página não renderizava, o erro não tinha onde
 * aparecer e o submit nunca disparava — o botão "Salvar nova senha" ficou
 * inerte, sem mensagem, trancando fora da conta quem esquecia a senha.
 *
 * O caso `senhas diferentes apontam o erro para confirmPassword` é o guarda:
 * ele quebra se alguém mexer no `path` do `.refine`, que é o que liga a
 * mensagem ao campo certo na tela.
 */

describe('signUpSchema', () => {
  const valido = {
    name: 'Orlando Cruz',
    email: 'orlando@empresa.com.br',
    password: 'SenhaForte#2026',
    confirmPassword: 'SenhaForte#2026',
    terms: true as const,
  }

  it('aceita cadastro completo', () => {
    expect(signUpSchema.safeParse(valido).success).toBe(true)
  })

  it('exige aceite dos termos', () => {
    const r = signUpSchema.safeParse({ ...valido, terms: false })
    expect(r.success).toBe(false)
  })

  it('recusa senha com menos de 8 caracteres', () => {
    const r = signUpSchema.safeParse({
      ...valido,
      password: 'Abc#123',
      confirmPassword: 'Abc#123',
    })
    expect(r.success).toBe(false)
  })

  it('aponta o erro de senhas diferentes no campo de confirmação', () => {
    const r = signUpSchema.safeParse({ ...valido, confirmPassword: 'Outra#2026' })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0]?.path).toEqual(['confirmPassword'])
    }
  })

  it('recusa e-mail inválido', () => {
    expect(signUpSchema.safeParse({ ...valido, email: 'sem-arroba' }).success).toBe(false)
  })
})

describe('resetPasswordSchema', () => {
  it('aceita as duas senhas iguais', () => {
    const r = resetPasswordSchema.safeParse({
      password: 'NovaSenha#2026',
      confirmPassword: 'NovaSenha#2026',
    })
    expect(r.success).toBe(true)
  })

  // Regressão direta do bug: sem `confirmPassword` o parse falha. Se este
  // teste passar a falhar, é sinal de que o schema mudou — e a tela precisa
  // mudar junto.
  it('exige confirmPassword; a tela precisa renderizar esse campo', () => {
    const r = resetPasswordSchema.safeParse({ password: 'NovaSenha#2026' })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path[0] === 'confirmPassword')).toBe(true)
    }
  })

  it('aponta o erro de divergência no campo de confirmação', () => {
    const r = resetPasswordSchema.safeParse({
      password: 'NovaSenha#2026',
      confirmPassword: 'Diferente#2026',
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0]?.path).toEqual(['confirmPassword'])
    }
  })
})

describe('definirSenhaSchema', () => {
  it('segue as mesmas regras do cadastro', () => {
    expect(
      definirSenhaSchema.safeParse({ password: 'Abc#1234', confirmPassword: 'Abc#1234' })
        .success,
    ).toBe(true)
    expect(
      definirSenhaSchema.safeParse({ password: 'curta', confirmPassword: 'curta' })
        .success,
    ).toBe(false)
  })
})

describe('loginSchema', () => {
  it('não impõe tamanho mínimo de senha', () => {
    // De propósito: senha antiga, criada antes da regra de 8 caracteres,
    // precisa continuar entrando. Validar tamanho aqui trancaria essas contas.
    const r = loginSchema.safeParse({ email: 'a@b.com', password: '123' })
    expect(r.success).toBe(true)
  })

  it('exige e-mail e senha preenchidos', () => {
    expect(loginSchema.safeParse({ email: '', password: '' }).success).toBe(false)
  })
})
