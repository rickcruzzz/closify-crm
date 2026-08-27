/**
 * As cinco áreas do produto logado que nenhum teste exercitava.
 *
 * `funil-completo.spec.ts` cobre a entrada e o dinheiro: landing, cadastro,
 * checkout, webhook do Asaas, e-mail. Daqui pra frente ficava tudo sem rede:
 * recuperação de senha, importação de planilha, convite e papéis, calendário e
 * o OAuth do Google. Todas construídas, nenhuma provada de ponta a ponta.
 *
 * ## Por que este arquivo é separado, e roda em CI
 *
 * `funil-completo` cria **cobrança real de R$49 no Asaas** e por isso fica fora
 * do gate. Nada aqui toca em dinheiro: nenhuma chamada ao Asaas, nenhuma
 * assinatura. O que ele cria é uma empresa descartável no Supabase, apagada no
 * `afterAll` aconteça o que acontecer.
 *
 * ## A empresa nasce pelo caminho real, não por insert
 *
 * A conta é criada com `auth.admin.createUser` (e-mail já confirmado, para
 * pular a caixa de entrada), mas a EMPRESA sai de
 * `create_workspace_with_admin` chamada com **sessão autenticada de verdade**.
 * Isso importa: a RPC é `security definer` e carrega a trava de plano da 0018,
 * e o trial de 7 dias da 0053 nasce ali dentro. Criar por `insert` com service
 * role testaria um estado que o produto nunca produz.
 */
import { createClient } from '@supabase/supabase-js'
import { expect, test, type BrowserContext, type Page } from '@playwright/test'

import { bancoAdmin, emailsEnviados, URL_BASE } from './helpers/ambiente'
import { criarIdentidade, type IdentidadeDeTeste } from './helpers/identidade'

test.describe.configure({ mode: 'serial' })

let navegador: BrowserContext
let pagina: Page

const dono = criarIdentidade()

/**
 * O convidado precisa de e-mail DIFERENTE, e `criarIdentidade` sozinha não
 * garante isso: ela carimba com `Date.now()`, e as duas chamadas acontecem no
 * mesmo milissegundo na carga do módulo. A primeira execução falhou com "A
 * user with this email address has already been registered" — as duas
 * identidades eram a mesma pessoa.
 *
 * O sufixo entra antes do `@` para o Gmail continuar entregando na caixa do
 * dono (o `+` já está lá) e para a busca por `velofunil-teste` continuar
 * achando os dois se a limpeza falhar.
 */
const convidado = (() => {
  const base = criarIdentidade()
  return { ...base, email: base.email.replace('@', '-convidado@') }
})()

/** O que precisa sumir no fim, na ordem em que dá para apagar. */
const rastros: {
  workspaceId?: string
  donoId?: string
  convidadoId?: string
} = {}

test.describe('produto logado: senha, planilha, equipe, calendário, Google', () => {
  test.beforeAll(async ({ browser }) => {
    const admin = bancoAdmin()

    // As duas contas nascem com o e-mail já confirmado: confirmar por link é o
    // que `funil-completo` prova, e repetir aqui só tornaria este arquivo lento
    // e dependente do Resend para começar.
    for (const [quem, guardar] of [
      [dono, (id: string) => (rastros.donoId = id)],
      [convidado, (id: string) => (rastros.convidadoId = id)],
    ] as const) {
      const { data, error } = await admin.auth.admin.createUser({
        email: quem.email,
        password: quem.senha,
        email_confirm: true,
        user_metadata: { name: quem.nome },
      })
      if (error) throw new Error(`não deu para criar ${quem.email}: ${error.message}`)
      guardar(data.user!.id)
    }

    // Sessão de verdade para criar a empresa: a RPC é `authenticated`, e o
    // service role não tem `auth.uid()` — chamá-la com ele devolveria erro ou,
    // pior, um estado que nenhum cliente real produz.
    const comoDono = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { error: erroLogin } = await comoDono.auth.signInWithPassword({
      email: dono.email,
      password: dono.senha,
    })
    if (erroLogin) throw new Error(`sessão do dono falhou: ${erroLogin.message}`)

    const { data: workspaceId, error: erroEmpresa } = await comoDono.rpc(
      'create_workspace_with_admin',
      { workspace_name: dono.empresa },
    )
    if (erroEmpresa) throw new Error(`create_workspace_with_admin: ${erroEmpresa.message}`)
    rastros.workspaceId = workspaceId as string

    // O onboarding fica marcado como concluído: senão toda navegação é
    // devolvida para as boas-vindas e nenhum dos cinco testes chega na tela.
    //
    // `tour_status: 'skipped'` junto, senão o tour de 5 passos abre por cima
    // da tela e os cliques dos testes caem no overlay dele.
    //
    // O `error` é conferido de propósito. A primeira versão gravava um campo
    // `completed_at` que **não existe nesta tabela** — o PostgREST recusou, o
    // código seguiu em frente sem olhar, e o sintoma apareceu três telas
    // adiante como `GET /leads 307` seguido de `GET /bem-vindo`. É a armadilha
    // que o próprio projeto documenta: escrita que não é conferida vira
    // diagnóstico errado em outro lugar.
    const { error: erroOnboarding } = await admin.from('onboarding_state').upsert(
      {
        user_id: rastros.donoId!,
        status: 'completed',
        etapa: null,
        tour_status: 'skipped',
      },
      { onConflict: 'user_id' },
    )
    if (erroOnboarding) {
      throw new Error(`não deu para concluir o onboarding do dono: ${erroOnboarding.message}`)
    }

    navegador = await browser.newContext({ baseURL: URL_BASE })
    pagina = await navegador.newPage()
  })

  test.afterAll(async () => {
    await navegador?.close()

    const admin = bancoAdmin()
    const removidos: string[] = []
    const sobraram: string[] = []

    // Cada passo no seu try: se um falhar, os outros ainda precisam rodar.
    // Parar no meio deixa lixo com aparência de limpeza.
    if (rastros.workspaceId) {
      try {
        const { error } = await admin.from('workspaces').delete().eq('id', rastros.workspaceId)
        if (error) throw new Error(error.message)
        removidos.push('empresa (cascata leva contatos, tarefas, convites e membros)')
      } catch (e) {
        sobraram.push(`workspace ${rastros.workspaceId}: ${(e as Error).message}`)
      }
    }

    for (const [rotulo, id] of [
      ['dono', rastros.donoId],
      ['convidado', rastros.convidadoId],
    ] as const) {
      if (!id) continue
      try {
        const { error } = await admin.auth.admin.deleteUser(id)
        if (error) throw new Error(error.message)
        removidos.push(`conta do ${rotulo}`)
      } catch (e) {
        sobraram.push(`usuário ${id}: ${(e as Error).message}`)
      }
    }

    console.log(`\n[limpeza] removido: ${removidos.join(' | ') || '(nada)'}`)
    if (sobraram.length) {
      // Alto e claro: lixo silencioso em produção é o defeito que
      // `docs/estado-atual.md` já registra no caso das cobranças órfãs.
      console.error(`[limpeza] SOBROU, apagar à mão: ${sobraram.join(' | ')}`)
    }
  })

  // ---------------------------------------------------------------- senha
  test('1. recuperação de senha envia o e-mail e não revela quem existe', async () => {
    // A decisão travada do projeto: a tela não pode distinguir "conta não
    // existe" de "e-mail enviado", senão vira ferramenta de enumeração de
    // e-mail e alimenta phishing. Prova: os dois casos têm que terminar igual.
    const respostas: string[] = []

    for (const email of [dono.email, `nao-existe-${dono.carimbo}@velofunil.com.br`]) {
      await pagina.goto('/esqueci-senha')
      await pagina.locator('#email').fill(email)
      await pagina.getByRole('button', { name: /enviar|recuperar/i }).first().click()

      // O que aparece depois do envio, seja confirmação ou erro.
      await pagina.waitForTimeout(4_000)
      const texto = (await pagina.locator('main, body').first().innerText())
        .replace(/\s+/g, ' ')
        .trim()
      respostas.push(texto)
    }

    // Compara o texto SEM o e-mail dentro: a tela pode ecoar o endereço
    // digitado, e isso não revela nada — quem digitou já sabe o que digitou.
    const semEmail = (t: string) => t.replace(/[\w.+-]+@[\w.-]+/g, '<email>')
    expect(
      semEmail(respostas[0]),
      'a tela responde diferente para e-mail que existe e e-mail que não existe, o que permite enumerar contas',
    ).toBe(semEmail(respostas[1]))

    // E o e-mail tem que ter saído de verdade para quem existe.
    await expect
      .poll(
        async () => {
          const enviados = await emailsEnviados()
          return enviados.find((e) => e.to.includes(dono.email))?.last_event ?? null
        },
        {
          timeout: 60_000,
          intervals: [3_000, 5_000],
          message: 'nenhum e-mail de recuperação chegou ao Resend',
        },
      )
      .not.toBeNull()
  })

  // ------------------------------------------------------------- planilha
  test('2. importar CSV cria os contatos, com acento vindo de Windows-1252', async () => {
    await entrar(pagina, dono)
    await pagina.goto('/leads')

    // Windows-1252 de propósito: é o que o Excel em português salva, e o
    // defeito medido em 11/08 gravava "Jos� Ant�nio" em silêncio porque
    // `File.text()` decodifica sempre em UTF-8. `latin1` no Buffer produz
    // exatamente os bytes que o Excel produziria para estes caracteres.
    const csv = [
      'nome,email,telefone',
      'José Antônio,jose.antonio@exemplo.com.br,11987654321',
      'Conceição Gonçalves,conceicao@exemplo.com.br,11912345678',
    ].join('\r\n')

    await pagina.getByRole('button', { name: /importar/i }).first().click()

    await pagina.locator('input[type="file"]').setInputFiles({
      name: `contatos-${dono.carimbo}.csv`,
      mimeType: 'text/csv',
      buffer: Buffer.from(csv, 'latin1'),
    })

    // O diálogo avança sozinho para o mapeamento assim que lê o arquivo.
    await expect(
      pagina.getByText('Conferir as colunas'),
      'o arquivo não foi lido: o diálogo não passou para o mapeamento',
    ).toBeVisible({ timeout: 30_000 })

    await pagina.getByRole('button', { name: /^Importar 2$/ }).click()

    // A recusa da importação sai em TOAST, fora do diálogo (`enviar()` chama
    // `toast.error` e o diálogo fica parado no mapeamento). Uma asserção presa
    // ao diálogo fica cega exatamente no caso que interessa: ela reporta
    // "element not found" enquanto o motivo está escrito na tela, num portal
    // ao lado. Por isso o desfecho é lido dos dois lugares.
    const avisoDeErro = pagina.locator('[data-sonner-toast], [role="status"], [role="alert"]')
    let desfecho = ''

    await expect
      .poll(
        async () => {
          if (await pagina.getByText('Importação concluída').count()) {
            desfecho = 'Importação concluída'
            return desfecho
          }
          const reclamacao = (await avisoDeErro.allInnerTexts()).join(' | ').replace(/\s+/g, ' ').trim()
          if (reclamacao) {
            desfecho = reclamacao
            return desfecho
          }
          return null
        },
        {
          timeout: 60_000,
          intervals: [1_000, 2_000],
          message: 'a importação não concluiu nem reclamou: ficou parada',
        },
      )
      .not.toBeNull()

    expect(desfecho, `a importação não concluiu. A tela diz: ${desfecho}`).toContain(
      'Importação concluída',
    )

    // A prova real é o banco, não a tela de sucesso.
    const admin = bancoAdmin()
    const { data: contatos } = await admin
      .from('leads')
      .select('name, email, phone')
      .eq('workspace_id', rastros.workspaceId!)
      .order('name')

    expect(contatos?.length, 'as duas linhas da planilha deveriam ter virado contato').toBe(2)
    expect(
      contatos?.map((c) => c.name),
      'acento corrompido: o CSV foi lido como UTF-8 em vez de Windows-1252',
    ).toEqual(['Conceição Gonçalves', 'José Antônio'])
  })

  // ---------------------------------------------------------------- equipe
  test('3. convite: aceite entra como membro, e membro não vira admin', async () => {
    await entrar(pagina, dono)
    await pagina.goto('/settings?aba=equipe')

    await pagina.getByRole('button', { name: /^Convidar/ }).first().click()

    // Espera o diálogo ABRIR antes de digitar. Sem isto o `fill` corre contra
    // a montagem e escreve num campo que ainda não existe; o clique seguinte
    // envia um formulário vazio, a Server Action recusa, e o sintoma aparece
    // 45 segundos depois como "o convite não foi gravado" — apontando para o
    // banco, que não tem nada a ver.
    const dialogoDeConvite = pagina
      .getByRole('dialog')
      .filter({ hasText: 'Convidar colaborador' })
    await expect(dialogoDeConvite).toBeVisible({ timeout: 30_000 })

    await dialogoDeConvite.locator('#email').fill(convidado.email)
    await dialogoDeConvite.getByRole('button', { name: 'Enviar convite' }).click()

    // `workspace_invites`, e o nome importa: a primeira versão consultava uma
    // tabela `invitations` que não existe. O PostgREST devolveu erro, o
    // `data` veio `null`, e o teste esperou 45 segundos para reportar "o
    // convite não foi gravado" — culpando o produto por um erro de digitação
    // do teste. Por isso o `error` é lido e jogado para cima na hora.
    const admin = bancoAdmin()
    await expect
      .poll(
        async () => {
          const { data, error } = await admin
            .from('workspace_invites')
            .select('status, role')
            .eq('workspace_id', rastros.workspaceId!)
            .eq('email', convidado.email)
            .maybeSingle()
          if (error) throw new Error(`consulta a workspace_invites falhou: ${error.message}`)
          return data?.status ?? null
        },
        { timeout: 45_000, intervals: [1_000, 2_000], message: 'o convite não foi gravado' },
      )
      .toBe('pending')

    // O aceite acontece na sessão do CONVIDADO, em contexto próprio: reusar a
    // aba do dono trocaria a sessão no meio e o teste passaria a medir outra
    // coisa.
    const doConvidado = await navegador.browser()!.newContext({ baseURL: URL_BASE })
    const abaDele = await doConvidado.newPage()
    try {
      const { data: convite } = await admin
        .from('workspace_invites')
        .select('token')
        .eq('workspace_id', rastros.workspaceId!)
        .eq('email', convidado.email)
        .single()

      await entrar(abaDele, convidado)
      await abaDele.goto(`/convite/${convite!.token}`)
      await abaDele
        .getByRole('button', { name: /aceitar|entrar/i })
        .first()
        .click()
      await abaDele.waitForTimeout(6_000)

      const { data: vinculo } = await admin
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', rastros.workspaceId!)
        .eq('user_id', rastros.convidadoId!)
        .maybeSingle()

      expect(vinculo?.role, 'quem aceitou convite deveria entrar como membro').toBe('membro')

      // A parte que só o banco decide. "Regra que só vive na Server Action não
      // é regra": um membro que chame o PostgREST direto com a chave pública
      // (que está no HTML por desenho) tem que ser recusado pelo RLS, não pela
      // interface. Aqui ele tenta se promover a admin.
      const comoMembro = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )
      await comoMembro.auth.signInWithPassword({
        email: convidado.email,
        password: convidado.senha,
      })
      const { error: recusa } = await comoMembro
        .from('workspace_members')
        .update({ role: 'admin' })
        .eq('workspace_id', rastros.workspaceId!)
        .eq('user_id', rastros.convidadoId!)

      const { data: depois } = await admin
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', rastros.workspaceId!)
        .eq('user_id', rastros.convidadoId!)
        .maybeSingle()

      expect(
        depois?.role,
        `membro conseguiu se promover a admin pelo PostgREST (erro devolvido: ${recusa?.code ?? 'nenhum'})`,
      ).toBe('membro')
    } finally {
      /**
       * Erro ao FECHAR o contexto não é sinal do produto.
       *
       * Contra produção esta linha estourou uma vez com
       * `browserContext.close: Target page, context or browser has been
       * closed`, e derrubou uma execução que já tinha provado tudo que
       * importa — o convite, o papel e a recusa do RLS. A causa é a
       * navegação do aceite ainda em voo quando o `finally` fecha; contra o
       * servidor local, mais rápido, nunca aconteceu.
       *
       * Teste que falha às vezes é pior que teste que falha sempre: ensina a
       * reexecutar até passar, e aí ninguém olha mais o resultado. O contexto
       * é descartável e o processo do Playwright morre logo depois, então o
       * que sobra de um close mal sucedido é nada.
       */
      await doConvidado.close().catch(() => {})
    }

    // Remoção, de volta na sessão do dono.
    const { error: erroRemocao } = await admin
      .from('workspace_members')
      .delete()
      .eq('workspace_id', rastros.workspaceId!)
      .eq('user_id', rastros.convidadoId!)
    expect(erroRemocao, 'remover colaborador falhou').toBeNull()

    const { count } = await admin
      .from('workspace_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('workspace_id', rastros.workspaceId!)
    expect(count, 'depois da remoção só o dono deveria continuar na empresa').toBe(1)
  })

  // ------------------------------------------------------------ calendário
  test('4. calendário abre nos três modos e mostra a tarefa', async () => {
    const admin = bancoAdmin()
    const { data: contato } = await admin
      .from('leads')
      .select('id, name')
      .eq('workspace_id', rastros.workspaceId!)
      .limit(1)
      .maybeSingle()

    const tituloDaTarefa = `Ligar para o cliente ${dono.carimbo.slice(-5)}`
    const { error: erroTarefa } = await admin.from('tasks').insert({
      workspace_id: rastros.workspaceId!,
      lead_id: contato?.id ?? null,
      title: tituloDaTarefa,
      // `due_at`, não `due_date`: o nome errado devolve `PGRST204` do
      // PostgREST, que só aparece porque o `error` é conferido.
      //
      // Meio-dia evita a fronteira de fuso: o servidor da Vercel roda em UTC e
      // uma tarefa marcada para 23h em São Paulo cai no dia seguinte lá — é a
      // armadilha que `lib/tasks/buckets.ts` existe para tratar.
      due_at: `${hojeEmSaoPaulo()}T12:00:00-03:00`,
      created_by: rastros.donoId!,
    })
    expect(erroTarefa, 'não deu para criar a tarefa do teste').toBeNull()

    await entrar(pagina, dono)

    // Cada modo mostra uma coisa diferente, e isso é decisão registrada, não
    // acaso. Mês e Semana desenham `TaskChip`, cujo texto é
    // `task.lead_name ?? task.title`: num chip de uma linha, quem ligar vale
    // mais que o que fazer, e o comentário do componente traz a medição que
    // levou a isso (`09:00 Cl… t`, com o nome do cliente cortado). Agenda usa
    // `TaskItem`, que tem espaço para o título inteiro.
    //
    // O teste afirma o que cada uma promete. Exigir o título nos três
    // reprovaria o produto por fazer a coisa certa — foi o que a primeira
    // versão fez.
    const oQueApareceEmCada: Record<string, string> = {
      Mês: contato!.name,
      Semana: contato!.name,
      Agenda: tituloDaTarefa,
    }

    for (const [modo, esperado] of Object.entries(oQueApareceEmCada)) {
      await pagina.goto('/calendario')
      await pagina.waitForTimeout(2_500)

      await pagina.getByRole('button', { name: modo, exact: true }).first().click()
      await pagina.waitForTimeout(2_500)

      const achou = await pagina
        .getByText(esperado, { exact: false })
        .first()
        .isVisible()
        .catch(() => false)

      if (!achou) {
        // Mostra o que a tela DE FATO tem. Sem isto o relatório é só
        // "element not found", que manda investigar o lugar errado — e foi
        // exatamente assim que a versão anterior acusou o calendário de não
        // mostrar a tarefa, quando ela estava lá com outro rótulo.
        const naTela = (await pagina.locator('main').first().innerText())
          .replace(/\s+/g, ' ')
          .slice(0, 600)
        throw new Error(
          `no modo ${modo} a tarefa de hoje deveria aparecer como "${esperado}". A tela mostra: ${naTela}`,
        )
      }
    }

    // O título não pode simplesmente sumir onde o chip mostra o cliente: ele
    // continua no `title` nativo, que é o que aparece no hover.
    await pagina.goto('/calendario')
    await pagina.waitForTimeout(2_500)
    const dicaDoChip = await pagina
      .locator(`[title*="${contato!.name}"]`)
      .first()
      .getAttribute('title')
    expect(
      dicaDoChip ?? '',
      'o título da tarefa sumiu do chip: nem no texto, nem no `title` do hover',
    ).toContain(tituloDaTarefa)

    // O defeito medido em 18/08: `useMediaQuery` devolve `false` no primeiro
    // render sempre (evita descasamento de hidratação), e o modo inicial lia
    // esse falso positivo de telefone uma única vez — travando todo desktop na
    // Agenda em vez do Mês. Numa tela larga, o padrão tem que ser Mês.
    await pagina.setViewportSize({ width: 1440, height: 900 })
    await pagina.goto('/calendario')
    await pagina.waitForTimeout(3_000)
    const modoInicial = await pagina
      .getByRole('button', { name: 'Mês', exact: true })
      .first()
      .getAttribute('data-state')
      .catch(() => null)
    // `data-state` pode não existir; o sinal que sempre existe é a grade do mês.
    const temGradeDoMes = await pagina.getByText(/segunda|seg\b/i).count()
    expect(
      temGradeDoMes > 0 || modoInicial === 'active',
      'no desktop o calendário deveria abrir no modo Mês, não na Agenda',
    ).toBe(true)
  })

  // --------------------------------------------------------------- Google
  test('5. OAuth do Google recusa nos quatro casos e só então vai ao Google', async () => {
    // Esta rota é o portão inteiro do fluxo: o callback grava com service role
    // confiando no `state` assinado, então quem consegue um `state` válido já
    // passou. Cada desvio abaixo é uma das guardas do `GET`.
    await entrar(pagina, dono)

    /**
     * As quatro guardas são lidas pelo cabeçalho `Location`, sem navegar.
     *
     * `page.goto` numa rota que só redireciona é frágil: a navegação pode
     * abortar no meio da cadeia (`net::ERR_ABORTED; maybe frame was
     * detached?`), e este teste passou duas vezes antes de falhar assim, o que
     * é pior que falhar sempre — vira ruído que ensina a reexecutar até passar.
     *
     * `page.request` compartilha os cookies do contexto, então a sessão do
     * dono vai junto e as guardas continuam sendo exercitadas de verdade.
     */
    const portao = async (query: string) => {
      const resposta = await pagina.request.get(
        `/api/integrations/google/connect?${query}`,
        { maxRedirects: 0 },
      )
      return decodeURIComponent(resposta.headers()['location'] ?? '')
    }

    // Provider inventado não pode virar `state` nenhum.
    expect(await portao('provider=facebook')).toContain('erro=provider_invalido')

    // Sem Pro não conecta. A empresa nasce em TRIAL (0053), que `pro_vigente`
    // aceita — para provar a recusa, o trial é encurtado no banco e desfeito
    // logo em seguida.
    const admin = bancoAdmin()
    const { data: antes } = await admin
      .from('workspaces')
      .select('trial_ate')
      .eq('id', rastros.workspaceId!)
      .single()

    await admin
      .from('workspaces')
      .update({ trial_ate: '2020-01-01T00:00:00Z', plan: 'free' })
      .eq('id', rastros.workspaceId!)

    try {
      expect(
        await portao('provider=google_calendar'),
        'empresa sem Pro conseguiu passar do portão do OAuth',
      ).toContain('erro=plano_free')
    } finally {
      await admin
        .from('workspaces')
        .update({ trial_ate: antes!.trial_ate, plan: 'pro' })
        .eq('id', rastros.workspaceId!)
    }

    // Sem sessão, vai para o login e não para o Google.
    const anonimo = await navegador.browser()!.newContext({ baseURL: URL_BASE })
    try {
      const semSessao = await anonimo
        .request
        .get('/api/integrations/google/connect?provider=gmail', { maxRedirects: 0 })
      expect(semSessao.headers()['location'] ?? '').toMatch(/\/login/)
    } finally {
      await anonimo.close()
    }

    // E o caminho feliz: com Pro e admin, sai para o Google pedindo EXATAMENTE
    // os dois escopos que a verificação aprovou em 24/08. `calendar.events`
    // (sem `.owned`) foi o que reprovou a submissão anterior, por dar acesso a
    // agenda que terceiros compartilharam.
    for (const [provider, escopo] of [
      ['google_calendar', 'calendar.events.owned'],
      ['gmail', 'gmail.send'],
    ] as const) {
      // Lê o `Location` da NOSSA rota, sem seguir. Navegar de verdade cai na
      // tela de login do Google (o navegador do teste não tem conta lá), e
      // ela reembrulha o pedido original dentro de `continue=`, codificado
      // outra vez — o escopo continua lá, mas some de uma leitura simples da
      // URL final. A primeira versão fez isso e acusou o produto de "pedir
      // escopo diferente do aprovado", que era falso.
      //
      // `page.request` compartilha os cookies do contexto, então a sessão do
      // dono vai junto e as guardas acima continuam valendo.
      const destino = await portao(`provider=${provider}`)

      expect(destino, `${provider} não foi redirecionado ao Google`).toContain(
        'accounts.google.com',
      )
      expect(destino, `${provider} pediu escopo diferente do aprovado`).toContain(escopo)
      expect(
        destino,
        'o escopo largo `calendar.events` foi o motivo da reprovação de 20/08, não pode voltar',
      ).not.toMatch(/calendar\.events(?!\.owned)/)
    }
  })

  // ------------------------------------------------------- próxima ação
  test('6. Próxima ação oferece a tarefa que já existe em vez de criar a segunda', async () => {
    const admin = bancoAdmin()

    // Cenário próprio, e não o dos testes anteriores: eles pegam contato com
    // `.limit(1)` sem `order`, e depender disso amarraria este teste à ordem
    // que o Postgres devolveu por acaso.
    const { data: contato, error: erroContato } = await admin
      .from('leads')
      .insert({
        workspace_id: rastros.workspaceId!,
        name: `Cliente da Proxima Acao ${dono.carimbo.slice(-5)}`,
        email: `proxima.acao.${dono.carimbo}@exemplo.com.br`,
        // `owner_id`, nao `created_by`: quem guarda `created_by` e `tasks`.
        owner_id: rastros.donoId!,
      })
      .select('id, name')
      .single()
    expect(erroContato, 'não deu para criar o contato do teste').toBeNull()

    const { data: negocio, error: erroNegocio } = await admin
      .from('deals')
      .insert({
        workspace_id: rastros.workspaceId!,
        lead_id: contato!.id,
        title: `Negocio da Proxima Acao ${dono.carimbo.slice(-5)}`,
        value: 1000,
        stage: 'novo',
        owner_id: rastros.donoId!,
      })
      .select('id')
      .single()
    expect(erroNegocio, 'não deu para criar o negócio do teste').toBeNull()

    // A tarefa que o defeito escondia: aberta, do contato, SEM `deal_id`. É
    // exatamente o que a página do Contato produzia, e o painel do negócio
    // nunca mostrava.
    const tituloDaTarefaSolta = `Ligar antes da proposta ${dono.carimbo.slice(-5)}`
    const { error: erroTarefa } = await admin.from('tasks').insert({
      workspace_id: rastros.workspaceId!,
      lead_id: contato!.id,
      deal_id: null,
      title: tituloDaTarefaSolta,
      type: 'ligacao',
      due_at: `${hojeEmSaoPaulo()}T14:00:00-03:00`,
      created_by: rastros.donoId!,
      assignee_id: rastros.donoId!,
    })
    expect(erroTarefa, 'não deu para criar a tarefa solta').toBeNull()

    await entrar(pagina, dono)
    await pagina.goto(`/kanban?negocio=${negocio!.id}`)
    await pagina.waitForTimeout(3_000)

    const painel = pagina.locator('[data-slot="sheet-content"]')
    await expect(painel, 'o painel do negócio não abriu').toBeVisible({ timeout: 30_000 })

    // O texto que contradizia o produto: dizia "Nenhuma agendada" enquanto o
    // contato tinha tarefa aberta. Agora nomeia o escopo.
    await expect(painel.getByText('Nada marcado para este negócio.')).toBeVisible()

    await painel.getByRole('button', { name: 'Agendar' }).click()

    // O ponto do pedido: antes isto abria o formulário de tarefa nova direto.
    const diálogo = pagina.getByRole('dialog').filter({ hasText: 'Próxima ação' })
    await expect(
      diálogo,
      'o diálogo abriu direto no formulário, sem oferecer a tarefa que já existe',
    ).toBeVisible({ timeout: 30_000 })

    const escolher = diálogo.getByRole('button', {
      name: new RegExp(`Usar "${tituloDaTarefaSolta}"`),
    })
    await expect(escolher, 'a tarefa aberta do contato não apareceu como opção').toBeVisible({
      timeout: 15_000,
    })

    await escolher.click()
    await pagina.waitForTimeout(4_000)

    // A prova é o banco: UMA tarefa, agora ligada ao negócio. Duas significaria
    // que o defeito continua, só que atrás de um clique a mais.
    const { data: tarefas } = await admin
      .from('tasks')
      .select('id, title, deal_id, done_at')
      .eq('workspace_id', rastros.workspaceId!)
      .eq('lead_id', contato!.id)

    expect(tarefas?.length, 'deveria continuar existindo UMA tarefa, não duas').toBe(1)
    expect(tarefas![0].deal_id, 'a tarefa não foi ligada ao negócio').toBe(negocio!.id)
  })

  test('7. sem tarefa para escolher, "Agendar" abre o formulário direto', async () => {
    const admin = bancoAdmin()

    // Contato sem tarefa nenhuma: não há o que escolher, e uma tela dizendo
    // "não há nada aqui" seria um clique a mais cobrado de todo mundo para
    // servir a minoria.
    const { data: contato } = await admin
      .from('leads')
      .insert({
        workspace_id: rastros.workspaceId!,
        name: `Cliente Sem Tarefa ${dono.carimbo.slice(-5)}`,
        email: `sem.tarefa.${dono.carimbo}@exemplo.com.br`,
        owner_id: rastros.donoId!,
      })
      .select('id')
      .single()

    const { data: negocio } = await admin
      .from('deals')
      .insert({
        workspace_id: rastros.workspaceId!,
        lead_id: contato!.id,
        title: `Negocio Sem Tarefa ${dono.carimbo.slice(-5)}`,
        value: 500,
        stage: 'novo',
        owner_id: rastros.donoId!,
      })
      .select('id')
      .single()

    await entrar(pagina, dono)
    await pagina.goto(`/kanban?negocio=${negocio!.id}`)
    await pagina.waitForTimeout(3_000)

    const painel = pagina.locator('[data-slot="sheet-content"]')
    await painel.getByRole('button', { name: 'Agendar' }).click()

    const formulario = pagina.getByRole('dialog').filter({ hasText: 'Nova tarefa' })
    await expect(
      formulario,
      'sem candidata, o formulário deveria abrir direto, sem etapa de escolha',
    ).toBeVisible({ timeout: 30_000 })

    // Este era o único diálogo committal do produto sem saída visível: só
    // `Esc` ou o X, e nenhum dos dois é descobrível.
    await expect(formulario.getByRole('button', { name: 'Cancelar' })).toBeVisible()

    // O atalho existe para ninguém precisar operar o campo segmentado de data
    // com teclado ou leitor de tela.
    const atalho = formulario.getByRole('button', { name: /^Amanhã, / })
    await expect(atalho, 'o atalho de prazo não apareceu').toBeVisible()

    await formulario.locator('#task-due').fill('')
    await atalho.click()
    const prazo = await formulario.locator('#task-due').inputValue()
    expect(prazo, 'o atalho não preencheu o campo de prazo').toMatch(
      /^[0-9]{4}-[0-9]{2}-[0-9]{2}T09:00$/,
    )

    // O erro tem que ficar LIGADO ao campo: `role="alert"` anuncia uma vez, e
    // quem volta com Tab depois não ouve mais nada.
    await formulario.locator('#task-title').fill('a')
    await formulario.getByRole('button', { name: 'Criar tarefa' }).click()
    await pagina.waitForTimeout(1_500)

    const descrito = await formulario.locator('#task-title').getAttribute('aria-describedby')
    expect(descrito, 'o campo com erro não aponta para a mensagem de erro').toBe('task-title-erro')
    await expect(formulario.locator('#task-title-erro')).toBeVisible()

    // Cancelar fecha sem criar nada.
    await formulario.getByRole('button', { name: 'Cancelar' }).click()
    await pagina.waitForTimeout(1_500)

    const { count } = await admin
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', rastros.workspaceId!)
      .eq('lead_id', contato!.id)
    expect(count, 'Cancelar criou tarefa').toBe(0)
  })

  // ------------------------------------------------ conexão com o Google
  test('8. conectar o Google avisa da caixa de permissão antes de sair da tela', async () => {
    await entrar(pagina, dono)
    await pagina.goto('/settings?aba=integracoes')
    await pagina.waitForTimeout(2_500)

    const conectar = pagina.getByRole('button', { name: 'Conectar Google Calendar' })
    await expect(conectar, 'o botão de conectar não apareceu').toBeVisible({ timeout: 30_000 })

    await conectar.click()

    // O ponto todo: antes isto era um `<a>` que saía do produto na hora. O
    // erro acontece NA tela do Google, e de lá não dá para avisar ninguém.
    const tutorial = pagina.getByRole('dialog').filter({ hasText: 'Conectar Google Calendar' })
    await expect(
      tutorial,
      'clicar em Conectar saiu direto para o Google, sem explicar nada',
    ).toBeVisible({ timeout: 20_000 })

    expect(pagina.url(), 'a página navegou quando deveria só abrir o diálogo').toContain(
      '/settings',
    )

    // O passo que carrega o peso. Sem este aviso, a pessoa clica em Continuar
    // com a caixa desmarcada e recebe um token sem permissão nenhuma.
    await expect(tutorial.getByText('Marcar a caixa de permissão')).toBeVisible()
    await expect(tutorial.getByText(/aparece desmarcada/i)).toBeVisible()

    // O botão precisa ser um link de verdade: a rota responde com redirect
    // para FORA do domínio, e navegação do App Router não sai do site.
    const irParaGoogle = tutorial.getByRole('link', { name: /Ir para o Google/ })
    await expect(irParaGoogle).toBeVisible()
    expect(await irParaGoogle.getAttribute('href')).toBe(
      '/api/integrations/google/connect?provider=google_calendar',
    )

    // Saída visível, como todo diálogo committal deste produto.
    await tutorial.getByRole('button', { name: 'Agora não' }).click()
    await pagina.waitForTimeout(1_200)
    await expect(tutorial).toBeHidden()
  })

  test('9. voltar do Google sem a permissão explica a causa e o conserto', async () => {
    await entrar(pagina, dono)

    // O código que o callback passou a emitir quando o escopo não vem. Um
    // código sem texto no mapa devolveria a pessoa a uma tela em branco, que é
    // pior que o defeito original: ela saberia que algo falhou e nada mais.
    await pagina.goto('/settings?aba=integracoes&erro=permissao_faltando')
    await pagina.waitForTimeout(2_500)

    const aviso = pagina.locator('[role="alert"]').first()
    await expect(aviso, 'o erro novo não tem mensagem no mapa da tela').toBeVisible({
      timeout: 20_000,
    })

    const texto = (await aviso.innerText()).replace(/\s+/g, ' ')
    expect(texto, `a mensagem não nomeia a causa: ${texto}`).toMatch(/permiss/i)
    expect(texto, `a mensagem não diz o que fazer: ${texto}`).toMatch(/marque a caixa/i)

    // E o card continua dizendo a verdade: não conectado, com o caminho de
    // volta ao lado. Antes desta rodada este caso mostrava "✓ Conectado".
    await expect(
      pagina.getByRole('button', { name: 'Conectar Google Calendar' }),
    ).toBeVisible()
  })

  test('10. o aviso de conectado sai sozinho, o de erro não', async () => {
    await entrar(pagina, dono)

    await pagina.goto('/settings?aba=integracoes&conectado=gmail')
    const aviso = pagina.locator('[role="status"]').filter({ hasText: 'Gmail conectado' })
    await expect(aviso).toBeVisible({ timeout: 20_000 })
    const nasceu = Date.now()

    // Diz o que MUDA, não só que conectou: o selo "✓ Conectado" do card já
    // afirma o estado, com o e-mail junto.
    await expect(aviso).toContainText(/enviar e-mail direto/)

    // O endereço perde `?conectado=` na hora. Sem isso, recarregar dias depois
    // traria a faixa de volta anunciando algo que já aconteceu.
    expect(pagina.url()).not.toContain('conectado=')

    // Sai sozinho. A faixa larga: 4s de espera + 320ms de transição, e a
    // execução do teste custa alguns milissegundos a cada leitura.
    await expect(aviso).toBeHidden({ timeout: 9_000 })
    const saiuEm = (Date.now() - nasceu) / 1000
    expect(saiuEm, `saiu cedo demais (${saiuEm.toFixed(1)}s)`).toBeGreaterThan(3.5)

    // O X fecha antes disso, para quem não quer esperar.
    await pagina.goto('/settings?aba=integracoes&conectado=google_calendar')
    const outro = pagina.locator('[role="status"]').filter({ hasText: 'Google Calendar conectado' })
    await expect(outro).toBeVisible({ timeout: 20_000 })
    await pagina.getByRole('button', { name: 'Fechar aviso' }).click()
    await expect(outro).toBeHidden({ timeout: 3_000 })

    /**
     * O erro NÃO some sozinho, e a diferença é deliberada.
     *
     * O aviso de sucesso é redundante — o card mostra o selo e a conta. O erro
     * carrega a ÚNICA cópia da explicação e do que fazer, e some enquanto a
     * pessoa lê seria pior do que não avisar.
     */
    await pagina.goto('/settings?aba=integracoes&erro=permissao_faltando')
    const erro = pagina.locator('[role="alert"]').first()
    await expect(erro).toBeVisible({ timeout: 20_000 })
    await pagina.waitForTimeout(6_000)
    await expect(erro, 'o erro sumiu sozinho, e não devia').toBeVisible()
  })
})

/** Dia de hoje no fuso de São Paulo, que é o que o produto usa. */
function hojeEmSaoPaulo(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

async function entrar(page: Page, quem: IdentidadeDeTeste) {
  await page.goto('/login')

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
