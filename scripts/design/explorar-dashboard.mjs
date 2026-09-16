/**
 * Exploração visual do dashboard na Replicate.
 *
 * ## O que este script É, e o que ele NÃO é
 *
 * É ferramenta de DESENVOLVIMENTO. Roda à mão, lê o token do `.env.local` e
 * grava imagem em `graphify-out/design/`. O produto não chama isto: nenhuma
 * rota, nenhum componente e nenhum build dependem da Replicate, e o dashboard
 * continua sendo React com dado real do Supabase.
 *
 * `REPLICATE_API_TOKEN` é lido só aqui, no Node. Não existe
 * `NEXT_PUBLIC_REPLICATE_*`, e não pode passar a existir: prefixo público
 * embute a variável no bundle que vai para o navegador de todo cliente.
 *
 * ## O modelo
 *
 * `google/nano-banana-pro`, escolhido consultando a busca da própria Replicate
 * em 16/09/2026 e não por memória: é oficial, aceita `image_input` (edição a
 * partir de uma captura real) e lidera em execução entre os de edição por
 * instrução. Modelo de imagem envelhece rápido; confira de novo antes de
 * reusar.
 *
 *     node --env-file=.env.local scripts/design/explorar-dashboard.mjs <captura.png>
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { basename } from 'node:path'

const TOKEN = process.env.REPLICATE_API_TOKEN
if (!TOKEN) {
  console.error('REPLICATE_API_TOKEN não está definido. Rode com --env-file=.env.local.')
  process.exit(1)
}

const captura = process.argv[2]
if (!captura) {
  console.error('Uso: node --env-file=.env.local scripts/design/explorar-dashboard.mjs <captura.png>')
  process.exit(1)
}

const MODELO = 'google/nano-banana-pro'
const SAIDA = 'graphify-out/design'

// A base comum de todas as direções. Ela descreve o que NÃO pode mudar, porque
// é isso que separa exploração de design de "gere um dashboard bonito": marca,
// idioma, estrutura de navegação e conteúdo dos números são do produto real.
const BASE = [
  'Redesign of this real SaaS CRM dashboard for Brazilian small businesses.',
  'Keep: the left sidebar exactly as is, the Portuguese labels, the teal brand color,',
  'the light background with white cards, subtle borders, rounded corners.',
  'Keep the same four KPIs and the same six funnel stages.',
  'No gradients, no glassmorphism, no 3D, no decorative illustrations, no dark mode.',
  'Professional, dense, precise, trustworthy. Looks like paid software, not a template.',
].join(' ')

const DIRECOES = [
  {
    nome: 'a-funil-horizontal',
    prompt: `${BASE} Direction A: replace the bar chart with a horizontal funnel strip where each stage is a segment whose WIDTH is its share of the pipeline, showing count and monetary value stacked inside each segment. Put the four KPI cards in a single tight row above it, each with a small trend indicator. Compact, one screen, no wasted horizontal space.`,
  },
  {
    nome: 'b-funil-lista',
    prompt: `${BASE} Direction B: replace the bar chart with a vertical list of stages, one row per stage, each row showing stage name, deal count, total value, percentage of pipeline, and a thin proportional progress bar. A summary column on the right with performance metrics (average ticket, win rate, cycle time). Table-like density, strong typographic hierarchy, numbers right-aligned.`,
  },
  {
    nome: 'c-duas-colunas',
    prompt: `${BASE} Direction C: two-column layout below the KPIs. Left column, 2/3 width: the funnel visualization. Right column, 1/3 width: a narrow panel of small performance metrics and short data-derived insight lines. Everything above the fold on a 1440px screen.`,
  },
]

const capturaBytes = await readFile(captura)
const forma = new FormData()
forma.append('content', new Blob([capturaBytes], { type: 'image/png' }), basename(captura))

const envio = await fetch('https://api.replicate.com/v1/files', {
  method: 'POST',
  headers: { authorization: `Bearer ${TOKEN}` },
  body: forma,
})
if (!envio.ok) {
  console.error('upload falhou', envio.status, await envio.text())
  process.exit(1)
}
const arquivo = await envio.json()
const urlDaCaptura = arquivo.urls.get
console.log('captura enviada:', arquivo.id)

await mkdir(SAIDA, { recursive: true })

// Disparadas EM SÉRIE, com espera entre uma e outra.
//
// Disparar as três juntas parece o certo (são independentes) e toma 429: com
// menos de US$ 5 de crédito a Replicate limita a 6 por minuto com rajada de
// UMA. Medido em 16/09, as duas últimas voltaram "Request was throttled".
const execucoes = []
for (const { nome, prompt } of DIRECOES) {
  execucoes.push(
    await (async () => {
    const r = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        version: MODELO,
        input: {
          prompt,
          image_input: [urlDaCaptura],
          aspect_ratio: '16:9',
          resolution: '2K',
          output_format: 'png',
        },
      }),
    })
    const p = await r.json()
    if (!r.ok) return { nome, erro: `${r.status} ${JSON.stringify(p).slice(0, 200)}` }
    return { nome, id: p.id }
    })(),
  )
  await new Promise((s) => setTimeout(s, 12_000))
}

async function esperar(id) {
  // Teto de 5 minutos. Sem ele, um modelo pendurado seguraria o script para
  // sempre e não diria por quê.
  for (let i = 0; i < 100; i++) {
    const r = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      headers: { authorization: `Bearer ${TOKEN}` },
    })
    const p = await r.json()
    if (p.status === 'succeeded' || p.status === 'failed' || p.status === 'canceled') return p
    await new Promise((s) => setTimeout(s, 3000))
  }
  return { status: 'timeout' }
}

for (const e of execucoes) {
  if (e.erro) {
    console.log(`${e.nome}: ERRO ${e.erro}`)
    continue
  }
  const p = await esperar(e.id)
  if (p.status !== 'succeeded') {
    console.log(`${e.nome}: ${p.status} ${p.error ?? ''}`)
    continue
  }
  const url = Array.isArray(p.output) ? p.output[0] : p.output
  const img = await fetch(url, { headers: { authorization: `Bearer ${TOKEN}` } })
  const destino = `${SAIDA}/${e.nome}.png`
  await writeFile(destino, Buffer.from(await img.arrayBuffer()))
  console.log(`${e.nome}: ${destino} (${p.metrics?.predict_time?.toFixed(1) ?? '?'}s)`)
}
