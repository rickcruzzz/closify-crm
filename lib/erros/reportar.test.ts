import { describe, expect, it } from 'vitest'

import { cortarParaCaber } from './reportar'

describe('cortarParaCaber', () => {
  it('devolve o texto inteiro quando cabe', () => {
    expect(cortarParaCaber('at DealCard', 8000)).toBe('at DealCard')
  })

  it('preserva `undefined`, que é ausência e não texto vazio', () => {
    expect(cortarParaCaber(undefined, 8000)).toBeUndefined()
  })

  it('corta pelo fim e nunca passa do teto', () => {
    // O defeito que motivou: `/api/log-erro` valida com zod e responde 400 —
    // DESCARTA a linha inteira — quando um campo passa do teto. Medido numa
    // árvore real do App Router, `componentStack` deu mais de 8000 chars, então
    // o relato mais valioso era justamente o que sempre seria recusado.
    const cortado = cortarParaCaber('x'.repeat(9000), 8000)
    expect(cortado).toHaveLength(8000)
  })

  it('preserva o COMEÇO, que é onde está quem quebrou', () => {
    // Tanto no stack quanto na árvore de componentes, o quadro mais interno vem
    // primeiro. Cortar pelo começo jogaria fora exatamente o nome procurado e
    // guardaria os wrappers do framework, que são iguais em todo erro.
    const arvore = 'at DealCard\n' + 'at WrapperDoNext\n'.repeat(2000)
    expect(cortarParaCaber(arvore, 8000)!.startsWith('at DealCard')).toBe(true)
  })

  it('marca que houve corte, para o corte não parecer o fim da árvore', () => {
    expect(cortarParaCaber('y'.repeat(9000), 8000)!.endsWith('\n[cortado]')).toBe(true)
  })
})
