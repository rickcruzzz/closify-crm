/**
 * Recaptura os prints do produto usados na landing (`public/produto/`).
 *
 * Print desatualiza — é a única desvantagem real de usar imagem em vez do mock
 * em HTML. Este script existe para que atualizar não dependa de alguém lembrar
 * do passo a passo: ele cria o cenário, captura e limpa tudo sozinho.
 *
 * Uso, com o app de PRODUÇÃO rodando local (não `next dev`: as animações e o
 * bundle de dev não representam o que o visitante vê):
 *
 *     npm run build && npm run start -- -p 3970
 *     node --env-file=.env.local scripts/capturar-prints-do-produto.mjs
 *
 * ## Por que um workspace descartável, e nunca produção
 *
 * As telas mostram nome, empresa, telefone e valor de negócio. Printar a conta
 * de um cliente real publicaria dado pessoal de terceiro numa página aberta —
 * é tratamento de dado sem base legal (LGPD), não um detalhe de zelo. Os dados
 * abaixo são fictícios e ecoam os que a landing já usa nos mocks em HTML.
 *
 * O workspace é apagado no `finally`, inclusive se a captura falhar no meio.
 */
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

import {
  EMAIL,
  SENHA,
  apagarCenario,
  criarCenario,
} from './marketing/cenario-de-demonstracao.mjs'

const BASE = process.env.BASE_URL ?? 'http://localhost:3970'
const SAIDA = 'public/produto'

// 1440x900 é o desktop mais comum; `deviceScaleFactor: 2` é o que separa um
// print nítido de um borrado em tela retina.
const VIEWPORT = { width: 1440, height: 900 }

const TELAS = [
  { rota: '/kanban', nome: 'kanban', espera: 'A contatar' },
  { rota: '/dashboard', nome: 'dashboard', espera: 'Funil de negócios' },
  { rota: '/hoje', nome: 'hoje', espera: 'Hoje' },
  { rota: '/leads', nome: 'contatos', espera: 'Busque, filtre e acompanhe' },
]

let cenario = null

try {
  cenario = await criarCenario()
  const email = EMAIL

  await mkdir(SAIDA, { recursive: true })
  const browser = await chromium.launch()

  // Os dois temas: a landing tem alternador, e um print claro sobre fundo
  // escuro (ou o contrário) desfaz a ilusão de que aquilo é a sua tela.
  for (const tema of ['dark', 'light']) {
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, locale: 'pt-BR' })
    const page = await context.newPage()
    // Semear ANTES de navegar: o next-themes lê do localStorage, e sem isso o
    // primeiro quadro sai no tema padrão.
    await page.addInitScript((t) => window.localStorage.setItem('theme', t), tema)
    // O banner de cookies nasce no rodapé de QUALQUER rota enquanto ninguém
    // respondeu, inclusive das telas de dentro do produto — e apareceu por cima
    // do print na primeira recaptura depois que ele passou a existir. Um aviso
    // de LGPD atravessado no material de venda mostra o produto discutindo
    // consentimento em vez de trabalhando. Responder aqui não altera o que a
    // tela desenha: o banner é a única coisa que essa chave controla.
    await page.addInitScript(() => window.localStorage.setItem('vf_consentimento_v1', 'recusado'))

    await page.goto(`${BASE}/login`)
    await page.locator('#email').fill(email)
    await page.locator('#password').fill(SENHA)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await page.waitForURL('**/dashboard', { timeout: 60_000 })

    for (const tela of TELAS) {
      await page.goto(`${BASE}${tela.rota}`)
      await page.getByText(tela.espera).first().waitFor({ timeout: 30_000 })
      // Rede parada não basta: as animações de entrada ainda estão correndo, e
      // um print no meio delas pega o conteúdo translúcido e deslocado.
      await page.waitForTimeout(1200)
      await page.screenshot({ path: `${SAIDA}/${tela.nome}-${tema}.png` })
      console.log(`ok ${SAIDA}/${tela.nome}-${tema}.png`)
    }
    await context.close()
  }

  await browser.close()
} finally {
  // Apaga mesmo se a captura falhar no meio.
  if (cenario) await apagarCenario(cenario)
}
