/**
 * Mede a LCP com o mesmo aperto do PageSpeed, e diz QUEM e o elemento.
 *
 *     node scripts/diagnostico/medir-lcp.mjs
 *     node scripts/diagnostico/medir-lcp.mjs https://staging.exemplo.com 5
 *
 * ## Por que isto existe
 *
 * O relatorio do PageSpeed da o numero da LCP e nao da a causa: a secao
 * "Detalhamento da LCP" vem recolhida, e a API sem chave responde 429. Sem
 * isso, "a LCP esta em 3,8s" e uma reclamacao, nao um diagnostico.
 *
 * Este script reproduz o perfil da ferramenta (Moto G Power, 4G lento, CPU 4x
 * via CDP) e devolve o ELEMENTO, a lista de candidatos na ordem em que
 * apareceram, e os recursos que terminam mais perto do instante da LCP — que e
 * onde a causa costuma estar.
 *
 * ## O que ele achou na primeira execucao, em 03/09
 *
 * A LCP desta landing **nao e o h1**: e o `<p>` logo abaixo dele. E o que
 * atrasa nao e layout nem JavaScript, e o download da FONTE — texto so conta
 * para a LCP quando pinta com a fonte final. Medido bloqueando os arquivos:
 *
 *     como esta        FCP 2680   LCP 3299   elemento <p>
 *     sem a mono       FCP 2412   LCP 2787   elemento <p>
 *     sem as duas      FCP 2217   LCP 2217   elemento <h1>
 *
 * A ultima linha e a prova: sem fonte nenhuma, a LCP IGUALA a FCP.
 *
 * ## A armadilha que ele tambem expos, e vale mais que o achado
 *
 * **Medir contra `localhost` nao serve para esta pergunta.** Local as fontes
 * terminam em ~2100-2500ms e em producao em ~2950ms, entao toda tentativa de
 * correcao passa no teste local sem mudar nada de verdade. Duas foram
 * descartadas assim: `preload: false` na mono (que ainda por cima removeu o
 * preload da sans junto) e `font-display: optional`.
 *
 * Rode contra PRODUCAO, ou contra um deploy de preview. Nunca contra o build
 * local.
 */
import { chromium } from '@playwright/test'

const URL_ALVO = process.argv[2] ?? 'https://www.velofunil.com.br/'
const RODADAS = Number(process.argv[3] ?? 3)

// Perfil "Slow 4G" do Lighthouse, numeros da propria ferramenta.
const REDE = {
  offline: false,
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
  latency: 150,
}
const CPU = 4

const observador = () => {
  window.__m = { lcp: null, cls: 0, candidatos: [] }
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) {
      window.__m.lcp = e
      window.__m.candidatos.push({
        t: Math.round(e.startTime),
        tag: e.element?.tagName,
        classe: (e.element?.className ?? '').toString().slice(0, 50),
        texto: (e.element?.textContent ?? '').trim().slice(0, 46),
        url: e.url || null,
        tamanho: e.size,
      })
    }
  }).observe({ type: 'largest-contentful-paint', buffered: true })
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) if (!e.hadRecentInput) window.__m.cls += e.value
  }).observe({ type: 'layout-shift', buffered: true })
}

const navegador = await chromium.launch({ args: ['--no-sandbox'] })

for (let r = 1; r <= RODADAS; r++) {
  const ctx = await navegador.newContext({
    viewport: { width: 412, height: 823 },
    deviceScaleFactor: 1.75,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
  })
  const page = await ctx.newPage()
  await page.addInitScript(observador)

  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', REDE)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU })

  await page.goto(URL_ALVO + '?lh=' + Date.now(), { waitUntil: 'load', timeout: 120000 })
  await page.waitForTimeout(4000)

  const d = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0]
    const paint = Object.fromEntries(
      performance.getEntriesByType('paint').map((p) => [p.name, Math.round(p.startTime)]),
    )
    const m = window.__m
    const lcp = m.lcp
    const rec = performance
      .getEntriesByType('resource')
      .filter((x) => x.responseEnd <= (lcp?.startTime ?? 1e9) + 50)
      .map((x) => ({
        nome: x.name
          .replace(/^https?:\/\/[^/]+/, '')
          .replace(/\?.*/, '')
          .slice(-42),
        tipo: x.initiatorType,
        inicio: Math.round(x.startTime),
        fim: Math.round(x.responseEnd),
        kb: Math.round(x.transferSize / 1024),
      }))
      .sort((a, b) => b.fim - a.fim)
      .slice(0, 8)
    return {
      ttfb: Math.round(nav.responseStart),
      fcp: paint['first-contentful-paint'],
      lcp: Math.round(lcp?.startTime ?? -1),
      cls: +m.cls.toFixed(4),
      elemento: lcp
        ? `${lcp.element?.tagName} "${(lcp.element?.textContent ?? '').trim().slice(0, 50)}"`
        : '?',
      // As fases que o painel do Chrome mostra, calculadas do mesmo jeito.
      fases: lcp
        ? {
            ttfb: Math.round(nav.responseStart),
            atrasoDeCarga: lcp.url ? Math.round(lcp.loadTime - nav.responseStart) : null,
            tempoDeCarga: lcp.url ? Math.round(lcp.loadTime - lcp.renderTime) : null,
            atrasoDeRender: Math.round(lcp.startTime - nav.responseStart),
          }
        : null,
      candidatos: m.candidatos,
      ultimosRecursosAntesDaLcp: rec,
    }
  })

  console.log(`\n${'='.repeat(58)}\nRODADA ${r}`)
  console.log(`  TTFB ${d.ttfb}ms   FCP ${d.fcp}ms   LCP ${d.lcp}ms   CLS ${d.cls}`)
  console.log(`  elemento do LCP: ${d.elemento}`)
  console.log(`  atraso de render (LCP - TTFB): ${d.fases?.atrasoDeRender}ms`)
  console.log('\n  candidatos, na ordem:')
  for (const c of d.candidatos)
    console.log(`    ${String(c.t).padStart(5)}ms  ${c.tag}  ${c.texto}`)
  console.log('\n  recursos que terminam mais perto da LCP:')
  for (const x of d.ultimosRecursosAntesDaLcp)
    console.log(
      `    fim ${String(x.fim).padStart(5)}ms  ${String(x.kb).padStart(4)}KB  ${x.tipo.padEnd(6)} ${x.nome}`,
    )

  await ctx.close()
}

await navegador.close()
