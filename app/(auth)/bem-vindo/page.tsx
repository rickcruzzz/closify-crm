import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { lerConvitePendente } from '@/lib/auth/intencao'
import { lerEstadoDoOnboarding } from '@/lib/onboarding/estado'
import { BemVindoClient } from '@/components/auth/bem-vindo-client'

export const metadata: Metadata = {
  title: 'Bem-vindo',
  robots: { index: false, follow: false },
}

/**
 * A porta de entrada de quem acabou de criar conta — por e-mail ou pelo Google.
 *
 * Antes só recebia quem entrava pelo Google, e quem se cadastrava por e-mail
 * caía direto na tela de "crie sua empresa", sem nunca ler o que o produto faz.
 *
 * O que a tela mostra depende do estado do onboarding, não de quem a pessoa é:
 *
 *   not_started  → boas-vindas com "Começar configuração" e "Pular por enquanto"
 *   in_progress  → "Continuar de onde parei", direto na etapa certa
 *   skipped      → /dashboard. Pular foi decisão dela, e repetir a oferta a
 *                  cada login transformaria a escolha em insistência
 *   completed    → /dashboard
 */
export default async function BemVindoPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Convite pendente tem precedência sobre tudo: quem foi convidado não vai
  // configurar empresa nenhuma, vai entrar na de quem convidou. Sem este
  // desvio a pessoa atravessaria o assistente inteiro para terminar numa
  // empresa paralela — o defeito que o commit 3779d72 corrigiu, voltando por
  // outra porta.
  const convitePendente = await lerConvitePendente()
  if (convitePendente) {
    const { data: convite } = await supabase.rpc('get_invite_by_token', {
      invite_token: convitePendente,
    })
    if (convite?.[0]?.status === 'pending') {
      redirect(`/convite/${convitePendente}`)
    }
    // Convite já usado: o cookie fica. Apagá-lo aqui é proibido — mexer em
    // cookie durante a renderização de um Server Component foi exatamente o
    // que quebrou a tela do convite com "Algo deu errado". Quem limpa é a
    // Server Action, em `finalizarOnboarding`.
  }

  const estado = await lerEstadoDoOnboarding()

  if (estado.status === 'skipped' || estado.status === 'completed') {
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
      retomando={estado.status === 'in_progress'}
    />
  )
}
