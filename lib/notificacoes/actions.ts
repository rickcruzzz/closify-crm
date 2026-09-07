'use server'

import { revalidatePath } from 'next/cache'
import { z } from '@/lib/validations/zod'

import { createClient } from '@/lib/supabase/server'
import { resolverWorkspaceAtivo } from '@/lib/workspace/ativo'
import { listarNotificacoesDaEmpresaAtiva } from '@/lib/notificacoes/queries'
import type { Notificacao } from '@/lib/notificacoes/tipos'

const idSchema = z.uuid('Notificação inválida.')

/**
 * Busca a lista para o sino aberto.
 *
 * Server Action e não prop do layout: a lista só é lida quando alguém clica no
 * sino, e a maioria das navegações nunca clica. Pendurá-la no layout faria
 * todo clique no produto pagar por uma tela que quase ninguém abre — o mesmo
 * raciocínio que tirou `getWorkspacesExclusivosDoUsuario` de dentro da aba
 * Equipe em 19/08, onde ele populava um diálogo fechado por padrão.
 */
export async function carregarNotificacoes(): Promise<
  { notificacoes: Notificacao[] } | { error: string }
> {
  try {
    return { notificacoes: await listarNotificacoesDaEmpresaAtiva() }
  } catch {
    return { error: 'Não conseguimos carregar seus avisos agora.' }
  }
}

/**
 * Marca uma como lida.
 *
 * ## O `workspace_id` no `update` não é redundância
 *
 * A RLS já impede escrever em notificação de outra empresa. O filtro extra
 * existe porque Server Action é endpoint HTTP e o id vem do cliente: sem ele,
 * um id de outra empresa produziria zero linhas afetadas e a RLS devolveria
 * **sucesso**, exatamente como o `delete` sem policy que a 0064 documentou.
 * Silêncio parecendo êxito é o defeito mais caro de reproduzir depois.
 */
export async function marcarComoLida(id: string) {
  const parse = idSchema.safeParse(id)
  if (!parse.success) return { error: 'Notificação inválida.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Sessão expirada.' }

  const workspaceId = await resolverWorkspaceAtivo(supabase, user.id)
  if (!workspaceId) return { error: 'Empresa não encontrada.' }

  const { error } = await supabase
    .from('notificacoes')
    .update({ lida_em: new Date().toISOString() })
    .eq('id', parse.data)
    .eq('workspace_id', workspaceId)
    .is('lida_em', null)

  if (error) {
    console.error('Não foi possível marcar como lida', error)
    return { error: 'Não foi possível marcar como lida.' }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}

/**
 * Tira o aviso da lista.
 *
 * Marca `dispensada_em` **e** `lida_em` na mesma escrita: quem dispensa já viu.
 * Deixar `lida_em` nulo faria o contador do sino continuar acusando algo que
 * saiu da tela — e contador que aponta para o que não existe é a forma mais
 * rápida de a pessoa parar de confiar nele.
 *
 * **Não apaga a linha, e isso é decisão.** Apagar exigiria uma policy de DELETE
 * para `authenticated`, e a 0066 recusa pelo mesmo motivo que recusa `insert`:
 * quem pode apagar aviso de cobrança pode esconder um. A linha continua no
 * banco e some da tela; quem remove de verdade é a purga de 90 dias.
 *
 * `coalesce` na data de leitura preserva QUANDO a pessoa viu: sobrescrever com
 * agora transformaria "vi isso ontem" em "vi agora", que é o mesmo defeito que
 * `marcarTodasComoLidas` evita com o `is('lida_em', null)`.
 */
export async function dispensarNotificacao(id: string) {
  const parse = idSchema.safeParse(id)
  if (!parse.success) return { error: 'Notificação inválida.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Sessão expirada.' }

  const workspaceId = await resolverWorkspaceAtivo(supabase, user.id)
  if (!workspaceId) return { error: 'Empresa não encontrada.' }

  const { data: atual } = await supabase
    .from('notificacoes')
    .select('lida_em')
    .eq('id', parse.data)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  const agora = new Date().toISOString()
  const { error } = await supabase
    .from('notificacoes')
    .update({ dispensada_em: agora, lida_em: atual?.lida_em ?? agora })
    .eq('id', parse.data)
    .eq('workspace_id', workspaceId)
    .is('dispensada_em', null)

  if (error) {
    console.error('Não foi possível dispensar o aviso', error)
    return { error: 'Não foi possível dispensar o aviso.' }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}

/**
 * Marca todas de uma vez.
 *
 * `is('lida_em', null)` e não um `update` cego: sem ele, reabrir o sino
 * reescreveria a data de leitura de tudo que já estava lido, e "quando eu vi
 * isso" viraria "a última vez que abri o sino".
 */
export async function marcarTodasComoLidas() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Sessão expirada.' }

  const workspaceId = await resolverWorkspaceAtivo(supabase, user.id)
  if (!workspaceId) return { error: 'Empresa não encontrada.' }

  const { error } = await supabase
    .from('notificacoes')
    .update({ lida_em: new Date().toISOString() })
    .eq('workspace_id', workspaceId)
    .is('lida_em', null)

  if (error) {
    console.error('Não foi possível marcar todas como lidas', error)
    return { error: 'Não foi possível marcar todas como lidas.' }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}
