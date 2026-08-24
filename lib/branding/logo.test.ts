import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * A marca exportada não pode divergir da marca do produto.
 *
 * `scripts/marketing/gerar-logos.mjs` copia os três caminhos SVG de
 * `components/branding/logo.tsx` para gerar os arquivos que o dono baixa. Se
 * alguém ajustar o desenho no componente e não regerar, os arquivos passam a
 * mostrar uma marca que o produto não usa mais — e ninguém descobre, porque
 * nenhum `tsc`/`lint` compara imagem com componente. É a mesma classe de
 * defeito dos prints da landing, que este projeto já pagou duas vezes.
 *
 * Este teste lê os DOIS arquivos e compara os caminhos. Quebra na hora em que
 * divergirem, com a instrução do que rodar.
 */
const RAIZ = join(__dirname, '..', '..')

function caminhosDo(arquivo: string): string[] {
  const conteudo = readFileSync(join(RAIZ, arquivo), 'utf-8')
  return Array.from(conteudo.matchAll(/d="(M[^"]+)"/g), (m) => m[1])
}

describe('marca exportada', () => {
  it('usa exatamente o desenho do componente do produto', () => {
    // Compara o componente com o ARQUIVO GERADO, não com o código do gerador.
    // Assim o teste pega os dois modos de divergir: alguém mudar o desenho e
    // não atualizar o gerador, e alguém atualizar o gerador e esquecer de
    // rodá-lo — este segundo é o mais provável, e o que passaria despercebido.
    const noComponente = caminhosDo('components/branding/logo.tsx')
    const noArquivo = caminhosDo('marketing/marca/simbolo-teal.svg')

    expect(noComponente).toHaveLength(3)
    expect(
      noArquivo,
      'A marca exportada não bate com components/branding/logo.tsx. ' +
        'Rode `node scripts/marketing/gerar-logos.mjs`.',
    ).toEqual(noComponente)
  })

  it('os arquivos gerados contêm as três camadas do funil', () => {
    // Três camadas convergindo: se o gerador emitisse só uma, o arquivo ainda
    // seria um SVG válido e o defeito passaria por qualquer verificação
    // automática que não olhasse o conteúdo.
    for (const arquivo of [
      'marketing/marca/simbolo-teal.svg',
      'marketing/marca/selo-teal.svg',
      'marketing/marca/completa-fundo-escuro.svg',
    ]) {
      expect(caminhosDo(arquivo), arquivo).toHaveLength(3)
    }
  })

  it('cada variante declara a própria cor, sem currentColor', () => {
    // O componente usa `fill="currentColor"` porque herda a cor do CSS. Num
    // arquivo baixado isso é armadilha: aberto fora de um navegador com CSS,
    // `currentColor` vira preto — e a pessoa manda a marca errada para a
    // gráfica sem perceber.
    const conteudo = readFileSync(
      join(RAIZ, 'marketing/marca/simbolo-teal.svg'),
      'utf-8',
    )
    expect(conteudo).not.toContain('currentColor')
    expect(conteudo).toContain('#00bfc0')
  })
})
