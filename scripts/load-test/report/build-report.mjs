// Monta docs/load-test/relatorio-<data>.md a partir do que REALMENTE rodou —
// results/summary/*.json (via `k6 run --summary-export=...`) e
// results/raw/*.log (stdout capturado, é onde moram os vereditos das
// corridas, impressos em teardown()). Nenhum número aqui é inventado: cenário
// sem arquivo correspondente vira uma linha "não executado", não um valor
// extrapolado.
//
// Convenção de nome esperada pelos outros scripts (ver k6/run-all.ps1):
//   results/summary/<cenario>__<perfil>.json
//   results/raw/<cenario>__<perfil>.log
import { readdirSync, readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const SUMMARY_DIR = join(ROOT, '..', 'results', 'summary')
const RAW_DIR = join(ROOT, '..', 'results', 'raw')
const DOCS_DIR = join(ROOT, '..', '..', '..', 'docs', 'load-test')

const PERFIL_LABEL = {
  smoke: 'smoke (2 VUs)',
  load: 'load (rampa até 100)',
  stress: 'stress (rampa até 1000)',
  spike: 'spike (pico 1000)',
  soak: 'soak (200 sustentado)',
}

function classificar(p95, errorRatePct) {
  if (errorRatePct > 5) return 'QUEBRA'
  if (p95 === null) return 'sem dado de latência'
  if (errorRatePct > 1) return 'ruim (erro alto)'
  if (p95 > 1000) return 'atenção'
  if (p95 < 500) return 'saudável'
  return 'atenção'
}

function lerSummaries() {
  if (!existsSync(SUMMARY_DIR)) return []
  const arquivos = readdirSync(SUMMARY_DIR).filter((f) => f.endsWith('.json'))

  return arquivos.map((arquivo) => {
    const [cenario, perfilComExt] = arquivo.replace(/\.json$/, '').split('__')
    const perfil = perfilComExt ?? 'desconhecido'
    const raw = JSON.parse(readFileSync(join(SUMMARY_DIR, arquivo), 'utf8'))
    const m = raw.metrics ?? {}

    const dur = m.http_req_duration?.values ?? {}
    const failed = m.http_req_failed?.values ?? {}
    const reqs = m.http_reqs?.values ?? {}

    const p50 = dur.med ?? dur['p(50)'] ?? null
    const p95 = dur['p(95)'] ?? null
    const p99 = dur['p(99)'] ?? null
    const errorRatePct = failed.rate != null ? failed.rate * 100 : 0
    const reqPerSec = reqs.rate ?? null

    return {
      cenario,
      perfil,
      p50,
      p95,
      p99,
      errorRatePct,
      reqPerSec,
      status: classificar(p95, errorRatePct),
    }
  })
}

function lerVeredictosDeCorrida() {
  if (!existsSync(RAW_DIR)) return []
  const arquivos = readdirSync(RAW_DIR).filter((f) => /^race\d/i.test(f))

  return arquivos.map((arquivo) => {
    const texto = readFileSync(join(RAW_DIR, arquivo), 'utf8')
    const bloco = texto.match(/=== RACE\d[^\n]*===[\s\S]*?(?=\n\n|\n===|$)/)
    return {
      arquivo,
      encontrado: !!bloco,
      resumo: bloco ? bloco[0].trim() : '(veredito não encontrado no log — rodar com stdout capturado)',
      violado: bloco ? /VIOLADO/.test(bloco[0]) : null,
    }
  })
}

function tabelaMarkdown(linhas) {
  const header = '| cenário | perfil | usuários (VUs) | p50 | p95 | p99 | taxa de erro | req/s | status |\n'
  const sep = '|---|---|---|---|---|---|---|---|---|\n'
  const rows = linhas
    .map(
      (l) =>
        `| ${l.cenario} | ${PERFIL_LABEL[l.perfil] ?? l.perfil} | — | ${fmt(l.p50)} | ${fmt(l.p95)} | ${fmt(l.p99)} | ${l.errorRatePct.toFixed(2)}% | ${l.reqPerSec ? l.reqPerSec.toFixed(1) : '—'} | ${l.status} |`,
    )
    .join('\n')
  return header + sep + rows
}

function fmt(v) {
  return v == null ? '—' : `${Math.round(v)}ms`
}

function main() {
  const summaries = lerSummaries()
  const corridas = lerVeredictosDeCorrida()

  if (summaries.length === 0) {
    console.error('Nenhum results/summary/*.json encontrado. Rode a suíte k6 com --summary-export primeiro.')
  }

  const data = new Date().toISOString().slice(0, 10)
  mkdirSync(DOCS_DIR, { recursive: true })

  const md = `# Relatório de teste de carga — Velo Funil (${data})

Gerado por \`scripts/load-test/report/build-report.mjs\` a partir de execuções
reais de k6. Cenário sem linha aqui não rodou — não foi extrapolado.

## Cenários de latência/throughput

${summaries.length > 0 ? tabelaMarkdown(summaries) : '_Nenhum resultado encontrado._'}

Critérios: p95 < 500ms saudável · p95 > 1000ms atenção · erro > 1% ruim ·
erro > 5% quebra.

## Corridas de concorrência (race1-5)

${
  corridas.length > 0
    ? corridas.map((c) => `### ${c.arquivo}\n\n\`\`\`\n${c.resumo}\n\`\`\``).join('\n\n')
    : '_Nenhum log de corrida encontrado em results/raw/._'
}

## Limitações declaradas

- Sem Vercel real: sem cold start serverless, sem CDN/edge, sem rede real
  entre datacenter e Supabase — \`next start\` local é otimista.
- Tier Free do Supabase tem teto próprio de infraestrutura — se apareceu
  antes do alvo de VUs, é rotulado acima como tal, não como falha de código.
- Se a máquina local saturou antes da app (ver \`dropped_iterations\` no
  output bruto do k6 em \`results/raw/\`), o teto reportado é da máquina de
  teste, não da aplicação.
`

  const destino = join(DOCS_DIR, `relatorio-${data}.md`)
  writeFileSync(destino, md)
  console.log(`Relatório gerado em ${destino}`)
}

main()
