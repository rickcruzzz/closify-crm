'use client'

import * as React from 'react'
import Link from 'next/link'
import { notFound, useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Building2, Calendar, Mail, Phone, User } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/layout/page-header'
import { LeadStatusBadge } from '@/components/leads/lead-status-badge'
import { LeadFormDialog } from '@/components/leads/lead-form-dialog'
import { DeleteLeadDialog } from '@/components/leads/delete-lead-dialog'
import { ActivityTimeline } from '@/components/leads/activity-timeline'
import { mockActivities, mockLeads } from '@/lib/leads/mock-data'
import type { Lead } from '@/lib/leads/types'
import type { LeadFormValues } from '@/lib/validations/lead'

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' })

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()

  const initialLead = mockLeads.find((l) => l.id === params.id)
  const [lead, setLead] = React.useState<Lead | undefined>(initialLead)
  const [formOpen, setFormOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)

  if (!initialLead) {
    notFound()
  }

  if (!lead) return null

  const activities = mockActivities
    .filter((a) => a.leadId === lead.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  function handleSave(values: LeadFormValues) {
    setLead((prev) => (prev ? { ...prev, ...values } : prev))
    toast.success('Lead atualizado com sucesso.')
  }

  function handleDelete() {
    toast.success('Lead excluído.')
    router.push('/leads')
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

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader title={lead.name} description={lead.company} />
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setFormOpen(true)}>
            Editar
          </Button>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            Excluir
          </Button>
        </div>
      </div>

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
              <span>{lead.owner}</span>
            </div>

            <div className="flex items-start gap-2 text-sm">
              <Calendar className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              <span>Criado em {dateFormatter.format(new Date(lead.createdAt))}</span>
            </div>

            <div className="border-t pt-4">
              <span className="text-muted-foreground mb-1 block text-xs">Valor estimado</span>
              <span className="text-lg font-semibold">{currencyFormatter.format(lead.value)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Timeline de atividades</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityTimeline activities={activities} />
          </CardContent>
        </Card>
      </div>

      <LeadFormDialog open={formOpen} onOpenChange={setFormOpen} lead={lead} onSave={handleSave} />

      <DeleteLeadDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        lead={lead}
        onConfirm={handleDelete}
      />
    </div>
  )
}
