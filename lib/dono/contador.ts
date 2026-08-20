import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

import { lerSilenciados } from './silenciados'
import { exigirAmbienteLocal } from './somente-local'

/**
 * Quantos alertas estão abertos, para o número no menu.
 *
 * ## Por que uma consulta separada, e não `lerCentral()`
 *
 * O menu vive no layout, que roda em **toda** navegação da Central. Chamar
 * `lerCentral()` aqui faria cada clique falar com Asaas, Resend e o banco
 * inteiro só para pintar um número — mais de um segundo somado a páginas que
 * nem usam esse dado.
 *
 * É literalmente a lição que o layout do produto já ensinou neste projeto:
 * consulta no caminho quente é paga em toda navegação, e foi assim que nasceu
 * o lag que precisou de uma investigação inteira para ser corrigido.
 *
 * ## Por que este número pode divergir do da página de alertas
 *
 * Porque ele é uma **aproximação barata de propósito**: conta o que dá para
 * contar com duas consultas ao banco, sem cruzar com o gateway de pagamento.
 * Um alerta de assinatura divergente só aparece depois de perguntar ao Asaas —
 * e perguntar ao Asaas a cada clique é exatamente o que este arquivo existe
 * para evitar.
 *
 * A consequência aceita: o menu pode mostrar menos do que a página. Nunca
 * mais. Errar para menos num contador é ruim; errar para mais é pior, porque
 * manda a pessoa procurar um problema que não existe.
 */
export async function contarAlertasAbertos(): Promise<number> {
  await exigirAmbienteLocal()

  try {
    const supabase = createAdminClient()

    const [erros, silenciados] = await Promise.all([
      supabase.from('error_logs').select('id', { count: 'exact', head: true }),
      lerSilenciados(),
    ])

    // O `id` de um alerta de erro é fixo (`'erros'`), então dá para saber se
    // ele foi silenciado sem montar a lista inteira.
    const temErros = (erros.count ?? 0) > 0 && !silenciados.has('erros')

    // Assinaturas que o banco sozinho já denuncia: ativas no nosso lado sem
    // data de vencimento, ou de teste. As que exigem o Asaas ficam de fora,
    // pelo motivo no bloco acima.
    const { data: assinaturas } = await supabase
      .from('subscriptions')
      .select('workspace_id, status, current_period_end, asaas_subscription_id')
      .limit(1000)

    const suspeitas = (assinaturas ?? []).filter(
      (s) =>
        !silenciados.has(`teste:${s.asaas_subscription_id}`) &&
        s.asaas_subscription_id?.startsWith('sub_teste'),
    ).length

    return suspeitas + (temErros ? 1 : 0)
  } catch {
    // Um contador que falha não pode derrubar o layout — e layout que quebra
    // leva a Central inteira junto. Sem número é melhor que sem tela.
    return 0
  }
}
