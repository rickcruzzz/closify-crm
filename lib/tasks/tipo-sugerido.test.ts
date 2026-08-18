import { describe, expect, it } from 'vitest'

import { taskTypesCriaveis, tipoSugerido } from './tipo-sugerido'
import { dealStages } from '@/lib/deals/types'

describe('taskTypesCriaveis', () => {
  // O defeito: a lista do seletor era `Object.keys(taskTypeLabels)`, que vem do
  // `ActivityType` da timeline e inclui `nota`. O formulário de tarefa exige
  // "Quando", então nota agendada aparecia em /hoje cobrando ação de um
  // registro de passado.
  it('não oferece nota, que é registro e não compromisso', () => {
    expect(taskTypesCriaveis).not.toContain('nota')
  })

  it('oferece os três que têm hora marcada', () => {
    expect([...taskTypesCriaveis]).toEqual(['ligacao', 'email', 'reuniao'])
  })
})

describe('tipoSugerido', () => {
  // O padrão era `'ligacao'` fixo, sem olhar a etapa: negócio em Negociação
  // abria pedindo ligação, quando o passo dessa fase é conversa.
  it('sugere reunião em negociação', () => {
    expect(tipoSugerido('negociacao')).toBe('reuniao')
  })

  it('sugere ligação em proposta enviada, porque e-mail vira fila', () => {
    expect(tipoSugerido('proposta_enviada')).toBe('ligacao')
  })

  it('sem etapa (tela Hoje, página do lead) cai em ligação', () => {
    expect(tipoSugerido(undefined)).toBe('ligacao')
  })

  // Trava contra etapa nova entrar no enum e a função devolver algo que o
  // seletor não oferece, o que abriria o formulário com um valor inválido.
  it('devolve sempre um tipo que o seletor oferece, para toda etapa', () => {
    for (const stage of dealStages) {
      expect(taskTypesCriaveis).toContain(tipoSugerido(stage))
    }
  })
})
