import { describe, expect, it } from 'vitest'

import { perfilSchema } from './auth'
import { activitySchema } from './activity'

/**
 * O nome do perfil vai para `user_metadata.name`, que é de onde a RPC
 * `get_workspace_member_names` lê o nome exibido na lista de colaboradores e
 * como autor de cada atividade, um valor ruim aqui suja a timeline inteira.
 */
describe('perfilSchema', () => {
  it('aceita nome comum', () => {
    expect(perfilSchema.safeParse({ name: 'Orlando Cruz' }).success).toBe(true)
  })

  it('remove espaço em volta antes de validar', () => {
    const r = perfilSchema.safeParse({ name: '  Ana Paula  ' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.name).toBe('Ana Paula')
  })

  it('recusa nome com menos de 2 caracteres', () => {
    expect(perfilSchema.safeParse({ name: 'A' }).success).toBe(false)
    // Só espaços viram string vazia depois do trim.
    expect(perfilSchema.safeParse({ name: '   ' }).success).toBe(false)
  })

  it('recusa nome absurdamente longo', () => {
    expect(perfilSchema.safeParse({ name: 'x'.repeat(81) }).success).toBe(false)
  })
})

describe('activitySchema', () => {
  it('aceita os quatro tipos previstos', () => {
    for (const type of ['ligacao', 'email', 'reuniao', 'nota']) {
      expect(activitySchema.safeParse({ type, description: 'Conversa inicial' }).success).toBe(
        true,
      )
    }
  })

  it('recusa tipo fora do enum', () => {
    // A edição de atividade manda `type` pela rede: o tipo do parâmetro em
    // TypeScript não protege nada em runtime.
    expect(
      activitySchema.safeParse({ type: 'whatsapp', description: 'Oi' }).success,
    ).toBe(false)
  })

  it('exige descrição com pelo menos 2 caracteres', () => {
    expect(activitySchema.safeParse({ type: 'nota', description: '' }).success).toBe(false)
    expect(activitySchema.safeParse({ type: 'nota', description: 'a' }).success).toBe(false)
  })
})
