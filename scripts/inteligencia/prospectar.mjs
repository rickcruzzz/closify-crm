/**
 * Prospecção do Velo Funil: acha PME brasileira do ICP e grava como lead no
 * SEU workspace.
 *
 * Uso INTERNO, rodado à mão. Não é recurso do produto, não roda em conta de
 * cliente, não tem cron. É o dono usando o Exa para achar quem paga — e
 * trabalhando a lista dentro do próprio Velo Funil.
 *
 *   node --env-file=.env.local scripts/inteligencia/prospectar.mjs --ensaio
 *   node --env-file=.env.local scripts/inteligencia/prospectar.mjs --confirmar
 *   node --env-file=.env.local scripts/inteligencia/prospectar.mjs --confirmar \
 *        --vertical=clinica --por-vertical=15
 *
 * Sem `--confirmar` ele NÃO grava nada: busca, pontua e imprime. Modo de ensaio
 * por padrão é o mesmo desenho de `publicar-instagram.mjs` — o comando que
 * gasta e o comando que mostra não podem ser o mesmo por acidente.
 *
 * ## O método, medido contra a API real em 06/09/2026
 *
 * 1. SEMENTE     `search` com `category: 'company'` por vertical. Devolve
 *                página de empresa, não blog nem agregador.
 * 2. EXPANSÃO    `findSimilar` em cada semente boa. Dado UM cliente ideal,
 *                devolve dez parecidos por US$ 0,007. É a primitiva que
 *                multiplica: 5 sementes viram 50 prospects.
 * 3. CONTATO     `contents` com `extras.links` E texto. As duas fontes, porque
 *                nenhuma sozinha basta — o `wa.me` só existe no link, o
 *                telefone do rodapé só existe no texto.
 * 4. FILTRO      exclusão de agregador e concorrente, pontuação, dedupe.
 */


import { mkdir, readFile, writeFile } from 'node:fs/promises'

const CHAVE = process.env.EXA_API_KEY
const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!CHAVE) {
  console.error('Falta EXA_API_KEY. Rode com: node --env-file=.env.local')
  process.exit(1)
}

const args = process.argv.slice(2)
const confirmar = args.includes('--confirmar')
const verticalPedido = args.find((a) => a.startsWith('--vertical='))?.split('=')[1] ?? null
const porVertical = Number(args.find((a) => a.startsWith('--por-vertical='))?.split('=')[1] ?? 10)
const tetoDeBusca = Number(args.find((a) => a.startsWith('--teto='))?.split('=')[1] ?? 40)
/**
 * As pracas. Medido em 06/09: a MESMA consulta com cidade diferente devolve
 * conjunto quase disjunto — o Exa ancora forte no lugar. Multiplicar por cidade
 * e o jeito mais barato de crescer o universo, porque cada praca custa uma
 * chamada e nao repete o que a anterior trouxe.
 *
 * Vazio (o padrao) roda a consulta nacional, sem cidade.
 */
const cidadesPedidas = (args.find((a) => a.startsWith('--cidades='))?.split('=')[1] ?? '')
  .split(',').map((c) => c.trim()).filter(Boolean)
const comMensagem = args.includes('--mensagem')
/**
 * Quantos prospects do TOPO recebem busca de decisor.
 *
 * Uma chamada por prospect, US$ 0,0196 cada — caro para rodar em noventa,
 * barato para os dez que voce vai ligar hoje. Zero (o padrao) nao busca ninguem.
 */
const quantosDecisores = Number(args.find((a) => a.startsWith('--decisores='))?.split('=')[1] ?? 0)
/** Nome (ou parte do nome) da empresa que recebe os leads. Ver `escolherWorkspace`. */
const workspacePedido = args.find((a) => a.startsWith('--workspace='))?.split('=')[1] ?? null
/** Quantas praças, da lista `PRACAS` (as maiores primeiro). 0 = uma passagem nacional. */
const quantasPracas = Number(args.find((a) => a.startsWith('--pracas='))?.split('=')[1] ?? 0)
/** Quantos prospects do topo viram lead. O resto fica no universo. */
const topo = Number(args.find((a) => a.startsWith('--topo='))?.split('=')[1] ?? 60)
/** Grava TODO domínio qualificado em CSV, inclusive quem não vira lead. */
const comUniverso = args.includes('--universo')
/** Rotaciona nicho e praça a cada dia, sem repetir o recorte de ontem. */
const modoDiario = args.includes('--diario')

/**
 * Quem pediu para não ser procurado de novo.
 *
 * A promessa sai na PRIMEIRA mensagem — *"me avisa que não te procuro de novo"*
 * — e sem este arquivo sendo lido aqui ela seria mentira: a próxima rodada
 * traria a mesma empresa, com o mesmo texto, e a segunda abordagem depois de um
 * "não" é o que vira denúncia de spam.
 *
 * Arquivo em texto e versionado de propósito: quem responde "não" responde no
 * WhatsApp do dono, e ele acrescenta uma linha. Tabela no banco exigiria uma
 * tela para alimentar, e tela que ninguém abre não é registro.
 */
async function lerNaoPerturbe() {
  try {
    const bruto = await readFile('scripts/inteligencia/nao-perturbe.txt', 'utf8')
    return new Set(
      bruto.split(/\r?\n/).map((l) => l.trim().toLowerCase())
        .filter((l) => l && !l.startsWith('#')),
    )
  } catch {
    return new Set()
  }
}
const naoPerturbe = await lerNaoPerturbe()

// O domínio puro é TypeScript e este script é `.mjs`; em vez de duplicar a
// regra, lê o módulo compilado sob demanda. Duas cópias divergem, e a que
// diverge em silêncio é a que ninguém está olhando.
const dominio = await import('../../lib/inteligencia-de-mercado/dominio/prospeccao.ts')
const aprendizado = await import('../../lib/inteligencia-de-mercado/dominio/aprendizado.ts')
const { montarAbordagem } = await import('../../lib/inteligencia-de-mercado/dominio/abordagem.ts')
const { extrairDecisor } = await import('../../lib/inteligencia-de-mercado/dominio/decisor.ts')
const { PRO_PLAN_PRICE, FREE_LEAD_LIMIT } = await import('../../lib/plans.ts')
const {
  VERTICAIS, PRACAS, ehDominioExcluido, extrairContato, pontuarProspect,
  ordenarProspects, deduplicarPorDominio, MINIMO_PARA_LEAD,
} = dominio

let buscasFeitas = 0
let custoTotal = 0
let creditoAcabou = false

/**
 * O teto por FASE, e por que um balde só não servia.
 *
 * O teto era um número para todas as rotas juntas. Numa rodada de 5 praças, as
 * chamadas de semente sozinhas consumiam quase os 40 — e o `contents`, que é o
 * que transforma resultado em prospect com contato, nunca chegava a rodar. A
 * rodada gastava o orçamento inteiro para produzir uma lista de URLs.
 *
 * Cada fase tem o próprio balde, então estourar a semente não come o detalhe.
 */
const tetos = {
  search: tetoDeBusca,
  findSimilar: Math.ceil(tetoDeBusca / 2),
  contents: tetoDeBusca,
}
const gastas = { search: 0, findSimilar: 0, contents: 0 }

class TetoDaFase extends Error {}
class CreditoAcabou extends Error {}

async function exa(rota, corpo) {
  const fase = rota === 'findSimilar' ? 'findSimilar' : rota === 'contents' ? 'contents' : 'search'
  if (gastas[fase] >= tetos[fase]) {
    throw new TetoDaFase(`teto de ${tetos[fase]} chamadas de ${fase} atingido`)
  }
  gastas[fase] += 1
  buscasFeitas += 1

  const r = await fetch(`https://api.exa.ai/${rota}`, {
    method: 'POST',
    headers: { 'x-api-key': CHAVE, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  })
  const j = await r.json()
  custoTotal += Number(j?.costDollars?.total ?? 0) || 0

  // 401 e 402 são a mesma coisa para quem chama: acabou o que dava para gastar.
  // Sinalizar em vez de estourar é o que permite a rodada PARAR com relatório e
  // gravar o que já colheu — perder a colheita porque o crédito acabou no meio
  // seria pagar duas vezes pelo mesmo trabalho.
  if (r.status === 401 || r.status === 402) {
    creditoAcabou = true
    throw new CreditoAcabou(`Exa recusou (${r.status}): credito ou chave`)
  }
  if (!r.ok) throw new Error(`Exa ${rota} -> ${r.status}: ${JSON.stringify(j).slice(0, 200)}`)
  return j
}

const host = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return null
  }
}

/**
 * A semente NÃO manda `excludeDomains`, e isso é medido.
 *
 * Combinar `category: 'company'` com a lista de exclusão derruba o resultado a
 * quase nada. Isolado em 06/09/2026, mesma consulta de clínica:
 *
 *     so a query                      10 resultados
 *     + category=company              10
 *     + excludeDomains (54 dominios)   1   <- os dois juntos
 *     sem category, com excludeDomains 10
 *
 * Cada parâmetro sozinho devolve dez; juntos, um. Mandar a lista era cinto e
 * suspensório — o filtro local (`ehDominioExcluido`) já roda sobre todo
 * candidato depois. O cinto custava 90% da colheita.
 *
 * O `findSimilar` continua mandando a lista: lá não há `category`, e a
 * combinação não aparece.
 */
async function semear(consulta, cidade = null) {
  // `numResults` ate 50 numa chamada so: medido em 06/09, 50 devolveu 43
  // resultados e 39 dominios UNICOS pelo mesmo preco de uma busca. Pedir 10 era
  // jogar fora quatro quintos da colheita.
  const j = await exa('search', {
    query: cidade ? `${consulta} em ${cidade}` : consulta,
    category: 'company',
    type: 'auto',
    numResults: Math.min(porVertical, 50),
  })
  return (j.results ?? []).map((x) => ({ url: x.url, titulo: x.title ?? null }))
}

async function expandir(url) {
  const j = await exa('findSimilar', {
    url,
    numResults: 10,
    excludeSourceDomain: true,
    excludeDomains: [...dominio.DOMINIOS_EXCLUIDOS],
  })
  return (j.results ?? []).map((x) => ({ url: x.url, titulo: x.title ?? null }))
}

/**
 * O nome de quem decide, pelo indice publico do LinkedIn.
 *
 * Nada e raspado: o Exa devolve o que ja indexou. **Automatizar acao DENTRO do
 * LinkedIn** — convite, mensagem, visita de perfil — e o que derruba conta, e
 * nada disso acontece aqui.
 *
 * `extrairDecisor` so aceita o perfil quando o nome da empresa aparece no
 * titulo. Sem casamento, `null` — porque nome errado na primeira palavra queima
 * a abordagem inteira, e e pior que nao ter nome nenhum.
 */
async function buscarDecisor(nomeDaEmpresa) {
  const j = await exa('search', {
    query: `socio proprietario ou diretor da empresa ${nomeDaEmpresa} no Brasil`,
    type: 'auto',
    numResults: 5,
    category: 'linkedin profile',
  })
  for (const r of j.results ?? []) {
    const d = extrairDecisor({ titulo: r.title ?? null, url: r.url ?? null }, nomeDaEmpresa)
    if (d) return d
  }
  return null
}

async function detalhar(urls) {
  if (urls.length === 0) return new Map()
  const j = await exa('contents', {
    urls,
    text: true,
    extras: { links: 30 },
    subpages: 2,
    subpageTarget: ['contato', 'contact', 'fale-conosco'],
    livecrawl: 'preferred',
  })
  const mapa = new Map()
  for (const x of j.results ?? []) {
    const paginas = [x, ...(x.subpages ?? [])]
    mapa.set(x.url, {
      texto: paginas.map((p) => p.text ?? '').join('\n'),
      links: paginas.flatMap((p) => p.extras?.links ?? []).map(String),
    })
  }
  return mapa
}

/**
 * Em qual empresa os leads entram — e por que "a mais antiga" era um defeito.
 *
 * A primeira versão pegava `order=created_at.asc&limit=1`. Conferido antes da
 * primeira gravação real, isso apontava para **"Agência Nova Era": plano Free,
 * `created_by` nulo, duas linhas dentro.** Duas coisas quebradas de uma vez:
 *
 *     empresa arbitraria   a mais antiga do banco nao e a que voce trabalha.
 *                          Os leads cairiam onde ninguem olha
 *     limite de plano      a trigger da 0026 recusa a partir de 50 leads, e ela
 *                          vale para o service_role tambem. Uma rodada de 400
 *                          morreria no meio com 42501, deixando parte gravada
 *
 * O `service_role` ignora RLS, **não ignora trigger** — e esse é o desenho
 * certo: limite de plano vive no banco justamente para não depender de quem
 * chama.
 *
 * Agora `--workspace=<parte do nome>` manda, e sem ele o padrão é a empresa
 * **Pro vigente** mais antiga. `pro_vigente()` e não `plan`, porque a coluna é
 * o último valor gravado e não sabe que o tempo passou.
 */
/** Quebra de linha nomeada: a nota é texto longo e legível na timeline. */
const LINHA = String.fromCharCode(10)

async function escolherWorkspace(cabecalho, quantos) {
  const r = await fetch(
    `${URL_SUPABASE}/rest/v1/workspaces?select=id,name,plan&order=created_at.asc`,
    { headers: cabecalho },
  )
  const todas = await r.json()
  if (!Array.isArray(todas) || todas.length === 0) {
    console.error('Nenhuma empresa encontrada. Nada foi gravado.')
    return null
  }

  const candidatas = workspacePedido
    ? todas.filter((w) => w.name.toLowerCase().includes(workspacePedido.toLowerCase()))
    : todas
  if (candidatas.length === 0) {
    console.error(`Nenhuma empresa com "${workspacePedido}" no nome. Nada foi gravado.`)
    return null
  }

  const vigentes = []
  for (const w of candidatas) {
    const v = await fetch(`${URL_SUPABASE}/rest/v1/rpc/pro_vigente`, {
      method: 'POST',
      headers: cabecalho,
      body: JSON.stringify({ target_workspace_id: w.id }),
    })
    if ((await v.json()) === true) vigentes.push(w)
  }

  const alvo = vigentes[0] ?? null
  if (!alvo) {
    console.error(
      'ALVO SEM PRO VIGENTE. A trigger da 0026 recusa acima de 50 contatos, e ' +
        `${quantos} leads morreriam no meio com 42501.`,
    )
    console.error(`Candidatas: ${candidatas.map((w) => w.name).join(', ')}`)
    console.error('Use --workspace=<parte do nome> de uma empresa com Pro vigente.')
    return null
  }
  return alvo
}

/**
 * A mensagem de abordagem, gravada na TIMELINE do contato.
 *
 * Sem isto, a abordagem existia só no terminal: a lista ia para o CRM e o texto
 * ficava numa rolagem que ninguém guarda. A pessoa abre o contato para ligar —
 * é ali que a primeira frase precisa estar.
 *
 * `author_id` fica NULO de propósito: a nota não foi escrita por ninguém da
 * equipe, e assinar com o nome de uma pessoa seria atribuir a ela um texto que
 * ela nunca leu. É também o que permite reconhecer, depois, o que veio da
 * máquina.
 *
 * Chamada nos DOIS caminhos — lead novo e lead que já existia sem nota. O
 * segundo é o que conserta as 237 linhas escritas antes desta função existir:
 * elas foram gravadas e ficaram mudas, e uma lista sem a primeira frase é
 * metade do trabalho.
 */
async function anotarAbordagem(cabecalho, ws, p, leadId) {
  // Não duplica: rodar de novo não deve encher a timeline de cópias.
  const jaTem = await fetch(
    `${URL_SUPABASE}/rest/v1/activities?select=id&lead_id=eq.${leadId}&author_id=is.null&limit=1`,
    { headers: cabecalho },
  )
  if ((await jaTem.json()).length > 0) return false

  const texto = montarAbordagem({
    dominio: p.dominio,
    nome: p.titulo,
    vertical: p.vertical,
    motivos: p.motivos,
    precoMensal: PRO_PLAN_PRICE,
    limiteGratis: FREE_LEAD_LIMIT,
    decisor: decisores.get(p.dominio)?.nome.split(' ')[0] ?? null,
  })
  const abrir = p.contato.whatsapp
    ? `${LINHA}${LINHA}Abrir no WhatsApp com o texto pronto:${LINHA}https://wa.me/${p.contato.whatsapp}?text=${encodeURIComponent(texto)}`
    : ''

  const nota = await fetch(`${URL_SUPABASE}/rest/v1/activities`, {
    method: 'POST',
    headers: cabecalho,
    body: JSON.stringify({
      workspace_id: ws.id,
      lead_id: leadId,
      author_id: null,
      type: 'nota',
      description:
        `Prospecção automática (${p.vertical}, ${p.pontos} pontos).${LINHA}` +
        `Por quê: ${p.motivos.join(', ')}.${LINHA}${LINHA}` +
        `Sugestão de primeira mensagem:${LINHA}${texto}${abrir}`,
    }),
  })
  if (!nota.ok) {
    // Falhar a nota não derruba nada: o lead já está gravado e é o que importa.
    console.error(`  nota nao gravada em ${p.dominio}: ${(await nota.text()).slice(0, 90)}`)
    return false
  }
  return true
}

/**
 * Tudo que o CRM já tem, numa leitura só.
 *
 * Antes era uma requisição por prospect (`leads?company=eq.<dominio>`). Com 60
 * prospects isso é tolerável; com mil, são mil idas a São Paulo, e a rodada
 * passa mais tempo perguntando ao banco do que buscando na web.
 *
 * A saída NÃO é `.in()` com mil valores: o PostgREST recebe filtro por query
 * string, e este projeto já mediu onde ele quebra — 500 valores devolvem 400 e
 * 2.000 devolvem 414. Foi assim que a dedupe da importação de planilha falhou
 * em silêncio, reimportando a planilha inteira.
 *
 * O que funciona, e é o padrão que a importação passou a usar: ler a coluna
 * paginada uma vez e comparar em memória.
 */
async function lerDominiosNoCrm(cabecalho, workspaceId) {
  const PAGINA = 1000
  const mapa = new Map()
  for (let de = 0; ; de += PAGINA) {
    const r = await fetch(
      `${URL_SUPABASE}/rest/v1/leads?select=id,company&workspace_id=eq.${workspaceId}` +
        `&order=created_at.asc&offset=${de}&limit=${PAGINA}`,
      { headers: cabecalho },
    )
    if (!r.ok) {
      console.error(`  leitura da base falhou: ${(await r.text()).slice(0, 120)}`)
      break
    }
    const linhas = await r.json()
    for (const l of linhas) if (l.company) mapa.set(l.company, l.id)
    // Página incompleta é a última. Parar por `length < PAGINA` e não por um
    // total conhecido: o total exigiria outra consulta, e ele muda enquanto
    // lemos.
    if (linhas.length < PAGINA) break
  }
  return mapa
}

async function gravarComoLeads(prospects) {
  if (!URL_SUPABASE || !SERVICE_ROLE) {
    console.error('\nFaltam credenciais do Supabase. Nada foi gravado.')
    return
  }
  const cabecalho = {
    apikey: SERVICE_ROLE,
    Authorization: `Bearer ${SERVICE_ROLE}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  }

  const ws = await escolherWorkspace(cabecalho, prospects.length)
  if (!ws) return

  console.log(`\ngravando em "${ws.name}" (${ws.id.slice(0, 8)}...)`)
  const jaNoCrm = await lerDominiosNoCrm(cabecalho, ws.id)
  console.log(`a base ja tem ${jaNoCrm.size} contatos com dominio`)
  let gravados = 0
  let jaExistiam = 0
  let anotados = 0

  for (const p of prospects) {
    // Dedupe contra o mapa lido de uma vez, não uma consulta por prospect.
    // Ver `lerDominiosNoCrm` para o porquê.
    if (jaNoCrm.has(p.dominio)) {
      jaExistiam += 1
      if (await anotarAbordagem(cabecalho, ws, p, jaNoCrm.get(p.dominio))) anotados += 1
      continue
    }

    const telefone = p.contato.whatsapp ?? p.contato.telefone
    const r = await fetch(`${URL_SUPABASE}/rest/v1/leads`, {
      method: 'POST',
      headers: cabecalho,
      body: JSON.stringify({
        workspace_id: ws.id,
        // O nome do site é o que a pessoa reconhece na lista; o domínio vai em
        // `company` porque é ele que dedupe usa e é único.
        name: (p.titulo ?? p.dominio).slice(0, 120),
        company: p.dominio,
        email: p.contato.email,
        phone: telefone,
        status: 'novo',
      }),
    })
    if (r.ok) {
      gravados += 1
      // A mensagem entra na TIMELINE do contato, como nota.
      //
      // Sem isto, a abordagem existia só no terminal: a lista ia para o CRM e o
      // texto ficava numa rolagem que ninguém guarda. A pessoa abre o contato
      // para ligar — é ali que a primeira frase precisa estar, e não noutro
      // lugar que exige lembrar de rodar um script de novo.
      //
      // `author_id` fica NULO de propósito: a nota não foi escrita por ninguém
      // da equipe, e assinar com o nome de uma pessoa seria atribuir a ela um
      // texto que ela nunca leu.
      const [criado] = await r.json()
      if (criado?.id) await anotarAbordagem(cabecalho, ws, p, criado.id)
      continue
    }
    const corpo = await r.text()
    // Dois prospects com o MESMO telefone: acontece quando o dono tem dois
    // sites, e a 0025 tem `unique` por telefone normalizado dentro da empresa.
    // Isso não é falha — é a dedupe do produto funcionando, e contar como erro
    // faria a rodada parecer quebrada.
    if (corpo.includes('23505')) {
      jaExistiam += 1
      continue
    }
    console.error(`  falhou ${p.dominio}: ${corpo.slice(0, 120)}`)
  }
  console.log(
    `gravados ${gravados} | ja existiam ou repetiram telefone ${jaExistiam}` +
      (anotados > 0 ? ` | ${anotados} ganharam a nota de abordagem agora` : ''),
  )
}

// ── execução ────────────────────────────────────────────────────────────────

const verticais = verticalPedido
  ? VERTICAIS.filter((v) => v.nome === verticalPedido)
  : VERTICAIS

if (verticais.length === 0) {
  console.error(`vertical desconhecido. Use um de: ${VERTICAIS.map((v) => v.nome).join(', ')}`)
  process.exit(1)
}

/**
 * As praças desta rodada.
 *
 * `--cidades` manda quando informado. `--pracas=N` pega as N primeiras de
 * `PRACAS`, ordenada por densidade de PME — sem a ordem, um recorte pequeno
 * viria aleatório. Sem nenhum dos dois, uma passagem nacional.
 */
const cidades = cidadesPedidas.length
  ? cidadesPedidas
  : quantasPracas > 0
    ? [...PRACAS].slice(0, quantasPracas)
    : []

/**
 * O modo diário: rotaciona o recorte para não colher o mesmo de ontem.
 *
 * O checkpoint guarda quantas rodadas já aconteceram, e o índice decide o nicho
 * e a janela de praças. Sem ele, "rodar todo dia" traria o mesmo topo toda
 * manhã — o Exa é estável, e é a CONSULTA que precisa mudar.
 *
 * Arquivo fora do Git: é diário de uma máquina, não estado do projeto — a mesma
 * razão que mantém `.central-local/` fora.
 */
const CAMINHO_RODADAS = 'scripts/inteligencia/.rodadas.json'
let rodada = 0
if (modoDiario) {
  try {
    rodada = JSON.parse(await readFile(CAMINHO_RODADAS, 'utf8')).rodada ?? 0
  } catch {
    rodada = 0
  }
}

const verticaisDaRodada = modoDiario ? [verticais[rodada % verticais.length]] : verticais
const cidadesDaRodada = modoDiario
  ? // Uma janela de 5 praças que anda a cada dia: girando, a lista inteira é
    // varrida a cada cinco rodadas do mesmo nicho.
    [...PRACAS, ...PRACAS].slice(
      (Math.floor(rodada / verticais.length) * 5) % PRACAS.length,
      ((Math.floor(rodada / verticais.length) * 5) % PRACAS.length) + 5,
    )
  : cidades

console.log(`modo: ${confirmar ? 'CONFIRMAR (grava leads)' : 'ENSAIO (nao grava nada)'}`)
if (modoDiario) console.log(`diario: rodada #${rodada}`)
console.log(
  `verticais: ${verticaisDaRodada.map((v) => v.nome).join(', ')} | ` +
    `${porVertical} por consulta | pracas: ${cidadesDaRodada.length || 'nacional'} | ` +
    `teto por fase: search ${tetos.search}, similar ${tetos.findSimilar}, contents ${tetos.contents}`,
)
console.log('')

const candidatos = []
try {
  for (const v of verticaisDaRodada) {
    const pracas = cidadesDaRodada.length ? cidadesDaRodada : [null]
    const sementes = []

    // Cada VARIANTE de consulta em cada praça. As duas dimensões multiplicam
    // porque o Exa ancora nas duas: "dedetizadora em Recife" e "controle de
    // pragas em Recife" devolvem conjuntos diferentes.
    for (const cidade of pracas) {
      for (const consulta of v.consultas) {
        try {
          sementes.push(...(await semear(consulta, cidade)))
        } catch (erro) {
          // Teto de fase não derruba a rodada: para de semear e vai detalhar o
          // que já tem. Crédito acabado sobe e encerra tudo.
          if (erro instanceof CreditoAcabou) throw erro
          console.error(`  ${v.nome}/${cidade ?? 'nacional'}: ${erro.message}`)
          break
        }
      }
      if (gastas.search >= tetos.search) break
    }
    console.log(`${v.nome.padEnd(20)} semente total: ${sementes.length}`)
    for (const s of sementes) candidatos.push({ ...s, vertical: v.nome })

    // `findSimilar` PROPORCIONAL: uma expansão por praça, não duas no total.
    // Com 25 praças, duas expansões cobriam 8% do que foi semeado — e é o
    // findSimilar que acha quem não escreve para buscador.
    const quantas = Math.max(2, Math.min(pracas.length, tetos.findSimilar))
    const passo = Math.max(1, Math.floor(sementes.length / quantas))
    for (let k = 0; k < sementes.length && k / passo < quantas; k += passo) {
      try {
        const parecidos = await expandir(sementes[k].url)
        for (const q of parecidos) candidatos.push({ ...q, vertical: v.nome })
      } catch (erro) {
        if (erro instanceof CreditoAcabou) throw erro
        break
      }
    }
    console.log(`${''.padEnd(20)} apos findSimilar: ${candidatos.length} candidatos`)
  }
} catch (erro) {
  console.error(`
PAROU: ${erro.message}`)
  if (creditoAcabou) {
    console.error('O credito do Exa acabou. A rodada segue com o que ja foi colhido.')
  }
}
const unicos = []
const vistos = new Set()
for (const c of candidatos) {
  const h = host(c.url)
  if (!h || vistos.has(h) || ehDominioExcluido(c.url)) continue
  if (naoPerturbe.has(h) || naoPerturbe.has(h.replace(/^www\./, ''))) {
    console.log(`  nao perturbe: ${h} — pulado`)
    continue
  }
  vistos.add(h)
  unicos.push(c)
}
console.log(`\ncandidatos: ${candidatos.length} -> unicos e nao excluidos: ${unicos.length}`)

// `contents` em lote, 20 por chamada: uma chamada por lote em vez de uma por
// site é o que mantém o custo linear e não multiplicado.
const detalhes = new Map()
for (let i = 0; i < unicos.length; i += 20) {
  const lote = unicos.slice(i, i + 20).map((c) => c.url)
  try {
    for (const [k, v] of await detalhar(lote)) detalhes.set(k, v)
  } catch (erro) {
    console.error(`  contents falhou no lote ${i / 20 + 1}: ${erro.message.slice(0, 100)}`)
  }
}

const pontuados = deduplicarPorDominio(
  ordenarProspects(
    unicos
      .map((c) => {
        const d = detalhes.get(c.url) ?? { texto: '', links: [] }
        return pontuarProspect({
          url: c.url,
          titulo: c.titulo,
          vertical: c.vertical,
          contato: extrairContato(d),
          texto: d.texto,
        })
      })
      .filter((p) => p.qualificado),
  ),
)


// Só o topo: uma chamada por prospect. Rodar em noventa custaria US$ 1,76 para
// nomear gente que ninguém vai ligar hoje.
const decisores = new Map()
if (quantosDecisores > 0) {
  console.log(`\nbuscando decisor dos ${Math.min(quantosDecisores, pontuados.length)} primeiros...`)
  for (const p of pontuados.slice(0, quantosDecisores)) {
    try {
      const d = await buscarDecisor(p.titulo ?? p.dominio)
      if (d) {
        decisores.set(p.dominio, d)
        console.log(`  ${p.dominio.padEnd(34)} ${d.nome} (${d.cargo})`)
      } else {
        console.log(`  ${p.dominio.padEnd(34)} nao casou — segue sem nome`)
      }
    } catch (erro) {
      console.error(`  ${p.dominio}: ${erro.message.slice(0, 60)}`)
    }
  }
}
console.log(`\n${'='.repeat(78)}`)
console.log(`${pontuados.length} PROSPECTS, melhores primeiro`)
console.log('='.repeat(78))
for (const p of pontuados) {
  const c = p.contato
  const canal = c.whatsapp
    ? `wa.me/${c.whatsapp}`
    : (c.telefone ?? c.email ?? '(abrir o site)')
  console.log(`\n[${String(p.pontos).padStart(2)}] ${p.dominio}  (${p.vertical})`)
  console.log(`     ${String(p.titulo ?? '').slice(0, 68)}`)
  console.log(`     contato: ${canal}`)
  if (c.email && c.whatsapp) console.log(`     e-mail:  ${c.email}`)
  console.log(`     porque:  ${p.motivos.join(', ')}`)
  const decisor = decisores.get(p.dominio)
  if (decisor) console.log(`     decisor: ${decisor.nome} — ${decisor.cargo}  ${decisor.perfilUrl}`)
  if (comMensagem) {
    const texto = montarAbordagem({
      dominio: p.dominio, nome: p.titulo, vertical: p.vertical, motivos: p.motivos,
      precoMensal: PRO_PLAN_PRICE, limiteGratis: FREE_LEAD_LIMIT,
      decisor: decisor ? decisor.nome.split(' ')[0] : null,
    })
    console.log(texto.split('\n').map((l) => (l ? `     | ${l}` : '     |')).join('\n'))
    if (c.whatsapp) console.log(`     abrir:   https://wa.me/${c.whatsapp}?text=${encodeURIComponent(texto)}`)
  }
}

const comContato = pontuados.filter((p) => p.contato.whatsapp || p.contato.telefone || p.contato.email)
console.log(`\n${'='.repeat(78)}`)
console.log(`chamadas ao Exa: ${buscasFeitas} | custo US$ ${custoTotal.toFixed(4)}`)
console.log(`com contato extraido: ${comContato.length} de ${pontuados.length}`)

/**
 * Quem vira lead: acima do piso **e** com canal de contato.
 *
 * O segundo filtro nasceu da primeira gravação real: três prospects tomaram
 * `23514` de `leads_contato_minimo`, o `check` da 0025 que exige e-mail OU
 * telefone. Eles tinham pontos por domínio, Instagram e sinais de propensão —
 * e nenhum jeito de falar com eles.
 *
 * Espelhar a regra do banco aqui não é duplicá-la: o banco continua sendo a
 * autoridade e recusaria de todo jeito. O que muda é a rodada parar de tentar
 * o que o schema proíbe, e a contagem final dizer a verdade sobre o que entrou.
 *
 * Os descartados não somem: aparecem na lista impressa com "(abrir o site)",
 * que é exatamente o que se faz com eles.
 */
const qualificados = pontuados.filter(
  (p) =>
    p.pontos >= MINIMO_PARA_LEAD &&
    (p.contato.email || p.contato.whatsapp || p.contato.telefone),
)
const semCanal = pontuados.filter(
  (p) =>
    p.pontos >= MINIMO_PARA_LEAD &&
    !(p.contato.email || p.contato.whatsapp || p.contato.telefone),
)
if (semCanal.length > 0) {
  console.log(
    `${semCanal.length} acima do piso ficam de FORA: sem e-mail e sem telefone, ` +
      'e o banco recusa (leads_contato_minimo). Abra o site deles à mão.',
  )
}

/**
 * O corte entre UNIVERSO e FILA, e por que ele existe.
 *
 * Descobrir cinco mil domínios custa dólares. Gravar cinco mil leads que
 * ninguém liga transforma a fila em ruído — a lição de 20/08, quando 8 dos 11
 * alertas da Central eram lixo e o alerta de dinheiro foi ignorado junto com
 * eles.
 *
 * Então: o universo inteiro vai para CSV, e só o topo vira lead com mensagem.
 * Os dois números aparecem lado a lado, para a diferença ser visível em vez de
 * silenciosa.
 */
const paraGravar = qualificados.slice(0, topo)
console.log(
  `acima do piso de ${MINIMO_PARA_LEAD} pontos: ${qualificados.length} | ` +
    `viram lead nesta rodada: ${paraGravar.length} (--topo=${topo})`,
)

if (comUniverso) {
  // CSV e não JSON: o universo é para ser aberto no Excel e filtrado à mão
  // quando a fila acabar. Mesmo separador `;` e BOM que `lib/leads/exportar-csv.ts`
  // usa, pela mesma razão — com vírgula a planilha vira uma coluna só.
  const linhasCsv = [
    'dominio;titulo;vertical;pontos;whatsapp;telefone;email;motivos',
    ...qualificados.map((p) =>
      [
        p.dominio,
        String(p.titulo ?? '').replace(/[;\r\n]/g, ' '),
        p.vertical,
        p.pontos,
        p.contato.whatsapp ?? '',
        p.contato.telefone ?? '',
        p.contato.email ?? '',
        p.motivos.join(' | '),
      ].join(';'),
    ),
  ]
  const nomes = [...new Set(qualificados.map((p) => p.vertical))].join('-') || 'rodada'
  const caminhoCsv = `docs/mercado/universo-${nomes}.csv`
  await mkdir('docs/mercado', { recursive: true })
  // Acrescenta em vez de sobrescrever: o universo é acumulado entre rodadas, e
  // sobrescrever jogaria fora o que já foi pago. O cabeçalho só entra na
  // primeira vez.
  let existente = ''
  try {
    existente = await readFile(caminhoCsv, 'utf8')
  } catch {
    existente = ''
  }
  const corpo = existente
    ? existente.trimEnd() + LINHA + linhasCsv.slice(1).join(LINHA) + LINHA
    : '\ufeff' + linhasCsv.join(LINHA) + LINHA
  await writeFile(caminhoCsv, corpo, 'utf8')
  console.log(`universo: ${qualificados.length} linhas -> ${caminhoCsv}`)
}

if (confirmar) {
  await gravarComoLeads(paraGravar)
} else {
  console.log('\nENSAIO: nada foi gravado. Rode com --confirmar para virar lead no CRM.')
}


// ── o que a rodada devolve para o PROJETO ────────────────────────────────────
//
// O texto dos sites já foi baixado e pago na mesma chamada que gerou o
// prospect. Jogá-lo fora depois de pontuar desperdiça a coisa mais escassa que
// este projeto tem: as palavras que o cliente usa para descrever o próprio
// negócio, escritas por ele.
//
// O documento sai SEMPRE, inclusive no ensaio: ele não grava nada no banco e
// não contata ninguém, então não há o que confirmar.
const paginasLidas = [...detalhes.entries()]
  .map(([url, d]) => ({ dominio: host(url), texto: d.texto ?? '' }))
  .filter((p) => p.dominio && p.texto.length > 200)

// De qual nicho é cada página. Sem isso o corpus não saberia dizer se um termo
// atravessa setores ou é jargão de um só — a única pergunta que uma rodada
// isolada não responde.
const nichoPorDominio = new Map(pontuados.map((p) => [p.dominio, p.vertical]))

const CAMINHO_CORPUS = 'docs/mercado/vocabulario.json'
let corpus = aprendizado.CORPUS_VAZIO
try {
  corpus = JSON.parse(await readFile(CAMINHO_CORPUS, 'utf8'))
} catch {
  corpus = aprendizado.CORPUS_VAZIO
}

const hoje = new Date().toISOString().slice(0, 10)
const promessas = aprendizado.extrairPromessas(paginasLidas)

for (const v of verticaisDaRodada) {
  const paginasDoNicho = paginasLidas.filter((pg) => nichoPorDominio.get(pg.dominio) === v.nome)
  if (paginasDoNicho.length === 0) continue
  const termos = aprendizado.extrairVocabulario(paginasDoNicho, {
    // Todas as variantes entram na desqualificação: a palavra que EU pus na
    // pergunta não pode voltar como resposta, e agora são três perguntas.
    consultas: [...v.consultas],
    // As praças da rodada entram na desqualificação: elas são parte da pergunta
    // que eu fiz, e sem isso "rio de janeiro" vira o termo que mais atravessa
    // nichos — medido em 07/09.
    pracas: cidadesDaRodada.length ? cidadesDaRodada : [],
    minimoDeSites: 3,
  })
  corpus = aprendizado.mesclarVocabulario(corpus, termos, v.nome, hoje)
  console.log(`vocabulario ${v.nome}: +${termos.length} termos de ${paginasDoNicho.length} sites`)
}

await mkdir('docs/mercado', { recursive: true })
await writeFile(CAMINHO_CORPUS, JSON.stringify(corpus, null, 2), 'utf8')

const consolidado = aprendizado.consolidarVocabulario(corpus)
const nichosNoCorpus = Object.keys(corpus.atualizadoEm).sort()
const caminho = 'docs/mercado/vocabulario-do-icp.md'
const linhas = [
  '# O vocabulário do ICP, acumulado',
  '',
  `Atualizado em ${hoje}. Nichos no corpus: ${nichosNoCorpus.join(', ') || '(nenhum)'}.`,
  '',
  'Gerado por `scripts/inteligencia/prospectar.mjs` a cada rodada, **somando em',
  'vez de sobrescrever**. Nada aqui foi escrito por mim: cada termo é contado em',
  'domínios distintos, e a palavra que entrou na consulta é desqualificada como',
  'resposta.',
  '',
  '## A coluna que decide onde a palavra é usada',
  '',
  '`nichos` é em quantos setores diferentes o termo aparece — não quantas vezes.',
  '',
  '    em 1 nicho    jargao daquele setor. Vira copy do anuncio DELE',
  '    em 4+ nichos  e como a PME brasileira fala. Vira copy da LANDING',
  '',
  '**Não vira palavra-chave do Google Ads.** Quem busca o termo do site é o',
  'CLIENTE daquela empresa, não a dona dela procurando um CRM — comprar esse',
  'clique paga por um público que nunca assinaria.',
  '',
  '| termo | nichos | sites | onde |',
  '| --- | ---: | ---: | --- |',
  ...consolidado.map((t) => `| ${t.termo} | ${t.nichos} | ${t.sites} | ${t.onde.join(', ')} |`),
  '',
  '## O que o nicho promete, na rodada mais recente',
  '',
  'Cada linha é uma objeção: se o visitante ouviu isto em dez sites antes do',
  'nosso, a frase não diferencia nada. Recorte literal, nunca paráfrase.',
  '',
  ...promessas.map((pr) => `- "${pr.frase}" — \`${pr.dominio}\``),
  '',
]
await writeFile(caminho, linhas.join(LINHA), 'utf8')
console.log(
  `corpus: ${Object.keys(corpus.termos).length} termos em ${nichosNoCorpus.length} nichos -> ${caminho}`,
)

if (modoDiario) {
  // Avança DEPOIS da rodada, não antes: se ela morrer no meio, amanhã repete o
  // mesmo recorte em vez de pular um pedaço do mapa sem ter colhido nada dele.
  await writeFile(CAMINHO_RODADAS, JSON.stringify({ rodada: rodada + 1 }), 'utf8')
  console.log(`diario: proxima rodada sera #${rodada + 1}`)
}
