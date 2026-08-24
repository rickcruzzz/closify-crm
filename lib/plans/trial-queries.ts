import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUserAndWorkspace } from '@/lib/supabase/workspace'

export type SituacaoDoPlano = {
  /** Trial vigente e ainda não pagou. */
  emTrial: boolean
  /** Assinatura paga valendo agora — o trial não conta aqui. */
  temAssinaturaPaga: boolean
}

/**
 * A situação do plano da empresa ativa.
 *
 * ## Por que as DUAS respostas, e não só `em_trial`
 *
 * Primeira versão desta função devolvia só `emTrial`, e o layout derivava o
 * resto com `assinaturaAtiva = !emTrial`. Estava errado, e de um jeito que não
 * aparece em `tsc` nem em lint: quem está no Free **depois** do trial também
 * tem `em_trial = false`, então seria tratado como assinante e **o aviso de
 * "seu teste terminou" nunca apareceria** — justamente para quem ele existe.
 *
 *     trial vigente + sem pagar   em_trial=true   pro_vigente=true
 *     trial vigente + pagou       em_trial=false  pro_vigente=true
 *     trial vencido + sem pagar   em_trial=false  pro_vigente=false   <- este
 *     trial vencido + pagou       em_trial=false  pro_vigente=true
 *
 * As duas últimas linhas só se distinguem com `pro_vigente()` na mão. Daí as
 * duas chamadas.
 *
 * ## Por que RPC e não a conta em TypeScript
 *
 * A regra de vigência (dias de compensação bancária, status que valem) vive nas
 * migrations 0027/0051/0053. Reescrevê-la aqui criaria uma segunda cópia — e a
 * 0038 já teve que consertar uma função que tinha exatamente isso, lendo
 * `workspaces.plan` em vez de `pro_vigente()`. Duas cópias divergem no dia em
 * que uma muda.
 *
 * As duas RPCs vão em paralelo, então custam uma ida de rede, não duas.
 */
export async function situacaoDoPlanoDaEmpresaAtiva(): Promise<SituacaoDoPlano> {
  const { workspaceId } = await getCurrentUserAndWorkspace()
  if (!workspaceId) return { emTrial: false, temAssinaturaPaga: false }

  const supabase = await createClient()

  const [{ data: emTrial }, { data: proVigente }] = await Promise.all([
    supabase.rpc('em_trial', { target_workspace_id: workspaceId }),
    supabase.rpc('pro_vigente', { target_workspace_id: workspaceId }),
  ])

  return {
    emTrial: emTrial === true,
    // Pro valendo sem ser por trial só pode ser assinatura paga.
    temAssinaturaPaga: proVigente === true && emTrial !== true,
  }
}
