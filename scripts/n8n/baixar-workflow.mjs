/**
 * Abre o navegador e baixa o workflow do n8n para a pasta de Downloads.
 *
 *     npm run n8n:baixar
 *
 * ## Por que existe, se o arquivo já está no repositório
 *
 * Ele está em `docs/n8n/`, e o seletor de arquivo do n8n abre em Downloads.
 * Navegar até a pasta do projeto no meio de um import é o tipo de atrito que
 * faz a pessoa desistir e colar JSON à mão — e JSON colado à mão perde
 * caractere, o que aqui significa um workflow que importa e não funciona.
 *
 * ## Por que Playwright, e não `start` no arquivo
 *
 * `start arquivo.json` abre no editor de texto, não baixa. `start URL` abre no
 * navegador mas o destino do download depende da configuração dele, e o
 * script não fica sabendo se deu certo.
 *
 * Com o Playwright o caminho é conhecido e a confirmação é real: o evento de
 * download traz o arquivo, `saveAs` decide onde, e dá para conferir o tamanho
 * depois. Ele já é dependência do projeto por causa do gate de segurança —
 * nada novo entra por causa disto.
 *
 * ## O servidor local existe por causa de um detalhe do navegador
 *
 * `file://` não dispara download: o Chrome renderiza JSON na tela. O que faz o
 * arquivo baixar é o cabeçalho `Content-Disposition: attachment`, e cabeçalho
 * exige HTTP. Daí o servidor de três linhas, que morre no `finally`.
 */
import { createServer } from 'node:http'
import { readFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { chromium } from '@playwright/test'

const ORIGEM = 'docs/n8n/agente-sdr-whatsapp.json'
const NOME = 'agente-sdr-whatsapp.json'

if (!existsSync(ORIGEM)) {
  console.error(`\n  não achei ${ORIGEM}. Rode a partir da raiz do projeto.\n`)
  process.exit(1)
}

const conteudo = readFileSync(ORIGEM)

// Falha aqui é melhor que um workflow quebrado importado: se o JSON não é
// válido, o n8n aceita o arquivo e o fluxo não roda, sem dizer por quê.
try {
  const w = JSON.parse(conteudo.toString('utf-8'))
  const nomes = new Set(w.nodes.map((n) => n.name))
  for (const [de, c] of Object.entries(w.connections ?? {})) {
    if (!nomes.has(de)) throw new Error(`ligação partindo de nó inexistente: ${de}`)
    for (const ramo of c.main ?? []) {
      for (const l of ramo) {
        if (!nomes.has(l.node)) throw new Error(`ligação para nó inexistente: ${l.node}`)
      }
    }
  }
  console.log(`\n  ${w.name}`)
  console.log(`  ${w.nodes.length} nós, ligações conferidas\n`)
} catch (e) {
  console.error(`\n  o JSON está quebrado: ${e.message}\n`)
  process.exit(1)
}

const destino = join(homedir(), 'Downloads')
mkdirSync(destino, { recursive: true })

const servidor = createServer((_req, res) => {
  res.writeHead(200, {
    'content-type': 'application/json; charset=utf-8',
    // É esta linha que faz baixar em vez de exibir.
    'content-disposition': `attachment; filename="${NOME}"`,
    'content-length': conteudo.length,
  })
  res.end(conteudo)
})

let navegador
try {
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok))
  const { port } = servidor.address()

  // `headless: false` de propósito: o pedido é ver o navegador abrir. Sem
  // isso o download acontece e não há sinal nenhum de que algo rodou.
  navegador = await chromium.launch({ headless: false })
  const ctx = await navegador.newContext({ acceptDownloads: true })
  const pagina = await ctx.newPage()

  const esperandoDownload = pagina.waitForEvent('download', { timeout: 30_000 })
  await pagina.goto(`http://127.0.0.1:${port}/${NOME}`).catch(() => {
    // Navegar para um download aborta a navegação no Chromium. O erro é
    // esperado e o download continua vindo pelo evento acima.
  })

  const download = await esperandoDownload
  const caminho = join(destino, NOME)
  await download.saveAs(caminho)

  console.log(`  baixado: ${caminho}`)
  console.log(`  ${conteudo.length} bytes\n`)
  console.log('  No n8n: ⋯ (canto superior direito) -> Import from File')
  console.log('  e escolha o arquivo em Downloads.\n')
} catch (e) {
  console.error(`\n  falhou: ${e.message}`)
  console.error(`  o arquivo continua em ${ORIGEM} — dá para importar direto de lá.\n`)
  process.exitCode = 1
} finally {
  await navegador?.close().catch(() => {})
  servidor.close()
}
