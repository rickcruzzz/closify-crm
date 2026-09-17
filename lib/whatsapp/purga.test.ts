import { describe, expect, it } from 'vitest'

import {
  DIAS_SEM_MAX_ATE_APAGAR,
  decidirPurga,
  mereceAviso,
  resumoVazio,
} from './purga'

const AGORA = new Date('2026-09-16T12:00:00Z')

function diasAtras(n: number): string {
  return new Date(AGORA.getTime() - n * 24 * 60 * 60 * 1000).toISOString()
}

describe('decidirPurga', () => {
  it('plano em dia e sem marca: nada a fazer', () => {
    expect(decidirPurga({ maxVigente: true, semMaxDesde: null }, AGORA)).toBe('nada')
  })

  it('primeira vez sem Max: MARCA, e não apaga nada hoje', () => {
    // Apagar na primeira varredura cortaria o número de quem teve o boleto
    // compensado com um dia de atraso, e reconectar exige pegar o celular.
    expect(decidirPurga({ maxVigente: false, semMaxDesde: null }, AGORA)).toBe('marcar')
  })

  it('sem Max há menos de uma semana: espera', () => {
    expect(decidirPurga({ maxVigente: false, semMaxDesde: diasAtras(1) }, AGORA)).toBe('nada')
    expect(decidirPurga({ maxVigente: false, semMaxDesde: diasAtras(6) }, AGORA)).toBe('nada')
  })

  it('no dia exato do prazo, apaga', () => {
    expect(
      decidirPurga({ maxVigente: false, semMaxDesde: diasAtras(DIAS_SEM_MAX_ATE_APAGAR) }, AGORA),
    ).toBe('apagar')
  })

  it('depois do prazo, apaga', () => {
    expect(decidirPurga({ maxVigente: false, semMaxDesde: diasAtras(90) }, AGORA)).toBe('apagar')
  })

  it('VOLTOU a pagar: limpa a marca, e é o ramo que todo mundo esquece', () => {
    // Sem ele, quem atrasa e volta carrega a marca antiga, e o PRÓXIMO atraso
    // de um dia soma com a espera do anterior: a instância morre por uma conta
    // que ninguém escreveu. Mesma classe do alarme preso por três dias em
    // 09/09, que precisou de `sincronizarMemoria` nos dois caminhos.
    expect(decidirPurga({ maxVigente: true, semMaxDesde: diasAtras(6) }, AGORA)).toBe('limpar')
  })

  it('quem voltou a pagar NUNCA cai no ramo de apagar, nem com marca vencida', () => {
    // A ordem dos ramos é a regra: `maxVigente` decide primeiro, sempre.
    expect(decidirPurga({ maxVigente: true, semMaxDesde: diasAtras(400) }, AGORA)).toBe('limpar')
  })

  it('data ilegível REMARCA em vez de apagar', () => {
    // Remarcar custa mais sete dias de uma instância; apagar por engano custa o
    // cliente parear o número de novo. O lado seguro de errar é o barato.
    expect(decidirPurga({ maxVigente: false, semMaxDesde: 'ontem' }, AGORA)).toBe('marcar')
    expect(decidirPurga({ maxVigente: false, semMaxDesde: '' }, AGORA)).toBe('marcar')
  })

  it('a marca no FUTURO não apaga', () => {
    // Relógio torto ou escrita fora de ordem. Dias negativos nunca alcançam o
    // limiar, e o efeito é esperar, que é o lado certo.
    expect(decidirPurga({ maxVigente: false, semMaxDesde: diasAtras(-3) }, AGORA)).toBe('nada')
  })
})

describe('mereceAviso', () => {
  it('rotina NÃO avisa', () => {
    // Marcar acontece no dia seguinte a todo atraso de pagamento. Avisar nela
    // treinaria o dono a arquivar sem ler, e junto iria o aviso que importa.
    expect(mereceAviso({ ...resumoVazio(), conferidas: 40, marcadas: 3, limpas: 2 })).toBe(false)
  })

  it('dia quieto não avisa', () => {
    expect(mereceAviso(resumoVazio())).toBe(false)
  })

  it('instância apagada AVISA: é dinheiro saindo da fatura', () => {
    expect(mereceAviso({ ...resumoVazio(), apagadas: 1 })).toBe(true)
  })

  it('falha AVISA, e é o caso mais caro dos dois', () => {
    // A instância que o provedor recusou apagar continua na fatura do mês
    // seguinte, e continua até alguém agir.
    expect(mereceAviso({ ...resumoVazio(), falhas: 1 })).toBe(true)
  })
})
