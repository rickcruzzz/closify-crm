import 'server-only'

import { asaasFetch, AsaasApiError } from '@/lib/asaas/client'
import { createClient } from '@/lib/supabase/server'

/**
 * Estado da assinatura para a tela de Cobrança.
 *
 * A tela mostrava apenas `workspaces.plan` (Free ou Pro) e nunca lia a tabela
 * `subscriptions`. Quem tinha assinatura criada com pagamento pendente via
 * "Free" e um botão de assinar de novo, sem aviso, sem link para pagar a
 * fatura que já existia, e sem forma de cancelar.
 */

export type FaturaPendente = {
  valor: number
  vencimento: string
  url: string
  /** `OVERDUE` no Asaas: passou do vencimento e ainda não foi pago. */
  vencida: boolean
}

export type EstadoAssinatura = {
  status: 'trialing' | 'active' | 'past_due' | 'canceled'
  temAssinaturaNoAsaas: boolean
  fatura: FaturaPendente | null
  /**
   * Até quando o Pro funciona. ISO, ou `null` em assinatura que nunca foi paga.
   *
   * **Não confundir com `fatura.vencimento`**, e a confusão custou caro: até
   * 25/08 esta coluna nunca era lida, e a tela mostrava só a data da fatura.
   * São perguntas diferentes:
   *
   *   fatura.vencimento    quando a cobrança precisa ser paga
   *   validoAte            até quando o acesso Pro continua funcionando
   *
   * A segunda é a que a pessoa procura quando abre Cobrança, e era a única que
   * não estava em lugar nenhum do produto.
   */
  validoAte: string | null
}

type AsaasPayment = {
  id: string
  status: string
  value: number
  dueDate: string
  invoiceUrl: string
}

export async function getEstadoAssinatura(
  workspaceId: string,
): Promise<EstadoAssinatura | null> {
  const supabase = await createClient()

  const { data: assinatura, error } = await supabase
    .from('subscriptions')
    .select('status, asaas_subscription_id, current_period_end')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  // `error` checado de propósito: sem isto, uma falha do PostgREST devolve
  // `assinatura` nula e a tela conclui "esta empresa não tem assinatura",
  // oferecendo assinar de novo a quem já paga. Classe 4 do diagnóstico de
  // 25/08, e aqui o desfecho seria cobrança duplicada.
  if (error) {
    console.error('getEstadoAssinatura: falha ao ler a assinatura', error)
    return null
  }

  if (!assinatura) return null

  const estado: EstadoAssinatura = {
    status: assinatura.status,
    temAssinaturaNoAsaas: !!assinatura.asaas_subscription_id,
    fatura: null,
    validoAte: assinatura.current_period_end,
  }

  if (!assinatura.asaas_subscription_id) return estado

  // A fatura em aberto vem do Asaas, não do nosso banco: o link de pagamento
  // (`invoiceUrl`) é gerado por eles e muda a cada ciclo. Guardar essa URL aqui
  // significaria servir link vencido no mês seguinte.
  try {
    const pagamentos = await asaasFetch<{ data: AsaasPayment[] }>(
      `/payments?subscription=${assinatura.asaas_subscription_id}&status=PENDING&limit=1`,
    )

    let pendente = pagamentos.data[0]

    if (!pendente) {
      const vencidos = await asaasFetch<{ data: AsaasPayment[] }>(
        `/payments?subscription=${assinatura.asaas_subscription_id}&status=OVERDUE&limit=1`,
      )
      pendente = vencidos.data[0]
    }

    if (pendente) {
      estado.fatura = {
        valor: pendente.value,
        vencimento: pendente.dueDate,
        url: pendente.invoiceUrl,
        vencida: pendente.status === 'OVERDUE',
      }
    }
  } catch (err) {
    // Falha ao consultar o Asaas não pode derrubar a tela inteira: sem a
    // fatura a pessoa ainda precisa ver o plano e o uso. Registra e segue.
    if (err instanceof AsaasApiError) {
      console.error(
        `getEstadoAssinatura: Asaas respondeu ${err.status} em ${err.path}`,
        err.body.slice(0, 300),
      )
    } else {
      console.error('getEstadoAssinatura: falha ao consultar o Asaas', err)
    }
  }

  return estado
}

/**
 * Uma linha do histórico da assinatura, já pronta para a tela.
 */
export type EventoDaAssinatura = {
  id: string
  /** ISO. A formatação fica no cliente, que sabe o fuso de quem lê. */
  criadoEm: string
  de: string | null
  para: string
  origem: string
  billingType: string | null
}

/**
 * Quantos eventos a tela mostra.
 *
 * Dez cobre mais de um ano de assinatura mensal saudável (uma renovação por
 * mês não gera evento: `registrarNoHistorico` ignora estado repetido). Quem
 * tiver mais que isso viu o suficiente para entender o que aconteceu.
 *
 * O teto também é a defesa contra o corte silencioso de 1.000 do PostgREST —
 * classe 5 do diagnóstico de 25/08.
 */
const EVENTOS_NA_TELA = 10

/**
 * O histórico da assinatura, do mais recente para o mais antigo.
 *
 * `subscriptions` guarda uma linha por empresa, só o estado atual: quem
 * assinou, cancelou e voltou não deixava rastro nenhum. Esta tabela (0055) é
 * append-only e escrita num lugar só, `lib/asaas/aplicar-evento.ts`.
 *
 * Lida com o client de sessão, não com o admin: a policy `assinatura_eventos_select`
 * já isola por empresa, e usar service role aqui seria abrir mão da defesa que
 * o banco oferece de graça.
 */
export async function getHistoricoDaAssinatura(
  workspaceId: string,
): Promise<EventoDaAssinatura[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('assinatura_eventos')
    .select('id, criado_em, de_status, para_status, origem, billing_type')
    .eq('workspace_id', workspaceId)
    .order('criado_em', { ascending: false })
    .limit(EVENTOS_NA_TELA)

  // `error` checado: sem isto uma falha vira lista vazia, e a tela diria
  // "nenhum evento" para quem tem histórico — mentira silenciosa, classe 4 do
  // diagnóstico de 25/08.
  if (error) {
    console.error('getHistoricoDaAssinatura: falha ao ler', error)
    return []
  }

  return (data ?? []).map((linha) => ({
    id: linha.id,
    criadoEm: linha.criado_em,
    de: linha.de_status,
    para: linha.para_status,
    origem: linha.origem,
    billingType: linha.billing_type,
  }))
}
