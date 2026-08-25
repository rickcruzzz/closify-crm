import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { normalizarTelefoneBrasileiro } from '@/lib/leads/whatsapp'

import { ehContaDeTeste } from './contas-internas'
import { lerContatos } from './contatos-do-trial'
import { exigirAmbienteLocal } from './somente-local'
import type { EmpresaNoTrial } from './trial'

/**
 * Quem está dentro da janela de trial agora, com o que é preciso para falar.
 *
 * A matemática (classificar, priorizar, o que fazer) mora em `trial.ts`, sem
 * banco e testada. Este arquivo é só a leitura.
 */

/** Mesmo teto e mesma razão de `queries.ts`: o PostgREST corta em 1.000 calado. */
const TETO = 5000

type LinhaDeEmpresa = {
  id: string
  name: string
  created_by: string | null
  trial_ate: string | null
  telefone: string | null
  whatsapp: string | null
}

export type LeituraDoTrial = {
  /** Só clientes externos — é com eles que existe conversa a ter. */
  empresas: EmpresaNoTrial[]
  /**
   * Quantas foram escondidas por serem teste nosso.
   *
   * Aparece na tela de propósito. Medido em 25/08, na primeira leitura real:
   * das 4 empresas em trial, **as 4 eram conta de teste** — duas com domínio
   * descartável, duas do próprio dono. Uma fila com 100% de lixo ensina a
   * ignorar a fila inteira, e junto com ela vai o cliente de verdade que
   * aparecer amanhã. É o mesmo defeito que os Alertas já pagaram (11 alertas,
   * 8 deles e-mail de teste), e a correção é a mesma: filtrar, e dizer que
   * filtrou.
   */
  escondidas: number
  lidoEm: string
}

export async function lerQuemEstaEmTrial(): Promise<LeituraDoTrial> {
  await exigirAmbienteLocal()

  const supabase = createAdminClient()
  const agora = new Date().toISOString()

  // `trial_ate > now()` filtra no banco; a segunda condição (não ter assinatura
  // viva) é resolvida abaixo, contra a tabela de assinaturas. É exatamente a
  // definição de `em_trial()` da migration 0053, e por isso ela é reproduzida
  // aqui em vez de reinventada: quem paga NÃO está decidindo, já decidiu.
  const [{ data: empresas }, { data: assinaturas }, { data: usuarios }] = await Promise.all([
    supabase
      .from('workspaces')
      .select('id, name, created_by, trial_ate, telefone, whatsapp')
      .gt('trial_ate', agora)
      .limit(TETO),
    supabase
      .from('subscriptions')
      .select('workspace_id, status, current_period_end')
      .in('status', ['active', 'past_due'])
      .limit(TETO),
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ])

  const linhas = (empresas ?? []) as LinhaDeEmpresa[]
  if (linhas.length === 0) return { empresas: [], escondidas: 0, lidoEm: agora }

  // Uma assinatura viva tira a empresa desta tela mesmo com `trial_ate` no
  // futuro — é o caso de quem assinou ANTES de o trial acabar, que é o
  // desfecho que queremos e não um cliente a perseguir.
  const jaPaga = new Set(
    (assinaturas ?? [])
      .filter((a) => a.current_period_end && new Date(a.current_period_end) > new Date())
      .map((a) => a.workspace_id),
  )

  const porUsuario = new Map(
    (usuarios?.users ?? []).map((u) => [
      u.id,
      { email: u.email ?? null, ultimoLogin: u.last_sign_in_at ?? null },
    ]),
  )

  const candidatas = linhas.filter((e) => !jaPaga.has(e.id))
  const emTrial = candidatas.filter((e) => {
    const dono = e.created_by ? porUsuario.get(e.created_by) : undefined
    return !ehContaDeTeste(dono?.email)
  })
  const escondidas = candidatas.length - emTrial.length

  if (emTrial.length === 0) return { empresas: [], escondidas, lidoEm: agora }

  const ids = emTrial.map((e) => e.id)

  // Contagem agregada no banco (`count: exact, head: true`), uma por empresa,
  // em vez de trazer as linhas para contar em JavaScript. Com poucas empresas
  // em trial ao mesmo tempo isso é barato, e não herda o corte silencioso de
  // 1.000 linhas do PostgREST — que é como uma empresa com 1.200 contatos
  // apareceria aqui como tendo exatamente 1.000.
  // A última escrita de cada tipo, por empresa. Três buscas por empresa, todas
  // com `order + limit(1)`: o banco devolve UMA linha, não a coleção inteira
  // para o JavaScript achar o máximo — que é como esta consulta herdaria o
  // corte silencioso de 1.000 linhas do PostgREST numa empresa movimentada.
  const ultimaEscrita = (tabela: 'leads' | 'deals' | 'activities', id: string) =>
    supabase
      .from(tabela)
      .select('created_at')
      .eq('workspace_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

  const [contagens, negociacoes, atividades, falados] = await Promise.all([
    Promise.all(
      ids.map((id) =>
        supabase
          .from('leads')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', id),
      ),
    ),
    Promise.all(
      ids.map((id) =>
        supabase
          .from('deals')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', id),
      ),
    ),
    Promise.all(
      ids.map((id) =>
        Promise.all([
          ultimaEscrita('leads', id),
          ultimaEscrita('deals', id),
          ultimaEscrita('activities', id),
        ]),
      ),
    ),
    lerContatos(),
  ])

  const lista: EmpresaNoTrial[] = emTrial.map((empresa, i) => {
    const dono = empresa.created_by ? porUsuario.get(empresa.created_by) : undefined

    // O telefone da empresa (do onboarding) tem precedência sobre o campo
    // `whatsapp`: os dois existem, e o segundo costuma estar vazio — medido em
    // 25/08, nenhuma das empresas em trial tinha `whatsapp` preenchido.
    const numeroBruto = empresa.whatsapp?.trim() || empresa.telefone?.trim() || null

    return {
      workspaceId: empresa.id,
      nome: empresa.name,
      emailDoDono: dono?.email ?? null,
      whatsapp: numeroBruto ? normalizarTelefoneBrasileiro(numeroBruto) : null,
      diasRestantes: empresa.trial_ate
        ? (new Date(empresa.trial_ate).getTime() - Date.now()) / 86_400_000
        : 0,
      contatos: contagens[i]?.count ?? 0,
      negocios: negociacoes[i]?.count ?? 0,
      ultimaAtividade: maisRecente([
        dono?.ultimoLogin ?? null,
        ...(atividades[i] ?? []).map((r) => r.data?.created_at ?? null),
      ]),
      faladoEm: falados[empresa.id] ?? null,
    }
  })

  return { empresas: lista, escondidas, lidoEm: agora }
}

/**
 * A mais nova entre várias datas, ignorando as ausentes.
 *
 * `null` quando não há nenhuma — o que significa "nunca deu sinal de vida", e
 * é diferente de "deu sinal há muito tempo". A tela distingue os dois casos.
 */
function maisRecente(datas: Array<string | null>): string | null {
  const validas = datas.filter((d): d is string => Boolean(d))
  if (validas.length === 0) return null

  return validas.reduce((a, b) => (new Date(a) > new Date(b) ? a : b))
}
