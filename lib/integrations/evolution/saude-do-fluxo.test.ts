import { describe, expect, it } from 'vitest'

import { avisoDeFluxoParado, conexoesQueParaamDeReceber } from './saude-do-fluxo'

/**
 * O caso real, ocorrido DUAS vezes em 25/08.
 *
 * O processo do Evolution virou zumbi: HTTP respondendo, `/send/text`
 * funcionando, `/instance/status` dizendo `connected` — e o laço de eventos
 * morto. Três horas de silêncio antes de alguém reparar, e nada no sistema
 * sabia.
 */
const AGORA = new Date('2026-08-25T16:00:00Z')

function conexao(over: Partial<Parameters<typeof conexoesQueParaamDeReceber>[0][0]> = {}) {
  return {
    workspaceId: 'w1',
    status: 'connected',
    ultimoEvento: '2026-08-25T15:30:00Z',
    ...over,
  }
}

describe('conexoesQueParaamDeReceber', () => {
  it('acusa a conexão que recebia e parou', () => {
    // Exatamente o caso de 25/08: último evento às 13:55, descoberto às 16:55.
    const paradas = conexoesQueParaamDeReceber(
      [conexao({ ultimoEvento: '2026-08-25T12:55:00Z' })],
      AGORA,
    )
    expect(paradas).toHaveLength(1)
    expect(paradas[0].horasEmSilencio).toBe(3)
  })

  it('não acusa quem recebeu há pouco', () => {
    expect(conexoesQueParaamDeReceber([conexao()], AGORA)).toHaveLength(0)
  })

  it('NÃO acusa conexão que nunca recebeu nada', () => {
    // Este é o teste que impede a fila de virar ruído. Empresa sem cliente
    // ativo fica dias em silêncio legitimamente, e conexão criada hoje ainda
    // não tem histórico. Alarme falso não incomoda: ele mata a fila inteira,
    // lição já paga em /dono/alertas com 8 de 11 alertas sendo ruído.
    expect(
      conexoesQueParaamDeReceber([conexao({ ultimoEvento: null })], AGORA),
    ).toHaveLength(0)
  })

  it('ignora quem não se diz conectado', () => {
    // `error` já está avisado e `disconnected` é estado esperado de quem
    // desligou de propósito. Avisar qualquer um dos dois repetiria o que a
    // tela já mostra.
    for (const status of ['error', 'disconnected', 'connecting']) {
      expect(
        conexoesQueParaamDeReceber(
          [conexao({ status, ultimoEvento: '2026-08-20T00:00:00Z' })],
          AGORA,
        ),
        status,
      ).toHaveLength(0)
    }
  })

  it('exatamente no limite já conta', () => {
    // Duas horas cravadas é silêncio de duas horas. Exigir "mais de" adiaria o
    // aviso por um ciclo inteiro do cron sem ganhar nada.
    const paradas = conexoesQueParaamDeReceber(
      [conexao({ ultimoEvento: '2026-08-25T14:00:00Z' })],
      AGORA,
    )
    expect(paradas).toHaveLength(1)
  })

  it('data no futuro é relógio torto, não fluxo parado', () => {
    // Tratar como silêncio negativo geraria número absurdo na tela do cliente.
    expect(
      conexoesQueParaamDeReceber(
        [conexao({ ultimoEvento: '2026-08-26T00:00:00Z' })],
        AGORA,
      ),
    ).toHaveLength(0)
  })

  it('data inválida não derruba a varredura inteira', () => {
    // Uma linha torta não pode impedir o aviso das outras — seria o cron
    // falhando calado, que é o defeito que ele existe para evitar.
    const paradas = conexoesQueParaamDeReceber(
      [
        conexao({ workspaceId: 'torta', ultimoEvento: 'nao-e-data' }),
        conexao({ workspaceId: 'parada', ultimoEvento: '2026-08-25T10:00:00Z' }),
      ],
      AGORA,
    )
    expect(paradas.map((p) => p.workspaceId)).toEqual(['parada'])
  })

  it('o limiar é parametrizável, para o teste não depender do padrão', () => {
    const seisHoras = conexoesQueParaamDeReceber(
      [conexao({ ultimoEvento: '2026-08-25T13:00:00Z' })],
      AGORA,
      6,
    )
    expect(seisHoras).toHaveLength(0)
  })
})

describe('avisoDeFluxoParado', () => {
  it('diz o próximo passo, não só o problema', () => {
    // "Sua conexão caiu" sem o que fazer transfere ao cliente o trabalho de
    // adivinhar, e ele não tem como saber que reconectar resolve.
    const texto = avisoDeFluxoParado(3)
    expect(texto).toContain('3 horas')
    expect(texto).toContain('Integrações')
    expect(texto.toLowerCase()).toContain('conecte de novo')
  })

  it('concorda o singular', () => {
    expect(avisoDeFluxoParado(1)).toContain('1 hora.')
  })
})
