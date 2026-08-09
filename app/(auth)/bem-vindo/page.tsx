import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { BemVindoClient } from '@/components/auth/bem-vindo-client'

export const metadata: Metadata = {
  title: 'Bem-vindo',
  robots: { index: false, follow: false },
}

/**
 * Primeira tela de quem acabou de entrar pelo Google.
 *
 * Antes o `/auth/callback` mandava todo mundo para `/dashboard`, que por sua
 * vez redirecionava para `/onboarding` quando não havia workspace — um salto
 * seco, sem nenhuma confirmação de que a conta foi criada. Aqui a pessoa é
 * recebida pelo nome e escolhe se quer uma senha reserva antes de seguir.
 */
export default async function BemVindoPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Quem já tem workspace não deveria ver as boas-vindas de novo — cairia aqui
  // ao reentrar pelo Google.
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (membership) {
    redirect('/dashboard')
  }

  // `identities` diz por onde a pessoa entrou. Só oferecemos senha a quem
  // entrou por provedor externo: para quem se cadastrou com e-mail a senha já
  // existe, e a tela viraria um passo repetido.
  const entrouPorProvedorExterno = (user.identities ?? []).some(
    (identidade) => identidade.provider !== 'email',
  )
  const temSenhaPropria = (user.identities ?? []).some(
    (identidade) => identidade.provider === 'email',
  )

  const primeiroNome =
    (user.user_metadata?.name as string | undefined)?.trim().split(' ')[0] ??
    user.email?.split('@')[0] ??
    null

  return (
    <BemVindoClient
      primeiroNome={primeiroNome}
      email={user.email ?? ''}
      podeDefinirSenha={entrouPorProvedorExterno && !temSenhaPropria}
    />
  )
}
