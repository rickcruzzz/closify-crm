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
 * ## O que este script pega
 *
 * Pega **arquivo citado que não existe**, **link markdown quebrado** e, desde
 * 04/09, **contagem carimbada que divergiu** — ver `contagens.mjs`.
 *
 * Até 04/09 esta seção dizia que afirmação em prosa não tinha atalho. Naquele
 * dia a lacuna cobrou: 20 afirmações erradas em 6 documentos, com este script
 * passando limpo sobre os arquivos que continham os erros. O carimbo é o
 * atalho que não existia — não confere prosa qualquer, confere a prosa que
 * alguém marcou como conferível.
 *
 * ## A lista de REMOVIDOS não é uma exceção para silenciar o alarme
 *
 * Um arquivo entra nela quando foi removido de propósito E o documento
 * registra a remoção com data e motivo. Sem esse registro, o alarme deve
 * continuar tocando — é exatamente ele que faltou entre 28/08 e 03/09.
 */
import { readdir, readFile, stat } from 'node:fs/promises'
import { medirTudo, INDISPONIVEL } from './contagens.mjs'
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
    'lib/mock-data.ts',
    'tres empresas ficticias de uma versao que nao existe mais, apagado em 23/09 — `docs/diagnostico.md` o listava como codigo morto desde 25/08 e ninguem removeu; zero importadores conferidos antes de apagar',
  ],
  [
    'components/onboarding/tour.tsx',
    'tour em Dialog central de cinco passos, removido em 17/09 — descrevia telas em vez de abri-las, e foi substituido pelo guia interativo em components/onboarding/guia-interativo.tsx, que destaca o elemento real e so avanca quando a acao acontece',
  ],
  [
    'lib/inteligencia-de-mercado/actions.ts',
    'pesquisa de mercado do lado do cliente, removida em 08/09 (0075) — nunca teve uma linha, e carregava suboperador fora do Brasil na politica',
  ],
  [
    'lib/inteligencia-de-mercado/queries.ts',
    'pesquisa de mercado do lado do cliente, removida em 08/09 (0075) — nunca teve uma linha, e carregava suboperador fora do Brasil na politica',
  ],
  [
    'lib/inteligencia-de-mercado/servico.ts',
    'pesquisa de mercado do lado do cliente, removida em 08/09 (0075) — nunca teve uma linha, e carregava suboperador fora do Brasil na politica',
  ],
  [
    'lib/inteligencia-de-mercado/exa/cliente.ts',
    'pesquisa de mercado do lado do cliente, removida em 08/09 (0075) — nunca teve uma linha, e carregava suboperador fora do Brasil na politica',
  ],
  [
    'components/leads/sinais-de-mercado.tsx',
    'pesquisa de mercado do lado do cliente, removida em 08/09 (0075) — nunca teve uma linha, e carregava suboperador fora do Brasil na politica',
  ],
  [
    'app/api/cron/enriquecer-leads/route.ts',
    'pesquisa de mercado do lado do cliente, removida em 08/09 (0075) — nunca teve uma linha, e carregava suboperador fora do Brasil na politica',
  ],
  [
    'dominio/orcamento.ts',
    'pesquisa de mercado do lado do cliente, removida em 08/09 (0075) — nunca teve uma linha, e carregava suboperador fora do Brasil na politica',
  ],
  [
    'components/settings/evolution-connect-dialog.tsx',
    'ponte do WhatsApp, removida em 28/08 (c52a718) — ver historico-agosto.md',
  ],
  [
    'lib/emails/whatsapp-desconectado.ts',
    'ponte do WhatsApp, removida em 28/08 (c52a718) — ver historico-agosto.md',
  ],
  [
    'scripts/diagnostico/vigiar-sessao-whatsapp.mjs',
    'ponte do WhatsApp, removida em 28/08 (c52a718) — ver historico-agosto.md',
  ],
  [
    'components/landing/kanban-preview.tsx',
    'mock órfão, removido em 4354fd7 quando o print real substituiu a ilustração — ver historico-agosto.md',
  ],
])

/**
 * O texto que precisa aparecer no documento para a remoção contar como
 * registrada. Sem ele, os itens acima voltam a ser problema.
 */
const MARCA_DE_REGISTRO = 'A ponte do WhatsApp SAIU do produto em 28/08'

/**
 * A marca que declara um documento como PROPOSTA.
 *
 * ## Por que uma terceira escotilha, e por que ela é do DOCUMENTO
 *
 * As duas de cima listam CAMINHOS: arquivo removido, arquivo de fora. Elas não
 * cobrem o caso de um documento de arquitetura, que cita por definição arquivos
 * que ainda não existem — é a função dele.
 *
 * `docs/whatsapp-arquitetura-elite.md` citava treze, e as treze viraram
 * "citado e não existe". Listá-las em `REMOVIDOS_COM_REGISTRO` seria mentira
 * (nada foi removido), e o documento seguinte citaria outras treze.
 *
 * Então a declaração é do documento, não do caminho: quem escreve uma proposta
 * escreve a marca no topo, e assume que aquilo é plano e não estado.
 *
 * **E o alarme não fica mudo.** As citações puladas são CONTADAS e impressas
 * no fim — o que muda é a classificação, não o silêncio. Um documento que se
 * declara proposta e descreve o que já existe continua aparecendo no relatório,
 * com o número na cara.
 */
const MARCA_DE_PROPOSTA = 'Este documento é uma PROPOSTA'

/**
 * Arquivos citados que NÃO são deste repositório, e por isso nunca existirão aqui.
 *
 * Mesma regra de `REMOVIDOS_COM_REGISTRO`: cada entrada diz de onde o arquivo é.
 * Sem o motivo escrito, é só o alarme sendo calado.
 */
const EXTERNOS_CONHECIDOS = new Map([
  ['webpack-runtime.js', 'interno do Next, em .next/ — citado ao explicar o MODULE_NOT_FOUND'],
  ['polyfill-module.js', 'interno do Next, em node_modules/next/dist/build/polyfills/'],
  ['email-decode.min.js', 'injetado pelo Cloudflare (Scrape Shield), nunca esteve no repo'],
  ['GRAPH_REPORT.md', 'gerado pelo graphify em graphify-out/, que está no .gitignore'],
  ['graph.html', 'idem, gerado em graphify-out/'],
  ['graph.json', 'idem, gerado em graphify-out/'],
  ['graphify-out/graph.json', 'gerado, e graphify-out/ esta no .gitignore — nao existe em clone novo'],
  ['graphify-out/GRAPH_REPORT.md', 'idem'],
  ['graphify-out/graph.html', 'idem'],
  // Estado de trabalho de UMA maquina, sempre no .gitignore: nascem quando o
  // dono usa a tela, e nao existem em clone novo. Citados pelos documentos
  // porque decidir onde o estado mora e justamente a decisao registrada.
  ['.dono-prospeccao.json', 'estado da prateleira (lib/dono/prateleira-estado.ts), no .gitignore'],
  ['.dono-silenciados.json', 'alertas silenciados (lib/dono/silenciados.ts), no .gitignore'],
  ['.dono-registro.jsonl', 'diario da Central (lib/dono/diario.ts), no .gitignore'],
  ['.rodadas.json', 'checkpoint das rodadas de prospeccao (prospectar.mjs --diario), no .gitignore'],
])

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
    // `.github` entra apesar do ponto: e onde o workflow de CI mora, e sem
    // isto ele era "citado e nao existe" para sempre — um falso positivo que
    // so apareceu em 04/09, quando `.yml` entrou nas extensoes conferidas.
    const OCULTOS_QUE_CONTAM = new Set(['.github'])
    if (IGNORAR.has(item.name)) continue
    if (item.name.startsWith('.') && !OCULTOS_QUE_CONTAM.has(item.name)) continue
    const rel = dir ? `${dir}/${item.name}` : item.name
    if (item.isDirectory()) await listarArquivos(rel, acc)
    else acc.push(rel)
  }
  return acc
}

// `.yml` entrou em 04/09: sem ele, `deploy-com-auditoria.yml` nunca era
// conferido, e o `testes.md` afirmou por 16 dias que o arquivo não estava no
// repositório enquanto o `git ls-files` dizia o contrário.
const EXT = '(?:ts|tsx|mts|mjs|js|py|sql|json|md|css|yml|yaml|ps1|sh)'
const CITACAO = new RegExp('`([a-zA-Z0-9_./()\\[\\]@-]+\\.' + EXT + ')`', 'g')
const LINK = /\[[^\]]+\]\(([^)h][^)]*\.md[^)]*)\)/g

const arquivosDoRepo = await listarArquivos()

// Recursivo desde 04/09: `docs/load-test/plano-de-teste.md` ficava de fora, e
// nada avisava que ele não estava sendo conferido.
const docs = [
  ...arquivosDoRepo.filter((f) => f.startsWith('docs/') && f.endsWith('.md')),
  'CLAUDE.md',
]

/**
 * O carimbo de contagem, e por que ele é conferido NOS DOIS SENTIDOS.
 *
 *     <!-- contagem: grafo.nos>=4000 migrations.arquivos=69 -->
 *
 * Conferir só o carimbo contra a realidade deixaria um buraco do tamanho do
 * problema: alguém edita o número na FRASE, esquece o comentário, e este script
 * aprova um comentário verdadeiro acima de uma frase mentirosa. Marcador
 * invisível que só se confere a si mesmo reproduz a doença que ele cura.
 *
 * Por isso são duas verificações: a métrica bate com o carimbo, E o valor do
 * carimbo aparece na prosa logo abaixo — aceitando `4279` e `4.279`, porque o
 * texto usa separador de milhar e o número não.
 *
 * ## `>=` existe porque nem toda contagem deve ser exata
 *
 * O grafo é reconstruído a cada commit: qualquer arquivo novo move a contagem,
 * e um valor exato estaria errado no commit seguinte — o alarme viraria ruído
 * diário, e alarme que se ignora é o que criou este problema. O piso só falha
 * quando o número ENCOLHE, que é o acidente que importa.
 *
 * Migration continua exata de propósito: quando uma entra, o PRD e o schema
 * DEVEM ser reconsiderados. Ali a fricção é o ponto.
 */
// ## `[\s\S]` e nao `[^>]`, e o controle negativo achou isso
//
// A primeira versao usava `([^>]+?)` — e o operador de piso, `>=`, TEM um
// `>`. Nenhum carimbo com piso era lido, e nada avisava: o script contava
// so os carimbos exatos e imprimia verde. Foi o controle negativo 1 que
// pegou, e e a mesma familia do defeito que ele existe para curar —
// conferidor que passa limpo sobre o que nao conseguiu ler.
const CARIMBO = /<!--\s*contagem:([\s\S]*?)-->/g

/** Quantas linhas depois do carimbo a prosa ainda conta como "logo abaixo". */
const ALCANCE_DA_PROSA = 12

function comSeparador(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/**
 * As linhas que estao dentro de bloco de codigo cercado.
 *
 * Um carimbo escrito como EXEMPLO — em `estado-atual.md`, explicando o proprio
 * mecanismo — nao e uma afirmacao sobre o repositorio. Sem esta distincao, o
 * documento que descreve o conferidor faz o conferidor reprovar, e o unico
 * conserto seria parar de documentar como ele funciona.
 *
 * Achado pelo proprio mecanismo, no commit que o registrava.
 */
function linhasDentroDeCerca(linhas) {
  const dentro = new Set()
  let aberto = false
  linhas.forEach((linha, i) => {
    if (/^\s*```/.test(linha)) {
      aberto = !aberto
      dentro.add(i)
      return
    }
    if (aberto) dentro.add(i)
  })
  return dentro
}

function conferirCarimbos(doc, txt, medidas) {
  const achados = []
  const linhas = txt.split('\n')
  const emCerca = linhasDentroDeCerca(linhas)

  for (const m of txt.matchAll(CARIMBO)) {
    const linhaDoCarimbo = txt.slice(0, m.index).split('\n').length - 1
    // Markdown tem DUAS formas de bloco de codigo, e a segunda quase escapou:
    // cerca de crases, e indentacao de quatro espacos. O exemplo que este
    // proprio documento usa para explicar o mecanismo e do segundo tipo.
    const indentado = /^ {4,}/.test(linhas[linhaDoCarimbo] ?? '')
    if (emCerca.has(linhaDoCarimbo) || indentado) continue
    const prosa = linhas.slice(linhaDoCarimbo + 1, linhaDoCarimbo + 1 + ALCANCE_DA_PROSA).join('\n')

    for (const par of m[1].trim().split(/\s+/).filter(Boolean)) {
      // `[a-z0-9_.]` e nao `[a-z_.]`: `e2e.specs` tem um digito no meio, e a
      // primeira versao o chamava de "carimbo ilegivel". Achado pelo proprio
      // conferidor, dois minutos depois de o regex de cima ser corrigido.
      const casado = par.match(/^([a-z0-9_.]+)(>=|=)(.+)$/)
      if (!casado) {
        achados.push(`carimbo ilegível: ${par}`)
        continue
      }
      const [, chave, operador, esperadoBruto] = casado

      if (!(chave in medidas)) {
        achados.push(`carimbo cita métrica que não existe: ${chave}`)
        continue
      }

      const real = medidas[chave]
      if (real === INDISPONIVEL) continue // a fonte não existe nesta máquina

      const esperado = Number(esperadoBruto)
      const bate = operador === '>=' ? real >= esperado : String(real) === esperadoBruto
      if (!bate) {
        achados.push(
          `${chave}: documento diz ${operador === '>=' ? '>= ' : ''}${esperadoBruto}, real ${real}`,
        )
        continue
      }

      // A segunda metade: o número tem de estar ESCRITO na prosa. Sem isto o
      // carimbo é enfeite, e o documento pode dizer outra coisa.
      const alvo = operador === '>=' ? esperadoBruto : String(real)
      if (!prosa.includes(alvo) && !prosa.includes(comSeparador(alvo))) {
        achados.push(
          `${chave}=${alvo} carimbado, mas o número não aparece nas ${ALCANCE_DA_PROSA} linhas seguintes`,
        )
      }
    }
  }
  return achados
}

const medidas = await medirTudo()

let problemas = 0
let carimbosConferidos = 0
let toleradosSemRegistro = 0
/** Citacoes puladas por virem de documento que se declara PROPOSTA. */
let propostos = 0
const textoDeTodos = (
  await Promise.all(docs.map((d) => readFile(join(RAIZ, d), 'utf-8').catch(() => '')))
).join('\n')

const removidosEstaoRegistrados = textoDeTodos.includes(MARCA_DE_REGISTRO)

console.log(`\nCONFERINDO ${docs.length} documentos\n${'='.repeat(56)}`)

for (const doc of docs) {
  const txt = await readFile(join(RAIZ, doc), 'utf-8').catch(() => '')
  const achados = []

  // Documento que se declara PROPOSTA cita o que ainda não existe por função.
  // As citações dele são contadas e reportadas, nunca caladas — ver
  // `MARCA_DE_PROPOSTA`.
  const ehProposta = txt.includes(MARCA_DE_PROPOSTA)

  if (!DOCS_HISTORICOS.has(doc)) {
    for (const m of txt.matchAll(CITACAO)) {
      const cam = m[1]
      // `.../route.ts` é abreviação de caminho, não um caminho.
      if (cam.includes('...')) continue
      // ## Caminho sem barra deixou de ser ignorado em 04/09
      //
      // A regra antiga pulava qualquer citação sem `/`, e isso escondia 39% de
      // tudo que os documentos citam — inclusive `vitest.config.ts`, que
      // `testes.md` citava havia semanas e que não existe: o arquivo é `.mts`.
      //
      // O custo é que citação de arquivo EXTERNO passa a aparecer. Elas vão
      // para `EXTERNOS_CONHECIDOS`, com o mesmo rigor de
      // `REMOVIDOS_COM_REGISTRO`: entra com o motivo escrito, ou não entra.
      if (EXTERNOS_CONHECIDOS.has(cam)) continue
      if (await existeComPrefixo(cam, arquivosDoRepo)) continue
      if (ehProposta) {
        propostos += 1
        continue
      }

      // Casa pelo caminho completo E pelo nome do arquivo: o documento cita
      // `vigiar-sessao-whatsapp.mjs` solto em alguns lugares e com o caminho
      // inteiro em outros, e a remocao e a mesma.
      const registro =
        REMOVIDOS_COM_REGISTRO.get(cam) ??
        [...REMOVIDOS_COM_REGISTRO].find(([k]) => k.endsWith('/' + cam))?.[1]
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

  for (const a of conferirCarimbos(doc, txt, medidas)) {
    achados.push(a)
  }
  carimbosConferidos += [...txt.matchAll(CARIMBO)].length

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
// Fora do `if`, e isso é o ponto: contar só quando já há problema tornaria a
// escotilha invisível justamente no dia em que ela estivesse escondendo algo.
if (propostos > 0) {
  console.log(
    `${propostos} citação(ões) vieram de documento declarado PROPOSTA — arquivos a CONSTRUIR.`,
  )
  console.log('Contadas, nao caladas: proposta que descreve o que ja existe aparece aqui.')
  console.log('')
}

if (problemas === 0) {
  // ## Verde que nao diz o que conferiu e o verde que criou este problema
  //
  // Ate 04/09 esta linha imprimia "documentos batem com o codigo" e mais nada
  // — e imprimiu isso sobre arquivos com 20 afirmacoes erradas dentro. Dizer o
  // que foi conferido, com o valor, e o que separa "conferi e bate" de
  // "nao conferi".
  console.log(`documentos batem com o codigo  (${carimbosConferidos} carimbo(s) de contagem)`)

  const semFonte = Object.entries(medidas).filter(([, v]) => v === INDISPONIVEL)
  if (semFonte.length) {
    console.log(`
ATENCAO: ${semFonte.length} metrica(s) sem fonte nesta maquina.`)
    console.log('Elas NAO foram conferidas — ausencia nao e zero:')
    for (const [k] of semFonte) console.log(`   ${k}`)
  }
  if (REMOVIDOS_COM_REGISTRO.size > 0) {
    console.log(`\n${REMOVIDOS_COM_REGISTRO.size} arquivos citados foram REMOVIDOS de proposito,`)
    console.log('e a remocao esta registrada:')
    for (const [k, v] of REMOVIDOS_COM_REGISTRO) console.log(`   ${k}\n     ${v}`)
  }
} else {
  console.log(`${problemas} problema(s)`)
  if (propostos > 0) {
    console.log(
      `
${propostos} citação(ões) de documento declarado PROPOSTA — arquivos a construir, não estado.`,
    )
    console.log('   Contadas e não caladas: proposta que descreve o que já existe aparece aqui.')
  }

  if (toleradosSemRegistro > 0) {
    console.log('\nATENCAO: a nota que explicava a remocao saiu do documento.')
    console.log('Sem ela, quem ler as secoes antigas conclui que o codigo existe.')
  }
}

process.exit(problemas > 0 ? 1 : 0)
