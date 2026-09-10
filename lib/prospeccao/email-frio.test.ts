import { describe, expect, it } from 'vitest'

import {
  classificar,
  diasParaEsvaziar,
  prepararFila,
  tetoDoDia,
} from '@/lib/prospeccao/email-frio'

describe('classificar endereço', () => {
  it('separa pessoal de papel', () => {
    expect(classificar('rick@agenciapulso.com')).toBe('pessoal')
    expect(classificar('contato@marcenaria.com.br')).toBe('papel')
    expect(classificar('vendas@empresa.com.br')).toBe('papel')
  })

  /**
   * O achado de 10/09: `papel` não é recusa.
   *
   * O benchmark que trata `contato@` como veneno é de B2B americano, onde ele
   * cai numa fila de suporte. Aqui o ICP tem de uma a três pessoas e `contato@`
   * é a caixa do dono. Recusar seria jogar fora 198 de 358 endereços — 55% da
   * lista — por uma regra calibrada para outro mercado.
   */
  it('papel é adiado, nunca recusado', () => {
    expect(classificar('contato@x.com.br')).not.toBe('recusado')
  })

  it('recusa caixa que ninguém lê', () => {
    expect(classificar('no-reply@x.com.br')).toBe('recusado')
    expect(classificar('naoresponda@x.com.br')).toBe('recusado')
  })

  /**
   * `alugamaq@alugamaq.com.br54` estava na base real, com o `54` grudado no
   * fim — telefone colado no e-mail pelo extrator. Endereço malformado não
   * volta como bounce silencioso: ele conta como hard bounce, e taxa de hard
   * bounce é o primeiro número que derruba reputação de remetente novo.
   */
  it('recusa endereço malformado, o caso real da base', () => {
    expect(classificar('alugamaq@alugamaq.com.br54')).toBe('recusado')
    expect(classificar('semarroba.com.br')).toBe('recusado')
    expect(classificar('a@b')).toBe('recusado')
  })

  it('recusa o que nem endereço é', () => {
    expect(classificar('logo@site.png')).toBe('recusado')
    expect(classificar('x@sentry.io')).toBe('recusado')
  })
})

describe('preparar a fila', () => {
  it('pessoais saem antes dos de papel', () => {
    const { fila } = prepararFila([
      { email: 'contato@a.com.br' },
      { email: 'joao@b.com.br' },
      { email: 'vendas@c.com.br' },
      { email: 'maria@d.com.br' },
    ])
    expect(fila.map((f) => f.email)).toEqual([
      'joao@b.com.br',
      'maria@d.com.br',
      'contato@a.com.br',
      'vendas@c.com.br',
    ])
  })

  /**
   * A dedupe é por ENDEREÇO, não por empresa: dois sites do mesmo dono
   * compartilham caixa. Medido na base em 10/09 — 421 linhas para 358
   * endereços, 63 repetidos. Mandar duas vezes para a mesma pessoa é a
   * reclamação de spam mais fácil de provocar que existe.
   */
  it('tira repetido, inclusive com caixa e espaço diferentes', () => {
    const r = prepararFila([
      { email: 'joao@b.com.br' },
      { email: ' JOAO@B.com.br ' },
      { email: 'joao@b.com.br' },
    ])
    expect(r.fila).toHaveLength(1)
    expect(r.repetidos).toBe(2)
  })

  it('conta cada categoria', () => {
    const r = prepararFila([
      { email: 'joao@b.com.br' },
      { email: 'contato@a.com.br' },
      { email: 'no-reply@z.com.br' },
      { email: '' },
    ])
    expect(r).toMatchObject({ pessoais: 1, papel: 1, recusados: 2, repetidos: 0 })
  })

  it('preserva a empresa junto do endereço', () => {
    const { fila } = prepararFila([{ email: 'joao@b.com.br', empresa: 'Marcenaria B' }])
    expect(fila[0].empresa).toBe('Marcenaria B')
  })
})

describe('rampa de aquecimento', () => {
  /**
   * O teto é 25 e NÃO sobe além, mesmo no dia 300.
   *
   * Medido: "the safe volume is 20 to 30 emails per inbox per day... You scale
   * by adding more inboxes and domains, never by pushing more volume through
   * one inbox." O número do Origami (50-75/dia) é o total da operação, em
   * várias caixas — ler aquilo como teto por caixa é o erro que queima o
   * domínio na segunda semana.
   */
  it('para em 25 e nunca passa', () => {
    expect(tetoDoDia(15)).toBe(25)
    expect(tetoDoDia(60)).toBe(25)
    expect(tetoDoDia(300)).toBe(25)
  })

  it('sobe em degraus, sem salto', () => {
    expect(tetoDoDia(1)).toBe(5)
    expect(tetoDoDia(4)).toBe(10)
    expect(tetoDoDia(8)).toBe(15)
    expect(tetoDoDia(12)).toBe(20)
  })

  it('dia zero ou negativo não envia nada', () => {
    expect(tetoDoDia(0)).toBe(0)
    expect(tetoDoDia(-3)).toBe(0)
  })

  /**
   * O número que decide se vale abrir a segunda caixa, em vez de decidir por
   * impressão. A base real tem 358 endereços.
   */
  it('358 endereços levam 22 dias com uma caixa, 15 com duas', () => {
    // Eu tinha estimado 17 de cabeça, e o teste corrigiu. A conta real:
    //
    //     dias  1-3    5/dia   =  15
    //     dias  4-7   10/dia   =  40   ->  55
    //     dias  8-11  15/dia   =  60   -> 115
    //     dias 12-14  20/dia   =  60   -> 175
    //     dia  15+    25/dia            -> faltam 183, mais 8 dias
    //
    // A rampa custa três semanas antes de a fila esvaziar, e é isso que
    // decide se vale abrir a segunda caixa — que corta para 15 dias, sem
    // nenhuma delas passar do teto seguro.
    expect(diasParaEsvaziar(358, 1)).toBe(22)
    expect(diasParaEsvaziar(358, 2)).toBe(15)
  })

  it('fila vazia não ocupa dia nenhum', () => {
    expect(diasParaEsvaziar(0)).toBe(0)
  })
})
