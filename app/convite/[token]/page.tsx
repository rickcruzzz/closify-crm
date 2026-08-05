import Link from 'next/link'
import { KanbanSquare } from 'lucide-react'

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { AcceptInviteCard } from '@/components/settings/accept-invite-card'

export default async function ConvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()

  const { data: invite } = await supabase
    .from('workspace_invites')
    .select('id, email, role, status, expires_at, workspace_id, workspaces(name)')
    .eq('token', token)
    .maybeSingle()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-4 py-12">
      <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <KanbanSquare className="size-4" />
        </div>
        Closify
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
            workspaceName={(invite.workspaces as unknown as { name: string } | null)?.name ?? ''}
            inviteEmail={invite.email}
            isAuthenticated={!!user}
            userEmail={user?.email}
          />
        )}
      </div>
    </div>
  )
}
