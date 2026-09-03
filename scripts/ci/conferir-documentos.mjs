/**
 * Confere se os documentos ainda descrevem o código que existe.
 *
 *     node scripts/ci/conferir-documentos.mjs
 *
 * ## Por que isto existe
 *
 * Este projeto tem histórico caro de documento afirmando o que deixou de ser
 * verdade, e sempre pela mesma razão: nenhum dos quatro portões lê Markdown.
 *
 *   - o PRD afirmou 687 testes e 17 tabelas quando o real era 774 e 18
 *   - o `estado-atual.md` dizia que o Instagram não tinha caminho por API,
 *     enquanto `publicar-instagram.mjs` existia e publicava
 *   - a mesma seção afirmava 3.555 seguidores quando eram 11.528
 *   - e em 03/09, o documento descrevia em detalhe a arquitetura da ponte do
 *     WhatsApp — medições, correções, decisões — sem registrar em lugar
 *     nenhum que ela tinha sido REMOVIDA em 28/08
 *
 * O último é o mais perigoso da lista, porque o texto não estava errado: ele
 * descrevia corretamente um passado. O que faltava era o aviso de que aquilo
 * já não vale, e o documento é lido no começo de toda sessão.
 *
 * ## O que este script pega, e o que ele não pega
 *
 * Pega **arquivo citado que não existe** e **link markdown quebrado**. Não
 * pega afirmação errada em prosa — para isso não há atalho, só conferir contra
 * a fonte, que é o que os comandos no cabeçalho do PRD servem para lembrar.
 *
 * ## A lista de REMOVIDOS não é uma exceção para silenciar o alarme
 *
 * Um arquivo entra nela quando foi removido de propósito E o documento
 * registra a remoção com data e motivo. Sem esse registro, o alarme deve
 * continuar tocando — é exatamente ele que faltou entre 28/08 e 03/09.
 */
import { readdir, readFile, stat } from 'node:fs/promises'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = resolve(join(dirname(fileURLToPath(import.meta.url)), '..', '..'))

/**
 * Arquivos citados que NÃO existem mais, e cuja remoção está documentada.
 *
 * Cada entrada aponta onde a remoção é explicada. Se você adicionar um item
 * aqui sem escrever a explicação, está apenas calando o alarme.
 */
const REMOVIDOS_COM_REGISTRO = new Map([
  [
    'components/settings/evolution-connect-dialog.tsx',
    'ponte do WhatsApp, removida em 28/08 (c52a718) — ver estado-atual.md',
  ],
  [
    'lib/emails/whatsapp-desconectado.ts',
    'ponte do WhatsApp, removida em 28/08 (c52a718) — ver estado-atual.md',
  ],
  [
    'scripts/diagnostico/vigiar-sessao-whatsapp.mjs',
    'ponte do WhatsApp, removida em 28/08 (c52a718) — ver estado-atual.md',
  ],
])

/**
 * O texto que precisa aparecer no documento para a remoção contar como
 * registrada. Sem ele, os itens acima voltam a ser problema.
 */
const MARCA_DE_REGISTRO = 'A ponte do WhatsApp SAIU do produto em 28/08'

/** `docs/plan.md` é um plano ANTIGO, com caminhos relativos a pastas de então. */
const DOCS_HISTORICOS = new Set(['docs/plan.md'])

const existe = (p) =>
  stat(join(RAIZ, p)).then(
    () => true,
    () => false,
  )

/**
 * Caminho citado quase nunca é o caminho completo.
 *
 * O texto escreve `(dashboard)/error.tsx` para
 * `app/(dashboard)/error.tsx`, e `lib/config.js` para
 * `scripts/load-test/k6/lib/config.js` — este último dentro de um bloco que
 * três linhas depois dá o caminho inteiro.
 *
 * Prefixo fixo resolve o primeiro caso e falha no segundo, que foi um falso
 * positivo real na primeira execução em 03/09. Por isso o último recurso é
 * procurar qualquer arquivo do repositório cujo caminho TERMINE com o citado.
 *
 * O custo é aceitar citação ambígua como válida. A alternativa — acusar
 * arquivo que existe — é pior: alarme que erra vira alarme que se ignora, e
 * este script existe justamente porque ninguém lia os documentos com atenção.
 */
async function existeComPrefixo(caminho, todosOsArquivos) {
  if (await existe(caminho)) return true
  for (const prefixo of ['app/', 'app/(dashboard)/', 'components/', 'lib/', 'scripts/']) {
    if (await existe(prefixo + caminho)) return true
  }
  return todosOsArquivos.some((f) => f.endsWith('/' + caminho))
}

/** Todos os arquivos versionados, para a resolução por sufixo acima. */
async function listarArquivos(dir = '', acc = []) {
  const IGNORAR = new Set([
    'node_modules', '.next', '.next-check', '.git', 'graphify-out',
    'criativos', '.playwright-mcp', 'coverage',
  ])
  for (const item of await readdir(join(RAIZ, dir), { withFileTypes: true })) {
    if (IGNORAR.has(item.name) || item.name.startsWith('.')) continue
    const rel = dir ? `${dir}/${item.name}` : item.name
    if (item.isDirectory()) await listarArquivos(rel, acc)
    else acc.push(rel)
  }
  return acc
}

const EXT = '(?:ts|tsx|mjs|js|py|sql|json|md|css)'
const CITACAO = new RegExp('`([a-zA-Z0-9_./()\\[\\]@-]+\\.' + EXT + ')`', 'g')
const LINK = /\[[^\]]+\]\(([^)h][^)]*\.md[^)]*)\)/g

const arquivosDoRepo = await listarArquivos()

const docs = [
  ...(await readdir(join(RAIZ, 'docs')))
    .filter((f) => f.endsWith('.md'))
    .map((f) => `docs/${f}`),
  'CLAUDE.md',
]

let problemas = 0
let toleradosSemRegistro = 0
const textoDeTodos = (
  await Promise.all(docs.map((d) => readFile(join(RAIZ, d), 'utf-8').catch(() => '')))
).join('\n')

const removidosEstaoRegistrados = textoDeTodos.includes(MARCA_DE_REGISTRO)

console.log(`\nCONFERINDO ${docs.length} documentos\n${'='.repeat(56)}`)

for (const doc of docs) {
  const txt = await readFile(join(RAIZ, doc), 'utf-8').catch(() => '')
  const achados = []

  if (!DOCS_HISTORICOS.has(doc)) {
    for (const m of txt.matchAll(CITACAO)) {
      const cam = m[1]
      // `.../route.ts` é abreviação de caminho, não um caminho.
      if (!cam.includes('/') || cam.includes('...')) continue
      if (await existeComPrefixo(cam, arquivosDoRepo)) continue

      const registro = REMOVIDOS_COM_REGISTRO.get(cam)
      if (registro) {
        if (!removidosEstaoRegistrados) {
          achados.push(`${cam} — removido, e o registro SUMIU do documento`)
          toleradosSemRegistro += 1
        }
        continue
      }
      achados.push(`${cam} — citado e não existe`)
    }
  }

  for (const m of txt.matchAll(LINK)) {
    const alvo = m[1].split('#')[0]
    const destino = resolve(join(RAIZ, dirname(doc), alvo))
    if (!(await stat(destino).then(() => true, () => false))) {
      achados.push(`link quebrado: ${alvo}`)
    }
  }

  if (achados.length) {
    problemas += achados.length
    console.log(`\n  ${doc}`)
    for (const a of achados) console.log(`     X ${a}`)
  }
}

console.log(`\n${'='.repeat(56)}`)
if (problemas === 0) {
  console.log('documentos batem com o codigo')
  if (REMOVIDOS_COM_REGISTRO.size > 0) {
    console.log(`\n${REMOVIDOS_COM_REGISTRO.size} arquivos citados foram REMOVIDOS de proposito,`)
    console.log('e a remocao esta registrada:')
    for (const [k, v] of REMOVIDOS_COM_REGISTRO) console.log(`   ${k}\n     ${v}`)
  }
} else {
  console.log(`${problemas} problema(s)`)
  if (toleradosSemRegistro > 0) {
    console.log('\nATENCAO: a nota que explicava a remocao saiu do documento.')
    console.log('Sem ela, quem ler as secoes antigas conclui que o codigo existe.')
  }
}

process.exit(problemas > 0 ? 1 : 0)
