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
const cidades = (args.find((a) => a.startsWith('--cidades='))?.split('=')[1] ?? '')
  .split(',').map((c) => c.trim()).filter(Boolean)
const comMensagem = args.includes('--mensagem')
/**
 * Quantos prospects do TOPO recebem busca de decisor.
 *
 * Uma chamada por prospect, US$ 0,0196 cada — caro para rodar em noventa,
 * barato para os dez que voce vai ligar hoje. Zero (o padrao) nao busca ninguem.
 */
const quantosDecisores = Number(args.find((a) => a.startsWith('--decisores='))?.split('=')[1] ?? 0)

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
  VERTICAIS, ehDominioExcluido, extrairContato, pontuarProspect,
  ordenarProspects, deduplicarPorDominio, MINIMO_PARA_LEAD,
} = dominio

let buscasFeitas = 0
let custoTotal = 0

async function exa(rota, corpo) {
  if (buscasFeitas >= tetoDeBusca) {
    throw new Error(`teto de ${tetoDeBusca} chamadas atingido — PARANDO em vez de gastar mais`)
  }
  buscasFeitas += 1
  const r = await fetch(`https://api.exa.ai/${rota}`, {
    method: 'POST',
    headers: { 'x-api-key': CHAVE, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  })
  const j = await r.json()
  custoTotal += Number(j?.costDollars?.total ?? 0) || 0
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
async function semear(vertical, cidade = null) {
  // `numResults` ate 50 numa chamada so: medido em 06/09, 50 devolveu 43
  // resultados e 39 dominios UNICOS pelo mesmo preco de uma busca. Pedir 10 era
  // jogar fora quatro quintos da colheita.
  const j = await exa('search', {
    query: cidade ? `${vertical.consulta} em ${cidade}` : vertical.consulta,
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

  const rw = await fetch(
    `${URL_SUPABASE}/rest/v1/workspaces?select=id,name&order=created_at.asc&limit=1`,
    { headers: cabecalho },
  )
  const ws = (await rw.json())[0]
  if (!ws) {
    console.error('Nenhum workspace encontrado. Nada foi gravado.')
    return
  }

  console.log(`\ngravando em "${ws.name}" (${ws.id.slice(0, 8)}...)`)
  let gravados = 0
  let jaExistiam = 0

  for (const p of prospects) {
    // Dedupe pelo que o CRM já tem: reimportar o mesmo prospect a cada rodada
    // encheria o funil de repetido, que é exatamente o defeito que a
    // importação de planilha já pagou.
    const busca = await fetch(
      `${URL_SUPABASE}/rest/v1/leads?select=id&workspace_id=eq.${ws.id}&company=eq.${encodeURIComponent(p.dominio)}&limit=1`,
      { headers: cabecalho },
    )
    if ((await busca.json()).length > 0) {
      jaExistiam += 1
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
    if (r.ok) gravados += 1
    else console.error(`  falhou ${p.dominio}: ${(await r.text()).slice(0, 120)}`)
  }
  console.log(`gravados ${gravados} | ja existiam ${jaExistiam}`)
}

// ── execução ────────────────────────────────────────────────────────────────

const verticais = verticalPedido
  ? VERTICAIS.filter((v) => v.nome === verticalPedido)
  : VERTICAIS

if (verticais.length === 0) {
  console.error(`vertical desconhecido. Use um de: ${VERTICAIS.map((v) => v.nome).join(', ')}`)
  process.exit(1)
}

console.log(`modo: ${confirmar ? 'CONFIRMAR (grava leads)' : 'ENSAIO (nao grava nada)'}`)
console.log(`verticais: ${verticais.map((v) => v.nome).join(', ')} | ${porVertical} por vertical | teto ${tetoDeBusca} chamadas\n`)

const candidatos = []
try {
  for (const v of verticais) {
    // Sem `--cidades`, uma passagem nacional. Com, uma por praca: o Exa ancora
    // forte no lugar, entao cada cidade traz conjunto quase disjunto pelo preco
    // de uma chamada.
    const pracas = cidades.length ? cidades : [null]
    const sementes = []
    for (const cidade of pracas) {
      const s = await semear(v, cidade)
      console.log(`${v.nome.padEnd(20)} ${(cidade ?? 'nacional').padEnd(16)} semente: ${s.length}`)
      sementes.push(...s)
    }
    for (const s of sementes) candidatos.push({ ...s, vertical: v.nome })

    // Expande a partir das duas primeiras — as mais relevantes segundo o Exa.
    // Expandir todas multiplicaria o custo sem melhorar a lista: `findSimilar`
    // de sementes vizinhas devolve muita interseção.
    for (const s of sementes.slice(0, 2)) {
      const parecidos = await expandir(s.url)
      console.log(`${''.padEnd(20)} findSimilar(${host(s.url)}): +${parecidos.length}`)
      for (const p of parecidos) candidatos.push({ ...p, vertical: v.nome })
    }
  }
} catch (erro) {
  console.error(`\nPAROU: ${erro.message}`)
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

const paraGravar = pontuados.filter((p) => p.pontos >= MINIMO_PARA_LEAD)
console.log(`acima do piso de ${MINIMO_PARA_LEAD} pontos: ${paraGravar.length} — so estes viram lead`)

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

const vocabulario = aprendizado.extrairVocabulario(paginasLidas, {
  consultas: verticais.map((v) => v.consulta),
  minimoDeSites: 3,
})
const promessas = aprendizado.extrairPromessas(paginasLidas)

const hoje = new Date().toISOString().slice(0, 10)
const caminho = `docs/mercado/aprendizado-${hoje}.md`
const linhas = [
  `# O que a prospecção de ${hoje} ensinou`,
  '',
  'Gerado por `scripts/inteligencia/prospectar.mjs`, lendo ' +
    `${paginasLidas.length} sites reais de ${verticais.map((v) => v.nome).join(', ')}.`,
  '**Nada aqui foi escrito por mim:** cada termo é contado em domínios distintos',
  'e cada promessa é recorte literal do site.',
  '',
  '## Vocabulário do ICP',
  '',
  'A coluna `sites` é o número de domínios DISTINTOS que usam o termo — nunca',
  'ocorrências. Um site que repete o próprio slogan quarenta vezes é um site, e',
  'não uma tendência de mercado.',
  '',
  '**Para que serve, e para o que NAO serve.** O termo abaixo vira **copy**: e a',
  'lingua que o cliente fala, e a landing que fala assim e reconhecida por ele.',
  '',
  '**NAO vira palavra-chave do Google Ads**, e a distincao custa dinheiro: quem',
  'busca `clareamento dental` e o PACIENTE da clinica, nao a dona dela procurando',
  'um CRM. Comprar esse clique paga por um publico que nunca assinaria. O site',
  'institucional diz como a empresa fala com o CLIENTE dela — nao como ela',
  'descreveria o proprio problema de gestao, que e o que a `g_preco` precisa.',
  '',
  'A `g_preco` continua parada com cauda longa que eu inventei, e este documento',
  'nao a corrige sozinho: o que ele corrige e a COPY da pagina de destino.',
  '',
  '| termo | sites | onde conferir |',
  '| --- | ---: | --- |',
  ...vocabulario.map((t) => `| ${t.termo} | ${t.sites} | ${t.exemplos.join(', ')} |`),
  '',
  '## O que o nicho promete, e que a nossa página enfrenta sem saber',
  '',
  'Cada linha é uma objeção: se o visitante ouviu isto em dez sites antes do',
  'nosso, a frase não diferencia nada. Recorte literal, nunca paráfrase.',
  '',
  ...promessas.map((p) => `- "${p.frase}" — \`${p.dominio}\``),
  '',
  '## O que este documento NÃO é',
  '',
  'Não é pesquisa de volume de busca. O Exa diz o que está **publicado**, não o',
  'que é procurado — o volume se confere no Planejador do Google antes de virar',
  'palavra-chave paga. Do mesmo jeito que o Search Console desmentiu duas',
  'suposições minhas em 03/09: quando a fonte oficial existe, é ela que decide.',
  '',
]
await mkdir('docs/mercado', { recursive: true })
await writeFile(caminho, linhas.join('\n'), 'utf8')
console.log(`\naprendizado: ${vocabulario.length} termos e ${promessas.length} promessas -> ${caminho}`)
