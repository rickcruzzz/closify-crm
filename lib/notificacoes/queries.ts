import { createClient } from '@/lib/supabase/server'
import { getCurrentUserAndWorkspace } from '@/lib/supabase/workspace'
import type { Notificacao, TipoDeNotificacao } from '@/lib/notificacoes/tipos'

/**
 * Teto de notificações lidas de uma vez.
 *
 * Não é paginação, é o mesmo raciocínio do teto de `/hoje`: uma lista de sino
 * com mais de 30 itens não é uma lista, é um mural que ninguém lê. A purga de
 * 90 dias (0066) cuida do resto, e o `.limit()` explícito evita herdar o corte
 * silencioso do PostgREST em 1.000 linhas — classe 5 do diagnóstico de 25/08.
 */
const MAX_NOTIFICACOES = 30

type LinhaCrua = {
  id: string
  tipo: TipoDeNotificacao
  titulo: string
  corpo: string | null
  href: string | null
  criada_em: string
  lida_em: string | null
}

/**
 * Quantas não lidas, para o contador do sino.
 *
 * `count: exact, head: true`: o banco devolve o NÚMERO, não as linhas. Isto
 * roda no layout do dashboard, ou seja, em toda navegação — a mesma disciplina
 * do contador de tarefas de 19/08. Trazer 30 linhas por clique para exibir um
 * número seria pagar a lista inteira para mostrar um dígito.
 */
export async function contarNaoLidasDaEmpresaAtiva(): Promise<number> {
  const { workspaceId, user } = await getCurrentUserAndWorkspace()
  const supabase = await createClient()

  const { count, error } = await supabase
    .from('notificacoes')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .is('lida_em', null)
    .or(`user_id.is.null,user_id.eq.${user.id}`)

  // Contador que erra para cima inventa urgência; para baixo, esconde. Zero é
  // o padrão seguro: o sino some, e a pessoa descobre pelo e-mail, que continua
  // saindo.
  if (error) {
    console.error('Contagem de notificações falhou', error)
    return 0
  }

  return count ?? 0
}

/**
 * A lista em si, buscada só quando o sino ABRE.
 *
 * Separada da contagem de propósito: a contagem roda em toda navegação e a
 * lista, quase nunca. Buscá-las juntas faria todo clique no produto pagar por
 * uma tela que a maioria das pessoas não abre.
 */
export async function listarNotificacoesDaEmpresaAtiva(): Promise<Notificacao[]> {
  const { workspaceId, user } = await getCurrentUserAndWorkspace()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('notificacoes')
    // String LITERAL: quebrar em concatenação faz o tipo do retorno inteiro
    // virar `GenericStringError`, porque o supabase-js analisa esta string no
    // nível de tipo. Armadilha já paga neste projeto.
    .select('id, tipo, titulo, corpo, href, criada_em, lida_em')
    .eq('workspace_id', workspaceId)
    .or(`user_id.is.null,user_id.eq.${user.id}`)
    .order('criada_em', { ascending: false })
    .limit(MAX_NOTIFICACOES)

  if (error) {
    console.error('Leitura de notificações falhou', error)
    return []
  }

  return (data as LinhaCrua[]).map((l) => ({
    id: l.id,
    tipo: l.tipo,
    titulo: l.titulo,
    corpo: l.corpo,
    href: l.href,
    criadaEm: l.criada_em,
    lidaEm: l.lida_em,
  }))
}
