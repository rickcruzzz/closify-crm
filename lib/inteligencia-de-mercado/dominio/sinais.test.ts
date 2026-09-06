import { describe, expect, it } from 'vitest'

import { classificarSinal, normalizar } from './sinais'

const encher = (frase: string) => frase.padEnd(60, ' e outras informacoes do texto')

describe('classificarSinal', () => {
  it('reconhece expressão com ACENTO', () => {
    // A lista de expressões é escrita sem acento e a normalização tira o acento
    // antes de comparar. Sem isso, metade dos textos em português passaria
    // batido — e a lista precisaria existir em duas versões que divergiriam.
    expect(classificarSinal(encher('A empresa contratação de novo diretor comercial'))?.tipo).toBe(
      'contratacao',
    )
  })

  it('investimento GANHA de dor no mesmo texto', () => {
    // Um texto que fala de captação E de dificuldade é sinal de investimento,
    // que é o mais acionável para vender. Sem ordem explícita, o resultado
    // dependeria da ordem do objeto, que ninguém garante.
    const s = classificarSinal(
      encher('A empresa captou R$ 10 milhoes apesar da dificuldade operacional do setor'),
    )
    expect(s?.tipo).toBe('investimento')
    expect(s?.confianca).toBe('alta')
  })

  it('separa forte de fraca', () => {
    expect(classificarSinal(encher('A transportadora contratou um novo head de operacoes'))?.confianca).toBe('alta')
    expect(classificarSinal(encher('A transportadora tem vagas abertas para o time comercial'))?.confianca).toBe('media')
  })

  it('descarta texto curto', () => {
    // Trecho de 20 caracteres não sustenta afirmação nenhuma sobre uma empresa
    // real, mesmo casando com uma expressão.
    expect(classificarSinal('gargalo')).toBeNull()
    expect(classificarSinal('houve um gargalo ali')).toBeNull()
  })

  it('NAO aceita como prova a palavra que veio da propria pergunta', () => {
    // A armadilha circular, achada contra a API real em 06/09: a consulta
    // pergunta "quais os gargalos?", o Exa destaca o trecho que contem
    // "gargalo" — e o classificador declarava dor/alta. O sinal era a pergunta
    // ecoando. Medido: 6 trechos do blog institucional da RD viraram 5 sinais.
    const trecho = encher('O setor discute o gargalo logistico brasileiro em diversos eventos')
    expect(classificarSinal(trecho)?.confianca).toBe('alta')
    expect(
      classificarSinal(trecho, 'Quais os maiores gargalos operacionais da empresa?'),
    ).toBeNull()
  })

  it('a desqualificacao vale por EXPRESSAO, nao apaga o resto', () => {
    // Tirar "gargalo" de circulacao nao pode cegar o classificador para um
    // sinal de outra natureza no mesmo texto.
    const t = encher('Apesar do gargalo citado, a empresa captou um aporte de R$ 5 milhoes')
    const s = classificarSinal(t, 'quais os gargalos da empresa?')
    expect(s?.tipo).toBe('investimento')
    expect(s?.confianca).toBe('alta')
  })

  it('descarta texto institucional, que é a maioria do que volta', () => {
    // O site que a própria empresa escreveu é a fonte que NÃO tem a dor. Se
    // isto virasse sinal, o recurso produziria "dor identificada" para qualquer
    // empresa com site.
    expect(
      classificarSinal(
        encher('Somos lider em solucoes logisticas com mais de 20 anos de mercado e atendimento nacional'),
      ),
    ).toBeNull()
  })
})

describe('normalizar', () => {
  it('tira acento, baixa a caixa e colapsa espaço', () => {
    expect(normalizar('  CONTRATAÇÃO   de   Pessoal  ')).toBe('contratacao de pessoal')
  })
})
