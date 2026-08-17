import { test, expect, type Page } from '@playwright/test'

import { asaas, bancoAdmin, emailsEnviados, TOKEN_WEBHOOK, URL_BASE } from './helpers/ambiente'
import { criarIdentidade, type IdentidadeDeTeste } from './helpers/identidade'
import { conferirQueNadaSobrou, limpar, type Rastros } from './helpers/limpeza'

/**
 * O funil inteiro, da landing até o Pro liberado e o e-mail entregue.
 *
 * Roda contra PRODUÇÃO e cria estado real: conta no Supabase, cliente e
 * assinatura no Asaas, cobrança de R$49 em aberto. Ninguém paga, e o
 * `afterAll` desfaz tudo. Por isso este arquivo NÃO entra no CI de deploy
 * (`test:security`), tem script próprio (`test:funil`).
 *
 * ## O que este teste não consegue provar, e por quê
 *
 * **O pagamento em si.** Pix, boleto e cartão acontecem numa página hospedada
 * pelo Asaas e exigem uma pessoa com dinheiro real. Nenhuma automação
 * atravessa isso. O teste prova o que vem antes (a fatura certa é gerada e
 * abre) e o que vem depois (o webhook libera o Pro e dispara o e-mail),
 * mandando o mesmo `PAYMENT_CONFIRMED` que o Asaas mandaria. O único trecho
 * não exercido é o clique humano no "pagar".
 *
 * **A caixa de entrada.** A prova de envio e entrega vem da API do Resend
 * (campo `last_event`). Como o endereço da conta de teste é um `+` do Gmail
 * do dono, ele também vê a mensagem chegar de verdade.
 */

// Sequência longa: cadastro real, onboarding, Asaas, webhook e Resend, tudo
// com latência de rede de produção.
test.describe.configure({ mode: 'serial', timeout: 180_000 })

const identidade: IdentidadeDeTeste = criarIdentidade()
const rastros: Rastros = { eventIds: [] }

test.describe('funil completo: landing → cadastro → Pro → e-mail', () => {
  test.afterAll(async () => {
    const { removidos, sobraram } = await limpar(rastros)
    console.log(`\n[limpeza] removido: ${removidos.join(' | ') || 'nada'}`)

    const pendencias = await conferirQueNadaSobrou(identidade.carimbo)

    if (sobraram.length > 0 || pendencias.length > 0) {
      // Grita alto de propósito. Cobrança que fica em aberto no nome de
      // alguém é o defeito registrado em docs/estado-atual.md (duas de R$49,
      // no nome de uma usuária real). Falhar em silêncio aqui repetiria a
      // história.
      console.error(
        [
          '',
          '=====================================================',
          'ATENÇÃO: a limpeza não terminou. Resolver À MÃO:',
          ...sobraram.map((s) => `  - ${s}`),
          ...pendencias.map((p) => `  - ${p}`),
          `  cliente Asaas: ${rastros.asaasCustomerId ?? '(não criado)'}`,
          `  assinatura Asaas: ${rastros.asaasSubscriptionId ?? '(não criada)'}`,
          `  conta: ${identidade.email}`,
          '=====================================================',
        ].join('\n'),
      )
    }
  })

  test('1. landing explica o produto e leva ao cadastro', async ({ page }) => {
    const errosDeConsole: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errosDeConsole.push(msg.text())
    })

    await page.goto('/')

    // O nome da marca precisa estar contíguo no h1: é o que o verificador de
    // marca do Google procura, e o wordmark sozinho não serve porque o
    // contraste de peso quebra a string em dois nós (ver components/branding/logo.tsx).
    const h1 = page.locator('h1').first()
    await expect(h1).toContainText('Velo Funil')
    await expect(h1).toContainText('Pare de perder venda por esquecimento')

    const cta = page.getByRole('link', { name: /começar grátis/i }).first()
    await expect(cta).toHaveAttribute('href', '/cadastro')

    expect(errosDeConsole, `erros de console na landing:\n${errosDeConsole.join('\n')}`).toEqual([])
  })

  test('2. cadastro cria a conta de verdade', async ({ page }) => {
    await page.goto('/cadastro')

    await page.locator('#name').fill(identidade.nome)
    await page.locator('#email').fill(identidade.email)
    await page.locator('#password').fill(identidade.senha)
    await page.locator('#confirmPassword').fill(identidade.senha)
    await page.locator('#terms').click()
    await page.getByRole('button', { name: 'Criar conta' }).click()

    // Com confirmação de e-mail ativa, `signUp` não devolve sessão
    // (lib/supabase/actions.ts): a pessoa cai numa tela pedindo para abrir o
    // e-mail. Confirmar que chegou até aí já prova que a conta foi criada.
    await expect(page).toHaveURL(/verifique-email|confirmar/, { timeout: 30_000 })

    const supabase = bancoAdmin()
    const { data } = await supabase.auth.admin.listUsers()
    const conta = data.users.find((u) => u.email === identidade.email)
    expect(conta, 'conta não apareceu no Supabase depois do cadastro').toBeTruthy()
    rastros.userId = conta!.id

    // Marca o e-mail como confirmado pelo admin: é exatamente o efeito de
    // clicar no link do e-mail, sem depender de ler caixa de entrada. O link
    // em si já tem cobertura própria (supabase/email-templates/README.md
    // documenta por que ele usa token_hash e não ConfirmationURL).
    const { error } = await supabase.auth.admin.updateUserById(conta!.id, { email_confirm: true })
    expect(error, 'falha ao confirmar o e-mail pelo admin').toBeNull()
  })

  test('3. login e onboarding criam a empresa', async ({ page }) => {
    await entrar(page, identidade)

    // Quem acabou de criar conta cai nas boas-vindas e depois no assistente.
    await page.goto('/onboarding')

    await page.locator('#nomeEmpresa').fill(identidade.empresa)
    await page.getByRole('button', { name: 'Continuar' }).click()

    // Os três passos seguintes são botões de escolha que avançam sozinhos.
    // "Pular por enquanto" existe na tela e é o caminho mais estável: o teste
    // está provando que o fluxo termina, não qual segmento foi escolhido.
    for (let i = 0; i < 3; i++) {
      const pular = page.getByRole('button', { name: /pular por enquanto/i })
      if (await pular.isVisible().catch(() => false)) {
        await pular.click()
      }
    }

    // Fim do assistente: o app leva para dentro do produto.
    await expect(page).toHaveURL(/\/(kanban|dashboard|hoje|leads)/, { timeout: 60_000 })

    const supabase = bancoAdmin()
    const { data: vinculo } = await supabase
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', rastros.userId!)
      .maybeSingle()

    expect(vinculo, 'onboarding não criou vínculo com nenhuma empresa').toBeTruthy()
    expect(vinculo!.role).toBe('admin')
    rastros.workspaceId = vinculo!.workspace_id

    const { data: workspace } = await supabase
      .from('workspaces')
      .select('plan')
      .eq('id', rastros.workspaceId!)
      .single()
    expect(workspace!.plan, 'empresa nova deveria nascer no Free').toBe('free')
  })

  test('4. checkout gera cobrança real de R$49 no Asaas', async ({ page, context }) => {
    await entrar(page, identidade)
    await page.goto('/settings/billing')

    await expect(page.getByText('Free', { exact: true }).first()).toBeVisible()

    await page.getByRole('button', { name: /assinar pro/i }).click()
    await page.locator('#cpfCnpj').fill(identidade.cpf)

    // O botão abre a fatura em outra aba (window.open dentro do gesto do
    // clique, senão o bloqueador de pop-up mata). Espera a aba nova.
    const novaAba = context.waitForEvent('page', { timeout: 60_000 })
    await page.getByRole('button', { name: /continuar para pagamento/i }).click()

    const abaDaFatura = await novaAba
    await abaDaFatura.waitForLoadState('domcontentloaded', { timeout: 60_000 })
    const urlDaFatura = abaDaFatura.url()
    expect(urlDaFatura, `a aba da fatura não foi para o Asaas: ${urlDaFatura}`).toContain('asaas')

    // A fatura precisa mostrar o valor certo. Se o Asaas mudar o layout, o
    // teste falha aqui e não em produção, com o cliente na frente.
    await expect(abaDaFatura.locator('body')).toContainText(/49/, { timeout: 30_000 })

    // A aba de trás fica no produto avisando que a cobrança está a caminho.
    await expect(page).toHaveURL(/pago=1/, { timeout: 30_000 })

    // Guarda os ids reais para o webhook e para a limpeza.
    const supabase = bancoAdmin()
    const { data: assinatura } = await supabase
      .from('subscriptions')
      .select('asaas_customer_id, asaas_subscription_id, status')
      .eq('workspace_id', rastros.workspaceId!)
      .single()

    expect(assinatura, 'checkout não gravou a assinatura no banco').toBeTruthy()
    rastros.asaasCustomerId = assinatura!.asaas_customer_id
    rastros.asaasSubscriptionId = assinatura!.asaas_subscription_id
    expect(assinatura!.status, 'antes de pagar o status não pode ser active').not.toBe('active')

    // Confere no Asaas que a assinatura existe mesmo, com o valor certo.
    const noAsaas = await asaas<{ value: number; status: string }>(
      `/subscriptions/${rastros.asaasSubscriptionId}`,
    )
    expect(noAsaas.value).toBe(49)
  })

  test('5. pagamento confirmado libera o Pro e manda o e-mail', async ({ page }) => {
    // Aqui está a fronteira do que dá para automatizar: pagar exige uma
    // pessoa. O que segue é exatamente o que o Asaas manda depois que a
    // pessoa paga, com o token real, no endpoint real.
    const eventId = `evt_teste_${identidade.carimbo}`
    rastros.eventIds.push(eventId)

    const resposta = await fetch(`${URL_BASE}/api/webhooks/asaas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'asaas-access-token': TOKEN_WEBHOOK(),
      },
      body: JSON.stringify({
        id: eventId,
        event: 'PAYMENT_CONFIRMED',
        payment: {
          id: `pay_teste_${identidade.carimbo}`,
          subscription: rastros.asaasSubscriptionId,
        },
      }),
    })
    expect(resposta.status, `webhook respondeu ${resposta.status}`).toBe(200)

    // Prova no banco: status da cobrança e validade do plano são coisas
    // diferentes (CLAUDE.md), então confere as duas.
    const supabase = bancoAdmin()
    const { data: assinatura } = await supabase
      .from('subscriptions')
      .select('status, current_period_end')
      .eq('workspace_id', rastros.workspaceId!)
      .single()
    expect(assinatura!.status).toBe('active')
    expect(assinatura!.current_period_end, 'sem validade gravada o Pro nasce vencido').toBeTruthy()

    const { data: vigente } = await supabase.rpc('pro_vigente', {
      target_workspace_id: rastros.workspaceId,
    })
    expect(vigente, 'pro_vigente() deveria ser true depois do pagamento').toBe(true)

    // Prova na tela: é o que o cliente vê.
    await entrar(page, identidade)
    await page.goto('/settings/billing')
    await expect(page.getByText('Pro', { exact: true }).first()).toBeVisible({ timeout: 30_000 })
  })

  test('6. o e-mail de confirmação sai e é entregue', async () => {
    // Envio é assíncrono e o Resend leva alguns segundos para registrar o
    // evento de entrega. Tenta algumas vezes antes de desistir.
    let encontrado: { subject: string; last_event: string } | undefined

    await expect
      .poll(
        async () => {
          const emails = await emailsEnviados()
          encontrado = emails.find((e) => e.to.includes(identidade.email))
          return encontrado?.last_event ?? 'ainda-nao-apareceu'
        },
        {
          timeout: 90_000,
          intervals: [3_000, 5_000, 5_000, 10_000],
          message: `nenhum e-mail para ${identidade.email} apareceu no Resend`,
        },
      )
      .not.toBe('ainda-nao-apareceu')

    expect(encontrado!.subject.toLowerCase()).toContain('pro')
    // `bounced` e `complained` são falha de entrega de verdade; `sent`,
    // `delivered` e `delivery_delayed` não são.
    expect(['bounced', 'complained']).not.toContain(encontrado!.last_event)
    console.log(
      `\n[e-mail] "${encontrado!.subject}" para ${identidade.email} => ${encontrado!.last_event}`,
    )
  })

  test('7. reenviar o mesmo evento não reprocessa', async () => {
    // A trava que impede um retry do Asaas (ou uma nova passada do job de
    // reconciliação) reativar o Pro depois de um cancelamento.
    const eventId = rastros.eventIds[0]

    const resposta = await fetch(`${URL_BASE}/api/webhooks/asaas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'asaas-access-token': TOKEN_WEBHOOK(),
      },
      body: JSON.stringify({
        id: eventId,
        event: 'PAYMENT_CONFIRMED',
        payment: { id: `pay_teste_${identidade.carimbo}`, subscription: rastros.asaasSubscriptionId },
      }),
    })
    expect(resposta.status).toBe(200)

    // Um único e-mail, mesmo com o evento chegando duas vezes.
    const emails = await emailsEnviados()
    const paraEstaConta = emails.filter((e) => e.to.includes(identidade.email))
    expect(
      paraEstaConta.length,
      `evento repetido gerou ${paraEstaConta.length} e-mails, deveria gerar 1`,
    ).toBe(1)
  })
})

/** Entra no app. Cada teste roda em contexto novo, então a sessão não persiste. */
async function entrar(page: Page, quem: IdentidadeDeTeste) {
  await page.goto('/login')
  await page.locator('#email').fill(quem.email)
  await page.locator('#password').fill(quem.senha)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 60_000 })
}
