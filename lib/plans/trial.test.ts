import { describe, expect, it } from 'vitest'
import { FREE_ORCAMENTO_LIMIT } from '@/lib/plans'

import { diasRestantesDoTrial, estadoDoTrial, textoDoAviso } from './trial'

const AGORA = new Date('2026-08-23T12:00:00.000Z')

/** Uma data a N dias (e opcionalmente N horas) de `AGORA`. */
function daquiA(dias: number, horas = 0): string {
  return new Date(AGORA.getTime() + dias * 86400000 + horas * 3600000).toISOString()
}

describe('dias restantes', () => {
  it('conta os dias inteiros que faltam', () => {
    expect(diasRestantesDoTrial(daquiA(7), AGORA)).toBe(7)
    expect(diasRestantesDoTrial(daquiA(1), AGORA)).toBe(1)
  })

  /**
   * Arredonda para CIMA de propósito. Quem tem 6 horas de acesso ainda TEM o
   * dia; dizer "0 dias" seria cortar antes da hora aos olhos da pessoa — e a
   * sensação de ter sido cortado cedo custa mais caro que o dia extra.
   */
  it('fração de dia ainda conta como um dia', () => {
    expect(diasRestantesDoTrial(daquiA(0, 6), AGORA)).toBe(1)
    expect(diasRestantesDoTrial(daquiA(2, 3), AGORA)).toBe(3)
  })

  it('depois do fim, fica negativo', () => {
    expect(diasRestantesDoTrial(daquiA(-2), AGORA)).toBe(-2)
  })
})

describe('estado do trial', () => {
  it('empresa sem trial (criada antes da 0051) não tem estado nenhum', () => {
    expect(estadoDoTrial(null, false, AGORA)).toEqual({ tipo: 'sem_trial' })
  })

  /**
   * O caso que mais importa acertar: quem PAGOU durante o trial não pode ver
   * contagem regressiva. Insistir com "faltam 2 dias" depois do pagamento faz a
   * pessoa duvidar se a cobrança passou — e duvidar da cobrança é o começo de
   * um pedido de reembolso.
   */
  it('quem assinou para de ver o trial, mesmo dentro do prazo', () => {
    expect(estadoDoTrial(daquiA(2), true, AGORA)).toEqual({ tipo: 'sem_trial' })
  })

  it('nos primeiros dias não incomoda', () => {
    const estado = estadoDoTrial(daquiA(6), false, AGORA)
    expect(estado).toEqual({ tipo: 'em_trial', diasRestantes: 6, avisar: false })
    expect(textoDoAviso(estado)).toBeNull()
  })

  it('a partir de 3 dias começa a avisar', () => {
    const estado = estadoDoTrial(daquiA(3), false, AGORA)
    expect(estado).toEqual({ tipo: 'em_trial', diasRestantes: 3, avisar: true })
    expect(textoDoAviso(estado)?.titulo).toBe('Faltam 3 dias do seu teste')
  })

  /**
   * A fronteira, travada com número literal de propósito.
   *
   * Escrever `AVISAR_A_PARTIR_DE` aqui faria o teste concordar com qualquer
   * valor da constante, inclusive um errado — ele passaria com 2, com 4 e com
   * 40. O número cru é o que transforma uma mudança de limiar em teste
   * vermelho, obrigando quem muda a olhar as três telas que dependem dele.
   *
   * Este limiar é compartilhado com o cron de aviso e com o destaque da tela de
   * cobrança desde 25/08 (diagnóstico, achado 7.2). Antes eram três números
   * diferentes para a mesma ideia.
   */
  it('a fronteira é 4 dias: avisa em 4, ainda não avisa em 5', () => {
    expect(estadoDoTrial(daquiA(4), false, AGORA)).toEqual({
      tipo: 'em_trial',
      diasRestantes: 4,
      avisar: true,
    })
    expect(estadoDoTrial(daquiA(5), false, AGORA)).toEqual({
      tipo: 'em_trial',
      diasRestantes: 5,
      avisar: false,
    })
  })

  it('o último dia tem texto próprio, no singular', () => {
    const estado = estadoDoTrial(daquiA(1), false, AGORA)
    expect(textoDoAviso(estado)?.titulo).toBe('Último dia do seu teste')
  })

  it('depois do prazo, o aviso muda de tom', () => {
    const estado = estadoDoTrial(daquiA(-5), false, AGORA)
    expect(estado).toEqual({ tipo: 'acabou', diasDesdeQueAcabou: 5 })
    expect(textoDoAviso(estado)?.titulo).toBe('Seu teste do Pro terminou')
  })
})

describe('texto do aviso', () => {
  /**
   * A regra de copy que este projeto já aplicou na landing e nas telas de erro:
   * falar do que acontece com a PESSOA, não do nosso processo. "Expira" é sobre
   * nós; "o WhatsApp para de trazer as mensagens" é sobre o dia dela.
   */
  it('descreve a perda concreta, não o prazo administrativo', () => {
    for (const dias of [1, 2, 3, -1]) {
      const texto = textoDoAviso(estadoDoTrial(daquiA(dias), false, AGORA))
      expect(texto).not.toBeNull()
      // A perda que o texto cita mudou em 11/09: era WhatsApp, e o WhatsApp
      // não funciona para ninguém desde 28/08 (`FASE_DO_WHATSAPP` = 'migrando').
      // Hoje é o teto de orçamento com lembrete, que o Free de fato aplica.
      expect(texto!.detalhe).toContain(String(FREE_ORCAMENTO_LIMIT))
      expect(texto!.titulo.toLowerCase()).not.toContain('expira')
    }
  })

  /**
   * O controle do caso acima: o que saiu não pode voltar sozinho.
   *
   * Esta tarja aparece em TODA tela logada, com o botão de assinar ao lado.
   * Enquanto a Cloud API não voltar, prometer WhatsApp aqui é cobrar por uma
   * coisa que o produto não faz.
   */
  it('não promete WhatsApp enquanto a integração está em migração', () => {
    for (const dias of [1, 2, 3, -1]) {
      const texto = textoDoAviso(estadoDoTrial(daquiA(dias), false, AGORA))
      expect(texto!.detalhe.toLowerCase()).not.toContain('whatsapp')
    }
  })

  /**
   * Ninguém perde dado quando o trial acaba (provado no banco na migration
   * 0052). O aviso precisa dizer isso: o medo de perder a base é o que faz a
   * pessoa fugir em vez de decidir.
   */
  it('deixa claro que nada é apagado', () => {
    const acabou = textoDoAviso(estadoDoTrial(daquiA(-1), false, AGORA))!
    expect(acabou.detalhe.toLowerCase()).toMatch(/inteiro|continua/)

    const ultimoDia = textoDoAviso(estadoDoTrial(daquiA(1), false, AGORA))!
    expect(ultimoDia.detalhe.toLowerCase()).toContain('nada é apagado')
  })
})
