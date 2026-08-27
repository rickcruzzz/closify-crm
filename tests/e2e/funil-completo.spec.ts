import { test, expect, type BrowserContext, type Page } from '@playwright/test'

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

/**
 * UM navegador para o fluxo inteiro, em vez do `page` que o Playwright cria
 * novo a cada teste.
 *
 * Não é preferência de estilo, é o que torna o teste verdadeiro. A intenção de
 * compra atravessa o cadastro dentro de um cookie (`vf_plano`,
 * lib/auth/intencao.ts), e contexto novo por teste começa com o pote de
 * cookies vazio: o passo do onboarding via o assistente completo e parava em
 * `/onboarding`, como se o atalho do Pro estivesse quebrado. Não estava, era o
 * teste que trocava de navegador no meio da compra, coisa que nenhuma pessoa
 * faz.
 */
let navegador: BrowserContext
let pagina: Page

test.describe('funil completo: landing → cadastro → Pro → e-mail', () => {
  test.beforeAll(async ({ browser }) => {
    navegador = await browser.newContext({ baseURL: URL_BASE })
    pagina = await navegador.newPage()
  })

  test.afterAll(async () => {
    await navegador?.close()
  })

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

  test('1. "Assinar Pro" na landing leva ao cadastro carregando a intenção', async () => {
    const errosDeConsole: string[] = []
    pagina.on('console', (msg) => {
      if (msg.type() === 'error') errosDeConsole.push(msg.text())
    })

    await pagina.goto('/')

    // O nome da marca precisa estar no h1: é o que o verificador de marca do
    // Google procura, e o wordmark sozinho não serve porque o contraste de
    // peso quebra a string em dois nós (ver components/branding/logo.tsx).
    // Fica em `sr-only`, então `toContainText` precisa do texto do nó, não do
    // que está pintado na tela.
    const h1 = pagina.locator('h1').first()
    await expect(h1).toContainText('Velo Funil')
    await expect(h1).toContainText('O WhatsApp guarda a conversa')

    const assinar = pagina.getByRole('link', { name: /assinar pro/i }).first()
    // `?plano=pro` é o elo que faz este clique valer alguma coisa: sem ele o
    // botão levaria ao MESMO destino do Free e a intenção de compra morreria
    // no cadastro. O parâmetro vira cookie no `signUp` e atravessa a ida ao
    // e-mail de confirmação (lib/auth/intencao.ts).
    await expect(assinar).toHaveAttribute('href', '/cadastro?plano=pro')

    // `scrollIntoViewIfNeeded` antes do clique não é zelo: o card entra por
    // `RevealOnScroll`, e clicar antes de ele liberar o elemento não navega.
    // Custou um falso positivo até isto ser entendido.
    await assinar.scrollIntoViewIfNeeded()
    await assinar.click()
    await expect(pagina).toHaveURL(/\/cadastro\?plano=pro/, { timeout: 30_000 })

    expect(errosDeConsole, `erros de console na landing:\n${errosDeConsole.join('\n')}`).toEqual([])
  })

  test('2. cadastro cria a conta de verdade', async () => {
    // Entra pela URL com a intenção, como o passo 1 terminou: é o `plano=pro`
    // daqui que o `signUp` transforma em cookie.
    await pagina.goto('/cadastro?plano=pro')

    await pagina.locator('#name').fill(identidade.nome)
    await pagina.locator('#email').fill(identidade.email)
    await pagina.locator('#password').fill(identidade.senha)
    await pagina.locator('#confirmPassword').fill(identidade.senha)
    // Pelo PAPEL, não por `#terms`: o Checkbox do Base UI renderiza um
    // `<button role="checkbox">` visível mais um `<input>` nativo escondido
    // (`aria-hidden`, `tabindex="-1"`, fora da viewport) que carrega o id. O
    // seletor por id pegava o input escondido e o clique nunca acontecia.
    await pagina.getByRole('checkbox').first().click()
    await pagina.getByRole('button', { name: 'Criar conta' }).click()

    // Com confirmação de e-mail ativa, `signUp` não devolve sessão
    // (lib/supabase/actions.ts): a pessoa cai numa tela pedindo para abrir o
    // e-mail. Confirmar que chegou até aí já prova que a conta foi criada.
    await expect(pagina).toHaveURL(/verifique-email|confirmar/, { timeout: 30_000 })

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

  test('3. onboarding usa o atalho do Pro e leva direto ao checkout', async () => {
    await entrar(pagina, identidade)

    // Quem acabou de criar conta cai nas boas-vindas e depois no assistente.
    await pagina.goto('/onboarding')

    await pagina.locator('#nomeEmpresa').fill(identidade.empresa)
    await pagina.getByRole('button', { name: 'Continuar' }).click()

    // O ATALHO: quem clicou "Assinar Pro" já decidiu, então o assistente
    // reduz de quatro perguntas para uma (components/onboarding/assistente.tsx,
    // `atalhoPro`). Segmento, modelo de venda e tamanho de equipe são
    // personalização, não bloqueio, e continuam no checklist de ativação.
    //
    // Se este `expect` falhar mostrando as outras perguntas, o cookie de
    // intenção não atravessou a ida ao e-mail e a compra virou cadastro Free,
    // que é exatamente o defeito que `lib/auth/intencao.ts` existe para
    // impedir.
    await expect(pagina).toHaveURL(/\/settings\/billing\?assinar=1/, { timeout: 60_000 })

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

  test('4. checkout abre sozinho e gera cobrança real de R$49 no Asaas', async () => {
    await entrar(pagina, identidade)

    // Chega pelo MESMO destino que o onboarding devolve, não por
    // `/settings/billing` puro: é o `?assinar=1` que faz o diálogo abrir
    // sozinho (`abrirDeInicio` em components/settings/subscribe-button.tsx).
    await pagina.goto('/settings/billing?assinar=1')

    await expect(pagina.getByText('Free', { exact: true }).first()).toBeVisible()

    // Sem clicar em nada: quem atravessou cadastro, e-mail de confirmação e
    // criação de empresa não pode ter que procurar o botão de novo. É aqui
    // que a compra se perdia antes.
    const campoDocumento = pagina.locator('#cpfCnpj')
    await expect(
      campoDocumento,
      'o diálogo de CPF/CNPJ deveria abrir sozinho com ?assinar=1',
    ).toBeVisible({ timeout: 30_000 })

    await campoDocumento.fill(identidade.cpf)

    await pagina.getByRole('button', { name: /continuar para pagamento/i }).click()

    // ANTES de qualquer asserção: a cobrança no Asaas já existe neste ponto, e
    // um `expect` que falhe daqui pra frente aborta o teste sem que a limpeza
    // saiba o que cancelar. Foi o que aconteceu numa execução: a asserção da
    // aba falhou, o `afterAll` imprimiu "assinatura Asaas: (não criada)" e
    // ficou uma cobrança de R$49 viva em produção, tendo que ser removida à
    // mão. Registrar primeiro, afirmar depois.
    //
    // ## E aconteceu DE NOVO, em 27/08/2026, pelo mesmo motivo
    //
    // O que estava aqui era `navegador.waitForEvent('page')`, esperando a aba
    // que o Asaas abria — e o produto **deixou de abrir aba**. O comentário de
    // `subscribe-button.tsx` diz por quê: Pix e boleto passaram a acontecer no
    // `PagarDialog`, dentro do produto, porque a página do Asaas exibe o nome
    // civil do titular em destaque e quem clicava em "Assinar o Velo Funil"
    // caía numa tela com o nome de um desconhecido no topo.
    //
    // O teste continuou esperando os 60s pela aba, estourou, e abortou entre
    // "a cobrança existe" e "a limpeza sabe o que cancelar". Restou
    // `cus_000196523658` com assinatura ATIVA e R$49 pendente em produção,
    // removido à mão depois.
    //
    // A lição não é sobre este seletor. **Este arquivo nunca tinha sido
    // executado** — está registrado em `estado-atual.md` — e um teste que não
    // roda não avisa quando o contrato que ele afirma deixa de existir. Ele
    // também exigia `?pago=1` na URL, um marcador que hoje não aparece em
    // nenhum arquivo do produto.
    //
    // Por isso o registro dos rastros vem AGORA, colado no clique, antes de
    // qualquer `expect`: a ordem é o que separa "teste falhou" de "teste
    // falhou e deixou dinheiro cobrando alguém".
    const supabase = bancoAdmin()

    // Espera a linha aparecer em vez de ler uma vez: `createCheckout` ainda
    // está no ar quando o clique retorna (cria cliente e assinatura no Asaas,
    // duas idas de rede, antes de gravar). Ler direto pega `null` e o teste
    // aborta DEPOIS de a cobrança já existir, que é o pior momento possível.
    let assinatura: {
      asaas_customer_id: string | null
      asaas_subscription_id: string | null
      status: string
    } | null = null

    await expect
      .poll(
        async () => {
          const { data } = await supabase
            .from('subscriptions')
            .select('asaas_customer_id, asaas_subscription_id, status')
            .eq('workspace_id', rastros.workspaceId!)
            .maybeSingle()
          assinatura = data
          return data?.asaas_subscription_id ?? null
        },
        {
          timeout: 90_000,
          intervals: [1_000, 2_000, 3_000],
          message: 'checkout não gravou a assinatura no banco',
        },
      )
      .not.toBeNull()

    rastros.asaasCustomerId = assinatura!.asaas_customer_id ?? undefined
    rastros.asaasSubscriptionId = assinatura!.asaas_subscription_id ?? undefined

    // O pagamento acontece DENTRO do produto, com a nossa marca. A pessoa não
    // troca de site entre decidir pagar e pagar.
    const dialogoDePagamento = pagina.getByRole('dialog').filter({
      hasText: 'Assinar o Plano Pro',
    })
    await expect(
      dialogoDePagamento,
      'o diálogo de pagamento deveria abrir sozinho depois do CPF',
    ).toBeVisible({ timeout: 60_000 })

    // As três formas da MESMA cobrança. Faltar uma não quebra a compra, mas
    // tira a opção de quem só usa aquela — e é silencioso.
    //
    // `button` e não `tab`: a faixa de seleção é feita de `<button>` comuns,
    // sem `role="tab"` nem `aria-selected`. Funciona no clique e no teclado; o
    // que falta é o leitor de tela anunciar qual está escolhida. Fica
    // registrado aqui porque foi medido, não corrigido nesta rodada.
    //
    // `exact` porque o diálogo tem outros botões que contêm as mesmas
    // palavras: "Copiar código Pix" casaria com /Pix/ e o teste passaria
    // achando a coisa errada.
    for (const forma of ['Pix', 'Boleto', 'Cartão']) {
      await expect(
        dialogoDePagamento.getByRole('button', { name: forma, exact: true }),
        `a forma de pagamento "${forma}" sumiu do diálogo`,
      ).toBeVisible({ timeout: 30_000 })
    }

    // O QR só existe se o Asaas devolveu os dados do Pix para uma cobrança de
    // verdade: é a prova de que a cobrança saiu, não só a assinatura.
    await expect(
      dialogoDePagamento.getByAltText(/QR Code do Pix/i),
      'o QR do Pix não carregou, então a cobrança não chegou a existir no Asaas',
    ).toBeVisible({ timeout: 60_000 })

    expect(assinatura!.status, 'antes de pagar o status não pode ser active').not.toBe('active')

    // Confere no Asaas que a assinatura existe mesmo, com o valor certo.
    const noAsaas = await asaas<{ value: number; status: string }>(
      `/subscriptions/${rastros.asaasSubscriptionId}`,
    )
    expect(noAsaas.value).toBe(49)
  })

  test('5. pagamento confirmado libera o Pro e manda o e-mail', async () => {
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
    await entrar(pagina, identidade)
    await pagina.goto('/settings/billing')
    await expect(pagina.getByText('Pro', { exact: true }).first()).toBeVisible({ timeout: 30_000 })
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

    // Um único e-mail DE PAGAMENTO, mesmo com o evento chegando duas vezes.
    //
    // O filtro precisa do assunto, não só do destinatário: a conta também
    // recebe o "Confirm your email address" que o Supabase dispara no
    // cadastro, e contar os dois fazia o teste acusar dedupe quebrada quando
    // ela estava funcionando. Falso positivo caro, porque a conclusão errada
    // seria "o cliente recebe cobrança duplicada".
    const emails = await emailsEnviados()
    const deCobranca = emails.filter(
      (e) => e.to.includes(identidade.email) && /plano pro/i.test(e.subject),
    )
    expect(
      deCobranca.length,
      `evento repetido gerou ${deCobranca.length} e-mails de pagamento, deveria gerar 1`,
    ).toBe(1)
  })
})

/**
 * Entra no app, se já não estiver dentro.
 *
 * O navegador é um só para o fluxo inteiro, então a sessão sobrevive de um
 * passo para o outro. Sem a saída antecipada, o segundo passo que chamasse
 * isto abriria `/login` já logado, seria redirecionado para dentro do produto,
 * e os campos de e-mail e senha nunca apareceriam.
 */
async function entrar(page: Page, quem: IdentidadeDeTeste) {
  await page.goto('/login')

  // Logado, o `/login` redireciona sozinho para dentro do produto.
  const jaEntrou = await page
    .waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 5_000 })
    .then(() => true)
    .catch(() => false)
  if (jaEntrou) return

  await page.locator('#email').fill(quem.email)
  await page.locator('#password').fill(quem.senha)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 60_000 })
}
