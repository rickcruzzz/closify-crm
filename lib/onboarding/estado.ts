import { cache } from 'react'

import { createClient } from '@/lib/supabase/server'
import type { OnboardingEtapa, OnboardingStatus, TourStatus } from '@/types/supabase'

export type EstadoDoOnboarding = {
  status: OnboardingStatus
  etapa: OnboardingEtapa | null
  tourStatus: TourStatus
  checklistOculto: boolean
  /** Marca falha de leitura, para quem decide redirecionar não confundir com `not_started` de verdade. */
  erro?: boolean
}

/**
 * Quem nunca respondeu nada não tem linha no banco.
 *
 * Linha ausente é tratada como `not_started` em vez de ser criada na leitura:
 * assim abrir uma página não gera escrita, e a linha nasce no primeiro passo
 * de verdade. O backfill da 0030 já deu linha a quem existia antes.
 */
const PADRAO: EstadoDoOnboarding = {
  status: 'not_started',
  etapa: null,
  tourStatus: 'not_started',
  checklistOculto: false,
}

/**
 * O estado do onboarding da pessoa logada.
 *
 * `cache()` por requisição pelo mesmo motivo de `getCurrentUserAndWorkspace`:
 * o layout, a página e o checklist perguntam a mesma coisa na mesma
 * navegação, e sem isto seriam três idas ao banco.
 */
export const lerEstadoDoOnboarding = cache(async (): Promise<EstadoDoOnboarding> => {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return PADRAO

  const { data, error } = await supabase
    .from('onboarding_state')
    .select('status, etapa, tour_status, checklist_oculto')
    .eq('user_id', user.id)
    .maybeSingle()

  // Falha de leitura vira `not_started`, e isso mandaria a pessoa ao
  // onboarding de novo. Preferível ao contrário — dar por concluído o que não
  // se conseguiu ler esconderia o assistente de quem precisa dele — mas o erro
  // precisa aparecer no log para não virar mistério.
  if (error) {
    console.error('lerEstadoDoOnboarding falhou', error)
    return { ...PADRAO, erro: true }
  }

  if (!data) return PADRAO

  return {
    status: data.status,
    etapa: data.etapa,
    tourStatus: data.tour_status,
    checklistOculto: data.checklist_oculto,
  }
})

/** Quem ainda deve ver o assistente. `skipped` não vê: foi decisão dela. */
export function precisaDeOnboarding(estado: EstadoDoOnboarding): boolean {
  return estado.status === 'not_started' || estado.status === 'in_progress'
}

/**
 * Quem nunca configurou nada precisa passar pelas boas-vindas antes do
 * produto — mesma regra que vivia no middleware. `in_progress` e `skipped`
 * NÃO desviam: pular foi decisão da pessoa, e quem está no meio já está na
 * tela certa. Falha de leitura (`erro`) também não desvia — um erro
 * transitório do banco não pode empurrar para as boas-vindas quem está
 * trabalhando.
 */
export function precisaDeBoasVindas(estado: EstadoDoOnboarding): boolean {
  return estado.status === 'not_started' && !estado.erro
}

/**
 * Fecha o onboarding de quem entrou numa empresa que já existe.
 *
 * Quem aceita convite não tem empresa para configurar: ela já está montada,
 * com nome, segmento e pipeline. Sem esta marca, a pessoa cairia nas
 * boas-vindas e atravessaria quatro perguntas sobre uma empresa que não é dela
 * — e o assistente terminaria sem alterar nada, porque colaborador não é admin
 * e a RLS recusa a escrita.
 *
 * `merge-duplicates` e não `insert`: quem aceita um SEGUNDO convite já tem
 * linha, e um insert cru estouraria por chave duplicada.
 *
 * Não é Server Action de propósito — precisa ser chamável tanto de uma action
 * quanto da página que aceita o convite sozinha.
 */
export async function concluirOnboardingPorConvite(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('onboarding_state')
    .upsert(
      { user_id: userId, status: 'completed', etapa: null, tour_status: 'not_started' },
      { onConflict: 'user_id' },
    )

  // Falhar aqui não pode derrubar o aceite do convite: a pessoa já entrou na
  // empresa, e o pior efeito de não gravar é ela ver as boas-vindas uma vez.
  if (error) {
    console.error('concluirOnboardingPorConvite falhou', error)
  }
}
