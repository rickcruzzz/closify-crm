'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { definirWorkspaceAtivo } from '@/lib/workspace/ativo'
import { getResend } from '@/lib/resend/client'
import { renderConviteEmail } from '@/lib/emails/convite'
import {
  inviteMemberSchema,
  memberRoleSchema,
  updateWorkspaceNameSchema,
  uuidSchema,
} from '@/lib/validations/workspace'
import { getCurrentUserAndWorkspace } from '@/lib/supabase/workspace'
import { getWorkspacesExclusivosDoUsuario } from '@/lib/workspace/queries'
import { canAddMember } from '@/lib/limits'
import { appUrl } from '@/lib/app-url'
import { concluirOnboardingPorConvite } from '@/lib/onboarding/estado'
import { excedeuLimite } from '@/lib/rate-limit'

async function requireAdmin() {
  const { user, workspaceId } = await getCurrentUserAndWorkspace()
  const supabase = await createClient()

  const { data: isAdmin } = await supabase.rpc('is_workspace_admin', {
    target_workspace_id: workspaceId,
  })

  if (!isAdmin) {
    return { error: 'Apenas administradores podem fazer isso.' as const }
  }

  return { supabase, user, workspaceId }
}

export async function updateWorkspaceName(values: unknown) {
  const parsed = updateWorkspaceNameSchema.safeParse(values)
  if (!parsed.success) {
    return { error: 'Dados inválidos.' }
  }

  const admin = await requireAdmin()
  if ('error' in admin) return admin

  const { error } = await admin.supabase
    .from('workspaces')
    .update({ name: parsed.data.name })
    .eq('id', admin.workspaceId)

  if (error) {
    console.error('updateWorkspaceName falhou', error)
    return { error: 'Não foi possível atualizar o workspace.' }
  }

  revalidatePath('/settings')
  return { success: true }
}

export async function inviteMember(values: unknown) {
  const parsed = inviteMemberSchema.safeParse(values)
  if (!parsed.success) {
    return { error: 'Dados inválidos.' }
  }

  const admin = await requireAdmin()
  if ('error' in admin) return admin

  const { supabase, workspaceId, user } = admin

  // Convidar a si mesmo era possível e acontecia de verdade em produção. Não
  // dá erro visível, mas gasta uma vaga do plano: `canAddMember` soma convites
  // pendentes aos membros ativos, então no Free (limite 2) o admin vira 1
  // membro + 1 convite e fica impedido de convidar alguém de verdade. E o
  // convite nunca serve para nada, `accept_workspace_invite` termina em
  // `on conflict do nothing`.
  //
  // A trava de fato é o trigger `validar_convite_de_workspace` (migration
  // 0024), porque a RLS permite INSERT direto na tabela. A checagem aqui existe
  // pela mensagem: sem ela, o erro chegaria à tela como falha crua do Postgres.
  if (parsed.data.email === user.email?.trim().toLowerCase()) {
    return { error: 'Você já faz parte desta empresa. Convide o e-mail de outra pessoa.' }
  }

  const { data: jaEMembro } = await supabase.rpc('email_e_membro_do_workspace', {
    target_workspace_id: workspaceId,
    target_email: parsed.data.email,
  })

  if (jaEMembro) {
    return { error: 'Esta pessoa já faz parte da empresa.' }
  }

  // Limita por workspace: o abuso aqui e usar nosso Resend como maquina de
  // spam, e quem dispara e sempre o mesmo workspace, variando o destinatario.
  if (await excedeuLimite('invite', workspaceId)) {
    return {
      error: 'Muitos convites enviados. Aguarde alguns minutos e tente novamente.',
    }
  }

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('name')
    .eq('id', workspaceId)
    .single()

  if (!workspace) {
    return { error: 'Workspace não encontrado.' }
  }

  const limit = await canAddMember(workspaceId)
  if (!limit.allowed) {
    return { error: limit.reason }
  }

  const { data: invite, error } = await supabase
    .from('workspace_invites')
    .insert({
      workspace_id: workspaceId,
      email: parsed.data.email,
      role: parsed.data.role,
      invited_by: user.id,
    })
    .select('token')
    .single()

  if (error) {
    console.error('inviteMember falhou', error)
    if (error.code === '23505') {
      return { error: 'Já existe um convite pendente para este e-mail.' }
    }
    return { error: 'Não foi possível criar o convite.' }
  }

  const inviteUrl = `${appUrl()}/convite/${invite.token}`

  // O convite já está gravado neste ponto. Falhar no envio não pode derrubar a
  // requisição com 500: a pessoa precisa saber que o convite existe e pode ser
  // reenviado, em vez de ver o diálogo travado sem explicação.
  let resend: ReturnType<typeof getResend>
  try {
    resend = getResend()
  } catch (err) {
    console.error('Resend indisponível ao enviar convite', err)
    return {
      error:
        'Convite criado, mas o serviço de e-mail não está configurado. Avise o suporte.',
    }
  }

  // O escape do nome do workspace acontece dentro de `renderConviteEmail`,
  // ver o comentário de `escapeHtml` em `lib/emails/layout.ts`, que explica por
  // que ele existe.
  const { subject, html } = renderConviteEmail({
    workspaceName: workspace.name,
    inviteUrl,
  })

  const { error: emailError } = await resend.emails.send({
    // Domínio próprio, verificado no Resend (SPF em `send`, DKIM em
    // `resend._domainkey` e DMARC publicados no registro.br). Sair do
    // `onboarding@resend.dev` tira o convite do domínio compartilhado de
    // teste, que é o que mais empurra esse e-mail para spam.
    from: 'Velo Funil <suporte@velofunil.com.br>',
    to: parsed.data.email,
    subject,
    html,
  })

  if (emailError) {
    console.error('Envio de e-mail de convite falhou', emailError)
    return {
      error: 'Convite criado, mas não foi possível enviar o e-mail. Tente reenviar.',
    }
  }

  revalidatePath('/settings')
  return { success: true }
}

export async function revokeInvite(inviteId: string) {
  const admin = await requireAdmin()
  if ('error' in admin) return admin

  const { error } = await admin.supabase
    .from('workspace_invites')
    .delete()
    .eq('id', inviteId)
    .eq('workspace_id', admin.workspaceId)

  if (error) {
    console.error('revokeInvite falhou', error)
    return { error: 'Não foi possível cancelar o convite.' }
  }

  revalidatePath('/settings')
  return { success: true }
}

export async function updateMemberRole(memberUserId: string, role: unknown) {
  // Server Action é endpoint HTTP: o tipo do parâmetro não protege nada em
  // runtime, um request forjado manda qualquer string.
  const parsed = memberRoleSchema.safeParse(role)
  if (!parsed.success) {
    return { error: 'Papel inválido.' }
  }

  const admin = await requireAdmin()
  if ('error' in admin) return admin

  // Rebaixar o último admin deixa o workspace sem ninguém que possa convidar,
  // cobrar ou gerenciar membros, lockout que só se resolve no banco.
  if (parsed.data === 'membro') {
    const { count } = await admin.supabase
      .from('workspace_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('workspace_id', admin.workspaceId)
      .eq('role', 'admin')

    if ((count ?? 0) <= 1) {
      return { error: 'O workspace precisa de pelo menos um administrador.' }
    }
  }

  const { error } = await admin.supabase
    .from('workspace_members')
    .update({ role: parsed.data })
    .eq('workspace_id', admin.workspaceId)
    .eq('user_id', memberUserId)

  if (error) {
    console.error('updateMemberRole falhou', error)
    return { error: 'Não foi possível atualizar o papel do membro.' }
  }

  revalidatePath('/settings')
  return { success: true }
}

export async function removeMember(memberUserId: string) {
  const admin = await requireAdmin()
  if ('error' in admin) return admin

  if (memberUserId === admin.user.id) {
    return { error: 'Você não pode remover a si mesmo.' }
  }

  const { error } = await admin.supabase
    .from('workspace_members')
    .delete()
    .eq('workspace_id', admin.workspaceId)
    .eq('user_id', memberUserId)

  if (error) {
    console.error('removeMember falhou', error)
    return { error: 'Não foi possível remover o membro.' }
  }

  revalidatePath('/settings')
  return { success: true }
}

// As exceções que a RPC levanta de propósito são seguras de mostrar. Qualquer
// outra coisa (violação de constraint, erro de cast, nome de tabela) vira
// mensagem genérica em vez de vazar o texto cru do Postgres pro browser.
const INVITE_ERRORS = [
  'Convite inválido ou já utilizado.',
  'Convite expirado.',
  'Este convite foi enviado para outro e-mail.',
  'Workspace atingiu o limite de 2 membros do plano Free.',
]

export async function acceptInvite(token: unknown) {
  const parsed = uuidSchema.safeParse(token)
  if (!parsed.success) {
    return { error: 'Convite inválido.' }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'not_authenticated' as const }
  }

  // Limita por usuario: sem isso, uma sessao valida pode martelar tokens de
  // convite a vontade. O token e UUID, entao adivinhar ja e inviavel -- isto
  // fecha o custo de tentar.
  if (await excedeuLimite('accept-invite', user.id)) {
    return { error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' }
  }

  const { data: workspaceId, error } = await supabase.rpc('accept_workspace_invite', {
    invite_token: parsed.data,
  })

  if (error) {
    console.error('acceptInvite falhou', error)
    const known = INVITE_ERRORS.find((message) => error.message.includes(message))
    return { error: known ?? 'Não foi possível aceitar o convite.' }
  }

  // Bug real reportado pelo dono, achado em 21/08: sem isto, quem aceita o
  // convite continua vendo a empresa mais antiga que já participava (ou a
  // que acabou de criar no cadastro) — `resolverWorkspaceAtivo` cai nesse
  // fallback sempre que o cookie `vf_empresa` não aponta pra empresa certa.
  // A migration 0048 fez a RPC devolver o `workspace_id` exatamente para
  // isto: gravar o cookie na hora, sem uma segunda consulta.
  if (workspaceId) {
    await definirWorkspaceAtivo(workspaceId)
  }

  // Mesma razão do aceite automático na página do convite: quem entra numa
  // empresa que já existe não tem empresa para configurar. Os dois caminhos
  // levam ao mesmo estado, deixar só um marcado faria o assistente aparecer
  // dependendo de por onde a pessoa aceitou.
  await concluirOnboardingPorConvite(supabase, user.id)

  return { success: true }
}

/**
 * Exclui a conta do usuário autenticado, LGPD, art. 18, VI.
 *
 * Duas etapas, nesta ordem, e a ordem importa:
 *
 * 1. A RPC `excluir_minha_conta` apaga os dados de aplicação sob a sessão do
 *    próprio usuário. Ela roda como `security definer` porque `workspaces` tem
 *    RLS sem policy de DELETE, um `delete` direto do client seria negado em
 *    silêncio, devolvendo sucesso com zero linhas apagadas.
 * 2. Só então a linha em `auth.users` é removida com a service role, que é o
 *    único caminho para o schema `auth`.
 *
 * Se a etapa 2 falhar, sobra um login sem nenhum dado, inconveniente, mas
 * recuperável. Se fosse ao contrário, os dados ficariam órfãos e sem dono, que
 * é exatamente o que o pedido de eliminação quer evitar.
 */
/**
 * Nomes dos workspaces que somem junto se a pessoa excluir a própria conta.
 *
 * Antes era buscado no Server Component da aba Equipe, toda vez que a aba
 * carregava, mesmo com o diálogo de exclusão fechado (o caso comum). Só o
 * diálogo mostra essa lista, então buscar aqui, quando ele abre, tira essa
 * consulta do carregamento normal da aba.
 */
export async function listarWorkspacesQueSeraoApagados() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  return getWorkspacesExclusivosDoUsuario(user.id)
}

export async function deleteAccount(senha: unknown) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Sessão expirada. Entre novamente.' }
  }

  // Reautentica antes de qualquer efeito irreversível. A confirmação de texto
  // ("digite EXCLUIR") na UI evita clique acidental, mas não é autenticação:
  // uma sessão sequestrada (cookie roubado, dispositivo destravado) bastava
  // para apagar a conta inteira sem que quem fez isso soubesse a senha.
  //
  // `signInWithPassword`, não uma comparação de hash local: é o mesmo caminho
  // que o login usa, então herda o mesmo tratamento de erro do GoTrue sem
  // duplicar lógica de senha aqui.
  if (typeof senha !== 'string' || senha.length === 0) {
    return { error: 'Confirme sua senha para excluir a conta.' }
  }

  if (!user.email) {
    return { error: 'Não foi possível confirmar sua identidade. Tente novamente.' }
  }

  const { error: authCheckError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: senha,
  })

  if (authCheckError) {
    return { error: 'Senha incorreta.' }
  }

  const { error: rpcError } = await supabase.rpc('excluir_minha_conta')

  if (rpcError) {
    console.error('excluir_minha_conta falhou', rpcError)
    // A RPC lança mensagem própria quando há assinatura ativa; ela é útil para
    // a pessoa e pode ser repassada.
    if (rpcError.message.includes('Cancele sua assinatura')) {
      return {
        error:
          'Cancele sua assinatura em Cobrança antes de excluir a conta. Assim a cobrança no Asaas não continua.',
      }
    }
    return { error: 'Não foi possível excluir a conta. Tente novamente.' }
  }

  const { error: authError } = await createAdminClient().auth.admin.deleteUser(user.id)

  if (authError) {
    // Os dados de aplicação já se foram neste ponto. Falhar aqui deixa apenas
    // um login vazio, então não vale bloquear a pessoa: registramos para
    // limpeza manual e seguimos para o logout.
    console.error('deleteUser (auth) falhou após limpar dados', {
      userId: user.id,
      message: authError.message,
    })
  }

  await supabase.auth.signOut()

  return { success: true }
}

/**
 * Troca a empresa que a pessoa está usando.
 *
 * O seletor da barra lateral era decorativo: `onClick` só mudava um estado do
 * React, e as páginas, que são Server Components e não enxergam esse estado,
 * continuavam lendo sempre a empresa mais antiga. Quem participava de duas via
 * as duas na lista, clicava na segunda, o rótulo mudava, e todos os dados
 * continuavam da primeira. Para quem foi convidado como colaborador tendo
 * empresa própria, isso significava nunca conseguir abrir a empresa que o
 * convidou.
 *
 * A escolha precisa virar cookie, e cookie só pode ser gravado em Server
 * Action ou Route Handler, daí esta função existir em vez de a página
 * resolver sozinha.
 */
export async function trocarEmpresa(workspaceId: unknown) {
  const parsed = uuidSchema.safeParse(workspaceId)
  if (!parsed.success) {
    return { error: 'Empresa inválida.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Sessão expirada. Entre novamente.' }
  }

  // Confere a participação AQUI, e não só na leitura. A RLS já impediria a
  // pessoa de ver dados de uma empresa alheia, o efeito seria tela vazia, não
  // vazamento,, mas gravar um cookie apontando para onde ela não pertence
  // deixaria o app num estado sem saída até o cookie expirar.
  const { data: vinculo } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('workspace_id', parsed.data)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!vinculo) {
    return { error: 'Você não participa desta empresa.' }
  }

  await definirWorkspaceAtivo(parsed.data)

  // Revalida tudo: cada tela do painel é montada a partir da empresa ativa, e
  // deixar qualquer uma em cache mostraria dados da empresa anterior.
  revalidatePath('/', 'layout')

  return { success: true }
}
