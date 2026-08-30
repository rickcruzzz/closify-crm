import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { exigirAmbienteLocal } from '@/lib/dono/somente-local'
import type { TipoDeFeedback } from '@/types/supabase'

export type RelatoNaTela = {
  id: string
  tipo: TipoDeFeedback
  mensagem: string
  rota: string | null
  plano: string | null
  criadoEm: string
  /** Nome da empresa, resolvido aqui — a tabela guarda só o id. */
  empresa: string
  /** Para responder. É a ação que a tela existe para provocar. */
  email: string
}

export type FilaDeFeedback = {
  relatos: RelatoNaTela[]
  /** Quantos foram silenciados, para o contador de "mostrar de novo". */
  silenciados: number
  /**
   * Quantos relatos internos existem, dito à parte.
   *
   * Não entram na fila — misturá-los é o defeito que a Central pagou em 20/08,
   * quando 8 de 11 alertas eram teste do próprio dono e a fila inteira virou
   * algo a ignorar. Mas esconder o número por completo faria parecer que
   * ninguém testou, então ele aparece como nota de rodapé.
   */
  internos: number
  lidoEm: string
}

/**
 * A fila de relatos, para a Central do Dono.
 *
 * Lê com `createAdminClient()` porque `feedback` tem RLS ligada e ZERO policy
 * (migration 0060) — nenhum papel de usuário enxerga a tabela, e a Central já
 * roda fora da RLS e só em localhost.
 *
 * ## Duas consultas, não um join
 *
 * `feedback` não tem FK para `workspaces` de propósito (apagar a empresa não
 * pode apagar a evidência do problema que ela relatou), então o PostgREST não
 * consegue embutir o nome. As duas leituras são pequenas e a fila é curta.
 */
export async function lerFilaDeFeedback(silenciados: Set<string>): Promise<FilaDeFeedback> {
  await exigirAmbienteLocal()

  const admin = createAdminClient()

  // `.limit()` explícito: o PostgREST corta em 1.000 linhas e NÃO devolve erro
  // — o defeito que já custou três funções deste projeto (0032, 0033). 200 é
  // mais do que qualquer fila que uma pessoa lê, e o teto é declarado em vez
  // de herdado.
  const { data: linhas, error } = await admin
    .from('feedback')
    .select('id, tipo, mensagem, rota, plano, workspace_id, user_id, interno, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('lerFilaDeFeedback falhou', error)
    return { relatos: [], silenciados: 0, internos: 0, lidoEm: new Date().toISOString() }
  }

  const todos = linhas ?? []
  const deCliente = todos.filter((l) => !l.interno)

  const idsDeEmpresa = Array.from(
    new Set(deCliente.map((l) => l.workspace_id).filter(Boolean)),
  )
  const { data: empresas } = idsDeEmpresa.length
    ? await admin.from('workspaces').select('id, name').in('id', idsDeEmpresa as string[])
    : { data: [] }

  const nomePorId = new Map((empresas ?? []).map((w) => [w.id, w.name]))

  // Um `getUserById` por relato seria uma ida por linha. A fila é curta e a
  // Central roda local, mas o padrão do projeto é não escrever laço de rede
  // sem necessidade — então busca uma página de usuários e casa em memória.
  const { data: usuarios } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const emailPorId = new Map((usuarios?.users ?? []).map((u) => [u.id, u.email ?? '']))

  const relatos: RelatoNaTela[] = deCliente
    .filter((l) => !silenciados.has(l.id))
    .map((l) => ({
      id: l.id,
      tipo: l.tipo,
      mensagem: l.mensagem,
      rota: l.rota,
      plano: l.plano,
      criadoEm: l.created_at,
      // A empresa pode ter sido apagada — e é justamente o caso que mais
      // interessa ler, porque o relato pode explicar por que ela saiu.
      empresa: (l.workspace_id && nomePorId.get(l.workspace_id)) || 'Empresa apagada',
      email: (l.user_id && emailPorId.get(l.user_id)) || 'sem e-mail',
    }))

  return {
    relatos,
    silenciados: deCliente.filter((l) => silenciados.has(l.id)).length,
    internos: todos.length - deCliente.length,
    lidoEm: new Date().toISOString(),
  }
}
