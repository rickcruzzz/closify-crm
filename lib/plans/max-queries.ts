import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { EstadoDaAssinatura } from '@/lib/plans/max'

/**
 * A situação de Max da empresa, para `direitoAoWhatsapp` decidir.
 *
 * ## Por que RPC e não a conta em TypeScript
 *
 * Mesma razão de `situacaoDoPlanoDaEmpresaAtiva`: a regra de vigência (status
 * que valem, dias de compensação bancária, e o ramo ÚNICO que o Max tem contra
 * os três do Pro) vive na migration 0089. Reescrevê-la aqui criaria uma segunda
 * cópia, e a 0038 já teve que consertar uma função com exatamente esse defeito.
 *
 * ## E por que a coluna vem JUNTO, sem contradizer a doutrina
 *
 * `max_vigente()` responde o acesso, e é a única coisa que responde. `plano`
 * entra para separar *"nunca assinou"* de *"assinou e venceu"* — ele decide a
 * FRASE, nunca o direito. O comentário em `lib/plans/max.ts` registra por quê:
 * *"Seu Pro venceu, reative"* aparecendo para quem nunca teve Pro é defeito já
 * pago neste produto, em 18/08.
 *
 * As duas idas vão em paralelo, então custam uma viagem de rede, não duas.
 */
export async function situacaoDoMax(workspaceId: string): Promise<EstadoDaAssinatura> {
  const supabase = await createClient()

  const [{ data: vigente }, { data: assinatura }] = await Promise.all([
    supabase.rpc('max_vigente', { target_workspace_id: workspaceId }),
    supabase.from('subscriptions').select('plano').eq('workspace_id', workspaceId).maybeSingle(),
  ])

  return {
    // `=== true` e não `Boolean(...)`: a RPC devolve `null` quando a leitura
    // falha, e `null` precisa cair no lado NEGADO. Falha de leitura virando
    // acesso liberado é a forma mais cara de errar aqui — libera uma instância
    // paga sem ninguém ter pago.
    maxVigente: vigente === true,
    plano: assinatura?.plano === 'max' ? 'max' : assinatura ? 'pro' : null,
  }
}
