import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

import type { LeadParaEnriquecer, PortaDeLeads } from '../ports/leads'

/**
 * A ponte entre o módulo e o banco do produto.
 *
 * Este é um dos dois únicos arquivos daqui que conhecem o resto do projeto — o
 * domínio inteiro continua sem saber que existe Supabase. É o que permite
 * testar a regra sem banco e trocar o banco sem tocar na regra.
 *
 * `createAdminClient` porque quem chama é o cron, que não tem sessão. As duas
 * tabelas da 0072 não têm policy de escrita para `authenticated` justamente
 * para que este seja o único caminho.
 */

/**
 * O tamanho do lote de uma passagem do cron.
 *
 * Doze porque o cron roda a cada 15 minutos e cada consulta ao Exa leva alguns
 * segundos: doze cabe folgado no tempo de execução de uma função da Vercel, e
 * ainda dá ~1.150 leads por dia — muito acima do que qualquer workspace deste
 * produto tem hoje. Aumentar sem medir o tempo de execução é como o teto de
 * 1.000 linhas do PostgREST: funciona até o dia em que corta em silêncio.
 */
export const TAMANHO_DO_LOTE = 12

export function criarPortaDeLeads(): PortaDeLeads {
  return {
    async pendentes(limite = TAMANHO_DO_LOTE): Promise<LeadParaEnriquecer[]> {
      const admin = createAdminClient()

      // Duas consultas e não um join: o PostgREST embuti relação como objeto
      // aninhado, e a tipagem gerada não acompanha `!inner` bem. Duas leituras
      // pequenas e explícitas custam menos que um filtro implícito errado —
      // e o `.limit()` fica visível, que é a lição das três funções que
      // mentiam em silêncio no teto de 1.000 linhas.
      const { data: fila, error: erroDaFila } = await admin
        .from('enriquecimento_de_lead')
        .select('lead_id, workspace_id')
        .eq('status', 'pendente')
        .order('criado_em', { ascending: true })
        .limit(limite)

      if (erroDaFila) throw erroDaFila
      if (!fila || fila.length === 0) return []

      const ids = fila.map((f) => f.lead_id)
      const { data: leads, error: erroDosLeads } = await admin
        .from('leads')
        .select('id, workspace_id, name, company, email')
        .in('id', ids)
        .limit(ids.length)

      if (erroDosLeads) throw erroDosLeads

      // A ordem da fila manda: `in()` não preserva ordem, e processar fora de
      // ordem faria o lead mais antigo esperar indefinidamente num lote cheio.
      const porId = new Map((leads ?? []).map((l) => [l.id, l]))
      return ids
        .map((id) => porId.get(id))
        .filter((l): l is NonNullable<typeof l> => Boolean(l))
        .map((l) => ({
          id: l.id,
          workspaceId: l.workspace_id,
          nome: l.name,
          empresa: l.company ?? null,
          email: l.email ?? null,
          etapaMudouEm: null,
        }))
    },

    async gastoDoMes(workspaceId: string): Promise<number> {
      const admin = createAdminClient()
      const inicioDoMes = new Date()
      inicioDoMes.setUTCDate(1)
      inicioDoMes.setUTCHours(0, 0, 0, 0)

      const { data, error } = await admin
        .from('enriquecimento_de_lead')
        .select('custo_centavos')
        .eq('workspace_id', workspaceId)
        .gte('consultado_em', inicioDoMes.toISOString())
        .limit(10_000)

      if (error) throw error

      // Somado aqui e não com `sum()` do PostgREST de propósito: o agregado
      // exige uma view ou uma RPC, e o `.limit()` explícito é o que impede o
      // corte silencioso em 1.000 linhas. Dez mil consultas num mês por
      // workspace é ordem de grandeza acima do teto de gasto — se um dia isso
      // ficar apertado, o teto já terá parado tudo antes.
      return (data ?? []).reduce((soma, linha) => soma + (linha.custo_centavos ?? 0), 0)
    },
  }
}
