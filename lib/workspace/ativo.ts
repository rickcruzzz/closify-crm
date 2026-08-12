import 'server-only'

import { cookies } from 'next/headers'

import type { createClient } from '@/lib/supabase/server'

/**
 * Qual empresa a pessoa está usando agora.
 *
 * Antes não existia: cada tela resolvia "o workspace mais antigo" por conta
 * própria, em quatro lugares diferentes, e o seletor de empresa da barra
 * lateral só trocava um estado local do React. Quem participava de duas
 * empresas via as duas na lista, clicava na segunda, o rótulo mudava — e todos
 * os dados continuavam sendo da primeira. Para quem foi convidado como
 * colaborador tendo empresa própria, isso significava não conseguir acessar a
 * empresa que o convidou, nunca.
 *
 * A escolha vira cookie porque precisa sobreviver à navegação entre páginas
 * (que são Server Components e não compartilham estado de React) e ao
 * recarregamento.
 */

const COOKIE = 'vf_empresa'

/** Um mês: tempo de a pessoa voltar sem ter que reescolher, sem virar eterno. */
const VALIDADE_SEGUNDOS = 60 * 60 * 24 * 30

const BASE = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  // Em `localhost` o navegador recusa cookie `secure`, e o seletor pararia de
  // funcionar só no ambiente de desenvolvimento — o pior lugar para um bug
  // aparecer.
  secure: process.env.NODE_ENV === 'production',
}

/**
 * Decide qual empresa responde por esta requisição.
 *
 * A escolha guardada só vale se a pessoa REALMENTE participa dela. O cookie é
 * enviado pelo navegador e portanto editável por quem quiser: sem esta
 * conferência, alguém apontaria para o UUID de outra empresa. A RLS bloquearia
 * a leitura de qualquer forma — o efeito seria uma tela vazia, não um
 * vazamento —, mas cair no padrão é melhor do que exibir um dashboard sem
 * nada e sem explicação.
 *
 * Sem escolha guardada, mantém o comportamento antigo: a empresa mais antiga.
 * `order` por `created_at` E por `workspace_id` porque sem desempate o
 * Postgres pode devolver ordens diferentes entre requisições, e a gravação
 * cairia numa empresa em cada request.
 */
export async function resolverWorkspaceAtivo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string | null> {
  const { data: vinculos } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .order('workspace_id', { ascending: true })

  if (!vinculos || vinculos.length === 0) return null

  const escolhido = await workspaceEscolhidoNoCookie()
  return resolverWorkspaceAtivoComVinculos(vinculos, escolhido)
}

/**
 * Mesma regra de `resolverWorkspaceAtivo`, mas recebendo os vínculos já
 * carregados por quem chama — usada em `getCurrentUserAndWorkspace`, que já
 * busca `workspace_members` para montar a lista do seletor. Sem isto, a
 * mesma tabela era lida duas vezes na mesma navegação.
 */
export function resolverWorkspaceAtivoComVinculos(
  vinculos: { workspace_id: string }[],
  cookieEscolhido: string | undefined,
): string | null {
  if (vinculos.length === 0) return null

  if (cookieEscolhido && vinculos.some((v) => v.workspace_id === cookieEscolhido)) {
    return cookieEscolhido
  }

  return vinculos[0]!.workspace_id
}

/** Lê a escolha guardada no cookie, para passar a `resolverWorkspaceAtivo`. */
export async function workspaceEscolhidoNoCookie(): Promise<string | undefined> {
  return (await cookies()).get(COOKIE)?.value
}

/**
 * Guarda a empresa escolhida.
 *
 * Não confere participação aqui de propósito — quem chama é a Server Action de
 * troca, que já conferiu. Repetir a consulta a cada gravação seria uma ida ao
 * banco a mais sem ganhar nada, já que `resolverWorkspaceAtivo` reconfere na
 * leitura seguinte.
 */
export async function definirWorkspaceAtivo(workspaceId: string) {
  const jar = await cookies()
  jar.set(COOKIE, workspaceId, { ...BASE, maxAge: VALIDADE_SEGUNDOS })
}

/**
 * Esquece a escolha.
 *
 * Chamado ao sair de uma empresa (ou ao ser removido dela): sem isso o cookie
 * apontaria para um vínculo que já não existe, e a pessoa cairia no padrão sem
 * entender por que a tela mudou de empresa sozinha.
 */
export async function limparWorkspaceAtivo() {
  const jar = await cookies()
  jar.delete(COOKIE)
}
