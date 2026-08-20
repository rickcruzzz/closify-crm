import { describe, expect, it } from 'vitest'

import { classificar } from './formatos-do-meta'

describe('classificar', () => {
  it('reconhece as três medidas exatas', () => {
    const quadrado = classificar(1080, 1080)
    expect(quadrado.serve && quadrado.formato.nome).toBe('Feed quadrado')
    expect(quadrado.serve && quadrado.exato).toBe(true)
    expect(quadrado.serve && quadrado.observacao).toBeUndefined()

    expect(classificar(1080, 1350).serve).toBe(true)
    const stories = classificar(1080, 1920)
    expect(stories.serve && stories.formato.nome).toBe('Stories e Reels')
  })

  // O Meta redimensiona; o que ele não conserta é proporção. Recusar o dobro
  // do tamanho seria pedir retrabalho por nada.
  it('aceita imagem maior na mesma proporção, avisando que não é exata', () => {
    const r = classificar(2160, 2160)
    expect(r.serve).toBe(true)
    expect(r.serve && r.formato.nome).toBe('Feed quadrado')
    expect(r.serve && r.exato).toBe(false)
    expect(r.serve && r.observacao).toContain('redimensiona')
  })

  // Imagem borrada é dinheiro gasto para parecer amador.
  it('avisa quando a imagem é menor que o recomendado', () => {
    const r = classificar(600, 600)
    expect(r.serve).toBe(true)
    expect(r.serve && r.observacao).toContain('borrada')
  })

  // O caso mais comum de arte gerada por IA: 1024×1024 em vez de 1080×1080.
  it('aceita 1024×1024, que é quadrado e só um pouco menor', () => {
    const r = classificar(1024, 1024)
    expect(r.serve).toBe(true)
    expect(r.serve && r.formato.nome).toBe('Feed quadrado')
    expect(r.serve && r.observacao).toContain('menor que o recomendado')
  })

  it('recusa proporção que não existe no Meta, sugerindo a mais próxima', () => {
    const r = classificar(1920, 1080) // paisagem 16:9
    expect(r.serve).toBe(false)
    expect(!r.serve && r.motivo).toContain('não bate')
    expect(!r.serve && r.sugestao.nome).toBeTruthy()
  })

  it('aguenta tamanho inválido sem quebrar', () => {
    expect(classificar(0, 0).serve).toBe(false)
    expect(classificar(-1, 100).serve).toBe(false)
  })
})
