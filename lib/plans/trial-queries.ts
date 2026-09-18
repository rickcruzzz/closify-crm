import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUserAndWorkspace } from '@/lib/supabase/workspace'

export type SituacaoDoPlano = {
  /** Trial vigente e ainda não pagou. */
  emTrial: boolean
  /** Assinatura paga valendo agora — o trial não conta aqui. */
  temAssinaturaPaga: boolean
  /**
   * Max vigente nesta empresa (migration 0089).
   *
   * Entra aqui e não numa leitura própria porque as três RPCs já vão no mesmo
   * `Promise.all`: acrescentar a terceira custa ZERO viagem de rede a mais, e
   * esta função roda em toda navegação do produto.
   *
   * Sem ele, o seletor de empresa mostrava **"Pro"** para quem paga R$ 250 —
   * `workspaces.plan` é enum de dois valores e vale `'pro'` para o Max, por
   * construção. O número estava certo e a palavra contava outra coisa, que é a
   * mesma classe do *"até 2 colaboradores"* prometendo três pessoas.
   */
  temMax: boolean
  /**
   * O Pro está valendo AGORA, lido da função e não da coluna.
   *
   * ## O defeito que isto fecha, relatado pelo dono em 18/09
   *
   * Empresa criada por quem já paga nascia mostrando **"Free"** no seletor,
   * com `pro_vigente()` devolvendo `true`. Medido: TRÊS empresas assim.
   *
   * A causa é que a coluna nunca é promovida. `sincronizar_plano_do_workspace`
   * só REBAIXA — o comentário dela diz isso em texto — e o ramo 3 de
   * `pro_vigente` (0078) cobre até cinco empresas do mesmo dono sem tocar em
   * `workspaces.plan` de nenhuma delas.
   *
   * Ou seja a coluna estava certa no que ela guarda, e errada como resposta à
   * pergunta que a tela faz. É a regra que este projeto já tem escrita:
   * **regra de plano lê a FUNÇÃO, nunca a coluna.**
   *
   * Custa zero viagem a mais: a RPC já ia no mesmo `Promise.all`, o valor só
   * era descartado depois de compor `temAssinaturaPaga`.
   */
  proVigente: boolean
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
  if (!workspaceId) {
    return { emTrial: false, temAssinaturaPaga: false, temMax: false, proVigente: false }
  }

  const supabase = await createClient()

  const [{ data: emTrial }, { data: proVigente }, { data: maxVigente }] = await Promise.all([
    supabase.rpc('em_trial', { target_workspace_id: workspaceId }),
    supabase.rpc('pro_vigente', { target_workspace_id: workspaceId }),
    supabase.rpc('max_vigente', { target_workspace_id: workspaceId }),
  ])

  return {
    emTrial: emTrial === true,
    // Pro valendo sem ser por trial só pode ser assinatura paga.
    temAssinaturaPaga: proVigente === true && emTrial !== true,
    // `=== true` e não `Boolean(...)`: a RPC devolve `null` quando a leitura
    // falha, e `null` precisa cair no lado NEGADO. Aqui o custo de errar é só
    // um rótulo, mas a mesma função é lida por quem decide acesso.
    temMax: maxVigente === true,
    proVigente: proVigente === true,
  }
}
