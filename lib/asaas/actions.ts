'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

import { asaasFetch, AsaasApiError } from '@/lib/asaas/client'
import { ehClienteDeOutraConta } from '@/lib/asaas/cliente-orfao'
import { appUrl } from '@/lib/app-url'
import { ipDaRequisicao } from '@/lib/request-ip'
import { excedeuLimite } from '@/lib/rate-limit'
import {
  enviarConversaoDeFormaDePagamento,
  enviarConversaoDeInicioDeCheckout,
} from '@/lib/analytics/meta-conversions'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUserAndWorkspace } from '@/lib/supabase/workspace'
import { dadosDeCorrespondencia } from '@/lib/analytics/dados-de-correspondencia'
import { cancelSubscriptionSchema, checkoutSchema } from '@/lib/validations/billing'
import {
  CICLOS,
  PLANO_NA_TELA,
  PRO_PLAN_PRICE,
  valorDoPlano,
} from '@/lib/plans'
import { CONTROLADOR } from '@/lib/legal'
import { prepararPixParaExibir, type QrCodePixDoAsaas } from '@/lib/asaas/pix'
import { prepararBoletoParaExibir, type LinhaDigitavelDoAsaas } from '@/lib/asaas/boleto'

type AsaasCustomer = { id: string }
type AsaasSubscription = { id: string }
type AsaasPayment = { id: string; invoiceUrl: string }
type AsaasPaymentList = { data: AsaasPayment[] }

type AsaasNotificacao = {
  id: string
  emailEnabledForCustomer: boolean
  smsEnabledForCustomer: boolean
  whatsappEnabledForCustomer: boolean
}

/**
 * Desliga as notificações que o Asaas manda por conta própria.
 *
 * ## Por que não basta `notificationDisabled: true` na criação
 *
 * Passar a flag ao criar o cliente **não** desliga os eventos: medido em
 * 31/08 com cliente descartável, o cliente nasce `notificationDisabled=true`
 * e mesmo assim com **8 de 8** eventos ativos (`PAYMENT_CREATED`,
 * `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `PAYMENT_DUEDATE_WARNING` ×2,
 * `PAYMENT_UPDATED`, `SEND_LINHA_DIGITAVEL`).
 *
 * São dois mecanismos independentes, e a documentação não diz qual vence.
 * Descobrir experimentalmente exigiria gerar cobrança real e esperar a fatura
 * para ver se a tarifa de mensageria apareceu — caro e lento. Desligar os
 * dois remove a pergunta.
 *
 * ## Por que isso importa
 *
 * Cada aviso enviado é tarifado como mensageria (R$ 0,99 no extrato desta
 * conta), e o produto **já manda todos eles** pelo Resend: pagamento
 * confirmado, pagamento atrasado, e a escada D-4..D-1 de vencimento. Manter
 * ligado paga para mandar duas vezes a mesma coisa, com dois remetentes
 * diferentes — que é como se treina alguém a marcar o remetente como spam,
 * perdendo junto o e-mail que importa.
 *
 * ## Por que falha não derruba o checkout
 *
 * Isto é economia, não correção de defeito: se as chamadas falharem, o
 * cliente ainda assina e ainda paga — só recebe aviso duplicado. Derrubar um
 * checkout por causa disso trocaria R$ 0,99 por R$ 49.
 *
 * Roda uma vez por cliente, no instante da criação, e em paralelo: são 8
 * chamadas independentes, e em série elas custariam ~8× a latência num
 * caminho que a pessoa está esperando.
 */
async function desligarNotificacoesDoCliente(customerId: string) {
  try {
    const { data } = await asaasFetch<{ data: AsaasNotificacao[] }>(
      `/customers/${customerId}/notifications`,
    )

    await Promise.all(
      (data ?? [])
        .filter(
          (n) =>
            n.emailEnabledForCustomer ||
            n.smsEnabledForCustomer ||
            n.whatsappEnabledForCustomer,
        )
        .map((n) =>
          asaasFetch(`/notifications/${n.id}`, {
            method: 'PUT',
            body: JSON.stringify({
              emailEnabledForCustomer: false,
              smsEnabledForCustomer: false,
              whatsappEnabledForCustomer: false,
            }),
          }),
        ),
    )
  } catch (erro) {
    console.error('desligarNotificacoesDoCliente falhou', customerId, erro)
  }
}

export async function createCheckout(values: unknown) {
  const parsed = checkoutSchema.safeParse(values)
  if (!parsed.success) {
    // Fallback neutro: o schema deixou de ter um campo só, e dizer
    // "CPF ou CNPJ inválido" para um ciclo desconhecido mandaria a pessoa
    // conferir o documento certo.
    return { error: parsed.error.issues[0]?.message ?? 'Não foi possível iniciar a assinatura.' }
  }
  const ciclo = parsed.data.ciclo
  const plano = parsed.data.plano
  const planoNaTela = PLANO_NA_TELA[plano]

  const { user, workspaceId } = await getCurrentUserAndWorkspace()
  const supabase = await createClient()

  const { data: isAdmin } = await supabase.rpc('is_workspace_admin', {
    target_workspace_id: workspaceId,
  })
  if (!isAdmin) {
    return { error: `Apenas administradores podem assinar o plano ${planoNaTela}.` }
  }

  // Depois do gate de admin e antes de qualquer chamada ao Asaas: a ideia é
  // não gastar cliente, assinatura nem cobrança no gateway por uma tentativa
  // que já ia ser recusada. Por USUÁRIO e não por IP, mesmo motivo do
  // feedback — aqui sempre há alguém identificado, e limitar por IP puniria
  // um escritório inteiro pelo excesso de uma pessoa.
  if (await excedeuLimite('checkout', user.id)) {
    return {
      error:
        'Você tentou assinar várias vezes seguidas. Aguarde alguns minutos e tente de novo.',
    }
  }

  // `fbc`/`fbp` entram no mesmo `select` que já busca o nome: são as âncoras
  // de atribuição gravadas por `finalizarOnboarding` e a diferença entre o
  // Meta saber que este checkout veio de um anúncio ou não. Mesmo dado que
  // `buscarAssinante` lê no caminho do Purchase.
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('name, fbc, fbp')
    .eq('id', workspaceId)
    .single()

  if (!workspace) {
    return { error: 'Workspace não encontrado.' }
  }

  const { data: existingSubscription } = await supabase
    .from('subscriptions')
    .select('asaas_customer_id, asaas_subscription_id, status, ciclo, plano')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  // ## A cobrança DUPLA, e ela nunca disparou por sorte de calendário
  //
  // Todas as guardas abaixo filtram `subscriptions` por `workspace_id`. Nenhuma
  // pergunta se o DONO já paga.
  //
  // O ramo 3 de `pro_vigente()` (0078) cobre as empresas IRMÃS do mesmo dono.
  // Então o caminho era: paga R$ 97 na empresa A, cria a empresa B, abre a
  // Cobrança de B, lê "Free" (porque `workspaces.plan` nunca é promovido),
  // clica em Assinar, e **uma segunda assinatura de R$ 97 nasce no Asaas** por
  // um plano que a pessoa já tem.
  //
  // Medido em 19/09: QUATRO empresas em produção com `plan = 'free'` e
  // `pro_vigente` verdadeiro, e ZERO donos com duas assinaturas ativas. Era
  // latente, com a munição toda carregada.
  //
  // ## Só o PRO é recusado, e o Max continua vendável
  //
  // `max_vigente` tem UM ramo só e não tem trial, de propósito: cada instância
  // de WhatsApp custa dinheiro de verdade, e dar ramo 3 a ela entregaria cinco
  // instâncias pagas por uma assinatura de R$ 250. Quem tem Pro pelo ramo 3
  // **precisa** poder assinar o Max.
  //
  // Recusar o Max aqui consertaria a cobrança dupla vendendo menos, que é a
  // forma silenciosa de errar.
  if (plano === 'pro' && !existingSubscription) {
    const { data: jaTemPro } = await supabase.rpc('pro_vigente', {
      target_workspace_id: workspaceId,
    })

    // `=== true` e não `Boolean(...)`: a RPC devolve `null` quando a leitura
    // falha, e `null` aqui precisa cair no lado que DEIXA seguir. Bloquear uma
    // venda por indisponibilidade de leitura é pior que a duplicata que esta
    // guarda evita, porque a duplicata ainda é reembolsável e a venda perdida
    // não volta.
    if (jaTemPro === true) {
      return {
        error:
          `Esta empresa já usa o ${PLANO_NA_TELA.pro} que você paga em outra empresa sua. ` +
          'Não é preciso assinar de novo aqui. Veja em Configurações, Cobrança.',
      }
    }
  }

  if (existingSubscription?.status === 'active') {
    // Nomeia o plano que ESTÁ ativo, não o que se tentou assinar: quem tem Pro
    // e clica em Max precisa ler "você já tem Pro", e não "você já tem Max".
    const ativo = PLANO_NA_TELA[existingSubscription.plano === 'max' ? 'max' : 'pro']
    return { error: `Este workspace já tem uma assinatura ${ativo} ativa.` }
  }

  // ## Trocar de ciclo OU DE PLANO com assinatura viva é recusado, e o motivo
  // é dinheiro nos dois casos
  //
  // Logo abaixo, `subscriptionId` é reaproveitado quando a assinatura anterior
  // não está `canceled` — e nesse caso o `if (!subscriptionId)` PULA a criação
  // no Asaas. A assinatura lá continuaria MONTHLY, cobrando R$ 49, enquanto o
  // upsert daqui gravaria `ciclo = 'YEARLY'`. A pessoa pagaria R$ 49 e a RPC
  // lhe daria um ano.
  //
  // Com o Max o buraco fica pior, porque a coluna `plano` não decide duração:
  // decide DIREITO. Reusando uma assinatura Pro de R$ 97, a cobrança
  // continuaria R$ 97 e a coluna diria `max` — e `max_vigente()` liberaria uma
  // instância de WhatsApp paga por um plano que não a cobre. É o único lugar
  // deste produto onde um erro de coluna vira custo recorrente de verdade.
  //
  // Cancelar-e-recriar e `PUT /subscriptions` foram considerados e ficaram de
  // fora: o primeiro reproduz o estado do workspace "pedro eee" se o POST
  // falhar depois do DELETE (ver o comentário logo abaixo), e o segundo depende
  // de `updatePendingPayments`, que nunca foi medido nesta conta — e mexeria no
  // valor de um boleto que a pessoa pode estar com a tela aberta.
  //
  // Recusar nomeia a ação que resolve. Trocar em silêncio não.
  const temAssinaturaViva =
    Boolean(existingSubscription?.asaas_subscription_id) &&
    existingSubscription?.status !== 'canceled'

  const cicloAtual = existingSubscription?.ciclo ?? 'MONTHLY'
  // `=== 'max'` e não um cast: a coluna é `text` no banco, e uma linha gravada
  // antes da 0089 (ou por migration futura) pode trazer qualquer coisa. Ler
  // como Pro o que não reconheço é o default seguro — o inverso liberaria Max.
  const planoAtual = existingSubscription?.plano === 'max' ? 'max' : 'pro'

  if (temAssinaturaViva && (cicloAtual !== ciclo || planoAtual !== plano)) {
    const periodo = CICLOS[cicloAtual].periodo
    // O valor do plano E do ciclo que a assinatura de fato tem. Ler de
    // `CICLOS[ciclo].valor`, como esta linha fazia, daria sempre o preço do Pro
    // — e anunciaria "cobrança de R$ 250" como "R$ 97" para quem tem Max.
    const valor = valorDoPlano(planoAtual, cicloAtual)
    return {
      error:
        `Já existe uma cobrança ${periodo} de R$ ${valor} (plano ${PLANO_NA_TELA[planoAtual]}) ` +
        'em aberto nesta empresa. Cancele a assinatura atual em Configurações → Cobrança para trocar de plano.',
    }
  }

  let customerId = existingSubscription?.asaas_customer_id ?? null
  // `subscriptionId` só é reaproveitado se a assinatura anterior ainda está
  // viva no Asaas. Uma assinatura `canceled` (cancelSubscription já chamou
  // DELETE nela) fica INACTIVE/deleted=true lá — reusar o id faz este
  // fluxo pular a criação de assinatura nova (linha abaixo só cria quando
  // `!subscriptionId`) e tentar buscar a fatura de uma assinatura morta,
  // que não tem pagamento nenhum. `payments.data` vem vazio,
  // `invoiceUrl` fica `undefined`, e a pessoa vê "assinatura criada, mas
  // não foi possível gerar o link de pagamento" — mesmo que a assinatura
  // NUNCA tenha sido recriada. Achado real: workspace "pedro eee" preso
  // nesse estado, confirmado contra a API do Asaas.
  let subscriptionId =
    existingSubscription?.status === 'canceled'
      ? null
      : (existingSubscription?.asaas_subscription_id ?? null)

  // externalReference fica opaco pro Asaas (eles só devolvem de volta nos
  // webhooks), codifica workspace e usuário juntos aqui pra permitir
  // reconciliação/auditoria futura sem precisar de outra consulta.
  //
  // O formato JSON `{"workspaceId":"<uuid>","userId":"<uuid>"}` tem 106
  // caracteres e o Asaas rejeita acima de 100 com
  // `400 invalid_object: O identificador externo não deve ultrapassar 100
  // caracteres`. Estourava para todo usuário, sempre, porque UUID tem tamanho
  // fixo, não era caso de borda.
  //
  // Dois UUIDs separados por `:` dão 73 caracteres e carregam a mesma
  // informação. Quem lê isso depois faz `split(':')`.
  const externalReference = `${workspaceId}:${user.id}`

  try {
    // A ordem aqui é sonda-depois-cria, e não o contrário, de propósito: o
    // `PUT` abaixo já era feito sempre, então ele serve de teste de existência
    // do cliente sem custar nenhuma chamada a mais no caminho feliz.
    if (customerId) {
      // Cliente pode já existir de uma tentativa anterior, a Asaas exige
      // CPF/CNPJ pra criar cobrança, então garante que está preenchido
      // mesmo num cliente reaproveitado (idempotente, sempre atualiza).
      try {
        await asaasFetch<AsaasCustomer>(`/customers/${customerId}`, {
          method: 'PUT',
          body: JSON.stringify({ cpfCnpj: parsed.data.cpfCnpj }),
        })
      } catch (err) {
        // O id pode ser de OUTRA conta Asaas. A migração de 31/08 trocou a
        // conta inteira (CNPJ do MEI baixado, e o gateway não deixa alterar
        // CNPJ de conta existente), e todo `cus_…` gravado antes disso aponta
        // para a conta velha — 13 das 15 linhas, medido no dia.
        //
        // Descartar o id e criar outro é o mesmo remédio que `subscriptionId`
        // ganhou em 19/08; esta era a metade que tinha ficado sem guarda.
        // O que NÃO é cliente ausente continua subindo, ver `cliente-orfao.ts`.
        if (!ehClienteDeOutraConta(err)) throw err
        customerId = null
        // A assinatura pertence ao cliente. Se ele é de outra conta, ela
        // também é — reusar o id aqui recriaria o defeito de 19/08 pelo
        // outro caminho: assinatura que não existe neste gateway, fatura
        // que nunca vem, e "não foi possível gerar o link de pagamento".
        subscriptionId = null
      }
    }

    if (!customerId) {
      const customer = await asaasFetch<AsaasCustomer>('/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: workspace.name,
          email: user.email,
          cpfCnpj: parsed.data.cpfCnpj,
          externalReference,
          // Metade da defesa. A outra é `desligarNotificacoesDoCliente`,
          // chamada logo abaixo: medido, esta flag sozinha NÃO desliga os
          // eventos — o cliente nasce com ela `true` e com 8 de 8 ativos.
          // O porquê de desligar está no comentário daquela função.
          notificationDisabled: true,
        }),
      })
      customerId = customer.id
      await desligarNotificacoesDoCliente(customerId)
    }

    if (!subscriptionId) {
      const subscription = await asaasFetch<AsaasSubscription>('/subscriptions', {
        method: 'POST',
        body: JSON.stringify({
          customer: customerId,
          // `UNDEFINED` continua: é o que faz a MESMA cobrança oferecer Pix,
          // boleto e cartão no `PagarDialog`. Um Pix de R$ 490 fechado na
          // visita é exatamente o caso de uso do plano anual.
          billingType: 'UNDEFINED',
          cycle: ciclo,
          value: valorDoPlano(plano, ciclo),
          nextDueDate: new Date().toISOString().slice(0, 10),
          // Aparece na fatura, no boleto e no extrato do cartão. É o único
          // texto de marca que controlamos nessa tela: o nome do recebedor vem
          // do cadastro da conta Asaas e, em MEI, é a razão social da Receita,
          // aqui, um CNPJ seguido do nome civil do titular. Trinta dias depois
          // da compra, ninguém reconhece aquilo, e é dessa não-identificação
          // que nasce a contestação.
          //
          // Por isso a descrição carrega três coisas, nesta ordem: a marca que
          // a pessoa reconhece, o que ela está pagando, e o canal para
          // perguntar antes de contestar. O e-mail entra no lugar da URL
          // porque quem não reconheceu a cobrança precisa FALAR com alguém, e
          // não visitar um site.
          //
          // Só vale para assinaturas novas, as já criadas mantêm a descrição
          // gravada no Asaas, que é a fonte da verdade da cobrança.
          description: `Velo Funil, Plano ${planoNaTela} · CRM de vendas · Assinatura ${CICLOS[ciclo].periodo} · ${CONTROLADOR.email}`,
          externalReference,
        }),
      })
      subscriptionId = subscription.id
    }
  } catch (err) {
    // O status HTTP diz o que aconteceu sem precisar adivinhar: 401 é chave
    // de API errada ou desatualizada (segredo diferente do token do
    // webhook, não confundir os dois na hora de depurar), 400 costuma ser
    // campo inválido no corpo da requisição, 403 é permissão da conta Asaas.
    if (err instanceof AsaasApiError) {
      console.error(
        `createCheckout: Asaas respondeu ${err.status} em ${err.path}`,
        err.body.slice(0, 500),
      )
    } else {
      console.error('createCheckout: falha ao chamar a API do Asaas', err)
    }
    return { error: 'Não foi possível iniciar a assinatura no Asaas. Tente novamente.' }
  }

  // subscriptions não tem policy de insert/update pro client (só o webhook,
  // via service role, mexe no status de cobrança), usa admin client aqui
  // de propósito, é a única escrita legítima fora do webhook porque só
  // grava customer_id/subscription_id, nunca o status de pagamento em si.
  //
  // `status` reusa o antigo só quando a assinatura antiga também foi
  // reusada (não passou por `canceled` acima). Uma assinatura RECÉM-CRIADA
  // no Asaas (subscriptionId != asaas_subscription_id anterior) começa
  // sempre como 'trialing' — gravar 'canceled' aqui travaria o workspace no
  // mesmo estado que motivou criar a assinatura de novo.
  const subscriptionFoiRecriada = subscriptionId !== existingSubscription?.asaas_subscription_id
  const admin = createAdminClient()
  const { error: upsertError } = await admin.from('subscriptions').upsert(
    {
      workspace_id: workspaceId,
      asaas_customer_id: customerId,
      asaas_subscription_id: subscriptionId,
      status: subscriptionFoiRecriada ? 'trialing' : (existingSubscription?.status ?? 'trialing'),
      // ## `ciclo` só entra quando a assinatura NASCEU nesta chamada
      //
      // A coluna decide se um pagamento compra 30 dias ou um ano
      // (`intervalo_do_ciclo`, migration 0070), e este upsert usa o admin
      // client — não há RLS por baixo para segurar erro de código. A única
      // defesa é esta condição.
      //
      // Gravá-la sempre permitiria que ela descrevesse um ciclo que a
      // assinatura do Asaas não tem: reusando uma assinatura MONTHLY, a
      // cobrança continuaria R$ 49 e a coluna diria YEARLY. Amarrada ao id
      // recém-criado, a coluna é consequência do que o gateway aceitou —
      // que é o que a torna entrada confiável, e não mais um palpite (0027).
      //
      // O guard lá em cima é a educação; isto é a trava. Se alguém remover
      // aquele, este continua impedindo a divergência.
      //
      // `plano` anda JUNTO de `ciclo`, na mesma condição e pelo mesmo motivo,
      // com uma consequência a mais: `plano` não decide duração, decide
      // DIREITO. Gravado sobre uma assinatura reusada, `max_vigente()` passaria
      // a devolver `true` para quem pagou Pro — e cada `true` desses é uma
      // instância de WhatsApp paga por nós, todo mês, até alguém notar.
      ...(subscriptionFoiRecriada ? { ciclo, plano } : {}),
    },
    { onConflict: 'workspace_id' },
  )

  if (upsertError) {
    console.error('createCheckout: falha ao salvar subscription', upsertError)
    return { error: 'Não foi possível iniciar a assinatura.' }
  }

  let invoiceUrl: string | undefined
  try {
    const payments = await asaasFetch<AsaasPaymentList>(
      `/payments?subscription=${subscriptionId}&limit=1`,
    )
    invoiceUrl = payments.data[0]?.invoiceUrl
  } catch (err) {
    console.error('createCheckout: falha ao buscar link de pagamento', err)
  }

  if (!invoiceUrl) {
    return { error: 'Assinatura criada, mas não foi possível gerar o link de pagamento.' }
  }

  // "InitiateCheckout" pro Meta, e a posição é a regra: só DEPOIS do
  // `invoiceUrl` confirmado. Antes daqui a assinatura pode existir sem
  // cobrança nenhuma — foi exatamente o estado em que o workspace "pedro eee"
  // ficou preso —, e avisar "iniciou o pagamento" de quem não tem o que pagar
  // ensina o algoritmo a perseguir um passo que não acontece.
  //
  // É o sinal mais próximo de compra que existe sem ter havido pagamento. O
  // vão que ele fecha é de DIAS: Pix e boleto demoram horas, cartão pode ser
  // recusado, e sem este evento o clique original podia sair da janela de
  // atribuição antes de o Purchase chegar.
  try {
    const cabecalhos = await headers()
    // Nome, cidade, estado e CEP da empresa: cada um amplia a janela de
    // correspondência da Meta. Estavam no banco desde o onboarding e nunca
    // eram enviados — o EMQ media 6,2 de 10 com e-mail, IP e user agent só.
    const correspondencia = await dadosDeCorrespondencia(workspaceId)
    await enviarConversaoDeInicioDeCheckout({
      email: user.email ?? '',
      ...correspondencia,
      // `checkout:` + id da assinatura, não UUID novo: quem clica em "Assinar"
      // de novo depois de fechar o diálogo cairia como segunda intenção de
      // compra, inflando o número que a campanha usa para otimizar.
      eventId: `checkout:${subscriptionId}`,
      // O valor do PLANO no ciclo escolhido, não a constante mensal do Pro.
      //
      // O argumento original vale entre ciclos: reportar um checkout anual
      // como mensal ensinaria a Meta que o comprador anual vale o mesmo. Ele
      // vale igual entre PLANOS, e era aí que esta linha errava — todo início
      // de checkout de Max ia como R$ 97.
      //
      // Duas linhas acima, `:348`, o valor que vai ao Asaas já usava
      // `valorDoPlano`. O gateway recebia 250 e a Meta recebia 97, no mesmo
      // bloco.
      valor: valorDoPlano(plano, ciclo),
      userId: user.id,
      fbc: workspace.fbc,
      fbp: workspace.fbp,
      actionSource: 'website',
      clientIp: await ipDaRequisicao(),
      clientUserAgent: cabecalhos.get('user-agent'),
      eventSourceUrl: `${appUrl()}/settings/billing`,
    })
  } catch (err) {
    console.error('Falha ao enviar InitiateCheckout pro Meta', err)
  }

  // Confirma que a cobrança existe, mas NÃO devolve mais a URL da fatura.
  //
  // Até 23/08 esta função devolvia `{ url }` e quem chamava abria a página do
  // Asaas em outra aba. Agora o pagamento acontece dentro do produto
  // (`PagarDialog`), que busca as três formas da mesma cobrança — o `invoiceUrl`
  // continua existindo e é usado lá, só para cartão.
  //
  // Fica registrado o motivo de a volta do Asaas nunca ter sido automática: o
  // `callback.successUrl` **não funciona**, testado contra a API em 11/08/2026 —
  // `POST /subscriptions` aceita o campo com HTTP 200, não o devolve na leitura,
  // não propaga para a cobrança gerada, e `PUT /payments` com `callback`
  // responde 500. Com o pagamento aqui dentro, isso deixou de ser um problema.
  return { success: true }
}

/**
 * Cancela a assinatura Pro do workspace.
 *
 * Ordem deliberada: cancela PRIMEIRO no Asaas, depois marca no banco. O Asaas
 * é quem de fato cobra, se a ordem fosse invertida e a chamada remota
 * falhasse, o app mostraria "cancelado" enquanto a fatura continuaria caindo
 * todo mês. Melhor a pessoa ver um erro e tentar de novo do que acreditar num
 * cancelamento que não aconteceu.
 *
 * O plano volta para `free` junto: manter Pro sem assinatura ativa é o mesmo
 * defeito que a auditoria encontrou no workspace de seed.
 */
export async function cancelSubscription(values: unknown) {
  const parsed = cancelSubscriptionSchema.safeParse(values)
  if (!parsed.success) {
    return { error: 'Digite CANCELAR para confirmar.' }
  }

  const { workspaceId } = await getCurrentUserAndWorkspace()
  const supabase = await createClient()

  const { data: isAdmin } = await supabase.rpc('is_workspace_admin', {
    target_workspace_id: workspaceId,
  })
  if (!isAdmin) {
    return { error: 'Apenas administradores podem cancelar a assinatura.' }
  }

  const { data: assinatura } = await supabase
    .from('subscriptions')
    .select('asaas_subscription_id, status')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (!assinatura?.asaas_subscription_id) {
    return { error: 'Não há assinatura ativa para cancelar.' }
  }

  if (assinatura.status === 'canceled') {
    return { error: 'Esta assinatura já foi cancelada.' }
  }

  try {
    await asaasFetch(`/subscriptions/${assinatura.asaas_subscription_id}`, {
      method: 'DELETE',
    })
  } catch (err) {
    if (err instanceof AsaasApiError) {
      console.error(
        `cancelSubscription: Asaas respondeu ${err.status} em ${err.path}`,
        err.body.slice(0, 500),
      )
      // 404 significa que a assinatura já não existe lá, seguir e acertar o
      // banco é o resultado correto, não um erro para a pessoa.
      if (err.status !== 404) {
        return {
          error: 'Não foi possível cancelar no Asaas. Tente novamente em instantes.',
        }
      }
    } else {
      console.error('cancelSubscription: falha ao chamar o Asaas', err)
      return { error: 'Não foi possível cancelar a assinatura. Tente novamente.' }
    }
  }

  // `subscriptions` e `workspaces.plan` não têm policy de escrita para o
  // client, o webhook é quem mexe nisso, via service role. Mesma justificativa
  // do upsert em `createCheckout`.
  const admin = createAdminClient()

  const { error: erroStatus } = await admin
    .from('subscriptions')
    .update({
      status: 'canceled',
      // ## A marca é o que separa "parei de renovar" de "meu dinheiro voltou"
      //
      // Os dois produzem `status = 'canceled'`, e pedem tratamento oposto: no
      // primeiro o dinheiro do ciclo ficou conosco, no segundo voltou.
      //
      // `assinatura_compra_acesso` (0098) só preserva o período pago quando
      // esta coluna está preenchida, então estorno e chargeback continuam
      // cortando na hora. É o que os Termos prometem na seção 5, palavra por
      // palavra: *"o acesso ao plano pago permanece até o fim do período já
      // pago"*.
      cancelado_pelo_cliente_em: new Date().toISOString(),
    })
    .eq('workspace_id', workspaceId)

  // A COLUNA desce na hora, e a FUNÇÃO é que decide o acesso. Não é
  // contradição: `workspaces.plan` é o último valor gravado e nunca foi fonte
  // de verdade — `planoEfetivo()` lê `pro_vigente()` e vai mostrar "Pro" até o
  // fim do período pago, que é o certo. Os limites leem a função direto.
  const { error: erroPlano } = await admin
    .from('workspaces')
    .update({ plan: 'free' })
    .eq('id', workspaceId)

  if (erroStatus || erroPlano) {
    // A cobrança JÁ parou no Asaas neste ponto. Deixar o app achando que ainda
    // é Pro é o lado seguro do erro, e o log permite acertar à mão.
    console.error('cancelSubscription: cancelou no Asaas mas falhou no banco', {
      workspaceId,
      erroStatus,
      erroPlano,
    })
    return {
      error:
        'A cobrança foi cancelada, mas houve falha ao atualizar sua conta. Fale com o suporte.',
    }
  }

  revalidatePath('/settings/billing')
  revalidatePath('/settings')
  return { success: true }
}

/**
 * Os três meios de pagamento da cobrança em aberto, para exibir DENTRO do app.
 *
 * ## Uma cobrança, três representações
 *
 * O projeto cria a assinatura com `billingType: 'UNDEFINED'`, e isso é o que
 * torna esta tela possível: no Asaas, uma cobrança assim aceita qualquer método,
 * e cada endpoint devolve a forma correspondente da MESMA cobrança. Medido
 * contra a API em 23/08 — a mesma `pay_...` respondeu `pixQrCode` (200),
 * `identificationField` (200) e trouxe `bankSlipUrl`.
 *
 * Não é preciso criar uma cobrança por método, nem perguntar antes qual a
 * pessoa quer. Ela escolhe na tela, com os três já prontos.
 *
 * ## Por que cartão continua saindo daqui
 *
 * O Asaas permite processar cartão por API (`/creditCard/tokenizeCreditCard`),
 * mas isso faz o número do cartão passar pelo nosso servidor e nos coloca no
 * escopo de PCI-DSS: auditoria, questionário de conformidade e
 * responsabilidade legal em caso de vazamento. Para um SaaS de R$ 49 operado
 * por uma pessoa, o custo não se paga. Cartão usa `invoiceUrl`, onde a
 * responsabilidade é do Asaas.
 *
 * ## Por que uma falha parcial não derruba a tela
 *
 * Pix e boleto são buscados em paralelo e cada um pode falhar sozinho. Se o Pix
 * não vier, a tela mostra boleto e cartão — quem está tentando pagar não pode
 * ficar sem nenhum caminho porque um endpoint oscilou.
 */
export async function obterFormasDePagamento() {
  const { user, workspaceId } = await getCurrentUserAndWorkspace()
  const supabase = await createClient()

  const { data: isAdmin } = await supabase.rpc('is_workspace_admin', {
    target_workspace_id: workspaceId,
  })
  if (!isAdmin) {
    return { error: 'Só administradores podem ver os dados de pagamento.' }
  }

  // `ciclo` vem junto para o diálogo de pagamento saber dizer "por mês" ou
  // "por ano". Sem ele, a tela mostraria o valor certo (490, que vem da
  // cobrança) com o período errado — e "R$ 490 por mês" é pior que os dois
  // errados, porque parece correto.
  const { data: assinatura } = await supabase
    .from('subscriptions')
    .select('asaas_subscription_id, ciclo')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  const subscriptionId = assinatura?.asaas_subscription_id
  if (!subscriptionId) {
    return { error: 'Nenhuma assinatura encontrada. Comece pelo botão de assinar.' }
  }

  let cobranca: { id: string; invoiceUrl: string; bankSlipUrl?: string; value?: number } | undefined
  try {
    const lista = await asaasFetch<{
      data: Array<{ id: string; invoiceUrl: string; bankSlipUrl?: string; value?: number }>
    }>(`/payments?subscription=${subscriptionId}&status=PENDING&limit=1`)
    cobranca = lista.data[0]
  } catch (err) {
    console.error('obterFormasDePagamento: falha ao buscar a cobrança', err)
    return { error: 'Não foi possível carregar a cobrança. Tente de novo em instantes.' }
  }

  if (!cobranca) {
    return { error: 'Não há cobrança em aberto para esta assinatura.' }
  }

  // Em paralelo e tolerantes a falha individual: um método fora do ar não pode
  // esconder os outros dois de quem está com o cartão na mão.
  const [pixBruto, boletoBruto] = await Promise.all([
    asaasFetch<QrCodePixDoAsaas>(`/payments/${cobranca.id}/pixQrCode`).catch((err) => {
      console.error('obterFormasDePagamento: Pix indisponível', err)
      return null
    }),
    asaasFetch<LinhaDigitavelDoAsaas>(`/payments/${cobranca.id}/identificationField`).catch(
      (err) => {
        console.error('obterFormasDePagamento: boleto indisponível', err)
        return null
      },
    ),
  ])

  // "AddPaymentInfo" pro Meta: a pessoa está com a forma de pagamento na
  // frente. É o último passo antes do dinheiro, e quem chega aqui e não paga
  // é o público de remarketing mais valioso que este funil produz.
  //
  // **Conferido que isto não vira laço**, que era o risco óbvio numa tela que
  // fica aberta esperando o Pix cair: o `PagarDialog` chama esta função uma
  // vez por abertura (efeito com dependência `[open]`); quem roda a cada 5s é
  // `pagamentoFoiConfirmado`, logo abaixo, que é outra função. Ainda assim o
  // `event_id` é preso ao id da cobrança, então fechar e reabrir o diálogo
  // manda o mesmo evento e a Meta deduplica em vez de contar de novo.
  try {
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('fbc, fbp')
      .eq('id', workspaceId)
      .maybeSingle()

    const cabecalhos = await headers()
    await enviarConversaoDeFormaDePagamento({
      email: user.email ?? '',
      eventId: `pagamento:${cobranca.id}`,
      valor: cobranca.value ?? PRO_PLAN_PRICE,
      userId: user.id,
      fbc: workspace?.fbc,
      fbp: workspace?.fbp,
      actionSource: 'website',
      clientIp: await ipDaRequisicao(),
      clientUserAgent: cabecalhos.get('user-agent'),
      eventSourceUrl: `${appUrl()}/settings/billing`,
    })
  } catch (err) {
    console.error('Falha ao enviar AddPaymentInfo pro Meta', err)
  }

  return {
    pagamento: {
      // O valor real da cobrança, do gateway. O fallback só existe para o caso
      // de o Asaas omitir o campo, e nesse caso o mensal é o palpite seguro.
      valor: cobranca.value ?? PRO_PLAN_PRICE,
      ciclo: assinatura?.ciclo ?? 'MONTHLY',
      pix: prepararPixParaExibir(pixBruto),
      boleto: prepararBoletoParaExibir(boletoBruto),
      boletoPdfUrl: cobranca.bankSlipUrl ?? null,
      /** Só para cartão — ver o comentário sobre PCI acima. */
      urlDoCartao: cobranca.invoiceUrl,
    },
  }
}

/**
 * O pagamento já caiu?
 *
 * A tela chama isto de tempos em tempos enquanto o QR está aberto. Quem aplica
 * o efeito continua sendo o webhook do Asaas (`lib/asaas/aplicar-evento.ts`) —
 * esta função só LÊ, e por isso não há risco de duas fontes ativando o plano.
 *
 * Lê `pro_vigente()` em vez de `subscriptions.status` pelo motivo de sempre: a
 * coluna é o último valor gravado e não sabe que o período venceu (0027).
 */
export async function pagamentoFoiConfirmado() {
  const { workspaceId } = await getCurrentUserAndWorkspace()
  const supabase = await createClient()

  const [{ data: proVigente }, { data: emTrial }] = await Promise.all([
    supabase.rpc('pro_vigente', { target_workspace_id: workspaceId }),
    supabase.rpc('em_trial', { target_workspace_id: workspaceId }),
  ])

  // Pro valendo sem ser por trial só pode ser pagamento confirmado.
  return { confirmado: proVigente === true && emTrial !== true }
}
