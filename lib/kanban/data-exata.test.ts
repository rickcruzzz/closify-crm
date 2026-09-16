import { describe, expect, it } from 'vitest'

import { dataExata, dataExataCurta, dataExataSemHora } from './data-exata'

// 19/04/2026 as 14:30 em Sao Paulo (UTC-3) = 17:30 UTC. Uma quarta-feira? Nao:
// 19/04/2026 e um DOMINGO. O caso foi escolhido assim de proposito — o exemplo
// do pedido ("19 de abril, quarta-feira") e um formato, nao uma data real, e
// travar o dia da semana real e o que impede a funcao de escrever o dia errado.
const DOMINGO_1430_SP = '2026-04-19T17:30:00.000Z'

describe('dataExata', () => {
  it('escreve dia, mes por extenso, dia da semana e hora', () => {
    expect(dataExata(DOMINGO_1430_SP)).toBe('19 de abril • domingo • 14:30')
  })

  it('usa o fuso de SAO PAULO, nao o do servidor', () => {
    // O servidor da Vercel roda em UTC. Sem `timeZone` declarado, este mesmo
    // instante sairia "17:30" la e "14:30" aqui — descasamento de hidratacao,
    // e a pessoa veria a hora errada por um quadro.
    expect(dataExata(DOMINGO_1430_SP)).toContain('14:30')
    expect(dataExata(DOMINGO_1430_SP)).not.toContain('17:30')
  })

  it('a virada do dia em UTC ainda e o dia ANTERIOR em Sao Paulo', () => {
    // 02:00 UTC do dia 20 e 23:00 do dia 19 em Sao Paulo. Formatar em UTC
    // adiantaria a data em um dia inteiro para todo negocio mexido a noite.
    expect(dataExata('2026-04-20T02:00:00.000Z')).toBe('19 de abril • domingo • 23:00')
  })

  it('hora em 24h, sem AM/PM', () => {
    expect(dataExata('2026-04-19T23:45:00.000Z')).toContain('20:45')
  })

  it('data invalida nao vira texto: devolve null', () => {
    // Quem chama nao renderiza a linha. E a mesma decisao de `dueDateInfo` no
    // dashboard, que ja pagou o defeito de imprimir "vence em NaN dias".
    expect(dataExata('nao e data')).toBeNull()
    expect(dataExata(null)).toBeNull()
    expect(dataExata(undefined)).toBeNull()
    expect(dataExata('')).toBeNull()
  })
})

describe('dataExataCurta', () => {
  it('mesma ordem e mesmo separador, so os nomes abreviados', () => {
    expect(dataExataCurta(DOMINGO_1430_SP)).toBe('19 abr • dom • 14:30')
  })

  it('NAO deixa ponto de abreviacao', () => {
    // "19 abr. • dom. • 14:30" pica a linha visualmente: dois pontos finais
    // competindo com o separador numa linha de 22 caracteres.
    expect(dataExataCurta(DOMINGO_1430_SP)).not.toMatch(/\./)
  })

  it('as duas formas carregam os MESMOS campos', () => {
    // O que faz as duas serem a mesma convencao e isto: ordem, separador e
    // campos iguais. Se uma delas perder a hora ou trocar a ordem, elas viram
    // duas convencoes, e ai a tela fica inconsistente.
    const longa = dataExata(DOMINGO_1430_SP)!.split(' • ')
    const curta = dataExataCurta(DOMINGO_1430_SP)!.split(' • ')
    expect(curta).toHaveLength(longa.length)
    expect(curta[2]).toBe(longa[2])
  })

  it('data invalida devolve null', () => {
    expect(dataExataCurta('31/02/2026')).toBeNull()
    expect(dataExataCurta(null)).toBeNull()
  })
})

describe('dataExataSemHora', () => {
  it('campo `date` do Postgres NAO ganha hora inventada', () => {
    // `deals.due_date` e `date`, sem hora. Escrever "00:00" seria inventar um
    // horario que ninguem marcou — e horario inventado num prazo e pior que
    // horario ausente, porque a pessoa pode agendar em cima dele.
    expect(dataExataSemHora('2026-04-19')).toBe('19 abr • dom')
  })

  it('nao desloca o dia pelo fuso', () => {
    // `new Date('2026-04-19')` e meia-noite UTC, que em Sao Paulo e 21h do dia
    // 18. Construir em horario local e o que impede o prazo de aparecer um dia
    // antes do que a pessoa escolheu.
    expect(dataExataSemHora('2026-04-19')).toContain('19 abr')
  })

  it('dia que nao existe no calendario devolve null', () => {
    // 31/02 existe como string e nao existe no calendario: o `Date` empurra em
    // silencio para marco, e a tela mostraria um dia que ninguem escolheu.
    expect(dataExataSemHora('2026-02-31')).toBeNull()
  })

  it('ano de DOIS digitos e recusado, e o teste e que estava errado', () => {
    // Eu escrevi este caso esperando que "0026-08-09" passasse, por ser um ano
    // de quatro digitos. Ele nao passa, e a funcao esta certa: `new Date(26,
    // ...)` remapeia 26 para 1926, entao a volta pelo `getFullYear` nao bate.
    //
    // Recusar e o comportamento desejado — foi exatamente esse remapeamento
    // que fez o dashboard exibir "atrasado ha 46.000 dias" antes de 26/08.
    expect(dataExataSemHora('0026-08-09')).toBeNull()
    expect(dataExataSemHora('26-08-09')).toBeNull()
    expect(dataExataSemHora(null)).toBeNull()
  })

  it('NAO deixa "de" nem ponto de abreviacao', () => {
    // `pt-BR` devolve "19 de abr." mesmo com o mes abreviado: a preposicao
    // sobrevive a abreviacao, e num card ela custa tres caracteres sem dizer
    // nada. Achado pelo teste, nao pela leitura do codigo.
    const s = dataExataSemHora('2026-04-19')!
    expect(s).not.toMatch(/\./)
    expect(s).not.toMatch(/ de /)
  })
})
