import 'server-only'

import { asaasFetch } from '@/lib/asaas/client'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * As duas perguntas de dinheiro que o vigia precisa fazer, e só elas.
 *
 * ## Por que não reusar `lerDinheiro()`
 *
 * Ela existe e faz o trabalho — mas para a Central, que mostra saldo, a
 * receber, vencido, recebido, confirmados e assinaturas numa tela só. São
 * **seis chamadas** ao Asaas.
 *
 * O vigia precisa de duas coisas. Reusar a função inteira significaria 144
 * chamadas por dia ao gateway para responder duas perguntas, e a Central faz
 * isso sob demanda — quando alguém abre a tela — enquanto um cron faz sem
 * ninguém pedir.
 *
 * ## E `lerDinheiro()` está atrás do gate de ambiente, de propósito
 *
 * Ela chama `exigirAmbienteLocal()`, que devolve 404 fora de `localhost`.
 * Arrancar essa linha para reusá-la na Vercel enfraqueceria uma trava que
 * protege dado financeiro de cliente — e a alternativa (extrair a leitura
 * "sem gate" e deixar as duas convivendo) cria uma função sem proteção
 * esperando o próximo consumidor distraído.
 *
 * Este arquivo é o outro caminho: leitura própria, enxuta, e que só faz o que
 * o cron precisa. Ele **não** tem gate porque roda na Vercel por definição — e
 * a rota que o chama é autenticada por `CRON_SECRET`.
 */

type Cobranca = { value?: number; subscription?: string }
type Assinatura = { id: string; status: string; deleted?: boolean; externalReference?: string }

/**
 * Assinaturas ativas no Asaas cuja empresa NÃO tem Pro vigente no banco.
 *
 * ## É o alerta mais caro do vigia
 *
 * Alguém pagou e não recebeu — e continua pagando. Foi exatamente o que a
 * investigação de 20/08 achou parado em produção: das 4 assinaturas ativas no
 * gateway, **3 não estavam entregando o plano**, e nada gerava erro em lugar
 * nenhum. Do ponto de vista do sistema, estava tudo funcionando.
 *
 * ## `pro_vigente()`, nunca a coluna `plan`
 *
 * A coluna é o último valor gravado e não sabe que o tempo passou; a função
 * decide. É doutrina travada deste projeto desde a 0027, e ignorá-la aqui
 * faria o vigia comparar contra um dado que pode estar velho — gerando alarme
 * falso, que é o que ensina a ignorar a fila inteira.
 */
export async function contarAssinaturasSemPro(): Promise<number> {
  const { data } = await asaasFetch<{ data: Assinatura[] }>('/subscriptions?limit=100')

  // `deleted` é o descarte real: uma assinatura cancelada continua aparecendo
  // com `status: ACTIVE` e `deleted: true`, e contá-la inflaria o alerta com
  // gente que já saiu.
  const vivas = data.filter((a) => a.status === 'ACTIVE' && !a.deleted)
  if (vivas.length === 0) return 0

  const admin = createAdminClient()
  const { data: assinaturasNoBanco, error } = await admin
    .from('subscriptions')
    .select('workspace_id, asaas_subscription_id')
    .in(
      'asaas_subscription_id',
      // O `.in()` do PostgREST vira query string, e o gateway recusa listas
      // longas — medido em 11/08: 500 valores já dão 400. Com teto de 100
      // assinaturas do lado do Asaas isso não é alcançável hoje, e o corte
      // fica explícito para o dia em que for.
      vivas.slice(0, 100).map((a) => a.id),
    )
  if (error) throw error

  let semPro = 0
  for (const viva of vivas) {
    const linha = (assinaturasNoBanco ?? []).find((l) => l.asaas_subscription_id === viva.id)

    // Assinatura ativa no gateway que o banco nunca registrou. É o caso mais
    // grave: nem workspace para consultar existe.
    if (!linha) {
      semPro += 1
      continue
    }

    const { data: vigente, error: erroDaRpc } = await admin.rpc('pro_vigente', {
      target_workspace_id: linha.workspace_id,
    })
    if (erroDaRpc) throw erroDaRpc
    if (!vigente) semPro += 1
  }

  return semPro
}

/** Cobranças geradas e não pagas. Cada uma tarifa mensageria mesmo sem ninguém pagar. */
export async function contarCobrancasVencidas(): Promise<number> {
  const r = await asaasFetch<{ totalCount: number; data: Cobranca[] }>(
    '/payments?status=OVERDUE&limit=100',
  )
  // `totalCount` e não `data.length`: o teto de 100 esconderia o excedente, e
  // um número menor que o real é pior que nenhum número.
  return r.totalCount
}
