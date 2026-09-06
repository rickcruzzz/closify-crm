import { describe, expect, it } from 'vitest'

import { extrairPromessas, extrairVocabulario } from './aprendizado'

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
