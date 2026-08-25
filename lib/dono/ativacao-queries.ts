import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

import { ehContaDeTeste } from './contas-internas'
import { exigirAmbienteLocal } from './somente-local'
import type { ContaObservada } from './ativacao'

/**
 * Monta o funil de ativação lendo o rastro que o produto já deixa no banco.
 *
 * Ver o cabeçalho de `ativacao.ts` para o porquê de não haver PostHog aqui.
 * Este arquivo é só a leitura; a matemática mora lá, testada e sem banco.
 */

/** Mesmo teto e mesma razão de `queries.ts`: o PostgREST corta em 1.000 calado. */
const TETO = 5000

export type LeituraDaAtivacao = {
  /** Só clientes externos — é sobre eles que o funil fala. */
  contas: ContaObservada[]
  /**
   * Quantas foram excluídas por serem teste/internas. Aparece na tela de
   * propósito: filtro invisível é filtro em que ninguém confia, e este aqui
   * muda o número que decide onde investir.
   */
  excluidas: number
  lidoEm: string
}

/**
 * Uma leitura por tabela, não uma por conta.
 *
 * Com N contas, perguntar "esta tem contato?" uma vez por conta seriam N idas
 * ao banco. Aqui são 6 buscas no total, e o cruzamento acontece em memória com
 * `Set` — a mesma decisão que a migration 0047 tomou para o casamento de
 * telefone, pelo mesmo motivo.
 */
export async function lerAtivacao(): Promise<LeituraDaAtivacao> {
  await exigirAmbienteLocal()

  const supabase = createAdminClient()

  const [{ data: usuarios }, { data: empresas }, { data: onboarding }] = await Promise.all([
    supabase.auth.admin.listUsers({ perPage: 1000 }),
    supabase.from('workspaces').select('id, created_by, created_at').limit(TETO),
    supabase.from('onboarding_state').select('user_id, status').limit(TETO),
  ])

  const [{ data: leads }, { data: deals }, { data: conexoes }] = await Promise.all([
    supabase.from('leads').select('workspace_id').limit(TETO),
    supabase.from('deals').select('workspace_id').limit(TETO),
    supabase
      .from('integration_connections')
      .select('workspace_id, status')
      .eq('status', 'connected')
      .limit(TETO),
  ])

  const emailPorUsuario = new Map((usuarios?.users ?? []).map((u) => [u.id, u.email ?? null]))
  const concluiuPorUsuario = new Set(
    (onboarding ?? []).filter((o) => o.status === 'completed').map((o) => o.user_id),
  )
  const comContato = new Set((leads ?? []).map((l) => l.workspace_id))
  const comNegocio = new Set((deals ?? []).map((d) => d.workspace_id))
  const comCanal = new Set((conexoes ?? []).map((c) => c.workspace_id))

  // `pro_vigente()` por empresa, em paralelo. É a função, nunca a coluna
  // `workspaces.plan` — doutrina travada desde a migration 0027: a coluna é o
  // último valor gravado e não sabe que o período pago venceu.
  const vigencias = await Promise.all(
    (empresas ?? []).map(async (w) => {
      const { data } = await supabase.rpc('pro_vigente', { target_workspace_id: w.id })
      return [w.id, data === true] as const
    }),
  )
  const proPorEmpresa = new Map(vigencias)

  const contas: ContaObservada[] = []
  let excluidas = 0

  for (const empresa of empresas ?? []) {
    const email = empresa.created_by ? (emailPorUsuario.get(empresa.created_by) ?? null) : null

    if (ehContaDeTeste(email)) {
      excluidas += 1
      continue
    }

    contas.push({
      criadaEm: empresa.created_at,
      concluiuOnboarding: empresa.created_by
        ? concluiuPorUsuario.has(empresa.created_by)
        : false,
      temContato: comContato.has(empresa.id),
      temNegocio: comNegocio.has(empresa.id),
      conectouCanal: comCanal.has(empresa.id),
      proVigente: proPorEmpresa.get(empresa.id) === true,
    })
  }

  return { contas, excluidas, lidoEm: new Date().toISOString() }
}
