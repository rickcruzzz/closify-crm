import { expect, test } from '@playwright/test'

import { bancoAdmin, emailsEnviados, URL_BASE } from './helpers/ambiente'
import { criarIdentidade } from './helpers/identidade'

/**
 * O canal de suporte, ponta a ponta, com o e-mail SAINDO de verdade.
 *
 * ## Por que este teste existe, e por que ele é diferente dos outros
 *
 * `produto-logado.spec.ts` prova que as telas funcionam. Este prova a única
 * coisa que nenhuma tela mostra: **que o aviso chega**. O relato pode ser
 * gravado, aparecer na Central, e o dono nunca saber — foi exatamente esse o
 * defeito achado em 30/08, quando o SDK do Resend devolvia `{ error }` sem
 * lançar e o `try/catch` sozinho deixava passar em silêncio.
 *
 * A prova de entrega é a API do Resend (`emailsEnviados`), não um mock: mock
 * provaria que o mock foi chamado.
 *
 * ## Por que a conta de teste faz o e-mail sair
 *
 * `enviarFeedback` não avisa quando `ehContaDeTeste` é verdadeiro — relato do
 * próprio dono não pode tocar a campainha. `criarIdentidade` gera
 * `j4693001+velofunil-teste-<carimbo>@gmail.com`, e `EMAILS_DO_DONO.has()`
 * compara string EXATA: o alias com `+` não bate, então a conta é tratada
 * como externa e o aviso sai.
 *
 * Isso é sorte a favor do teste, não desenho — e fica registrado como
 * observação: alias `+` do e-mail do dono escapa da classificação. Não é
 * problema hoje porque toda conta E2E é apagada no fim, mas se um dia alguém
 * cadastrar com alias de propósito, ela aparecerá como cliente externo na
 * Central.
 *
 * ## Fora do CI, de propósito
 *
 * Escreve no banco de PRODUÇÃO (o único que existe) e dispara e-mail real.
 * Rodar a cada push encheria a caixa do dono. Chamado à mão por
 * `npm run test:suporte`.
 */
const identidade = criarIdentidade()

let userId: string | null = null
let workspaceId: string | null = null

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  const admin = bancoAdmin()

  // Conta criada pela API e já confirmada: o objetivo aqui é o SUPORTE, não o
  // cadastro — que já tem prova própria em `funil-completo.spec.ts`.
  const { data: novo, error } = await admin.auth.admin.createUser({
    email: identidade.email,
    password: identidade.senha,
    email_confirm: true,
    user_metadata: { name: 'Cliente de Teste E2E' },
  })
  if (error) throw error
  userId = novo.user.id

  const { createClient } = await import('@supabase/supabase-js')
  const sessao = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  )
  await sessao.auth.signInWithPassword({
    email: identidade.email,
    password: identidade.senha,
  })

  const { data: ws, error: erroWs } = await sessao.rpc('create_workspace_with_admin', {
    workspace_name: identidade.empresa,
  })
  if (erroWs) throw erroWs
  workspaceId = ws as string

  // Sem isto o middleware desvia para `/bem-vindo` e nenhuma tela do produto
  // abre — o que fez a primeira versão deste roteiro falhar sem explicar.
  await admin
    .from('onboarding_state')
    .upsert(
      { user_id: userId, status: 'completed', tour_status: 'completed' },
      { onConflict: 'user_id' },
    )
})

test.afterAll(async () => {
  const admin = bancoAdmin()

  if (workspaceId) {
    // Os ARQUIVOS primeiro: `feedback` não tem FK para `workspaces`, então
    // apagar a empresa não leva os anexos, e o caminho deles só existe na
    // coluna `anexos` do relato.
    const { data: pastas } = await admin.storage.from('anexos-feedback').list(workspaceId)
    for (const pasta of pastas ?? []) {
      const { data: arquivos } = await admin.storage
        .from('anexos-feedback')
        .list(`${workspaceId}/${pasta.name}`)
      const caminhos = (arquivos ?? []).map((a) => `${workspaceId}/${pasta.name}/${a.name}`)
      if (caminhos.length > 0) await admin.storage.from('anexos-feedback').remove(caminhos)
    }
    await admin.from('feedback').delete().eq('workspace_id', workspaceId)
    await admin.from('workspaces').delete().eq('id', workspaceId)
  }
  if (userId) await admin.auth.admin.deleteUser(userId)
})

/** Entra e para no Funil, que é de onde o relato vai sair. */
async function entrar(page: import('@playwright/test').Page) {
  await page.goto(`${URL_BASE}/login`, { waitUntil: 'domcontentloaded' })

  // Espera a HIDRATAÇÃO antes de clicar, e isto não é zelo: clicar antes faz o
  // navegador submeter o formulário NATIVAMENTE, viram
  // `/login?email=...&password=...` e a Server Action nunca roda. A primeira
  // rodada deste teste caiu exatamente nisso — e expôs, de brinde, que o
  // submit pré-hidratação leva a SENHA na URL (registrado em
  // docs/estado-atual.md).
  //
  // `waitForFunction` sobre o próprio formulário: o React marca o input como
  // controlado ao hidratar, e mudar o valor por script passa a disparar o
  // handler. Mais honesto que um `waitForTimeout` fixo, que passa ou falha
  // conforme a rede do dia.
  await page.waitForFunction(
    () => {
      const form = document.querySelector('form')
      // `__reactProps$...` só existe depois que o React assume o elemento.
      return !!form && Object.keys(form).some((k) => k.startsWith('__react'))
    },
    null,
    { timeout: 60_000 },
  )

  await page.fill('#email', identidade.email)
  await page.fill('#password', identidade.senha)
  await page.getByRole('button', { name: /entrar/i }).first().click()
  await page.waitForURL(/dashboard/, { timeout: 60_000 })
  await page.goto(`${URL_BASE}/kanban`, { waitUntil: 'domcontentloaded' })
  // O botão só existe depois da hidratação; esperá-lo é mais honesto que um
  // `waitForTimeout` fixo, que passa ou falha conforme a rede do dia.
  await page.getByRole('button', { name: /ajuda e sugest/i }).waitFor({ timeout: 60_000 })
}

test('o item de ajuda existe na barra lateral, sem precisar sair da tela', async ({ page }) => {
  await entrar(page)

  await expect(page.getByRole('button', { name: /ajuda e sugest/i })).toBeVisible()

  const antes = page.url()
  await page.getByRole('button', { name: /ajuda e sugest/i }).click()
  await page.locator('#mensagem').waitFor({ timeout: 30_000 })

  // O critério pedido: abrir o canal NÃO navega para lugar nenhum.
  expect(page.url()).toBe(antes)
})

test('relato de PROBLEMA grava e dispara o aviso por e-mail', async ({ page }) => {
  await entrar(page)

  const marca = `E2E ${identidade.carimbo}`

  await page.getByRole('button', { name: /ajuda e sugest/i }).click()
  await page.locator('#mensagem').waitFor({ timeout: 30_000 })
  await page.getByRole('button', { name: /tive um problema/i }).click()
  await page
    .locator('#mensagem')
    .fill(`${marca} — teste de suporte: o card não salva quando arrasto para Fechado Ganho.`)

  // Um anexo de verdade: PNG 1x1 válido, montado aqui para o teste não
  // depender de nenhum arquivo no disco.
  await page.locator('#anexos').setInputFiles({
    name: 'print-do-erro.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    ),
  })

  await page.getByRole('button', { name: /^enviar$/i }).click()

  // A confirmação diz o que acontece a seguir, não "enviado".
  await expect(page.getByText(/já fomos avisados/i)).toBeVisible({ timeout: 60_000 })

  const admin = bancoAdmin()
  const { data: linhas } = await admin
    .from('feedback')
    .select('tipo, status, mensagem, anexos, plano')
    .eq('workspace_id', workspaceId!)

  const problema = (linhas ?? []).find((l) => l.tipo === 'problema')
  expect(problema, 'o relato precisa estar no banco').toBeTruthy()
  expect(problema!.status).toBe('aberto')
  expect(problema!.anexos).toHaveLength(1)
})

test('relato de SUGESTÃO grava e NÃO dispara e-mail', async ({ page }) => {
  await entrar(page)

  const admin = bancoAdmin()
  const antes = (await emailsEnviados()).length

  await page.getByRole('button', { name: /ajuda e sugest/i }).click()
  await page.locator('#mensagem').waitFor({ timeout: 30_000 })
  await page.getByRole('button', { name: /tenho uma sugest/i }).click()
  await page
    .locator('#mensagem')
    .fill(`E2E ${identidade.carimbo} — sugestão: exportar contatos para planilha.`)
  await page.getByRole('button', { name: /^enviar$/i }).click()

  await expect(page.getByText(/sugest[aã]o registrada/i)).toBeVisible({ timeout: 60_000 })

  const { data: linhas } = await admin
    .from('feedback')
    .select('tipo')
    .eq('workspace_id', workspaceId!)
  expect((linhas ?? []).filter((l) => l.tipo === 'sugestao')).toHaveLength(1)

  // A parte que importa: sugestão não toca a campainha. E-mail para tudo vira
  // ruído, e ruído treina a ignorar a caixa — a lição de 20/08, quando 8 de 11
  // alertas da Central eram teste do próprio dono.
  const depois = (await emailsEnviados()).length
  expect(depois, 'sugestão não pode gerar e-mail').toBe(antes)
})

test('o aviso do problema CHEGOU ao Resend, com o plano no assunto', async () => {
  // A lista do Resend é a prova de entrega. Sem isto o teste provaria que a
  // linha de código rodou, não que a mensagem saiu — e essa diferença é
  // exatamente o defeito de 30/08, em que o SDK devolvia `{ error }` sem
  // lançar e nada aparecia em lugar nenhum.
  const enviados = await emailsEnviados()
  const aviso = enviados.find((e) => e.subject.includes(identidade.empresa))

  expect(aviso, `nenhum e-mail com "${identidade.empresa}" no assunto`).toBeTruthy()
  expect(aviso!.to).toContain('suporte@velofunil.com.br')
  // O plano no assunto é o que permite decidir a urgência na notificação do
  // celular, sem abrir nada. Esta conta é Free.
  expect(aviso!.subject).toContain('Grátis')
  // `bounced` e `complained` seriam entrega falhada com aparência de sucesso.
  expect(['sent', 'delivered', 'delivered_delayed']).toContain(aviso!.last_event)

  console.log(`\n  E-MAIL ENVIADO: "${aviso!.subject}"`)
  console.log(`  para: ${aviso!.to.join(', ')}`)
  console.log(`  estado no Resend: ${aviso!.last_event}\n`)
})
