import { describe, expect, it } from 'vitest'

import {
  consolidarVocabulario,
  CORPUS_VAZIO,
  extrairPromessas,
  extrairVocabulario,
  mesclarVocabulario,
} from './aprendizado'

const pagina = (dominio: string, texto: string) => ({ dominio, texto })

describe('extrairVocabulario', () => {
  it('conta DOMINIO distinto, nunca ocorrencia', () => {
    // O defeito que esta regra evita: um site que repete o proprio slogan
    // quarenta vezes lideraria a lista sozinho, e a lista diria "tendencia do
    // mercado" sobre uma amostra de UM.
    const paginas = [
      pagina('a.com.br', 'agendamento online '.repeat(40)),
      pagina('b.com.br', 'plano de tratamento para o paciente'),
      pagina('c.com.br', 'plano de tratamento aprovado'),
      pagina('d.com.br', 'plano de tratamento em etapas'),
    ]
    const termos = extrairVocabulario(paginas, { minimoDeSites: 2 })
    const primeiro = termos[0]
    expect(primeiro.termo).toContain('plano')
    expect(primeiro.sites).toBe(3)
    // O termo repetido 40x em um site so nao alcanca o piso de 2 dominios.
    expect(termos.find((t) => t.termo === 'agendamento online')).toBeUndefined()
  })

  it('desqualifica a palavra da CONSULTA, que e eco da propria pergunta', () => {
    // Buscar "clinica odontologica" e achar "clinica odontologica" em 100% dos
    // resultados nao ensina nada. Mesma regra de `classificarSinal`, que nasceu
    // de 5 falsos positivos medidos.
    const paginas = [
      pagina('a.com.br', 'clinica odontologica com implante dentario'),
      pagina('b.com.br', 'clinica odontologica faz implante dentario'),
      pagina('c.com.br', 'clinica odontologica: implante dentario'),
    ]
    const comConsulta = extrairVocabulario(paginas, {
      consultas: ['clinica odontologica em Sao Paulo'],
      minimoDeSites: 2,
    })
    expect(comConsulta.map((t) => t.termo)).toContain('implante dentario')
    expect(comConsulta.map((t) => t.termo)).not.toContain('clinica odontologica')

    // Controle: SEM passar a consulta, o eco lidera — que e exatamente o
    // resultado inutil que a regra existe para impedir.
    const semConsulta = extrairVocabulario(paginas, { minimoDeSites: 2 })
    expect(semConsulta.map((t) => t.termo)).toContain('clinica odontologica')
  })

  it('ignora acento e caixa, porque Clinica e clinica sao a mesma palavra', () => {
    const termos = extrairVocabulario(
      [pagina('a.com.br', 'Prótese Dentária'), pagina('b.com.br', 'protese dentaria')],
      { minimoDeSites: 2 },
    )
    expect(termos.map((t) => t.termo)).toContain('protese dentaria')
  })

  it('nao devolve fragmento que comeca ou termina em palavra vazia', () => {
    const termos = extrairVocabulario(
      Array.from({ length: 4 }, (_, i) => pagina(`s${i}.com.br`, 'plano de saude para toda a familia')),
      { minimoDeSites: 2 },
    )
    for (const t of termos) {
      const p = t.termo.split(' ')
      expect(['de', 'para', 'a', 'o']).not.toContain(p[0])
      expect(['de', 'para', 'a', 'o']).not.toContain(p[p.length - 1])
    }
  })

  it('traz o dominio de exemplo, porque termo sem fonte e suposicao minha', () => {
    const termos = extrairVocabulario(
      [pagina('um.com.br', 'implante dentario'), pagina('dois.com.br', 'implante dentario')],
      { minimoDeSites: 2 },
    )
    expect(termos[0].exemplos).toContain('um.com.br')
    expect(termos[0].exemplos.length).toBeLessThanOrEqual(3)
  })
})

describe('extrairPromessas', () => {
  it('recorta a frase INTEIRA, sem parafrasear', () => {
    const frase = 'Oferecemos atendimento humanizado com mais de 20 anos de experiência.'
    const [p] = extrairPromessas([pagina('a.com.br', frase)])
    expect(p.frase).toBe(frase)
    expect(p.dominio).toBe('a.com.br')
  })

  it('ignora frase curta demais e texto de navegacao', () => {
    expect(extrairPromessas([pagina('a.com.br', 'Home. Sobre. Contato. Blog.')])).toHaveLength(0)
  })

  it('limita por site, para um site falante nao dominar a lista', () => {
    const texto = Array.from(
      { length: 8 },
      (_, i) => `Garantimos o melhor resultado possível na etapa número ${i} do tratamento.`,
    ).join(' ')
    expect(extrairPromessas([pagina('a.com.br', texto)], { maximoPorSite: 2 })).toHaveLength(2)
  })
})

describe('o ruido que a PRIMEIRA rodada real trouxe', () => {
  it('descarta boilerplate de widget em ingles', () => {
    // Medido: `don t have`, `have the app` e `download it now` apareceram em 6
    // sites, todos do mesmo banner de "baixe nosso aplicativo". Seis dominios
    // distintos passavam no piso e o termo nao dizia nada sobre o nicho.
    const paginas = Array.from({ length: 6 }, (_, i) =>
      pagina(`s${i}.com.br`, "You don't have the app? Download it now. Implante dentario aqui."),
    )
    const termos = extrairVocabulario(paginas, { minimoDeSites: 3 }).map((t) => t.termo)
    expect(termos).not.toContain('have the app')
    expect(termos).not.toContain('download it now')
    // E o termo em portugues do mesmo texto continua vindo — o corte e pela
    // funcao gramatical inglesa, nao pela pagina inteira.
    expect(termos).toContain('implante dentario')
  })

  it('descarta cromo de rodape, mas NAO o CTA do nicho', () => {
    const paginas = Array.from({ length: 5 }, (_, i) =>
      pagina(`s${i}.com.br`, 'Fale conosco. Todos os direitos reservados. Agende sua consulta hoje.'),
    )
    const termos = extrairVocabulario(paginas, { minimoDeSites: 3 }).map((t) => t.termo)
    expect(termos).not.toContain('fale conosco')
    expect(termos).not.toContain('direitos reservados')
    // A distincao que importa: `agende sua consulta` e o CTA escrito pelo
    // proprio nicho, que e exatamente o que este documento existe para colher.
    expect(termos).toContain('agende sua consulta')
  })

  it('tira a marcacao markdown do recorte', () => {
    // O `contents` do Exa devolve markdown; `## Nosso compromisso` levaria a
    // marcacao para dentro da citacao literal.
    const [p] = extrairPromessas([
      pagina('a.com.br', '## Nosso compromisso é com a sua autoestima e o seu sorriso!'),
    ])
    expect(p.frase).toBe('Nosso compromisso é com a sua autoestima e o seu sorriso!')
  })

  it('nao repete a MESMA frase vinda do cabecalho e do corpo', () => {
    const frase = 'Nosso compromisso é com a sua autoestima e o seu sorriso!'
    const p = extrairPromessas([pagina('a.com.br', `## ${frase}\n${frase}`)])
    expect(p).toHaveLength(1)
  })
})

describe('o corpus que acumula em vez de se destruir', () => {
  const t = (termo: string, sites: number) => ({ termo, sites, exemplos: ['a.com.br'] })

  it('somar dois nichos preserva o primeiro', () => {
    // O defeito que isto corrige: `aprendizado-<data>.md` era sobrescrito, e
    // seis nichos no mesmo dia deixavam so o ultimo. O dado ja tinha sido pago.
    const um = mesclarVocabulario(CORPUS_VAZIO, [t('agende sua visita', 5)], 'dedetizacao', '2026-09-07')
    const dois = mesclarVocabulario(um, [t('projeto sob medida', 4)], 'marcenaria', '2026-09-07')
    expect(dois.termos['agende sua visita']).toEqual({ dedetizacao: 5 })
    expect(dois.termos['projeto sob medida']).toEqual({ marcenaria: 4 })
    expect(Object.keys(dois.atualizadoEm)).toEqual(['dedetizacao', 'marcenaria'])
  })

  it('rodar o MESMO nicho de novo pega o maior, nunca a soma', () => {
    // Somar transformaria repeticao em evidencia: rodar dedetizacao cinco vezes
    // nao torna o termo mais universal, so mede melhor o mesmo nicho.
    const um = mesclarVocabulario(CORPUS_VAZIO, [t('controle de pragas', 8)], 'dedetizacao', 'x')
    const dois = mesclarVocabulario(um, [t('controle de pragas', 5)], 'dedetizacao', 'y')
    expect(dois.termos['controle de pragas']).toEqual({ dedetizacao: 8 })
  })

  it('o consolidado ordena por ALCANCE entre nichos, nao por volume', () => {
    // Ordenar por sites poria o termo do nicho mais rodado no topo — e ele e
    // inutil para a landing. O que serve para a landing atravessa setores.
    let c = CORPUS_VAZIO
    c = mesclarVocabulario(c, [t('so em um nicho', 40), t('atravessa', 2)], 'a', 'x')
    c = mesclarVocabulario(c, [t('atravessa', 2)], 'b', 'x')
    c = mesclarVocabulario(c, [t('atravessa', 2)], 'c', 'x')

    const [primeiro, segundo] = consolidarVocabulario(c)
    expect(primeiro.termo).toBe('atravessa')
    expect(primeiro.nichos).toBe(3)
    expect(primeiro.onde).toEqual(['a', 'b', 'c'])
    // 40 sites num nicho so perde para 6 sites em tres nichos.
    expect(segundo.termo).toBe('so em um nicho')
  })
})

describe('a praca tambem e a minha pergunta', () => {
  it('o nome da cidade NAO vira vocabulario do ICP', () => {
    // Medido no primeiro corpus acumulado, 07/09: "rio de janeiro" era o termo
    // que mais atravessava nichos — porque a consulta era "... em Rio de
    // Janeiro". A consulta circular voltando por uma porta nova: a cidade e
    // colada no `semear`, fora do texto da consulta.
    const paginas = Array.from({ length: 4 }, (_, i) =>
      pagina(`s${i}.com.br`, 'Atendemos todo o Rio de Janeiro com controle de pragas certificado'),
    )
    const comPraca = extrairVocabulario(paginas, {
      consultas: ['site de dedetizadora'],
      pracas: ['Rio de Janeiro'],
      minimoDeSites: 2,
    }).map((t) => t.termo)
    expect(comPraca).not.toContain('rio de janeiro')
    // E o termo do NEGÓCIO continua vindo: o corte é na pergunta, não na página.
    expect(comPraca).toContain('pragas certificado')

    // Controle: SEM passar a praca, a cidade lidera — o resultado inutil que a
    // regra existe para impedir.
    const semPraca = extrairVocabulario(paginas, {
      consultas: ['site de dedetizadora'],
      minimoDeSites: 2,
    }).map((t) => t.termo)
    expect(semPraca).toContain('rio de janeiro')
  })

  it('conector de discurso e fragmento de URL ficam fora', () => {
    // Eles aparecem em qualquer texto do mundo, entao atravessam TODOS os
    // nichos e subiriam ao topo do consolidado dizendo nada.
    const paginas = Array.from({ length: 4 }, (_, i) =>
      pagina(`s${i}.com.br`, 'Além disso veja https www exemplo com br e entre em contato conosco'),
    )
    const termos = extrairVocabulario(paginas, { minimoDeSites: 2 }).map((t) => t.termo)
    for (const lixo of ['alem disso', 'https www', 'contato conosco', 'entre em contato']) {
      expect(termos).not.toContain(lixo)
    }
  })
})
