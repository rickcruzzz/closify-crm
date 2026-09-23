import { createClient } from '@/lib/supabase/server'
import {
  FREE_LEAD_LIMIT,
  FREE_MEMBER_LIMIT,
  FREE_ORCAMENTO_LIMIT,
  FREE_WORKSPACE_LIMIT,
  MAX_WORKSPACE_LIMIT,
  PRO_WORKSPACE_LIMIT,
} from '@/lib/plans'

type LimitCheck = { allowed: boolean; reason?: string }

/**
 * Quantos orçamentos com lembrete ainda cabem no Free desta empresa.
 *
 * Espelha a trigger da 0079, que é quem de fato recusa — esta existe para a
 * mensagem chegar ANTES da tentativa, como `canAddLead`. As duas contam a
 * mesma coisa e por isso precisam contar do mesmo jeito: **só orçamento
 * ABERTO**, porque negócio ganho ou perdido libera a vaga.
 *
 * Sem o `stage` aqui, a tela diria "você tem 3 de 3" para quem fechou dois — e
 * o banco deixaria criar. Limite que a tela e o banco contam diferente é pior
 * que limite nenhum: ele ensina a pessoa a não acreditar no aviso.
 */
export async function canAddOrcamento(workspaceId: string): Promise<LimitCheck> {
  const supabase = await createClient()

  const { data: pro } = await supabase.rpc('pro_vigente', { target_workspace_id: workspaceId })

  if (pro) return { allowed: true }

  const { count } = await supabase
    .from('deals')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .not('orcamento_validade', 'is', null)
    .not('stage', 'in', '(fechado_ganho,fechado_perdido)')

  if ((count ?? 0) >= FREE_ORCAMENTO_LIMIT) {
    return {
      allowed: false,
      reason: `O plano Free acompanha ${FREE_ORCAMENTO_LIMIT} orçamentos ao mesmo tempo. Feche um negócio ou faça upgrade para o Pro para acompanhar quantos quiser.`,
    }
  }

  return { allowed: true }
}

export async function canAddLead(workspaceId: string): Promise<LimitCheck> {
  const supabase = await createClient()

  const { data: pro } = await supabase.rpc('pro_vigente', { target_workspace_id: workspaceId })

  if (pro) return { allowed: true }

  const { count } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)

  if ((count ?? 0) >= FREE_LEAD_LIMIT) {
    return {
      allowed: false,
      // "contatos", nao "leads", e a palavra e o conserto.
      //
      // A trigger `checar_limite_de_leads` levanta *"Plano Free permite no
      // maximo % contatos"* desde a 0052, que foi a ultima a redefini-la. O
      // banco trocou a palavra e o TypeScript nao: quem batia no teto via uma
      // frase pela tela e outra pelo erro da trigger, dependendo de qual dos
      // dois caminhos barrasse primeiro.
      //
      // E "contatos" e o que a tela chama: o item do menu, o titulo da pagina
      // e o botao dizem Contatos. "Leads" e nome de tabela.
      reason: `Plano Free permite no máximo ${FREE_LEAD_LIMIT} contatos. Faça upgrade para o Pro para continuar.`,
    }
  }

  return { allowed: true }
}

// A importação por CSV grava várias linhas de uma vez, então `canAddLead`
// (que só responde sim/não para UMA linha) deixaria passar um arquivo de 300
// leads num workspace Free com 1 vaga sobrando. Devolve quantas cabem;
// `null` significa sem teto (plano Pro).
export async function remainingLeadSlots(workspaceId: string): Promise<number | null> {
  const supabase = await createClient()

  const { data: pro } = await supabase.rpc('pro_vigente', { target_workspace_id: workspaceId })

  if (pro) return null

  const { count } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)

  return Math.max(0, FREE_LEAD_LIMIT - (count ?? 0))
}

export async function canAddMember(workspaceId: string): Promise<LimitCheck> {
  const supabase = await createClient()

  const { data: pro } = await supabase.rpc('pro_vigente', { target_workspace_id: workspaceId })

  if (pro) return { allowed: true }

  // Conta membros já ativos + convites pendentes, sem isso, dava pra
  // estourar o limite mandando vários convites de uma vez e todos aceitando
  // depois.
  const [{ count: memberCount }, { count: pendingInvites }] = await Promise.all([
    supabase
      .from('workspace_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId),
    supabase
      .from('workspace_invites')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('status', 'pending'),
  ])

  if ((memberCount ?? 0) + (pendingInvites ?? 0) >= FREE_MEMBER_LIMIT) {
    return {
      allowed: false,
      reason: `Plano Free permite no máximo ${FREE_MEMBER_LIMIT} membros. Faça upgrade para o Pro para convidar mais.`,
    }
  }

  return { allowed: true }
}

/**
 * Pode criar mais uma empresa?
 *
 * Diferente dos outros limites, este é POR USUÁRIO, não por workspace: o que
 * se está contendo é justamente a criação de workspaces novos para escapar do
 * teto de colaboradores.
 *
 * A conta é feita sobre quem CRIOU a empresa, não sobre quem é admin dela.
 * Participar a convite de outro não consome a vaga de ninguém, e ser promovido
 * a admin lá também não.
 *
 * ## As duas contagens tinham que ser a MESMA (09/09)
 *
 * Até a 0078 esta função contava associação de admin e a RPC contava a mesma
 * coisa, então batiam. A 0078 mudou a RPC para `created_by` — porque seguir a
 * associação faria **aceitar um convite virar upgrade** — e por um momento as
 * duas discordaram: quem fosse admin de cinco empresas, tendo criado duas,
 * levava "O plano Pro inclui 5 empresas" desta função enquanto o banco
 * deixaria criar.
 *
 * É o defeito que a própria 0078 documenta para justificar concentrar o teto
 * num lugar só, cometido no lugar de fora. Agora as duas contam `created_by`.
 *
 * Quem já passou do limite antes desta regra existir mantém o que criou: a
 * checagem só barra criações novas.
 */
export async function canAddWorkspace(userId: string): Promise<LimitCheck> {
  const supabase = await createClient()

  const { data: proprias } = await supabase
    .from('workspaces')
    .select('id')
    .eq('created_by', userId)

  const ids = (proprias ?? []).map((w) => w.id)
  if (ids.length === 0) return { allowed: true }

  // Uma empresa Pro libera a criação, e o Pro cobre as cinco.
  //
  // Pergunta por workspace em vez de ler a coluna `plan` em lote: a coluna é o
  // último valor gravado e não sabe que o período pago venceu. `pro_vigente`
  // confere a validade. São poucas chamadas, o Free permite uma empresa, e
  // quem tem várias é justamente quem paga.
  const [validades, validadesMax] = await Promise.all([
    Promise.all(ids.map((id) => supabase.rpc('pro_vigente', { target_workspace_id: id }))),
    // O Max sobe o teto de CRIACAO de 5 para 10 (0094). Nao muda quantos
    // WhatsApps a pessoa conecta: isso e um por empresa paga, e `max_vigente`
    // continua com um ramo so.
    Promise.all(ids.map((id) => supabase.rpc('max_vigente', { target_workspace_id: id }))),
  ])

  const temPro = validades.some(({ data }) => data === true)
  const temMax = validadesMax.some(({ data }) => data === true)

  // O Pro deixou de ser passe livre em 09/09: ele cobre até
  // `PRO_WORKSPACE_LIMIT` empresas, todas com os recursos Pro. Antes disso
  // quem pagava criava quantas quisesse e cada nova nascia Free — teto de 50
  // contatos dentro de um plano já comprado.
  const teto = temMax
    ? MAX_WORKSPACE_LIMIT
    : temPro
      ? PRO_WORKSPACE_LIMIT
      : FREE_WORKSPACE_LIMIT

  if (ids.length >= teto) {
    return {
      allowed: false,
      // Tres frases, palavra por palavra iguais as da 0094: quem ja esta no
      // Max nao pode ouvir "assine o Max".
      reason: temMax
        ? `O plano Max inclui ${MAX_WORKSPACE_LIMIT} empresas. Fale com a gente para ter mais.`
        : temPro
          ? `O plano Pro inclui ${PRO_WORKSPACE_LIMIT} empresas. Assine o Max para gerenciar até ${MAX_WORKSPACE_LIMIT}.`
          : `O plano Free inclui ${FREE_WORKSPACE_LIMIT} empresa. Faça upgrade para o Pro para gerenciar várias.`,
    }
  }

  return { allowed: true }
}
