import 'server-only'

import { createClient } from '@/lib/supabase/server'

/**
 * O que a tela do contato mostra sobre pesquisa de mercado.
 *
 * Lê com o cliente do USUÁRIO, não com `createAdminClient()`. A 0072 dá
 * `select` por `is_workspace_member` nas duas tabelas, então a RLS é a defesa —
 * e usar o admin aqui contornaria justamente a regra que isola uma empresa da
 * outra. O admin fica onde ele precisa estar: no serviço que ESCREVE, chamado
 * pelo cron.
 */

export type SinalDeMercado = {
  id: string
  tipo: string
  resumo: string
  fonteUrl: string
  publicadoEm: string | null
  confianca: string
  criadoEm: string
}

export type EstadoDaPesquisa = {
  /** `null` quando o lead nunca foi enfileirado. */
  status: 'pendente' | 'ok' | 'falhou' | 'sem_sinal' | null
  consultadoEm: string | null
  sinais: SinalDeMercado[]
}

export async function lerPesquisaDoLead(
  workspaceId: string,
  leadId: string,
): Promise<EstadoDaPesquisa> {
  const supabase = await createClient()

  // As duas em paralelo: encadear seria mais uma ida em série até São Paulo na
  // página que a pessoa mais abre depois do funil.
  const [fila, sinais] = await Promise.all([
    supabase
      .from('enriquecimento_de_lead')
      .select('status, consultado_em')
      .eq('workspace_id', workspaceId)
      .eq('lead_id', leadId)
      .maybeSingle(),
    supabase
      .from('sinal_de_mercado')
      .select('id, tipo, resumo, fonte_url, publicado_em, confianca, criado_em')
      .eq('workspace_id', workspaceId)
      .eq('lead_id', leadId)
      .order('criado_em', { ascending: false })
      // Teto explícito: o PostgREST corta em 1.000 sem avisar, e consulta nova
      // sem `.limit()` herda esse defeito. Aqui doze já é mais do que cabe na
      // tela — a purga de 180 dias da 0072 cuida do resto.
      .limit(12),
  ])

  return {
    status: (fila.data?.status as EstadoDaPesquisa['status']) ?? null,
    consultadoEm: fila.data?.consultado_em ?? null,
    sinais: (sinais.data ?? []).map((s) => ({
      id: s.id,
      tipo: s.tipo,
      resumo: s.resumo,
      fonteUrl: s.fonte_url,
      publicadoEm: s.publicado_em,
      confianca: s.confianca,
      criadoEm: s.criado_em,
    })),
  }
}
