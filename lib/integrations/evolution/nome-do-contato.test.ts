import { describe, expect, it } from 'vitest'

import { nomeDeContato } from './nome-do-contato'

/**
 * O caso real, visto na primeira mensagem de WhatsApp que entrou no funil
 * (25/08): o contato foi criado como `𝖵𝖾𝗅𝗈 𝖥𝗎𝗇𝗂𝗅`.
 *
 * Não é erro de fonte — é o que o `PushName` traz. E dentro de um CRM isso
 * significa um contato que existe e não aparece na busca: procurar "Velo" não
 * acha `𝖵𝖾𝗅𝗈`, porque `𝖵` e `V` são caracteres diferentes.
 */
describe('nomeDeContato', () => {
  it('converte o nome estilizado que chegou de verdade', () => {
    expect(nomeDeContato('𝖵𝖾𝗅𝗈 𝖥𝗎𝗇𝗂𝗅')).toBe('Velo Funil')
  })

  it('cobre os outros blocos que o WhatsApp aceita', () => {
    // Todos aparecem em perfil de WhatsApp brasileiro, e todos quebram busca
    // do mesmo jeito.
    expect(nomeDeContato('𝐌𝐚𝐫𝐢𝐚')).toBe('Maria')
    expect(nomeDeContato('𝕁𝕠𝕒̃𝕠')).toBe('João')
    expect(nomeDeContato('Ⓐⓝⓐ')).toBe('Ana')
    expect(nomeDeContato('ＣＡＲＬＯＳ')).toBe('CARLOS')
  })

  it('preserva acento de verdade', () => {
    // A decomposição de compatibilidade separa o acento da letra. Sem a
    // recomposição, "José" viraria "Jose" com um acento solto flutuando.
    expect(nomeDeContato('José Antônio')).toBe('José Antônio')
    expect(nomeDeContato('Conceição')).toBe('Conceição')
  })

  it('tira emoji, que não é nome', () => {
    // `Maria 💅✨` ordena errado numa lista, vira quadradinho em PDF, e não
    // acrescenta nada a quem procura o contato. O emoji fica no WhatsApp.
    expect(nomeDeContato('Maria 💅✨')).toBe('Maria')
    expect(nomeDeContato('🔥 Pedro Vendas 🔥')).toBe('Pedro Vendas')
  })

  it('devolve null quando não sobra nome', () => {
    // `null` é resposta legítima, não falha: quem chama sabe o telefone e
    // escolhe um rótulo melhor do que esta função conseguiria.
    for (const vazio of [null, undefined, '', '   ', '😀😀', '...', '5571993309404']) {
      expect(nomeDeContato(vazio), JSON.stringify(vazio)).toBeNull()
    }
  })

  it('corta recado disfarçado de nome', () => {
    // Gente usa o nome do WhatsApp como status. Uma coluna de contato com 200
    // caracteres arrebenta toda listagem do produto.
    const longo = 'Promoção imperdível ligue agora mesmo '.repeat(5)
    const saida = nomeDeContato(longo)!
    expect(saida.length).toBeLessThanOrEqual(81)
    expect(saida.endsWith('…')).toBe(true)
  })

  it('nome comum passa intacto', () => {
    // A normalização não pode "consertar" o que já estava certo.
    expect(nomeDeContato('Ana Paula Ribeiro')).toBe('Ana Paula Ribeiro')
    expect(nomeDeContato('  Bruno   Teixeira  ')).toBe('Bruno Teixeira')
  })
})
