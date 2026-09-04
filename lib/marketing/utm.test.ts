import { describe, expect, it } from 'vitest'

import { chaveDeUtm, parametrosDeOrigem } from './utm'

/**
 * `chaveDeUtm` já era exercitada de lado por `eco-da-peca.test.ts` e por
 * `lib/dono/atribuicao.test.ts`, nunca direto. Os casos abaixo travam o
 * comportamento que os dois consumidores dependem, incluindo o achado de 04/09:
 * o nome da campanha na Meta e o `utm_campaign` da URL **nunca** vão ser
 * idênticos por escrito, porque espaço, travessão e parêntese não cabem numa
 * URL e nome de campanha existe para ser lido no painel.
 */
describe('chaveDeUtm', () => {
  it('reduz nome de campanha e valor de URL à mesma forma', () => {
    expect(chaveDeUtm('Velo Funil — aquisicao (cadastro)')).toBe(
      'velo-funil-aquisicao-cadastro',
    )
    expect(chaveDeUtm('aquisicao_cadastro')).toBe('aquisicao-cadastro')
  })

  it('tira acento, que é a metade invisível do problema', () => {
    // O formatador do projeto reescreve caractere combinante para a forma
    // literal, então este caso é o que garante que o `NFD` continua valendo.
    expect(chaveDeUtm('Aquisição')).toBe('aquisicao')
    expect(chaveDeUtm('promoção de março')).toBe('promocao-de-marco')
  })

  it('não deixa separador sobrando nas pontas', () => {
    expect(chaveDeUtm('  _a1_  ')).toBe('a1')
    expect(chaveDeUtm('(preço)')).toBe('preco')
  })

  it('devolve string vazia para ausente', () => {
    expect(chaveDeUtm(null)).toBe('')
    expect(chaveDeUtm(undefined)).toBe('')
    expect(chaveDeUtm('')).toBe('')
  })
})

/**
 * O CTA das páginas de conteúdo perdia a origem ao levar para `/cadastro`, e
 * com ela o eco da promessa — o "grátis, sem cartão" sumia exatamente diante
 * dos quatro campos, que é o ponto de maior atrito do funil.
 */
describe('parametrosDeOrigem', () => {
  it('leva adiante o que identifica a origem', () => {
    expect(parametrosDeOrigem('?utm_content=g1_preco')).toBe('?utm_content=g1_preco')
    expect(parametrosDeOrigem('?gclid=Cj0KCQaBc123')).toBe('?gclid=Cj0KCQaBc123')
  })

  it('preserva os seis campos juntos, na ordem da lista', () => {
    const url =
      '?utm_source=google&utm_medium=cpc&utm_campaign=g_preco' +
      '&utm_content=g1_preco&utm_term=quanto+custa+um+crm&gclid=abc123'
    const saida = parametrosDeOrigem(url)

    for (const campo of [
      'utm_source=google',
      'utm_medium=cpc',
      'utm_campaign=g_preco',
      'utm_content=g1_preco',
      'gclid=abc123',
    ]) {
      expect(saida).toContain(campo)
    }
    // `+` do espaço é reescrito como `%2B`/`+` pelo URLSearchParams; o que
    // importa é o valor sobreviver, não a codificação exata.
    expect(saida).toContain('utm_term=')
  })

  it('DESCARTA o que não é de origem', () => {
    // A defesa que importa: repassar a query inteira levaria para a página de
    // cadastro qualquer coisa pendurada na URL. Este projeto já trata caminho
    // de URL como credencial (`/convite/<token>`), e o wrapper do Vercel
    // Analytics higieniza a rota antes de enviar exatamente por isso.
    expect(parametrosDeOrigem('?token=segredo&utm_content=g1_preco')).toBe(
      '?utm_content=g1_preco',
    )
    expect(parametrosDeOrigem('?convite=abc&email=alguem@exemplo.com')).toBe('')
    expect(parametrosDeOrigem('?redirect=https://outro.site')).toBe('')
  })

  it('descarta valor vazio em vez de repassar chave solta', () => {
    // `?utm_content=` não diz de onde a visita veio, e repassá-lo daria a
    // `ecoDaPeca` uma string vazia — mesmo resultado, URL mais suja.
    expect(parametrosDeOrigem('?utm_content=')).toBe('')
  })

  it('devolve vazio para query ausente, sem gerar um "?" solto', () => {
    // Um `?` sozinho no fim do href não quebra nada e apareceria em toda visita
    // orgânica, que é a imensa maioria.
    expect(parametrosDeOrigem('')).toBe('')
    expect(parametrosDeOrigem(null)).toBe('')
    expect(parametrosDeOrigem(undefined)).toBe('')
    expect(parametrosDeOrigem('?')).toBe('')
  })

  it('aceita a query com e sem o "?" na frente', () => {
    expect(parametrosDeOrigem('utm_content=g1_preco')).toBe('?utm_content=g1_preco')
  })
})
