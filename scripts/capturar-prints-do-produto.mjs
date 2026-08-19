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
import { createClient } from '@supabase/supabase-js'
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.BASE_URL ?? 'http://localhost:3970'
const SAIDA = 'public/produto'
const SENHA = 'CapturaDePrints2026!'

// 1440x900 é o desktop mais comum; `deviceScaleFactor: 2` é o que separa um
// print nítido de um borrado em tela retina.
const VIEWPORT = { width: 1440, height: 900 }

const TELAS = [
  { rota: '/kanban', nome: 'kanban', espera: 'Novo Lead' },
  { rota: '/dashboard', nome: 'dashboard', espera: 'Funil de negócios' },
  { rota: '/hoje', nome: 'hoje', espera: 'Hoje' },
]

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

const dia = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)
const hora = (h) => new Date(Date.now() + h * 3600000).toISOString()

let userId = null
let workspaceId = null

try {
  const email = `captura-${Date.now()}@acmecorp.com.br`

  const { data: u, error: uErr } = await admin.auth.admin.createUser({
    email,
    password: SENHA,
    email_confirm: true,
    user_metadata: { name: 'Rick Cruz' },
  })
  if (uErr) throw uErr
  userId = u.user.id

  const { data: ws, error: wsErr } = await admin
    .from('workspaces')
    .insert({
      name: 'Acme Corp',
      plan: 'pro',
      segmento: 'agencia',
      email_comercial: 'contato@acmecorp.com.br',
      cidade: 'São Paulo',
      estado: 'SP',
    })
    .select('id')
    .single()
  if (wsErr) throw wsErr
  workspaceId = ws.id

  await admin.from('workspace_members').insert({ workspace_id: workspaceId, user_id: userId, role: 'admin' })
  // `checklist_oculto` para o dashboard não aparecer com o card de primeiros
  // passos por cima das métricas — é o estado de quem já configurou tudo.
  await admin.from('onboarding_state').insert({
    user_id: userId,
    status: 'completed',
    tour_status: 'completed',
    checklist_oculto: true,
  })

  const LEADS = [
    { name: 'Marcos Vinícius', company: 'Agência Nova Era', email: 'marcos@novaera.com.br', phone: '11988887777' },
    { name: 'Juliana Prado', company: 'Clínica Vida Plena', email: 'juliana@vidaplena.com.br', phone: '11977776666' },
    { name: 'Roberto Neves', company: 'Construforte Engenharia', email: 'roberto@construforte.com.br', phone: '11966665555' },
    { name: 'Carla Bastos', company: 'Clínica Bem Estar', email: 'carla@bemestar.com.br', phone: '11955554444' },
    { name: 'Diego Ramalho', company: 'Imóveis Max', email: 'diego@imoveismax.com.br', phone: '11944443333' },
    { name: 'Patrícia Lemos', company: 'Prime Consultoria', email: 'patricia@primecon.com.br', phone: '11933332222' },
    { name: 'Eduardo Salles', company: 'Imobiliária Horizonte', email: 'eduardo@horizonte.com.br', phone: '11922221111' },
    { name: 'Fernanda Rocha', company: 'Studio Alva', email: 'fernanda@studioalva.com.br', phone: '11911110000' },
  ]
  const { data: leads, error: lErr } = await admin
    .from('leads')
    .insert(LEADS.map((l) => ({ ...l, workspace_id: workspaceId, owner_id: userId, status: 'novo', value: 0 })))
    .select('id, company')
  if (lErr) throw lErr
  const idDa = Object.fromEntries(leads.map((l) => [l.company, l.id]))

  // Negócios espalhados pelas 6 etapas: um funil com uma etapa só não mostra
  // o formato do produto, que é justamente a distribuição.
  const DEALS = [
    { title: 'Plano anual', empresa: 'Agência Nova Era', value: 4500, stage: 'novo', due: dia(6) },
    { title: 'Consultoria de marca', empresa: 'Clínica Vida Plena', value: 5100, stage: 'novo', due: dia(9) },
    { title: 'Pacote trimestral', empresa: 'Construforte Engenharia', value: 22000, stage: 'novo', due: dia(3) },
    { title: 'Gestão de agenda', empresa: 'Clínica Bem Estar', value: 2800, stage: 'contato_realizado', due: dia(4) },
    { title: 'Captação de contatos', empresa: 'Imóveis Max', value: 15000, stage: 'contato_realizado', due: dia(11) },
    { title: 'Reforma de identidade', empresa: 'Prime Consultoria', value: 3600, stage: 'proposta_enviada', due: dia(2) },
    { title: 'Expansão de portfólio', empresa: 'Imobiliária Horizonte', value: 12500, stage: 'proposta_enviada', due: dia(8) },
    { title: 'Ensaio de produto', empresa: 'Studio Alva', value: 7400, stage: 'negociacao', due: dia(5) },
    { title: 'Retenção anual', empresa: 'Agência Nova Era', value: 9800, stage: 'negociacao', due: dia(13) },
    { title: 'Campanha de lançamento', empresa: 'Clínica Vida Plena', value: 11200, stage: 'fechado_ganho', due: dia(-4) },
    { title: 'Consultoria pontual', empresa: 'Prime Consultoria', value: 6800, stage: 'fechado_perdido', due: dia(-9) },
  ]
  const { data: deals, error: dErr } = await admin
    .from('deals')
    .insert(
      DEALS.map((d) => ({
        workspace_id: workspaceId,
        lead_id: idDa[d.empresa],
        owner_id: userId,
        title: d.title,
        value: d.value,
        stage: d.stage,
        due_date: d.due,
      })),
    )
    .select('id, title')
  if (dErr) throw dErr
  const dealDe = Object.fromEntries(deals.map((d) => [d.title, d.id]))

  // Uma tarefa em cada faixa da tela Hoje: atrasada, hoje, próximos dias.
  const { error: tErr } = await admin.from('tasks').insert([
    { workspace_id: workspaceId, deal_id: dealDe['Pacote trimestral'], lead_id: idDa['Construforte Engenharia'], assignee_id: userId, created_by: userId, title: 'Ligar para fechar o pacote', type: 'ligacao', due_at: hora(-20) },
    { workspace_id: workspaceId, deal_id: dealDe['Reforma de identidade'], lead_id: idDa['Prime Consultoria'], assignee_id: userId, created_by: userId, title: 'Enviar proposta revisada', type: 'email', due_at: hora(3) },
    { workspace_id: workspaceId, deal_id: dealDe['Ensaio de produto'], lead_id: idDa['Studio Alva'], assignee_id: userId, created_by: userId, title: 'Reunião de alinhamento', type: 'reuniao', due_at: hora(7) },
    { workspace_id: workspaceId, deal_id: dealDe['Gestão de agenda'], lead_id: idDa['Clínica Bem Estar'], assignee_id: userId, created_by: userId, title: 'Confirmar escopo por WhatsApp', type: 'ligacao', due_at: hora(30) },
    { workspace_id: workspaceId, deal_id: dealDe['Captação de contatos'], lead_id: idDa['Imóveis Max'], assignee_id: userId, created_by: userId, title: 'Retomar conversa da semana passada', type: 'nota', due_at: hora(54) },
  ])
  if (tErr) throw tErr

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
  // Apaga mesmo se a captura falhar no meio: workspace de teste esquecido no
  // banco vira dado órfão que ninguém sabe de onde veio.
  if (workspaceId) await admin.from('workspaces').delete().eq('id', workspaceId)
  if (userId) await admin.auth.admin.deleteUser(userId)
  console.log('cenário de demonstração removido')
}
