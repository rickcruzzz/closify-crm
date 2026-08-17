import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { concluirOnboardingPorConvite } from '@/lib/onboarding/estado'
import { AcceptInviteCard } from '@/components/settings/accept-invite-card'
import { Logo } from '@/components/branding/logo'

export default async function ConvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createClient()

  const { data: inviteRows } = await supabase.rpc('get_invite_by_token', {
    invite_token: token,
  })
  const invite = inviteRows?.[0]

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Aceita sozinho quando não há mais nada a decidir: o convite está válido e
  // quem está na sessão é exatamente quem foi convidado.
  //
  // A pessoa já disse "sim" duas vezes, clicou no link do e-mail e criou a
  // conta a partir dele. Pedir um terceiro clique é onde o fluxo antigo
  // perdia gente: quem chegava aqui sem sessão era mandado ao cadastro, o
  // token se perdia, e a volta caía em `/onboarding` criando uma empresa
  // própria em vez de entrar na equipe.
  //
  // Aceitar durante um GET normalmente seria imprudente, foi assim que o
  // link de confirmação de e-mail morria antes do clique, consumido por
  // scanner de provedor. Aqui não corre esse risco: a condição exige SESSÃO
  // com o e-mail certo, e scanner não tem cookie de ninguém.
  const podeAceitarSozinho =
    invite &&
    invite.status === 'pending' &&
    new Date(invite.expires_at) >= new Date() &&
    user?.email === invite.email

  if (podeAceitarSozinho) {
    const { error } = await supabase.rpc('accept_workspace_invite', { invite_token: token })

    if (!error) {
      // A empresa já existe, montada por quem convidou, não há o que
      // configurar. Sem esta marca, o middleware mandaria a pessoa às
      // boas-vindas e ela atravessaria quatro perguntas sobre uma empresa que
      // não é dela, terminando sem alterar nada (colaborador não é admin, e a
      // RLS recusa a escrita).
      await concluirOnboardingPorConvite(supabase, user!.id)
      redirect('/dashboard')
    }

    // Falhou (limite do plano estourado, corrida com outro aceite): cai no
    // card abaixo, que mostra o motivo em vez de uma tela em branco.
    console.error('aceite automático de convite falhou', error)
  }

  return (
    <div className="bg-background flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-12">
      <Link href="/">
        <Logo />
      </Link>
      <div className="w-full max-w-sm">
        {!invite || invite.status !== 'pending' ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Convite inválido</CardTitle>
              <CardDescription>
                Este link de convite não existe, já foi usado ou expirou.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : new Date(invite.expires_at) < new Date() ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Convite expirado</CardTitle>
              <CardDescription>
                Peça para o administrador do workspace enviar um novo convite.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <AcceptInviteCard
            token={token}
            workspaceName={invite.workspace_name}
            inviteEmail={invite.email}
            isAuthenticated={!!user}
            userEmail={user?.email}
          />
        )}
      </div>
    </div>
  )
}
