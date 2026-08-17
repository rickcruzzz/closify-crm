import { test, expect, type Page } from '@playwright/test'

/**
 * Auditoria de segurança das páginas públicas, roda no CI antes de
 * promover um deploy pra produção (ver .github/workflows/deploy-com-auditoria.yml).
 *
 * Só cobre rotas SEM sessão: o CI não tem credencial de teste, e criar uma
 * conta descartável a cada rodada de deploy geraria lixo de teste em
 * produção, o padrão do projeto (docs/estado-atual.md) é limpar sempre o
 * que se cria, e a forma mais simples de cumprir isso aqui é não criar nada.
 *
 * IMPORTANTE, rodar contra build de produção, não `next dev`: em modo dev
 * o bundler não faz tree-shaking agressivo de `import type`, e o arquivo
 * inteiro de `types/supabase.ts` (comentários incluídos) pode entrar no
 * bundle de alguma rota. Um desses comentários contém a palavra
 * "service_role" em português, sem ser segredo nenhum, dispara falso
 * positivo só em dev. Confirmado batendo direto no chunk minificado de
 * produção (`curl` + `grep`): zero ocorrências lá. Rodar com
 * `npm run build && npm start` (ou contra uma URL já deployada) antes de
 * confiar no resultado local, é isso que o CI faz.
 */
const ROTAS_PUBLICAS = ['/', '/login', '/cadastro', '/esqueci-senha', '/termos', '/privacidade']

// Cada padrão é uma classe de segredo real deste projeto (ver lib/asaas,
// lib/resend, lib/integrations, .env.local), não são exemplos genéricos de
// tutorial. Se aparecer no HTML/JS que vai pro navegador, vazou.
const PADROES_DE_SEGREDO: { nome: string; regex: RegExp }[] = [
  { nome: 'Supabase service_role', regex: /service_role/i },
  { nome: 'Chave de API do Asaas', regex: /\$?aact_[a-zA-Z0-9$]/ },
  { nome: 'Chave de API do Resend', regex: /\bre_[A-Za-z0-9]{20,}\b/ },
  { nome: 'Client secret do Google OAuth', regex: /GOCSPX-[A-Za-z0-9_-]+/ },
  { nome: 'Chave de acesso AWS', regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { nome: 'Chave privada PEM', regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  {
    nome: 'Segredo genérico atribuído (SECRET=/KEY=)',
    regex: /\b[A-Z][A-Z0-9_]*(?:SECRET|API_KEY|PRIVATE_KEY)\b\s*[:=]\s*["'][A-Za-z0-9+/_-]{16,}["']/,
  },
]

// Regressão de configuração, não vazamento de dado, mas é o tipo de coisa
// que alguém remove sem querer mexendo em next.config.mjs, e só um teste
// automático pega antes de virar produção.
const HEADERS_OBRIGATORIOS = [
  'strict-transport-security',
  'x-frame-options',
  'x-content-type-options',
]

const PADRAO_DE_STACK_TRACE = /(at Object\.<anonymous>|\.(?:js|ts):\d+:\d+|Error:\s+\S+\.(?:js|ts))/

async function coletarRespostasDeMesmaOrigem(page: Page, baseURL: string) {
  const corpos: { url: string; corpo: string }[] = []
  const origem = new URL(baseURL).origin

  page.on('response', (response) => {
    const url = response.url()
    if (!url.startsWith(origem)) return

    const tipo = response.headers()['content-type'] ?? ''
    if (!/text|javascript|json/i.test(tipo)) return

    // Não bloqueia a navegação esperando o corpo: guarda a promise e resolve
    // depois, no fim do teste.
    corpos.push({
      url,
      corpo: '',
    })
    const indice = corpos.length - 1
    response
      .text()
      .then((texto) => {
        corpos[indice].corpo = texto
      })
      .catch(() => {
        // Resposta binária ou já consumida, não é o alvo desta varredura.
      })
  })

  return corpos
}

for (const rota of ROTAS_PUBLICAS) {
  test(`sem segredo vazado em ${rota}`, async ({ page, baseURL }) => {
    const mensagensDeConsole: string[] = []
    page.on('console', (msg) => mensagensDeConsole.push(msg.text()))

    const corpos = await coletarRespostasDeMesmaOrigem(page, baseURL ?? 'http://localhost:3000')

    const resposta = await page.goto(rota, { waitUntil: 'networkidle' })
    expect(resposta, `Rota ${rota} não respondeu`).not.toBeNull()

    // Dá tempo das promises de `.text()` disparadas durante a navegação
    // resolverem antes de varrer os corpos coletados.
    await page.waitForTimeout(500)

    const achados: string[] = []

    for (const { url, corpo } of corpos) {
      for (const { nome, regex } of PADROES_DE_SEGREDO) {
        if (regex.test(corpo)) {
          achados.push(`${nome} encontrado em ${url}`)
        }
      }
    }

    for (const texto of mensagensDeConsole) {
      for (const { nome, regex } of PADROES_DE_SEGREDO) {
        if (regex.test(texto)) {
          achados.push(`${nome} encontrado no console: ${texto.slice(0, 200)}`)
        }
      }
    }

    expect(achados, achados.join('\n')).toHaveLength(0)
  })

  test(`headers de segurança presentes em ${rota}`, async ({ page }) => {
    const resposta = await page.goto(rota)
    expect(resposta).not.toBeNull()

    const headers = resposta!.headers()
    const faltando = HEADERS_OBRIGATORIOS.filter((h) => !(h in headers))

    expect(faltando, `Headers ausentes em ${rota}: ${faltando.join(', ')}`).toHaveLength(0)

    // CSP em Report-Only é o estado aceito hoje (documentado em
    // next.config.mjs), registra no relatório do CI sem falhar o build.
    // O objetivo é não deixar isso cair no esquecimento, não bloquear
    // deploy por causa de uma decisão já tomada conscientemente.
    const csp = headers['content-security-policy']
    const cspReportOnly = headers['content-security-policy-report-only']
    if (!csp && cspReportOnly) {
      test.info().annotations.push({
        type: 'aviso',
        description: `CSP ainda em Report-Only em ${rota}, não bloqueia XSS, só loga.`,
      })
    }
    expect(csp || cspReportOnly, `Nenhuma CSP (nem Report-Only) em ${rota}`).toBeTruthy()
  })
}

test('API não vaza stack trace em resposta de erro', async ({ request, baseURL }) => {
  // Webhook do Asaas sem token válido é o caso mais fácil de provocar um
  // 401/500 sem precisar de sessão nenhuma.
  const resposta = await request.post(`${baseURL}/api/webhooks/asaas`, {
    data: { bad: true },
    headers: { 'Content-Type': 'application/json' },
  })

  const corpo = await resposta.text()
  expect(PADRAO_DE_STACK_TRACE.test(corpo), `Resposta parece stack trace: ${corpo.slice(0, 300)}`).toBe(
    false,
  )
})
