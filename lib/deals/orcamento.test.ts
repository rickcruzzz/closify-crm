import { describe, expect, it } from 'vitest'

import {
  diasAteVencer,
  prazoDoLembrete,
  somarDias,
  textoDoPrazo,
  tituloDoLembrete,
} from './orcamento'

describe('somarDias', () => {
  it('atravessa mes e ano sem escorregar', () => {
    expect(somarDias('2026-09-30', 1)).toBe('2026-10-01')
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01')
    expect(somarDias('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('acerta ano bissexto', () => {
    // 2028 e bissexto. Uma conta feita com `new Date(...)` no fuso local
    // erraria aqui dependendo da maquina — por isso a ancoragem em Date.UTC.
    expect(somarDias('2028-02-28', 1)).toBe('2028-02-29')
    expect(somarDias('2028-03-01', -1)).toBe('2028-02-29')
  })

  it('subtrai a antecedencia sem virar o mes errado', () => {
    expect(somarDias('2026-10-01', -2)).toBe('2026-09-29')
  })
})

describe('prazoDoLembrete', () => {
  it('cobra 2 dias antes, as 09:00 de Sao Paulo', () => {
    // Validade longe: o caso normal, e o unico em que a antecedencia cabe.
    expect(prazoDoLembrete('2026-09-20', new Date('2026-09-08T12:00:00Z'))).toBe(
      '2026-09-18T09:00:00-03:00',
    )
  })

  it('orcamento que vence AMANHA nao nasce atrasado', () => {
    // O defeito que esta regra existe para impedir: `validade - 2 dias` cai
    // ANTEONTEM, e `/hoje` exibiria a tarefa como "atrasada ha 2 dias" no
    // segundo em que ela foi criada. Tarefa que nasce atrasada ensina a pessoa
    // a ignorar o aviso de atraso, que e o unico sinal que o produto tem.
    const agora = new Date('2026-09-08T12:00:00Z')
    expect(prazoDoLembrete('2026-09-09', agora)).toBe('2026-09-08T23:59:59-03:00')
  })

  it('NUNCA devolve instante no passado, em nenhum dos dois caminhos', () => {
    // O invariante que importa mais que o valor exato. Varre validades de
    // ontem ate 30 dias a frente.
    const agora = new Date('2026-09-08T15:30:00Z')
    for (let d = -1; d <= 30; d++) {
      const validade = somarDias('2026-09-08', d)
      const prazo = new Date(prazoDoLembrete(validade, agora))
      expect(prazo.getTime(), `validade ${validade}`).toBeGreaterThan(agora.getTime())
    }
  })

  it('mesmo dia: manda para as 09:00 se ainda nao passou, e para o fim do dia se passou', () => {
    // 07:00 em Sao Paulo — as 09:00 ainda vem.
    expect(prazoDoLembrete('2026-09-10', new Date('2026-09-08T10:00:00Z'))).toBe(
      '2026-09-08T09:00:00-03:00',
    )
    // 12:00 em Sao Paulo — as 09:00 ja passaram, entao vai para o fim do dia.
    expect(prazoDoLembrete('2026-09-10', new Date('2026-09-08T15:00:00Z'))).toBe(
      '2026-09-08T23:59:59-03:00',
    )
  })

  it('a noite de Sao Paulo NAO empurra a cobranca para o dia seguinte', () => {
    // 21:00 em Sao Paulo ja e o dia SEGUINTE em UTC. Uma implementacao com
    // `toISOString().slice(0,10)` marcaria a cobranca para amanha — o mesmo
    // defeito que `diaEmSaoPaulo` existe para evitar em lib/tasks/buckets.ts.
    const noite = new Date('2026-09-09T01:00:00Z') // 22:00 de 08/09 em SP
    expect(prazoDoLembrete('2026-09-09', noite)).toBe('2026-09-08T23:59:59-03:00')
  })
})

describe('diasAteVencer', () => {
  it('conta em dia de calendario', () => {
    const agora = new Date('2026-09-08T12:00:00Z')
    expect(diasAteVencer('2026-09-08', agora)).toBe(0)
    expect(diasAteVencer('2026-09-09', agora)).toBe(1)
    expect(diasAteVencer('2026-09-07', agora)).toBe(-1)
    expect(diasAteVencer('2026-10-08', agora)).toBe(30)
  })

  it('usa o dia de SAO PAULO, nao o do servidor', () => {
    // A Vercel roda em UTC. As 22:00 de 08/09 em Sao Paulo, o servidor ja
    // acha que e 09/09 — e um orcamento que vence em 08/09 apareceria como
    // "venceu ontem" para quem ainda esta no dia dele.
    const noite = new Date('2026-09-09T01:00:00Z')
    expect(diasAteVencer('2026-09-08', noite)).toBe(0)
  })
})

describe('textoDoPrazo', () => {
  it('fala como gente no dia que importa', () => {
    const agora = new Date('2026-09-08T12:00:00Z')
    // "vence em 0 dias" nao e uma frase que alguem diz em voz alta, e o dia
    // zero e justamente o que precisa ser lido sem traducao.
    expect(textoDoPrazo('2026-09-08', agora)).toBe('vence hoje')
    expect(textoDoPrazo('2026-09-09', agora)).toBe('vence amanhã')
    expect(textoDoPrazo('2026-09-07', agora)).toBe('venceu ontem')
    expect(textoDoPrazo('2026-09-05', agora)).toBe('venceu há 3 dias')
    expect(textoDoPrazo('2026-09-15', agora)).toBe('vence em 7 dias')
  })
})

describe('tituloDoLembrete', () => {
  it('carrega o nome do negocio, porque /hoje mistura empresas', () => {
    expect(tituloDoLembrete('Dedetização Restaurante Sabor')).toBe(
      'Cobrar retorno do orçamento — Dedetização Restaurante Sabor',
    )
  })

  it('respeita o teto de 200 de taskSchema', () => {
    // A tarefa daqui e inserida direto, sem passar por `taskSchema`. Mas quem
    // for EDITAR essa tarefa abre o TaskFormDialog, que valida com o schema:
    // um titulo de 240 caracteres gravado aqui faria a edicao recusar o valor
    // que o proprio produto escreveu.
    const titulo = tituloDoLembrete('x'.repeat(400))
    expect(titulo.length).toBeLessThanOrEqual(200)
    expect(titulo.endsWith('…')).toBe(true)
  })

  it('nao corta o que ja cabe', () => {
    const titulo = tituloDoLembrete('Marcenaria Silva')
    expect(titulo.endsWith('…')).toBe(false)
  })
})
