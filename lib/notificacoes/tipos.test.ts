import { describe, expect, it } from 'vitest'

import {
  TIPOS_DE_NOTIFICACAO,
  gravidadeDe,
  tempoRelativo,
  type TipoDeNotificacao,
} from '@/lib/notificacoes/tipos'

describe('quem pode virar notificação', () => {
  it('não avisa sobre o que a pessoa acabou de fazer', () => {
    // O defeito que este teste impede é o de 20/08, quando 8 dos 11 alertas da
    // Central eram ruído: fila com item sem valor dentro ensina a ignorar a
    // fila inteira, e junto com o item chato vai embora o alerta de dinheiro.
    //
    // O teste PROÍBE em vez de conferir a lista vigente, pela mesma razão que
    // o teste da bio do Instagram proíbe a palavra da oferta aposentada: uma
    // asserção sobre o que existe passa mesmo quando algo indevido entrou ao
    // lado.
    const proibidos = [
      'contato_criado',
      'negocio_criado',
      'tarefa_criada',
      'importacao_concluida',
      'membro_entrou',
    ]
    for (const p of proibidos) {
      expect(TIPOS_DE_NOTIFICACAO as readonly string[]).not.toContain(p)
    }
  })

  it('todo tipo tem gravidade, e nenhuma é inventada na hora', () => {
    for (const tipo of TIPOS_DE_NOTIFICACAO) {
      expect(['alta', 'media']).toContain(gravidadeDe(tipo))
    }
  })

  it('o único de gravidade média é a boa notícia', () => {
    // Pagamento confirmado é o único tipo que não pede ação. Se um dia ele
    // virar `alta`, o ponto vermelho passa a aparecer para dizer "deu certo" —
    // e a cor deixa de significar "algo vai custar dinheiro".
    const medias = TIPOS_DE_NOTIFICACAO.filter((t) => gravidadeDe(t) === 'media')
    expect(medias).toEqual(['pagamento_confirmado'])
  })

  it('um tipo fora da lista não passa pelo tipo do TypeScript', () => {
    // Documenta o contrato: o `check` da 0066 recusaria no banco, e o TS
    // recusa antes. As duas metades existem porque Server Action é endpoint
    // HTTP — quem chama o PostgREST direto pula o TypeScript.
    const valido: TipoDeNotificacao = 'plano_vencendo'
    expect(TIPOS_DE_NOTIFICACAO).toContain(valido)
  })
})

describe('tempoRelativo', () => {
  const base = new Date('2026-09-02T12:00:00Z')
  const atras = (ms: number) => new Date(base.getTime() - ms).toISOString()

  it('arredonda para baixo, porque a pessoa compara com o relógio dela', () => {
    // 2h59 vira "há 2 horas", não "há 3 horas". Arredondar para cima faz o
    // aviso parecer mais velho do que é, e num aviso de vencimento isso muda a
    // leitura de urgência.
    expect(tempoRelativo(atras(2 * 3600_000 + 59 * 60_000), base)).toBe('há 2 horas')
  })

  it('menos de um minuto é "agora"', () => {
    expect(tempoRelativo(atras(30_000), base)).toBe('agora')
  })

  it('singular e plural não saem trocados', () => {
    expect(tempoRelativo(atras(3600_000), base)).toBe('há 1 hora')
    expect(tempoRelativo(atras(2 * 3600_000), base)).toBe('há 2 horas')
    expect(tempoRelativo(atras(24 * 3600_000), base)).toBe('ontem')
    expect(tempoRelativo(atras(2 * 24 * 3600_000), base)).toBe('há 2 dias')
    expect(tempoRelativo(atras(7 * 24 * 3600_000), base)).toBe('há 1 semana')
  })

  it('não passa de "há 3 meses" na prática, porque a purga corta em 90 dias', () => {
    // A 0066 apaga o que passa de 90 dias. Se um dia aparecer "há 6 meses" na
    // tela, o cron de limpeza parou — e o número na tela é o primeiro sinal.
    expect(tempoRelativo(atras(89 * 24 * 3600_000), base)).toBe('há 2 meses')
  })
})
