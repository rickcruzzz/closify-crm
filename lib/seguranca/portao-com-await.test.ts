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

/**
 * Toda chamada do portão, com o que vem imediatamente antes dela.
 *
 * Nova a cada uso: `RegExp` com `/g` carrega `lastIndex` entre chamadas.
 */
function chamadasDoPortao(portao: string): RegExp {
  return new RegExp(String.raw`(\S*)\s*\b${portao}\s*\(`, 'gm')
}

/**
 * As formas que de fato esperam a promise.
 *
 * ## A lógica é ALLOW-LIST, e a primeira versão era o contrário
 *
 * A primeira versão ancorava no que vinha antes SER um limite de statement
 * (`^`, `;`, `{`, `}`) e tratava o resto como seguro. Medido depois de
 * escrita, ela deixava passar quatro formas que rodam sem esperar:
 *
 *     if (ehDono) exigirAmbienteLocal()
 *     else exigirAmbienteLocal()
 *     for (const x of y) exigirAmbienteLocal()
 *     cond ? exigirAmbienteLocal() : null
 *
 * Um portão de segurança dentro de um `if` de uma linha é exatamente o código
 * que alguém escreveria, e a varredura o aprovava. Varredura que erra para o
 * lado de APROVAR é pior que varredura nenhuma: ela dá a sensação de cobertura
 * sem a cobertura.
 *
 * Invertida, o padrão é reprovar e só o que está aqui passa. Forma nova de
 * esperar entra nesta lista de propósito: acrescentar a exceção obriga a
 * pensar nela, e é barato.
 */
const ESPERA_DE_VERDADE = [
  'await', // await exigirAmbienteLocal()
  'return', // quem chama espera
  'void', // descarte EXPLÍCITO
  '=', // const r = ..., e também `=>`
  '(', // passado como argumento, ou dentro de Promise.all(
  ',', // segundo item de um Promise.all
  '[', // primeiro item de um array de promises
  '.', // método de outro objeto, não este portão
]

/**
 * A própria DECLARAÇÃO do portão, que não é chamada de coisa nenhuma.
 *
 * `async function abrirSessao(` casa com o mesmo padrão de uma chamada, e sem
 * esta porta a varredura acusava os onze lugares onde os seis portões nascem.
 * Alarme sobre a definição é ruído puro, e ruído é como uma varredura deixa de
 * ser lida.
 */
function ehDeclaracao(prefixo: string): boolean {
  return /\bfunction$/.test(prefixo.trim())
}

/** O prefixo imediato promete que alguém vai esperar? */
function alguemEspera(prefixo: string): boolean {
  const limpo = prefixo.trim()
  if (limpo === '') return false
  return ESPERA_DE_VERDADE.some((forma) => limpo.endsWith(forma))
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

  /** Toda chamada de um portão numa linha, com veredito. */
  function soltasNaLinha(portao: string, linha: string): boolean {
    return Array.from(linha.matchAll(chamadasDoPortao(portao))).some(
      (achado) => !ehDeclaracao(achado[1]) && !alguemEspera(achado[1]),
    )
  }

  it.each(PORTOES)('%s', (portao) => {
    const soltas: string[] = []
    for (const { caminho, codigo } of fontes) {
      if (!codigo.includes(portao)) continue
      for (const linha of codigo.split('\n')) {
        if (soltasNaLinha(portao, linha)) soltas.push(`${caminho}: ${linha.trim()}`)
      }
    }
    expect(soltas).toEqual([])
  })

  /**
   * Os CONTROLES, e sem eles um erro na expressão aprova tudo para sempre. É a
   * lição de 18/09, quando a varredura de acentos nasceu cega de dois jeitos
   * diferentes e só o controle acusou.
   *
   * As quatro últimas formas desta lista **passavam** na primeira versão desta
   * varredura, e foram o motivo de ela ser invertida para allow-list. Um
   * portão de segurança dentro de um `if` de uma linha é exatamente o código
   * que alguém escreveria.
   */
  it.each([
    '  exigirAmbienteLocal()',
    '  const a = 1; exigirAmbienteLocal()',
    '  if (ehDono) exigirAmbienteLocal()',
    '  } else exigirAmbienteLocal()',
    '  for (const x of y) exigirAmbienteLocal()',
    '  cond ? exigirAmbienteLocal() : null',
  ])('CONTROLE, pega a chamada solta: %s', (linha) => {
    expect(soltasNaLinha('exigirAmbienteLocal', linha)).toBe(true)
  })

  it.each([
    ['exigirAmbienteLocal', '  await exigirAmbienteLocal()'],
    ['exigirAmbienteLocal', '  return exigirAmbienteLocal()'],
    ['exigirAmbienteLocal', '  void exigirAmbienteLocal()'],
    ['exigirAmbienteLocal', '  const p = exigirAmbienteLocal()'],
    ['exigirAmbienteLocal', '  await Promise.all([exigirAmbienteLocal(), outra()])'],
    ['abrirSessao', '  const s = await abrirSessao()'],
    ['conferirAlvo', '  const r = await conferirAlvo(a, b)'],
  ])('CONTROLE, não acusa o correto (%s): %s', (portao, linha) => {
    expect(soltasNaLinha(portao, linha)).toBe(false)
  })
})
