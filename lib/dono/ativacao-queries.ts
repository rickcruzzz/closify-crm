import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

import { ehContaInterna } from './contas-internas'
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

/**
 * Domínios de e-mail descartável usados nos testes deste projeto.
 *
 * ## A lição que esta lista carrega
 *
 * A tentação é detectar teste por padrão ("contém 'teste'", "domínio esquisito").
 * Este projeto quase apagou uma cliente real assim: `testei122@gmaa2il.com` casa
 * com qualquer regex de teste e é pessoa de verdade, com empresa, contatos e
 * negócios — ela só digitou o próprio e-mail errado (ver `lib/dono/dominios.ts`).
 *
 * Por isso: lista fechada, conferida uma a uma. Chata de manter e nunca
 * classifica cliente de verdade como lixo.
 *
 * Aqui o erro seria menos grave que apagar — só distorceria uma estatística —,
 * mas distorcer a estatística de ativação é exatamente o que faz decidir errado
 * onde investir. Na auditoria de 22/08, a taxa calculada sobre a base cheia
 * media o próprio dono usando o produto.
 */
const DOMINIOS_DESCARTAVEIS = new Set([
  // Geradores de e-mail temporário usados nos testes desta base, conferidos um
  // a um em 23/08 contra a lista real de contas que criaram empresa.
  'neplis.com',
  'beiwoh.com',
  'joystill.com',
  'mrworlds.com',
  'careney.com',
  'rpaintel.com',
  'hutdot.com',
  'ittiv.com',
  'archifun.com',
  // Domínios que só existem dentro dos scripts de teste deste repositório.
  'exemplo-teste.com.br',
  'acmecorp.com.br',
])

/**
 * Contas do próprio dono e de demonstração.
 *
 * O dono confirmou em 23/08 que **todos os cadastros até aqui foram teste
 * dele** — inclusive os de `gmail.com`, que nenhum filtro de domínio pegaria.
 * Por isso esta lista existe e por isso ela precisa ser mantida à mão: sem ela,
 * o painel misturaria teste antigo com o tráfego pago que está por vir, e a
 * primeira campanha seria avaliada contra uma linha de base falsa.
 *
 * Quando entrar cliente de verdade, NÃO adicione ninguém aqui — a lista só
 * cresce com conta que você mesmo criou.
 */
const EMAILS_DO_DONO = new Set([
  'j4693001@gmail.com',
  'henriquestn24@gmail.com',
  'henriqueprogramador590@gmail.com',
  'pedroescobar90sb@gmail.com',
  'jonatqpedro@gmail.com',
  'imperioimports70@gmail.com',
  'empresatower6@gmail.com',
  'mbarretodacruz@gmail.com',
  'lamopuniftc@gmail.com',
  'fanimayara67@gmail.com',
  'demo.pro@velofunil.com.br',
])

function ehContaDeTeste(email: string | null | undefined): boolean {
  if (!email) return true // sem e-mail não dá para afirmar que é cliente real
  const limpo = email.trim().toLowerCase()
  if (ehContaInterna(limpo)) return true
  if (EMAILS_DO_DONO.has(limpo)) return true
  const dominio = limpo.split('@')[1] ?? ''
  return DOMINIOS_DESCARTAVEIS.has(dominio)
}

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
