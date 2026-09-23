import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Portão de segurança chamado sem `await` não é portão.
 *
 * ## O defeito que motivou isto, e ele estava em produção
 *
 * `lib/whatsapp/reserva-actions.ts` chamava `exigirAmbienteLocal()` sem
 * `await`. A função é `async`, então o `notFound()` rejeitava uma promise que
 * ninguém observava e **a execução continuava**: o schema validava e
 * `guardarNaReserva` gravava credencial de provedor com `service_role`, numa
 * tabela com zero policies.
 *
 * E a Server Action existe no build de produção mesmo com a página em 404,
 * porque um componente a importa e o action-id é emitido. Quem envenenasse a
 * reserva entregaria uma instância controlada por ele ao próximo cliente que
 * pagasse o Max.
 *
 * ## Por que um teste e não a regra do ESLint
 *
 * `@typescript-eslint/no-floating-promises` pega a classe inteira e é a
 * ferramenta certa em teoria. Medido aqui: ela é type-aware, e com
 * `parserOptions.project` o `npm run lint` **passou de 2 minutos sem terminar**.
 * Portão que ninguém aguenta rodar deixa de ser rodado, e aí ele não protege
 * nada — que é o mesmo defeito, um nível acima.
 *
 * Este teste roda em milissegundos e cobre o que de fato decide acesso. É mais
 * estreito de propósito, e a diferença está escrita para quem vier depois não
 * achar que a classe inteira está fechada.
 *
 * ## O que conta como chamada segura
 *
 *     await exigirAmbienteLocal()        espera
 *     return exigirAmbienteLocal()       quem chama espera
 *     const r = await abrirSessao()      espera
 *     void exigirAmbienteLocal()         DESCARTA de propósito, e é explícito
 *
 * Qualquer outra forma é a promise solta.
 */

/**
 * Os portões. Todos `async`, e todos decidem se a execução continua.
 *
 * Conferido um a um com `grep "async function"`: nenhum deles é síncrono, então
 * não há caso em que chamar sem `await` esteja certo.
 */
const PORTOES = [
  'exigirAmbienteLocal',
  'exigirAdmin',
  'requireAdmin',
  'abrirSessao',
  'conferirConversa',
  'conferirAlvo',
] as const

const RAIZ = process.cwd()
const PASTAS = ['lib', 'app', 'components']

function arquivosDeCodigo(dir: string, achados: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    if (nome === 'node_modules' || nome.startsWith('.')) continue
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) arquivosDeCodigo(caminho, achados)
    else if (/\.tsx?$/.test(nome) && !nome.endsWith('.test.ts')) achados.push(caminho)
  }
  return achados
}

/**
 * Comentário fora, senão a própria explicação de um defeito reprova o arquivo.
 *
 * É a mesma decisão de `oferta-nas-artes.test.ts`, e pelo mesmo motivo: os
 * comentários deste projeto registram o defeito com o código que o causou, e
 * apagá-los para o teste passar destruiria a memória.
 */
function semComentarios(fonte: string): string {
  return fonte
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .join('\n')
}

/** Nova a cada chamada: `RegExp` com `/g` carrega `lastIndex` entre usos. */
function chamadaSolta(portao: string): RegExp {
  // Nega o que espera de verdade: `await`, `return`, `=`, `void`, `(`, `,`,
  // `:` e `.` antes do nome. O que sobra é a chamada como STATEMENT.
  return new RegExp(String.raw`(^|[;{}])\s*${portao}\s*\(`, 'gm')
}

describe('portão de segurança nunca é chamado sem await', () => {
  const arquivos = PASTAS.flatMap((p) => arquivosDeCodigo(join(RAIZ, p)))

  /**
   * Lido UMA vez, não uma vez por portão.
   *
   * A primeira versão relia os ~400 arquivos do disco para cada um dos seis
   * portões. Sozinho ele passava em 200ms; dentro da suíte inteira, com os
   * outros 140 arquivos disputando I/O, **estourou os 5s de timeout** — e um
   * teste que falha por lentidão é indistinguível de um que achou defeito.
   * Gastei uma investigação achando que tinha encontrado dois portões soltos
   * a mais, e era o relógio.
   */
  const fontes = arquivos.map((caminho) => ({
    caminho: caminho.slice(RAIZ.length + 1),
    codigo: semComentarios(readFileSync(caminho, 'utf-8')),
  }))

  it('existem arquivos para conferir', () => {
    expect(fontes.length).toBeGreaterThan(200)
  })

  it.each(PORTOES)('%s', (portao) => {
    const soltas: string[] = []
    for (const { caminho, codigo } of fontes) {
      if (!codigo.includes(portao)) continue
      for (const linha of codigo.split('\n')) {
        if (chamadaSolta(portao).test(linha)) soltas.push(`${caminho}: ${linha.trim()}`)
      }
    }
    expect(soltas).toEqual([])
  })

  /**
   * O CONTROLE, e sem ele um erro de digitação na expressão aprova tudo para
   * sempre. É a lição de 18/09, quando a varredura de acentos nasceu cega de
   * dois jeitos diferentes e só o controle acusou.
   */
  it('a varredura PEGA a chamada solta quando ela existe', () => {
    const ruim = 'export async function x() {\n  exigirAmbienteLocal()\n  return 1\n}'
    const achou = ruim
      .split('\n')
      .some((l) => chamadaSolta('exigirAmbienteLocal').test(l))
    expect(achou).toBe(true)
  })

  it('a varredura NÃO acusa a chamada correta', () => {
    for (const bom of [
      '  await exigirAmbienteLocal()',
      '  return exigirAmbienteLocal()',
      '  const s = await abrirSessao()',
      '  void exigirAmbienteLocal()',
      '  const r = conferirAlvo(a, b)',
    ]) {
      const portao = /abrirSessao/.test(bom)
        ? 'abrirSessao'
        : /conferirAlvo/.test(bom)
          ? 'conferirAlvo'
          : 'exigirAmbienteLocal'
      expect(chamadaSolta(portao).test(bom)).toBe(false)
    }
  })
})
