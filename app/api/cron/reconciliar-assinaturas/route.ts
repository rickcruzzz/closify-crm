import { timingSafeEqual } from 'node:crypto'

import { NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'
import {
  aplicarEventoAsaas,
  buscarAssinante,
  type StatusAssinatura,
} from '@/lib/asaas/aplicar-evento'
import { buscarPagamentoMaisRecente } from '@/lib/asaas/status-real'
import { getResend } from '@/lib/resend/client'
import { renderPlanoVencendoEmail } from '@/lib/emails/plano-vencendo'
import { PRO_PLAN_PRICE } from '@/lib/plans'
import { appUrl } from '@/lib/app-url'

// `timingSafeEqual` e o client admin (service role) não rodam no Edge, ver
// mesmo comentário em app/api/webhooks/asaas/route.ts.
export const runtime = 'nodejs'

/**
 * Rede de segurança pro caso do webhook do Asaas falhar em entregar (DNS
 * fora do ar, deploy no meio, timeout, qualquer motivo: o Asaas não
 * reenvia sozinho depois de uma falha). Roda 1x/dia via Vercel Cron
 * (`vercel.json`), varre assinaturas com status suspeito e corrige
 * comparando contra o status real no Asaas.
 *
 * Ver docs/estado-atual.md, mesmo padrão de webhook perdido que já
 * aconteceu (workspace "Orne", 13/08) e que ficava preso até alguém notar
 * na mão.
 */

function isValidCronSecret(authorizationHeader: string | null): boolean {
  const expected = process.env.CRON_SECRET
  if (!authorizationHeader || !expected) return false

  const prefixo = 'Bearer '
  if (!authorizationHeader.startsWith(prefixo)) return false
  const token = authorizationHeader.slice(prefixo.length)

  const a = Buffer.from(token)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false

  return timingSafeEqual(a, b)
}

// Mesmo nome de evento que o webhook usaria pra este status (ver
// ACTIVE_EVENTS/PAST_DUE_EVENTS/CANCELED_EVENTS em
// app/api/webhooks/asaas/route.ts), de propósito, não um nome "de
// reconciliação" à parte: o `eventId` monta em cima disso, e é isso que faz
// o dedupe reconhecer quando o webhook real (ou uma correção manual
// anterior) já processou o mesmo pagamento, evitando reenviar e-mail/Meta
// duplicado.
function eventoParaStatus(status: StatusAssinatura): string {
  if (status === 'active') return 'PAYMENT_RECEIVED'
  if (status === 'past_due') return 'PAYMENT_OVERDUE'
  return 'PAYMENT_REFUNDED'
}

export async function GET(request: Request) {
  if (!isValidCronSecret(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const { data: suspeitas, error } = await supabase
    .from('subscriptions')
    .select('workspace_id, asaas_subscription_id, status')
    .in('status', ['trialing', 'past_due'])
    .not('asaas_subscription_id', 'is', null)

  if (error) {
    console.error('Reconciliação Asaas: falha ao listar assinaturas suspeitas', error)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }

  const resumo = {
    verificadas: suspeitas.length,
    divergentes: 0,
    corrigidas: 0,
    correcoes: [] as Array<{
      workspace_id: string
      asaas_subscription_id: string
      de: string
      para: StatusAssinatura
    }>,
  }

  for (const linha of suspeitas) {
    // `asaas_subscription_id` filtrado por `.not(... 'is', null)` acima, mas
    // o tipo gerado continua nullable, o `!` aqui é seguro por causa do
    // filtro, não por suposição.
    const asaasSubscriptionId = linha.asaas_subscription_id!

    const pagamento = await buscarPagamentoMaisRecente(asaasSubscriptionId)
    if (!pagamento || !pagamento.statusMapeado) continue
    if (pagamento.statusMapeado === linha.status) continue

    resumo.divergentes += 1

    const eventType = eventoParaStatus(pagamento.statusMapeado)

    const resultado = await aplicarEventoAsaas({
      supabase,
      status: pagamento.statusMapeado,
      subscriptionId: asaasSubscriptionId,
      // Mesmo formato de dedupe que o webhook usaria pra este pagamento
      // (`evento:payment.id`), se o webhook real ou uma correção manual já
      // processou esse pagamento específico, o dedupe barra aqui sozinho.
      eventId: `${eventType}:${pagamento.id}`,
      eventType,
      // Assinatura anterior à 0044 nasceu sem `ultimo_billing_type`. Este é o
      // caminho que preenche o dado retroativamente, sem precisar de script
      // de migração de dados: o job já está lendo o pagamento mesmo.
      billingType: pagamento.billingType,
      origem: 'reconciliacao:cron',
    })

    if (resultado.ok && !resultado.duplicate && resultado.matched) {
      resumo.corrigidas += 1
      const correcao = {
        workspace_id: linha.workspace_id,
        asaas_subscription_id: asaasSubscriptionId,
        de: linha.status,
        para: pagamento.statusMapeado,
      }
      resumo.correcoes.push(correcao)
      console.warn('Reconciliação Asaas: assinatura corrigida', correcao)
    }
  }

  const avisos = await avisarQuemEstaPertoDeVencer(supabase)

  return NextResponse.json({ ...resumo, avisos })
}

/**
 * Avisa por e-mail quem tem o Pro vencendo em 1 ou 2 dias.
 *
 * Mora neste job, e não num cron próprio, por dois motivos: é menos superfície
 * de falha (um agendamento só para acompanhar) e o plano da Vercel limita
 * quantos cron jobs existem.
 *
 * **Por que aqui existe relógio, se a 0027 rejeitou cron de propósito.** A
 * 0027 rejeitou cron para o CORTE, e continua valendo: a validade é função
 * consultada na hora do uso, um plano vencido para de valer sozinho, sem
 * depender de nada ter rodado. Aviso é outra coisa: não dá para avisar de
 * forma preguiçosa, porque quem não abre o app nunca receberia. Se este job
 * falhar, ninguém perde acesso indevidamente, só deixa de ser avisado, que é
 * uma falha de grau bem menor.
 */
async function avisarQuemEstaPertoDeVencer(supabase: ReturnType<typeof createAdminClient>) {
  const agora = Date.now()
  const daquiADoisDias = new Date(agora + 2 * 24 * 60 * 60 * 1000).toISOString()

  const { data: vencendo, error } = await supabase
    .from('subscriptions')
    .select('asaas_subscription_id, current_period_end, aviso_vencimento_enviado_em')
    .eq('status', 'active')
    .not('asaas_subscription_id', 'is', null)
    .not('current_period_end', 'is', null)
    // Janela: vence de agora até daqui a 2 dias. Quem já venceu fica de fora,
    // para esse caso existe o e-mail de pagamento atrasado, disparado pelo
    // evento do Asaas.
    .gt('current_period_end', new Date(agora).toISOString())
    .lte('current_period_end', daquiADoisDias)

  if (error) {
    console.error('Aviso de vencimento: falha ao listar assinaturas', error)
    return { candidatas: 0, enviados: 0, pulados: 0 }
  }

  const resultado = { candidatas: vencendo.length, enviados: 0, pulados: 0 }

  for (const linha of vencendo) {
    // Trava de idempotência: um aviso por dia, no máximo. Sem ela, duas
    // execuções no mesmo dia (retry da Vercel, chamada manual) mandariam o
    // mesmo e-mail de novo, e cobrança repetida é o caminho curto para o
    // cliente marcar o remetente como spam.
    if (avisadoHoje(linha.aviso_vencimento_enviado_em)) {
      resultado.pulados += 1
      continue
    }

    const assinante = await buscarAssinante(supabase, linha.asaas_subscription_id!)
    if (!assinante) {
      resultado.pulados += 1
      continue
    }

    const restam = diasDeCalendarioAte(new Date(linha.current_period_end!))

    const { subject, html } = renderPlanoVencendoEmail({
      workspaceName: assinante.workspaceName,
      valor: PRO_PLAN_PRICE,
      diasRestantes: restam,
      appUrl: appUrl(),
    })

    try {
      const { error: erroEnvio } = await getResend().emails.send({
        from: 'Velo Funil <suporte@velofunil.com.br>',
        to: assinante.email,
        subject,
        html,
      })
      if (erroEnvio) throw new Error(erroEnvio.message)
    } catch (err) {
      // Não marca como enviado: assim a execução de amanhã tenta de novo, em
      // vez de o cliente ficar sem aviso nenhum por causa de uma falha
      // passageira do Resend.
      console.error('Aviso de vencimento: falha ao enviar e-mail', err)
      resultado.pulados += 1
      continue
    }

    const { error: erroMarca } = await supabase
      .from('subscriptions')
      .update({ aviso_vencimento_enviado_em: new Date().toISOString() })
      .eq('asaas_subscription_id', linha.asaas_subscription_id!)

    if (erroMarca) {
      // E-mail já saiu. Registrar alto: sem a marca, a execução de amanhã
      // manda de novo, e o cliente recebe dois avisos.
      console.error('Aviso de vencimento: e-mail enviado mas a marca não gravou', erroMarca)
    }

    resultado.enviados += 1
  }

  return resultado
}

/**
 * O dia do calendário em São Paulo, como `2026-08-18`.
 *
 * O servidor da Vercel roda em UTC, e às 21h de São Paulo já é o dia seguinte
 * lá. Toda contagem de dia aqui passa por esta função, mesma armadilha que
 * `diaEmSaoPaulo` já resolveu para as tarefas (lib/tasks/buckets.ts).
 */
function diaEmSaoPaulo(data: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(data)
}

/** O aviso já saiu hoje? Um por dia, no máximo. */
function avisadoHoje(ultimoAviso: string | null): boolean {
  if (!ultimoAviso) return false
  return diaEmSaoPaulo(new Date(ultimoAviso)) === diaEmSaoPaulo(new Date())
}

/**
 * Quantos dias de CALENDÁRIO faltam, não quantos períodos de 24h.
 *
 * A diferença importa no texto do e-mail. Uma assinatura que vence às 10h de
 * amanhã está a 29 horas de distância; arredondar isso para cima dá "vence em
 * 2 dias", e a pessoa lê que tem mais tempo do que tem. Contando pelo dia do
 * calendário, vence amanhã é 1, e o e-mail diz "amanhã".
 */
function diasDeCalendarioAte(vencimento: Date): number {
  const hoje = new Date(`${diaEmSaoPaulo(new Date())}T00:00:00Z`).getTime()
  const dia = new Date(`${diaEmSaoPaulo(vencimento)}T00:00:00Z`).getTime()
  return Math.max(1, Math.round((dia - hoje) / (24 * 60 * 60 * 1000)))
}
