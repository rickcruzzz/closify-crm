'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Building2, Calendar, Mail, Phone, User } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/layout/page-header'
import { LeadStatusBadge } from '@/components/leads/lead-status-badge'
import { LeadFormDialog } from '@/components/leads/lead-form-dialog'
import { DeleteLeadDialog } from '@/components/leads/delete-lead-dialog'
import { ActivityTimeline } from '@/components/leads/activity-timeline'
import { ActivityFormDialog } from '@/components/leads/activity-form-dialog'
import { createActivity, deleteLead, updateLead } from '@/lib/leads/actions'
import type { LeadRow, WorkspaceMember } from '@/lib/leads/queries'
import type { ActivityType } from '@/lib/leads/types'
import type { LeadFormValues } from '@/lib/validations/lead'
import type { ActivityFormValues } from '@/lib/validations/activity'

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' })

type ActivityRow = {
  id: string
  type: ActivityType
  description: string
  created_at: string
  // `author_id` decide quem pode editar o registro; a timeline compara com o
  // usuário da sessão.
  author_id: string | null
  author_name: string | null
}

export function LeadDetailClient({
  lead,
  activities,
  members,
  currentUserId,
  isAdmin,
}: {
  lead: LeadRow
  activities: ActivityRow[]
  members: WorkspaceMember[]
  currentUserId: string
  isAdmin: boolean
}) {
  const router = useRouter()
  const [formOpen, setFormOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [activityFormOpen, setActivityFormOpen] = React.useState(false)

  async function handleSave(values: LeadFormValues) {
    const result = await updateLead(lead.id, values)
    if (result?.error) {
      toast.error(result.error)
      return
    }
    toast.success('Lead atualizado com sucesso.')
    setFormOpen(false)
    router.refresh()
  }

  async function handleDelete() {
    const result = await deleteLead(lead.id)
    if (result?.error) {
      toast.error(result.error)
      return
    }
    toast.success('Lead excluído.')
    router.push('/leads')
  }

  async function handleCreateActivity(values: ActivityFormValues) {
    const result = await createActivity(lead.id, values)
    if (result?.error) {
      toast.error(result.error)
      return
    }
    toast.success('Atividade registrada.')
    router.refresh()
  }

  return (
    <div>
      <Link
        href="/leads"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" />
        Voltar para leads
      </Link>

      <PageHeader
        title={lead.name}
        description={lead.company ?? ''}
        actions={
          <>
            <Button variant="outline" onClick={() => setFormOpen(true)}>
              Editar
            </Button>
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              Excluir
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Informações</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div>
              <span className="text-muted-foreground mb-1.5 block text-xs">Status</span>
              <LeadStatusBadge status={lead.status} />
            </div>

            <div className="flex items-start gap-2 text-sm">
              <Mail className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              <span className="break-all">{lead.email}</span>
            </div>

            <div className="flex items-start gap-2 text-sm">
              <Phone className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              <span>{lead.phone}</span>
            </div>

            <div className="flex items-start gap-2 text-sm">
              <Building2 className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              <span>{lead.company}</span>
            </div>

            <div className="flex items-start gap-2 text-sm">
              <User className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              <span>{lead.owner_name ?? 'Sem responsável'}</span>
            </div>

            <div className="flex items-start gap-2 text-sm">
              <Calendar className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              <span>Criado em {dateFormatter.format(new Date(lead.created_at))}</span>
            </div>

            <div className="border-t pt-4">
              <span className="text-muted-foreground mb-1 block text-xs">
                Valor estimado
              </span>
              <span className="text-lg font-semibold">
                {currencyFormatter.format(lead.value)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Timeline de atividades</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setActivityFormOpen(true)}>
              Registrar atividade
            </Button>
          </CardHeader>
          <CardContent>
            <ActivityTimeline
              activities={activities}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
            />
          </CardContent>
        </Card>
      </div>

      <LeadFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        lead={lead}
        members={members}
        onSave={handleSave}
      />

      <DeleteLeadDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        lead={lead}
        onConfirm={handleDelete}
      />

      <ActivityFormDialog
        open={activityFormOpen}
        onOpenChange={setActivityFormOpen}
        onCreate={handleCreateActivity}
      />
    </div>
  )
}
