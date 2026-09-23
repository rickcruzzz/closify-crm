import 'server-only'

import { asaasFetch } from '@/lib/asaas/client'
import { createAdminClient } from '@/lib/supabase/admin'
import { assinaturaEstaViva } from '@/lib/asaas/assinatura-viva'

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
 * Assinaturas PAGAS no Asaas cuja empresa NÃO tem Pro vigente no banco.
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
  const vivas = data.filter(assinaturaEstaViva)
  if (vivas.length === 0) return 0

  /**
   * ## `ACTIVE` no Asaas NÃO quer dizer "pagou" — medido em 12/09
   *
   * Este era o defeito, e ele fazia o alerta mais caro do vigia mentir todo
   * dia. No Asaas, `subscription.status = ACTIVE` significa que a assinatura
   * existe e está gerando cobranças; diz nada sobre o dinheiro ter entrado.
   * Uma assinatura criada agora, com boleto vencendo em três dias e ninguém
   * pagando, fica `ACTIVE` do mesmo jeito.
   *
   * Medido nas duas assinaturas vivas da conta:
   *
   *     sub_...gqkk7  R$ 970  YEARLY   cobrancas: OVERDUE           nunca pagou
   *     sub_...1qofd  R$  49  MONTHLY  cobrancas: PENDING, OVERDUE  nunca pagou
   *
   *     o vigia contava            2 "assinatura(s) ativa(s) sem Pro liberado"
   *     de fato pagaram e nao receberam   0
   *
   * **A direção do erro é o que torna isto grave.** O alerta afirma *"alguém
   * pagou e não recebeu"*, e quem o lesse iria liberar Pro de cortesia para
   * duas pessoas que não pagaram nada — perdendo receita para consertar um
   * problema que não existe.
   *
   * E é a quarta aparição da mesma classe neste projeto: alerta falso desvia
   * atenção dos reais, e fila com lixo dentro ensina a ignorar a fila inteira.
   *
   * ## O cruzamento já existia em `lerDinheiro()`
   *
   * `dinheiro.ts` monta um `Set` de assinaturas que de fato receberam, a
   * partir de `RECEIVED` + `CONFIRMED`, e o comentário de lá explica por que
   * os dois: `CONFIRMED` é cartão aprovado com repasse a caminho, e sem ele a
   * assinatura no cartão sumiria nos dias entre a aprovação e o dinheiro cair.
   *
   * Duas leituras do mesmo fato divergiram porque a regra morava só em uma.
   */
  const [recebidos, confirmados] = await Promise.all([
    asaasFetch<{ data: Cobranca[] }>('/payments?status=RECEIVED&limit=100'),
    asaasFetch<{ data: Cobranca[] }>('/payments?status=CONFIRMED&limit=100'),
  ])
  const comPagamento = new Set<string>()
  for (const cobranca of [...recebidos.data, ...confirmados.data]) {
    // Cobrança avulsa não tem `subscription`, e ignorá-la aqui é correto.
    if (cobranca.subscription) comPagamento.add(cobranca.subscription)
  }

  const pagas = vivas.filter((a) => comPagamento.has(a.id))
  if (pagas.length === 0) return 0

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
      pagas.slice(0, 100).map((a) => a.id),
    )
  if (error) throw error

  let semPro = 0
  for (const viva of pagas) {
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

type WebhookDoAsaas = {
  id: string
  name?: string
  enabled?: boolean
  interrupted?: boolean
  sendType?: string
  url?: string
}

/**
 * Webhooks do Asaas que pararam de entregar.
 *
 * ## O achado que criou esta função, em 04/09
 *
 * O webhook desta conta estava **`interrupted: true` desde 30/08 às 23:18** —
 * cinco dias. Pagamento confirmado não chegava ao produto, e nada avisava.
 * Descobri por acaso, ao provar outra coisa: a prova não recebia evento
 * nenhum.
 *
 * ## Por que é o alerta mais caro que existe aqui
 *
 * A rede de segurança funciona: o cron de reconciliação varre o Asaas uma vez
 * por dia e aplica o que o webhook perdeu. Ninguém deixa de receber o Pro.
 *
 * Mas a fila interrompida é **indistinguível de "ninguém pagou"** de fora, e
 * some justamente quando mais se confia nela. Quem paga por Pix às 9h espera
 * o Pro em segundos e recebe no dia seguinte — no exato momento em que a
 * pessoa está com o cartão na mão decidindo se o produto funciona.
 *
 * ## E o gatilho não importa tanto quanto a permanência
 *
 * O Asaas penaliza a entrega que falha e interrompe a fila depois de algumas
 * (`penalizedRequestsCount: 4`, nesta conta). Falha transitória é inevitável —
 * deploy, indisponibilidade do banco, rede. O defeito não é ela.
 *
 * O defeito é que a fila **não se recupera sozinha e não avisa**: uma vez
 * interrompida, fica assim até alguém consultar a API. Medido em 04/09: a
 * rota responde em 209ms sem correspondência e 369ms ativando o Pro, com o
 * token conferido — ou seja, o endpoint estava são o tempo todo em que a fila
 * esteve parada.
 *
 * ## `sendType: SEQUENTIALLY` multiplica o estrago, e fica assim de propósito
 *
 * Um evento travado bloqueia todos os seguintes. `NON_SEQUENTIALLY` evitaria
 * isso e traria um problema pior num sistema de cobrança: `canceled` podendo
 * ser aplicado depois de `active`, fora de ordem. Ordem importa aqui; o que
 * faltava era o alarme.
 *
 * Devolve os nomes, não `true`/`false`: com mais de um webhook configurado, o
 * alerta precisa dizer QUAL parou.
 */
export async function webhooksInterrompidos(): Promise<string[]> {
  const { data } = await asaasFetch<{ data: WebhookDoAsaas[] }>('/webhooks')

  return (data ?? [])
    // `enabled: false` é escolha de quem configurou, não falha. Só interessa o
    // webhook que deveria estar entregando e não está.
    .filter((w) => w.enabled !== false && w.interrupted === true)
    .map((w) => (w.name ?? w.url ?? w.id).trim())
}
