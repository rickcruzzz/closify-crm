import { describe, expect, it } from 'vitest'

import { taskSchema } from './task'

const base = {
  title: 'Ligar para o cliente',
  type: 'ligacao' as const,
  assigneeId: '11111111-1111-4111-8111-111111111111',
  leadId: '22222222-2222-4222-8222-222222222222',
}

function comPrazo(dueAt: Date | string) {
  return taskSchema.safeParse({ ...base, dueAt })
}

function daquiA(dias: number) {
  return new Date(Date.now() + dias * 24 * 60 * 60 * 1000)
}

describe('taskSchema, prazo', () => {
  it('aceita o caso comum: amanhã', () => {
    expect(comPrazo(daquiA(1)).success).toBe(true)
  })

  // O piso era `2000-01-01`, copiado do dealSchema, cuja justificativa é
  // "cobre compromisso antigo importado". Tarefa NÃO é importada: nasce do
  // formulário, para ser feita. Com o piso largo entrou em produção uma tarefa
  // marcada para 2000-11-11, criada em 2026, que a tela anunciava como
  // "atrasada há 9411 dias".
  it('recusa ano digitado errado, o defeito que aconteceu de verdade', () => {
    const resultado = comPrazo('2000-11-11T11:00:00.000Z')
    expect(resultado.success).toBe(false)
    if (!resultado.success) {
      // A mensagem precisa apontar o que conferir. "Data fora do intervalo
      // aceito", que era o texto antigo, não diz à pessoa que ela errou o ano.
      expect(resultado.error.issues[0]?.message).toContain('ano')
    }
  })

  // Registrar hoje algo que ficou pendente da semana passada é uso legítimo, e
  // travar isso empurraria a pessoa de volta para o papel.
  it('aceita prazo recente no passado', () => {
    expect(comPrazo(daquiA(-7)).success).toBe(true)
    expect(comPrazo(daquiA(-300)).success).toBe(true)
  })

  it('recusa prazo de mais de um ano atrás', () => {
    expect(comPrazo(daquiA(-400)).success).toBe(false)
  })

  it('continua aceitando agendamento distante no futuro', () => {
    expect(comPrazo(daquiA(500)).success).toBe(true)
  })
})
