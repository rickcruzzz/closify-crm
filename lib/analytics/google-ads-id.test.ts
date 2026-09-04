import { describe, expect, it } from 'vitest'

import { googleAdsIdSeguro, rotuloDeConversaoSeguro } from './google-ads-id'

/**
 * Os dois valores entram num script INLINE e numa URL, exatamente como o ID do
 * Meta Pixel entrava quando uma quebra de linha colada na Vercel derrubou a
 * produção inteira em 24/08 — tela preta para quem aceitasse os cookies.
 *
 * Cada caso aqui é aquele incidente aplicado a este caminho.
 */
describe('googleAdsIdSeguro', () => {
  it('aceita o formato que o trecho de código do Google traz', () => {
    expect(googleAdsIdSeguro('AW-123456789')).toBe('AW-123456789')
  })

  it('aceita o número sozinho, que é como a tela da conversão mostra', () => {
    // As duas colagens são razoáveis. Recusar esta produziria o silêncio que o
    // arquivo existe para evitar: variável preenchida, tag nunca carregando.
    expect(googleAdsIdSeguro('123456789')).toBe('AW-123456789')
  })

  it('remove a quebra de linha, o defeito que já derrubou a produção', () => {
    expect(googleAdsIdSeguro('AW-123456789\n')).toBe('AW-123456789')
    expect(googleAdsIdSeguro('\r\nAW-123456789\r\n')).toBe('AW-123456789')
  })

  it('remove espaço e aspas que o copiar-e-colar arrasta junto', () => {
    expect(googleAdsIdSeguro('  AW-123456789  ')).toBe('AW-123456789')
    expect(googleAdsIdSeguro('"AW-123456789"')).toBe('AW-123456789')
    expect(googleAdsIdSeguro("'AW-123456789'")).toBe('AW-123456789')
  })

  it('remove invisível de largura zero, que nenhuma inspeção visual pega', () => {
    expect(googleAdsIdSeguro('AW-123456789​')).toBe('AW-123456789')
    expect(googleAdsIdSeguro('﻿AW-123456789')).toBe('AW-123456789')
  })

  it('recusa o que não for AW- mais dígitos', () => {
    // A defesa que importa: o valor vira parte de um script inline e de uma
    // URL. Caractere estranho aqui não é configuração errada, é injeção.
    expect(googleAdsIdSeguro("AW-1'); alert(1); ('")).toBeNull()
    expect(googleAdsIdSeguro('G-XYZABC123')).toBeNull()
    expect(googleAdsIdSeguro('AW-123/AbC-dEf')).toBeNull()
  })

  it('recusa o ID de MEDIÇÃO do GA4, que tem outro prefixo e outro efeito', () => {
    // `G-…` é Google Analytics 4, descartado deste projeto por decisão travada
    // ("ferramenta de site, não de app logado"). Aceitá-lo aqui carregaria um
    // rastreador que ninguém escolheu, sob o nome de conversão de anúncio.
    expect(googleAdsIdSeguro('G-1234567890')).toBeNull()
  })

  it('devolve null para vazio ou ausente', () => {
    expect(googleAdsIdSeguro(undefined)).toBeNull()
    expect(googleAdsIdSeguro('')).toBeNull()
    expect(googleAdsIdSeguro('   ')).toBeNull()
    // Só o prefixo, sem número: acontece quando alguém cola metade do valor.
    expect(googleAdsIdSeguro('AW-')).toBeNull()
  })
})

/**
 * O rótulo é a metade do `send_to` que diz QUAL conversão contar. Com o ID e
 * sem ele, a tag carrega, a chamada sai e a conversão não aparece no relatório
 * — falha silenciosa com tudo parecendo certo, que é o pior tipo.
 */
describe('rotuloDeConversaoSeguro', () => {
  it('aceita o alfabeto que o Google de fato usa', () => {
    expect(rotuloDeConversaoSeguro('AbC-dEfG_hIj')).toBe('AbC-dEfG_hIj')
    expect(rotuloDeConversaoSeguro('7q2LCJ_x9pgDEP-abc')).toBe('7q2LCJ_x9pgDEP-abc')
  })

  it('limpa quebra de linha, espaço e aspas', () => {
    expect(rotuloDeConversaoSeguro('AbC-dEfG\n')).toBe('AbC-dEfG')
    expect(rotuloDeConversaoSeguro('  "AbC-dEfG"  ')).toBe('AbC-dEfG')
  })

  it('recusa o send_to INTEIRO colado no lugar do rótulo', () => {
    // O erro de colagem mais provável: o painel mostra `AW-123/AbC` junto, e a
    // barra é o que separa os dois. Aceitá-la aqui produziria
    // `send_to: 'AW-123/AW-123/AbC'` — chamada válida, conversão nenhuma.
    expect(rotuloDeConversaoSeguro('AW-123456789/AbC-dEfG')).toBeNull()
  })

  it('recusa caractere fora do alfabeto', () => {
    expect(rotuloDeConversaoSeguro("AbC'); alert(1); ('")).toBeNull()
  })

  it('recusa espaço NO MEIO em vez de juntar, e isto foi um defeito meu', () => {
    // A primeira versão copiava a limpeza de `pixel-id.ts`, que remove espaço
    // em qualquer posição. Ali é inofensivo — o resultado ainda tem que ser só
    // dígitos. Aqui `AbC dEf` virava `AbCdEf`: um rótulo VÁLIDO e diferente do
    // colado, que faria a tag carregar, a chamada sair e o Google não achar a
    // ação de conversão. Zero no relatório com tudo parecendo certo.
    expect(rotuloDeConversaoSeguro('AbC dEf')).toBeNull()
  })

  it('e o mesmo vale para o ID, pelo mesmo motivo', () => {
    // `AW-123 456` juntado daria `AW-123456`, uma conta que provavelmente
    // existe e não é a nossa. Recusar é o único jeito de o erro aparecer.
    expect(googleAdsIdSeguro('AW-123 456')).toBeNull()
  })

  it('devolve null para vazio ou ausente', () => {
    expect(rotuloDeConversaoSeguro(undefined)).toBeNull()
    expect(rotuloDeConversaoSeguro('')).toBeNull()
    expect(rotuloDeConversaoSeguro('   ')).toBeNull()
  })
})
