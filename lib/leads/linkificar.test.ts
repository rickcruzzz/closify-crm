import { describe, expect, it } from 'vitest'

import { linkificar, rotuloDoLink } from './linkificar'

describe('linkificar', () => {
  it('separa o link do texto ao redor', () => {
    const p = linkificar('Veja https://exemplo.com.br/x e me diga')
    expect(p).toEqual([
      { tipo: 'texto', valor: 'Veja ' },
      { tipo: 'link', valor: 'https://exemplo.com.br/x' },
      { tipo: 'texto', valor: ' e me diga' },
    ])
  })

  it('devolve o texto inteiro quando nao ha link', () => {
    expect(linkificar('nota sem endereco')).toEqual([{ tipo: 'texto', valor: 'nota sem endereco' }])
  })

  it('a pontuacao final fica no TEXTO, nao no endereco', () => {
    // Sem isto, "veja https://x.com.br." levaria o ponto para dentro do link e
    // o endereco quebraria no clique.
    const p = linkificar('veja https://x.com.br.')
    expect(p[1]).toEqual({ tipo: 'link', valor: 'https://x.com.br' })
    expect(p[2]).toEqual({ tipo: 'texto', valor: '.' })
  })

  it('NAO transforma javascript: em link', () => {
    // A descricao da atividade e escrita por gente. `javascript:` e execucao de
    // codigo disfarcada de link, e so `https://` passa.
    const texto = 'clique javascript:alert(1) aqui'
    expect(linkificar(texto)).toEqual([{ tipo: 'texto', valor: texto }])
  })

  it('NAO transforma http:// simples em link', () => {
    const texto = 'antigo http://exemplo.com'
    expect(linkificar(texto)).toEqual([{ tipo: 'texto', valor: texto }])
  })

  it('acha varios links na mesma nota', () => {
    const p = linkificar('a https://um.com b https://dois.com c')
    expect(p.filter((x) => x.tipo === 'link')).toHaveLength(2)
  })

  it('preserva as quebras de linha da nota', () => {
    // A nota da prospeccao tem paragrafos, e a timeline os mostra.
    const p = linkificar('linha 1\n\nlinha 2 https://x.com.br')
    expect(p[0]).toEqual({ tipo: 'texto', valor: 'linha 1\n\nlinha 2 ' })
  })
})

describe('rotuloDoLink', () => {
  it('o link gigante do wa.me vira uma frase', () => {
    // Ele carrega a mensagem inteira codificada e passa de 500 caracteres:
    // mostrado cru, empurraria o resto da nota para fora da tela.
    const url = 'https://wa.me/5511999998888?text=' + encodeURIComponent('a'.repeat(400))
    expect(rotuloDoLink(url)).toBe('Abrir no WhatsApp com a mensagem pronta')
  })

  it('endereco comum aparece sem o www e sem o protocolo', () => {
    expect(rotuloDoLink('https://www.velofunil.com.br/leads')).toBe('velofunil.com.br/leads')
  })

  it('corta endereco longo demais para caber na linha', () => {
    const r = rotuloDoLink('https://exemplo.com.br/' + 'a'.repeat(90))
    expect(r.length).toBeLessThanOrEqual(48)
    expect(r.endsWith('…')).toBe(true)
  })
})
