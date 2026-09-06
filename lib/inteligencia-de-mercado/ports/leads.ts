/**
 * O que o módulo precisa saber de um lead — e nada além.
 *
 * Este arquivo é o CONTRATO. O módulo não importa `LeadRow` de
 * `lib/leads/queries.ts` de propósito: se importasse, mudar uma coluna do CRM
 * quebraria a inteligência de mercado, e as duas passariam a ser uma coisa só.
 * Quem faz a ponte é `adapters/leads-supabase.ts`, o único arquivo daqui que
 * conhece o resto do projeto.
 */

export type LeadParaEnriquecer = {
  id: string
  workspaceId: string
  nome: string
  empresa: string | null
  /**
   * O e-mail do lead. É de onde o domínio da empresa sai — o CRM não tem campo
   * de site, conferido no catálogo em 06/09. Ver `dominioDoEmail`.
   */
  email: string | null
  /** Quando a etapa do negócio mudou pela última vez, se houver negócio. */
  etapaMudouEm: Date | null
}

export type PortaDeLeads = {
  /** Os próximos da fila, já filtrados por quem pode ser consultado. */
  pendentes(limite: number): Promise<LeadParaEnriquecer[]>
  /** Quanto o workspace já gastou no mês corrente, em centavos. */
  gastoDoMes(workspaceId: string): Promise<number>
}
