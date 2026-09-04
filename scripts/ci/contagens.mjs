/**
 * As contagens do repositório, calculadas em vez de lembradas.
 *
 *     node scripts/ci/contagens.mjs
 *
 * ## Por que isto existe
 *
 * `conferir-documentos.mjs` confere se CAMINHO citado existe, e o cabeçalho
 * dele declara a lacuna: *"Não pega afirmação errada em prosa"*. Ele cita,
 * inclusive, o caso histórico — o PRD afirmando 687 testes e 17 tabelas quando
 * o real era 774 e 18.
 *
 * Em 04/09 a lacuna cobrou de novo, e maior: **20 afirmações erradas em 6
 * documentos ao mesmo tempo**, com o conferidor passando limpo sobre os
 * arquivos que acabara de ler. Grafo com 3.989 nós quando eram 4.279. PRD com
 * 68 migrations quando eram 69. `testes.md` com 436 testes quando eram 1.013.
 *
 * Este arquivo é o sucessor executável da tabela `métrica → comando` que já
 * existe no cabeçalho do PRD: em vez de lembrar qual comando responde cada
 * número, roda um só e recebe todos, com a definição ao lado.
 *
 * ## O que ele NÃO faz, e por quê
 *
 * Não fala com o Postgres, e por isso não conta tabela, RPC, foreign key nem
 * trigger. Ele é chamado por um conferidor que precisa rodar offline, em CI,
 * em segundos. Contagem de banco continua humana — guardada pela sentinela de
 * migration, que expira o carimbo quando uma migration nova entra.
 *
 * ## `INDISPONIVEL` não é zero
 *
 * `graphify-out/` está no `.gitignore`: em clone novo e no CI o grafo não
 * existe. Tratar ausência como `0` faria o conferidor acusar erro que não há;
 * tratar como "pular" o deixaria verde em silêncio, e os números do grafo
 * apodreceriam para sempre — que é exatamente a doença sendo curada aqui.
 *
 * A terceira saída é dizer **não sei**, e quem consome tem de distinguir isso
 * de um número. É a mesma disciplina de `lib/dono/vigia.ts`, onde `null`
 * significa "não consegui ler" e nunca "está zerado".
 */
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = resolve(join(dirname(fileURLToPath(import.meta.url)), '..', '..'))

/** O valor que significa "não consegui olhar", e nunca "é zero". */
export const INDISPONIVEL = Symbol('indisponivel')

/**
 * Migrations removidas de propósito, e onde a remoção está explicada.
 *
 * Mesma forma e mesma regra de `REMOVIDOS_COM_REGISTRO` em
 * `conferir-documentos.mjs`: entrar aqui sem escrever a explicação no
 * documento é calar o alarme, não resolver o problema.
 */
export const BURACOS_COM_REGISTRO = new Map([
  [
    '0049',
    'provada desnecessária e removida em 22/08 — ver docs/historico-agosto.md',
  ],
])

async function listarArquivos(dir = '', acc = []) {
  const IGNORAR = new Set([
    'node_modules',
    '.next',
    '.next-check',
    '.git',
    'graphify-out',
    'criativos',
    '.playwright-mcp',
    'coverage',
  ])
  for (const item of await readdir(join(RAIZ, dir), { withFileTypes: true })) {
    if (IGNORAR.has(item.name) || item.name.startsWith('.')) continue
    const rel = dir ? `${dir}/${item.name}` : item.name
    if (item.isDirectory()) await listarArquivos(rel, acc)
    else acc.push(rel)
  }
  return acc
}

/**
 * As migrations, e o invariante que a contagem sozinha não enxerga.
 *
 * ## Nunca comparar contagem com o maior prefixo
 *
 * São 69 arquivos indo de `0001` a `0070`: o `0049` foi removido. Quem
 * comparar `ls | wc -l` com o maior número diverge de 1 para sempre, e a
 * "correção" natural é escrever o número errado.
 *
 *     maior - menor + 1 - buracos.length === arquivos
 *
 * O invariante pega três acidentes que a contagem crua não pega: buraco novo
 * não declarado (e o erro NOMEIA qual), prefixo duplicado (dois `0071_*.sql`,
 * perigo real de deploy e invisível numa contagem), e documento afirmando "a
 * maior é 0069" depois que a 0070 entrou.
 */
async function migrations() {
  const arquivos = (await readdir(join(RAIZ, 'supabase/migrations'))).filter((f) =>
    f.endsWith('.sql'),
  )
  const numeros = arquivos
    .map((f) => f.match(/^(\d{4})_/)?.[1])
    .filter(Boolean)
    .map(Number)
    .sort((a, b) => a - b)

  const menor = numeros[0]
  const maior = numeros[numeros.length - 1]

  const buracos = []
  for (let n = menor; n <= maior; n += 1) {
    if (!numeros.includes(n)) buracos.push(String(n).padStart(4, '0'))
  }

  const duplicados = numeros.filter((n, i) => numeros.indexOf(n) !== i)

  return {
    'migrations.arquivos': arquivos.length,
    'migrations.menor': String(menor).padStart(4, '0'),
    'migrations.maior': String(maior).padStart(4, '0'),
    'migrations.buracos': buracos,
    'migrations.duplicados': duplicados.map((n) => String(n).padStart(4, '0')),
  }
}

/**
 * O grafo do graphify.
 *
 * ## A chave é `links`, não `edges`
 *
 * Não existe `edges` no `graph.json`. Quem escrever `g.edges.length` recebe
 * `undefined` — e somado vira `NaN`, que não parece erro. Eu mesmo caí nisso
 * em 03/09 e cheguei a concluir "grafo sem arestas" antes de conferir.
 *
 * `nos_sem_arquivo` existe porque a descrição no `CLAUDE.md` envelheceu de
 * NATUREZA, não de número: ela falava em "oito nós de nome de PACOTE"
 * (`next`, `jspdf`) e hoje são objetos SQL e classes do Pillow. Métrica
 * nomeada obriga quem for corrigir a passar pela definição, em vez de trocar
 * um dígito e manter a explicação errada.
 */
async function grafo() {
  let bruto
  try {
    bruto = JSON.parse(await readFile(join(RAIZ, 'graphify-out/graph.json'), 'utf-8'))
  } catch {
    return {
      'grafo.nos': INDISPONIVEL,
      'grafo.arestas': INDISPONIVEL,
      'grafo.comunidades': INDISPONIVEL,
      'grafo.nos_sem_arquivo': INDISPONIVEL,
      'grafo.nos_de_claude': INDISPONIVEL,
    }
  }

  const nos = bruto.nodes ?? []
  const comunidades = new Set(nos.map((n) => n.community ?? n.group).filter((c) => c !== undefined))

  return {
    'grafo.nos': nos.length,
    'grafo.arestas': (bruto.links ?? []).length,
    'grafo.comunidades': comunidades.size,
    'grafo.nos_sem_arquivo': nos.filter((n) => !n.source_file).length,
    'grafo.nos_de_claude': nos.filter((n) => String(n.source_file ?? '').includes('.claude')).length,
  }
}

/**
 * Os arquivos de teste, contados pelo glob que o vitest de fato usa.
 *
 * ## Por que ler o config em vez de repetir o padrão
 *
 * Escrever `lib/**\/*.test.ts` aqui criaria uma SEGUNDA fonte da verdade sobre
 * o que é um arquivo de teste — a mesma doença que este script cura, um nível
 * abaixo. Se alguém acrescentar `components/**` ao `include`, a métrica
 * contaria o conjunto errado e continuaria verde.
 *
 * Lendo o config, se o padrão mudar de forma a métrica **se recusa a
 * responder** em vez de mentir com confiança.
 */
async function testes(todosOsArquivos) {
  let config
  try {
    config = await readFile(join(RAIZ, 'vitest.config.mts'), 'utf-8')
  } catch {
    return { 'testes.arquivos': INDISPONIVEL, 'testes.impressao': INDISPONIVEL }
  }

  // Só o formato que o config usa hoje: `include: ['lib/**/*.test.ts']`. Outro
  // formato cai no INDISPONIVEL, que é o comportamento desejado.
  const achado = config.match(/include:\s*\[\s*'([^']+)'\s*\]/)
  if (!achado) return { 'testes.arquivos': INDISPONIVEL, 'testes.impressao': INDISPONIVEL }

  const pasta = achado[1].split('/')[0]
  const arquivos = todosOsArquivos
    .filter((f) => f.startsWith(`${pasta}/`) && f.endsWith('.test.ts'))
    .sort()

  // ## A sentinela, e por que ela é do CONTEÚDO e não da contagem
  //
  // `testes.casos` (1.013) não tem atalho: exige rodar o vitest, 8,4s. Contar
  // `it(` estaticamente dá 860, 15% abaixo, por causa dos `.each`.
  //
  // Então o número fica carimbado no documento com uma sentinela: a impressão
  // digital do conjunto de arquivos de teste. Ela se move quando um teste é
  // acrescentado, removido OU editado — inclusive um caso novo dentro de
  // arquivo existente, que uma sentinela de contagem deixaria passar.
  //
  // A validade se amarra ao REPOSITÓRIO, não ao calendário: prazo em dias
  // criaria uma bomba-relógio estourando num commit sem relação nenhuma, e o
  // remédio para alarme fora de hora é o hábito de ignorá-lo.
  const hash = createHash('sha1')
  for (const f of arquivos) {
    hash.update(f)
    hash.update(await readFile(join(RAIZ, f), 'utf-8'))
  }

  return {
    'testes.arquivos': arquivos.length,
    'testes.impressao': hash.digest('hex').slice(0, 12),
  }
}

/**
 * `deal_stage`, com a definição no nome da métrica.
 *
 * O PRD diz 22 arquivos, `capacidades.md` diz 19, e a contagem real de código
 * dá 9. Não são três erros de contagem: são três definições implícitas
 * diferentes — com documentos, com o `.svg` do diagrama, e só código.
 *
 * O nome carrega a definição para o próximo leitor não repetir a divergência.
 */
function dealStage(todosOsArquivos) {
  const CODIGO = /\.(ts|tsx|mjs|js|sql|py|ps1)$/
  return todosOsArquivos.filter(
    (f) =>
      CODIGO.test(f) &&
      !f.startsWith('docs/') &&
      // ## O medidor não se conta
      //
      // Este arquivo cita `deal_stage` no comentário e no nome da métrica, e
      // na primeira execução apareceu no próprio resultado: 10 em vez de 9.
      //
      // Medição que inclui o medidor é instável — editar um comentário aqui
      // mudaria o número lá, e a "correção" seria recarimbar o documento por
      // causa de uma vírgula. `scripts/ci/` são os conferidores, não
      // consumidores do enum.
      !f.startsWith('scripts/ci/'),
  )
}

/** Roda tudo e devolve o registro inteiro. Sem rede, sem banco. */
export async function medirTudo() {
  const todosOsArquivos = await listarArquivos()

  const comDealStage = []
  for (const f of dealStage(todosOsArquivos)) {
    const txt = await readFile(join(RAIZ, f), 'utf-8').catch(() => '')
    if (txt.includes('deal_stage')) comDealStage.push(f)
  }

  const e2e = todosOsArquivos.filter(
    (f) => f.startsWith('tests/e2e/') && f.endsWith('.spec.ts'),
  )
  const docs = todosOsArquivos.filter(
    (f) => (f.startsWith('docs/') && f.endsWith('.md')) || f === 'CLAUDE.md',
  )

  return {
    ...(await migrations()),
    ...(await grafo()),
    ...(await testes(todosOsArquivos)),
    'e2e.specs': e2e.length,
    'deal_stage.arquivos_de_codigo': comDealStage.length,
    'docs.arquivos': docs.length,
  }
}

/** De onde cada número sai, para quem for reconferir à mão. */
export const DEFINICOES = {
  'migrations.arquivos': 'arquivos .sql em supabase/migrations/',
  'migrations.menor': 'menor prefixo de 4 dígitos',
  'migrations.maior': 'maior prefixo de 4 dígitos',
  'migrations.buracos': 'números ausentes entre o menor e o maior',
  'migrations.duplicados': 'prefixos repetidos — perigo de deploy',
  'grafo.nos': 'graph.json .nodes',
  'grafo.arestas': 'graph.json .links (NÃO existe .edges)',
  'grafo.comunidades': 'valores distintos de .community',
  'grafo.nos_sem_arquivo': 'nós sem source_file — objetos SQL e símbolos externos',
  'grafo.nos_de_claude': 'nós cujo source_file cita .claude/',
  'testes.arquivos': 'arquivos *.test.ts sob o include do vitest.config.mts',
  'testes.impressao': 'sha1 do nome+conteúdo dos arquivos de teste — sentinela de testes.casos',
  'e2e.specs': 'tests/e2e/*.spec.ts',
  'deal_stage.arquivos_de_codigo': 'arquivos de código (não-docs) que citam deal_stage',
  'docs.arquivos': 'docs/**/*.md mais CLAUDE.md',
}

const chamadoDiretamente =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))

if (chamadoDiretamente) {
  const medidas = await medirTudo()
  const largura = Math.max(...Object.keys(medidas).map((k) => k.length))

  console.log(`\nCONTAGENS DO REPOSITORIO\n${'='.repeat(72)}`)
  for (const [chave, valor] of Object.entries(medidas)) {
    const mostrado =
      valor === INDISPONIVEL
        ? 'INDISPONIVEL'
        : Array.isArray(valor)
          ? valor.length
            ? valor.join(', ')
            : '(nenhum)'
          : String(valor)
    console.log(`  ${chave.padEnd(largura)}  ${mostrado}`)
    console.log(`  ${' '.repeat(largura)}  ${DEFINICOES[chave] ?? ''}`)
  }

  // O invariante das migrations, explicado na saída em vez de escondido.
  const m = medidas
  const soma =
    Number(m['migrations.maior']) -
    Number(m['migrations.menor']) +
    1 -
    m['migrations.buracos'].length
  console.log(`\n${'='.repeat(72)}`)
  console.log(
    `invariante: ${Number(m['migrations.maior'])} - ${Number(m['migrations.menor'])} + 1 - ` +
      `${m['migrations.buracos'].length} buraco(s) = ${soma}  ` +
      `${soma === m['migrations.arquivos'] ? '== arquivos, OK' : `!= ${m['migrations.arquivos']}, DIVERGE`}`,
  )
  for (const [n, motivo] of BURACOS_COM_REGISTRO) {
    console.log(`  buraco ${n} declarado: ${motivo}`)
  }

  const semFonte = Object.entries(medidas).filter(([, v]) => v === INDISPONIVEL)
  if (semFonte.length) {
    console.log(`\n${semFonte.length} metrica(s) sem fonte nesta maquina:`)
    for (const [k] of semFonte) console.log(`   ${k}`)
  }
  console.log()
}
