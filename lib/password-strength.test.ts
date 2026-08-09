import { describe, expect, it } from 'vitest'

import { avaliarSenha, gerarSenhaForte } from './password-strength'

describe('avaliarSenha', () => {
  it('marca como fraca o que não protege nada', () => {
    for (const senha of ['12345678', '123456', 'senha123', 'password', 'aaaaaaaa']) {
      expect(avaliarSenha(senha).nivel, senha).toBe('fraca')
    }
  })

  it('marca como fraca qualquer coisa com menos de 8 caracteres', () => {
    expect(avaliarSenha('Ab#1').nivel).toBe('fraca')
  })

  // Defeito corrigido: o detector de sequência derrubava para "fraca" qualquer
  // senha contendo "12345" em QUALQUER posição. "Kmtbvn123456" (12 caracteres,
  // três classes) recebia nota pior que "Xyzqwr12" (8 caracteres) — a senha
  // melhor levava a nota pior. Agora a checagem é por proporção.
  it('não pune senha longa só por conter uma sequência curta', () => {
    expect(avaliarSenha('Kmtbvn123456').nivel).not.toBe('fraca')
  })

  it('exige tamanho e variedade para dar nota forte', () => {
    expect(avaliarSenha('Tr0vao#Chuva2026').nivel).toBe('forte')
    expect(avaliarSenha('Xyzqwr12').nivel).toBe('media')
  })

  // Palavra de dicionário com contador atrás não merece selo de forte, mesmo
  // com 12 caracteres e três classes.
  it('cobra as quatro classes quando há padrão previsível', () => {
    expect(avaliarSenha('Senha1234567').nivel).toBe('media')
  })

  it('senha vazia não quebra e não sugere nada', () => {
    const r = avaliarSenha('')
    expect(r.nivel).toBe('fraca')
    expect(r.rotulo).toBe('')
  })

  it('o percentual acompanha o nível', () => {
    expect(avaliarSenha('12345678').percentual).toBe(33)
    expect(avaliarSenha('Xyzqwr12').percentual).toBe(66)
    expect(avaliarSenha('Tr0vao#Chuva2026').percentual).toBe(100)
  })
})

describe('gerarSenhaForte', () => {
  it('sempre gera senha classificada como forte', () => {
    // Repete porque a geração é aleatória: um sorteio infeliz que caísse em
    // "média" só apareceria de vez em quando, e em produção seria confuso ver
    // o próprio botão sugerir uma senha que o medidor reprova.
    for (let i = 0; i < 50; i++) {
      expect(avaliarSenha(gerarSenhaForte()).nivel).toBe('forte')
    }
  })

  it('respeita o tamanho pedido', () => {
    expect(gerarSenhaForte(16)).toHaveLength(16)
    expect(gerarSenhaForte(24)).toHaveLength(24)
  })

  it('evita caracteres que se confundem ao ler da tela', () => {
    // A pessoa lê a senha sugerida da tela para anotar; l/I/O/0/1 viram erro
    // de transcrição.
    for (let i = 0; i < 20; i++) {
      expect(gerarSenhaForte()).not.toMatch(/[lIO01]/)
    }
  })

  it('não repete a mesma senha', () => {
    const geradas = new Set(Array.from({ length: 30 }, () => gerarSenhaForte()))
    expect(geradas.size).toBe(30)
  })
})
