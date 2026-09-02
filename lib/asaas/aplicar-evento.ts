import 'server-only'

import { revalidatePath } from 'next/cache'

import { createAdminClient } from '@/lib/supabase/admin'
import { dadosDeCorrespondencia } from '@/lib/analytics/dados-de-correspondencia'
import { getResend } from '@/lib/resend/client'
import { renderPagamentoConfirmadoEmail } from '@/lib/emails/pagamento-confirmado'
import { renderPagamentoAtrasadoEmail } from '@/lib/emails/pagamento-atrasado'
import { enviarConversaoDeCompra } from '@/lib/analytics/meta-conversions'
import { PRO_PLAN_PRICE } from '@/lib/plans'
import { appUrl } from '@/lib/app-url'
import type { SubscriptionStatus } from '@/types/supabase'

export type StatusAssinatura = 'active' | 'past_due' | 'canceled'

/**
 * O que `subscriptions.status` pode ser, incluindo `trialing`.
 *
 * Mais largo que `StatusAssinatura`: aquele é o que um evento do Asaas pode
 * APLICAR, este é o que a coluna pode CONTER. `trialing` nunca chega por
 * evento, mas é o estado inicial de toda assinatura criada no checkout — e por
 * isso aparece como `de_status` no histórico da primeira cobrança.
 */
type StatusDeAssinaturaNoBanco = SubscriptionStatus

export type ResultadoAplicacao =
  | { ok: true; duplicate: boolean; matched: boolean }
  | { ok: false }

/**
 * Aplica um status de assinatura vindo do Asaas, dedupe, RPC atômica
 * (status + plano) e os side effects que dependem dela (e-mail, conversão
 * pro Meta). Extraído do handler do webhook (`app/api/webhooks/asaas/route.ts`)
 * pra ser reusado pelo job de reconciliação (`app/api/cron/reconciliar-assinaturas/route.ts`),
 * que descobre o `status`/`subscriptionId` consultando a API do Asaas
 * direto em vez de receber um payload de webhook, o efeito, uma vez que se
 * sabe o status, é o mesmo dos dois caminhos.
 *
 * `origem` só entra no log, pra diferenciar no Vercel se a correção veio do
 * webhook em tempo real ou da varredura periódica.
 */
export async function aplicarEventoAsaas(params: {
  supabase: ReturnType<typeof createAdminClient>
  status: StatusAssinatura
  subscriptionId: string
  eventId: string
  eventType: string
  /**
   * Como a pessoa pagou (CREDIT_CARD, BOLETO, PIX), quando se sabe.
   *
   * Decide a tolerância depois do vencimento: cartão recusado corta em 24h,
   * boleto e Pix mantêm 3 dias porque podem estar compensando com o dinheiro
   * já fora da conta (`dias_de_graca`, migration 0044).
   *
   * `null` é legítimo: nem todo evento traz pagamento (cancelamento de
   * assinatura, por exemplo). A RPC preserva o tipo já gravado nesse caso, em
   * vez de apagá-lo, senão a graça mudaria de 1 para 3 dias na hora errada.
   */
  billingType?: string | null
  origem: string
}): Promise<ResultadoAplicacao> {
  const { supabase, status, subscriptionId, eventId, eventType, billingType, origem } = params

  // Idempotência: sem isso, reenviar um PAYMENT_CONFIRMED legítimo (retry do
  // Asaas, replay manual ou nova passada do job de reconciliação sobre o
  // mesmo pagamento) reativava plan='pro' depois de um cancelamento. O
  // insert com PK no id do evento é a trava, se já existe, o evento já foi
  // processado e não repetimos o efeito.
  const { error: dedupeError } = await supabase
    .from('asaas_webhook_events')
    .insert({ event_id: eventId, event_type: eventType })

  if (dedupeError) {
    // 23505 = unique_violation: evento repetido, não é erro.
    if (dedupeError.code === '23505') {
      return { ok: true, duplicate: true, matched: false }
    }
    console.error(`[${origem}] Asaas: falha ao registrar evento`, dedupeError)
    return { ok: false }
  }

  // O estado ANTES da mudança, lido aqui porque a RPC não devolve o que
  // sobrescreveu. É o que transforma o histórico em narrativa ("estava
  // past_due, virou active") em vez de uma lista de estados soltos.
  //
  // Uma ida a mais ao banco, num caminho que não é quente: o webhook processa
  // um evento por vez e o cron roda uma vez por dia. Falha aqui não interrompe
  // nada — o histórico é registro, não regra, e perder uma linha dele nunca
  // pode custar a aplicação do pagamento.
  const { data: anterior } = await supabase
    .from('subscriptions')
    .select('workspace_id, status')
    .eq('asaas_subscription_id', subscriptionId)
    .maybeSingle()

  // Atualizar `subscriptions.status` e `workspaces.plan` em dois round-trips
  // deixava a porta aberta pra segunda escrita falhar e o plano ficar errado
  // em silêncio. A RPC faz as duas na mesma transação.
  const { data: matched, error } = await supabase.rpc('apply_asaas_subscription_status', {
    p_asaas_subscription_id: subscriptionId,
    p_status: status,
    p_billing_type: billingType ?? undefined,
  })

  if (error) {
    // O registro de dedupe já foi gravado, então uma nova tentativa cairia
    // em 23505 sem nunca aplicar o status. Apagar a marca devolve o evento
    // pra fila: o próximo retry (webhook ou reconciliação) reprocessa de
    // verdade.
    await supabase.from('asaas_webhook_events').delete().eq('event_id', eventId)
    console.error(`[${origem}] Asaas: falha ao aplicar status da assinatura`, error)
    return { ok: false }
  }

  // Sem isso, quem confirma pagamento pelo webhook (o caminho normal,
  // ninguém está com a aba de Cobrança aberta esperando) via a tela
  // continuar mostrando fatura pendente até o cache do Next expirar
  // sozinho. `createCheckout`/`cancelSubscription` (lib/asaas/actions.ts)
  // já revalidam quando a MUDANÇA parte da própria pessoa; isto cobre o
  // caminho assíncrono, webhook em tempo real e o cron de reconciliação,
  // que também passa por esta função.
  if (matched === true) {
    revalidatePath('/settings/billing')
    await registrarNoHistorico(supabase, {
      workspaceId: anterior?.workspace_id ?? null,
      de: anterior?.status ?? null,
      para: status,
      origem,
      billingType: billingType ?? null,
      eventId,
    })
  }

  // Pagamento confirmado é o único momento em que o produto tinha algo a
  // dizer e ficava calado, liberação do Pro é assíncrona, sem aviso não dá
  // pra saber quando voltar a olhar.
  if (status === 'active' && matched === true) {
    await enviarEmailDoWebhook(supabase, subscriptionId, renderPagamentoConfirmadoEmail)
    await enviarConversaoParaMeta(supabase, subscriptionId, eventId)
  } else if (status === 'past_due' && matched === true) {
    await enviarEmailDoWebhook(supabase, subscriptionId, renderPagamentoAtrasadoEmail)
  }

  return { ok: true, duplicate: false, matched: matched === true }
}

/**
 * Grava uma linha no histórico da assinatura.
 *
 * ## Por que só aqui, e em nenhum outro lugar
 *
 * Esta função é o caminho compartilhado entre o webhook do Asaas e o cron de
 * reconciliação. Gravar o histórico nos dois separadamente criaria duas cópias
 * da mesma regra, que divergem no primeiro dia em que uma mudar — e a regra do
 * dinheiro é a pior de todas para divergir.
 *
 * ## Por que nunca derruba o chamador
 *
 * O histórico é registro, não regra. Se a escrita falhar, o pagamento já foi
 * aplicado e o cliente já tem o Pro: devolver erro aqui faria o webhook
 * responder 500, o Asaas reenviar, e o dedupe barrar sem reprocessar. Trocar
 * uma linha de histórico por um pagamento preso é um péssimo negócio.
 */
async function registrarNoHistorico(
  supabase: ReturnType<typeof createAdminClient>,
  dados: {
    workspaceId: string | null
    de: StatusDeAssinaturaNoBanco | null
    para: StatusAssinatura
    origem: string
    billingType: string | null
    eventId: string
  },
): Promise<void> {
  if (!dados.workspaceId) return

  // Estado repetido não vira linha: o cron confere todo dia, e sem isto uma
  // assinatura estável encheria o histórico de "active → active". Ruído mata
  // a lista inteira, lição já paga em /dono/alertas.
  if (dados.de === dados.para) return

  const { error } = await supabase.from('assinatura_eventos').insert({
    workspace_id: dados.workspaceId,
    de_status: dados.de,
    para_status: dados.para,
    origem: dados.origem,
    billing_type: dados.billingType,
    asaas_event_id: dados.eventId,
  })

  if (error) {
    console.error('Histórico de assinatura: falha ao gravar', error)
  }
}

/**
 * Busca o workspace e o e-mail do dono a partir da assinatura do Asaas.
 *
 * `created_by` é quem abriu a empresa e, pela regra do checkout, o único
 * que pode assinar, é para ele que a cobrança vai. Compartilhado entre
 * `enviarEmailDoWebhook` e `enviarConversaoParaMeta` pra não repetir as
 * mesmas três idas ao banco (subscriptions → workspaces → auth.admin) duas
 * vezes na mesma chamada.
 *
 * Exportado porque o job diário (`app/api/cron/reconciliar-assinaturas`)
 * precisa exatamente da mesma busca para mandar o aviso de vencimento.
 */
export async function buscarAssinante(
  supabase: ReturnType<typeof createAdminClient>,
  subscriptionId: string,
): Promise<{
  workspaceName: string
  /** Para o evento de compra buscar cidade, estado e CEP. */
  workspaceId: string
  /** Aceite do banner, gravado no onboarding. `null` = nunca respondeu. */
  consentimento: boolean | null
  email: string
  fbc: string | null
  fbp: string | null
  /** Telefone do dono, quando cadastrado no Auth — vira `ph` no evento do Meta. */
  telefone: string | null
  userId: string
} | null> {
  const { data: assinatura } = await supabase
    .from('subscriptions')
    .select('workspace_id')
    .eq('asaas_subscription_id', subscriptionId)
    .maybeSingle()

  if (!assinatura) return null

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('name, created_by, fbc, fbp, consentimento_analitico')
    .eq('id', assinatura.workspace_id)
    .maybeSingle()

  if (!workspace?.created_by) return null

  const { data: dono } = await supabase.auth.admin.getUserById(workspace.created_by)
  const email = dono?.user?.email
  if (!email) return null

  return {
    workspaceName: workspace.name,
    workspaceId: assinatura.workspace_id,
    consentimento: workspace.consentimento_analitico ?? null,
    email,
    fbc: workspace.fbc,
    fbp: workspace.fbp,
    telefone: dono?.user?.phone || null,
    userId: workspace.created_by,
  }
}

/**
 * Manda o e-mail correspondente ao status novo.
 *
 * Engole qualquer falha de propósito. O e-mail é aviso, não é o efeito: o
 * status já foi aplicado na transação anterior. Deixar uma exceção escapar
 * aqui faria o webhook responder 500, o Asaas reenviar o evento, e o dedupe
 * por `event_id`, que já gravou este evento, devolver sucesso sem
 * reprocessar nada.
 *
 * A idempotência do envio vem de graça do dedupe: um `event_id` só chega
 * aqui uma vez, então não há risco de mandar o mesmo e-mail duas vezes.
 */
async function enviarEmailDoWebhook(
  supabase: ReturnType<typeof createAdminClient>,
  subscriptionId: string,
  render: (params: { workspaceName: string; valor: number; appUrl: string }) => {
    subject: string
    html: string
  },
) {
  try {
    const assinante = await buscarAssinante(supabase, subscriptionId)
    if (!assinante) return

    // ## O consentimento, lido do BANCO e não do cookie
    //
    // Este caminho nasce no webhook do Asaas: quem faz a requisição é o
    // gateway, não a pessoa. Não há cookie, não há `localStorage`, não há
    // visitante — a guarda de `enviarEventoParaMeta` não tem o que ler aqui.
    //
    // Por isso a 0065 guarda a decisão em `workspaces`, no onboarding. `null`
    // (empresa criada antes da coluna, ou quem nunca respondeu o banner) conta
    // como recusa: ausência de decisão nunca é consentimento.
    if (assinante.consentimento !== true) return

    const { subject, html } = render({
      workspaceName: assinante.workspaceName,
      valor: PRO_PLAN_PRICE,
      appUrl: appUrl(),
    })

    const { error } = await getResend().emails.send({
      from: 'Velo Funil <suporte@velofunil.com.br>',
      to: assinante.email,
      subject,
      html,
    })

    if (error) {
      console.error('Asaas: falha ao enviar e-mail', error)
    }
  } catch (err) {
    console.error('Asaas: erro ao enviar e-mail', err)
  }
}

/**
 * Avisa o Meta que um pagamento de verdade aconteceu, Conversions API,
 * server-side, sem depender do navegador de quem pagou (o checkout roda na
 * página hospedada do Asaas). Mesma idempotência do e-mail: `eventId` só
 * chega aqui uma vez por causa do dedupe em `asaas_webhook_events`.
 */
async function enviarConversaoParaMeta(
  supabase: ReturnType<typeof createAdminClient>,
  subscriptionId: string,
  eventId: string,
) {
  try {
    const assinante = await buscarAssinante(supabase, subscriptionId)
    if (!assinante) return

    // ## O Purchase era o evento de PIOR identificação do funil
    //
    // `InitiateCheckout` e `AddPaymentInfo` já passavam por
    // `dadosDeCorrespondencia()` e levavam `fn`, `ln`, `ct`, `st` e `zp`. O
    // Purchase não — mandava só e-mail, telefone e `external_id`.
    //
    // É o inverso do que a Meta precisa: o evento que mais vale para o
    // algoritmo aprender era o que menos permitia casar a conversão com uma
    // pessoa. E não havia razão registrada para a diferença — o dado estava
    // no banco o tempo todo, a uma consulta de distância.
    const correspondencia = await dadosDeCorrespondencia(assinante.workspaceId)

    await enviarConversaoDeCompra({
      ...correspondencia,
      email: assinante.email,
      valor: PRO_PLAN_PRICE,
      eventId,
      fbc: assinante.fbc,
      fbp: assinante.fbp,
      // O spread vem ANTES para estas linhas vencerem: o telefone do Auth é
      // o da pessoa que paga, e o de `workspaces` é o comercial da empresa.
      // Para casar a conversão, o primeiro identifica melhor.
      telefone: assinante.telefone ?? correspondencia.telefone,
      userId: assinante.userId,
    })
  } catch (err) {
    console.error('Asaas: erro ao enviar conversão pro Meta', err)
  }
}
