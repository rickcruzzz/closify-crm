import { describe, expect, it } from 'vitest'

import { feedbackSchema } from '@/lib/validations/feedback'

const valido = { tipo: 'problema' as const, mensagem: 'O botão de salvar não responde.' }

describe('feedbackSchema', () => {
  it('aceita um relato normal', () => {
    expect(feedbackSchema.safeParse(valido).success).toBe(true)
  })

  /**
   * O tipo decide se um e-mail sai. Um valor fora dos dois passaria pelo
   * TypeScript num `FormData` (que é `string`) e só falharia no `check` da
   * migration 0060 — com erro de banco na cara de quem só queria pedir ajuda.
   */
  it('recusa tipo fora dos dois, que é o campo que dispara o e-mail', () => {
    expect(feedbackSchema.safeParse({ ...valido, tipo: 'elogio' }).success).toBe(false)
  })

  /**
   * O piso não existe para dificultar o relato — existe contra o envio vazio.
   * "não funciona" tem 13 caracteres e PASSA de propósito: quem escreve pouco
   * costuma ser justamente quem está travado e com pressa.
   */
  it('aceita "não funciona", que é curto e é relato de verdade', () => {
    expect(feedbackSchema.safeParse({ ...valido, mensagem: 'não funciona' }).success).toBe(true)
  })

  it.each([['vazio', ''], ['espaços', '   '], ['toque acidental', 'oi']])(
    'recusa %s',
    (_rotulo, mensagem) => {
      expect(feedbackSchema.safeParse({ ...valido, mensagem }).success).toBe(false)
    },
  )

  // O mesmo teto do `check` da 0060. Se um dos dois mudar sem o outro, a
  // mensagem de 4001 caracteres passa aqui e explode no banco.
  it('respeita o teto de 4000, o mesmo do banco', () => {
    expect(feedbackSchema.safeParse({ ...valido, mensagem: 'a'.repeat(4000) }).success).toBe(true)
    expect(feedbackSchema.safeParse({ ...valido, mensagem: 'a'.repeat(4001) }).success).toBe(false)
  })

  it('apara espaço em volta antes de medir', () => {
    const r = feedbackSchema.safeParse({ ...valido, mensagem: '  não funciona  ' })
    expect(r.success && r.data.mensagem).toBe('não funciona')
  })

  // A rota é opcional: o diálogo abre de qualquer tela, e uma delas pode não
  // conseguir informar. Faltar contexto não pode impedir o relato de chegar.
  it('não exige a rota', () => {
    expect(feedbackSchema.safeParse(valido).success).toBe(true)
  })
})
