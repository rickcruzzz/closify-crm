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

// O domínio puro é TypeScript e este script é `.mjs`; em vez de duplicar a
// regra, lê o módulo compilado sob demanda. Duas cópias divergem, e a que
// diverge em silêncio é a que ninguém está olhando.
const dominio = await import('../../lib/inteligencia-de-mercado/dominio/prospeccao.ts')
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

async function semear(vertical) {
  const j = await exa('search', {
    query: vertical.consulta,
    category: 'company',
    type: 'auto',
    numResults: porVertical,
    excludeDomains: [...dominio.DOMINIOS_EXCLUIDOS],
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
    const sementes = await semear(v)
    console.log(`${v.nome.padEnd(16)} semente: ${sementes.length}`)
    for (const s of sementes) candidatos.push({ ...s, vertical: v.nome })

    // Expande a partir das duas primeiras — as mais relevantes segundo o Exa.
    // Expandir todas multiplicaria o custo sem melhorar a lista: `findSimilar`
    // de sementes vizinhas devolve muita interseção.
    for (const s of sementes.slice(0, 2)) {
      const parecidos = await expandir(s.url)
      console.log(`${''.padEnd(16)} findSimilar(${host(s.url)}): +${parecidos.length}`)
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
