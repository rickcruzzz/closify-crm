'use client'

import * as React from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { MoreHorizontal, Plus, Search } from 'lucide-react'

import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { LeadStatusBadge } from '@/components/leads/lead-status-badge'
import { LeadFormDialog } from '@/components/leads/lead-form-dialog'
import { DeleteLeadDialog } from '@/components/leads/delete-lead-dialog'
import { mockLeads } from '@/lib/leads/mock-data'
import { leadStatusLabels, type Lead, type LeadStatus } from '@/lib/leads/types'
import type { LeadFormValues } from '@/lib/validations/lead'

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' })

export default function LeadsPage() {
  const [leads, setLeads] = React.useState<Lead[]>(mockLeads)
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<LeadStatus | 'todos'>('todos')

  const [formOpen, setFormOpen] = React.useState(false)
  const [editingLead, setEditingLead] = React.useState<Lead | undefined>()

  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deletingLead, setDeletingLead] = React.useState<Lead | undefined>()

  const filteredLeads = React.useMemo(() => {
    const term = search.trim().toLowerCase()
    return leads.filter((lead) => {
      const matchesSearch =
        !term ||
        lead.name.toLowerCase().includes(term) ||
        lead.company.toLowerCase().includes(term)
      const matchesStatus = statusFilter === 'todos' || lead.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [leads, search, statusFilter])

  function openCreateForm() {
    setEditingLead(undefined)
    setFormOpen(true)
  }

  function openEditForm(lead: Lead) {
    setEditingLead(lead)
    setFormOpen(true)
  }

  function handleSave(values: LeadFormValues, id?: string) {
    if (id) {
      setLeads((prev) => prev.map((lead) => (lead.id === id ? { ...lead, ...values } : lead)))
      toast.success('Lead atualizado com sucesso.')
    } else {
      const newLead: Lead = {
        ...values,
        id: `lead-${Date.now()}`,
        createdAt: new Date().toISOString().slice(0, 10),
      }
      setLeads((prev) => [newLead, ...prev])
      toast.success('Lead criado com sucesso.')
    }
  }

  function openDeleteDialog(lead: Lead) {
    setDeletingLead(lead)
    setDeleteOpen(true)
  }

  function handleDelete(id: string) {
    setLeads((prev) => prev.filter((lead) => lead.id !== id))
    setDeleteOpen(false)
    toast.success('Lead excluído.')
  }

  return (
    <div>
      <PageHeader title="Leads" description="Busque, filtre e acompanhe seus leads." />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
          <div className="relative max-w-sm flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input
              placeholder="Buscar por nome ou empresa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as LeadStatus | 'todos')}
          >
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="Filtrar por status">
                {(value) =>
                  value === 'todos'
                    ? 'Todos os status'
                    : leadStatusLabels[value as LeadStatus]
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {(Object.keys(leadStatusLabels) as LeadStatus[]).map((status) => (
                <SelectItem key={status} value={status}>
                  {leadStatusLabels[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={openCreateForm} className="shrink-0">
          <Plus className="size-4" />
          Novo lead
        </Button>
      </div>

      <div className="ring-foreground/10 overflow-hidden rounded-xl ring-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLeads.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground py-8 text-center">
                  Nenhum lead encontrado.
                </TableCell>
              </TableRow>
            )}
            {filteredLeads.map((lead) => (
              <TableRow key={lead.id}>
                <TableCell className="font-medium">
                  <Link href={`/leads/${lead.id}`} className="hover:underline">
                    {lead.name}
                  </Link>
                  <div className="text-muted-foreground text-xs">{lead.email}</div>
                </TableCell>
                <TableCell>{lead.company}</TableCell>
                <TableCell>
                  <LeadStatusBadge status={lead.status} />
                </TableCell>
                <TableCell>{lead.owner}</TableCell>
                <TableCell>{currencyFormatter.format(lead.value)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {dateFormatter.format(new Date(lead.createdAt))}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="ghost" size="icon-sm">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem render={<Link href={`/leads/${lead.id}`} />}>
                        Ver detalhes
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openEditForm(lead)}>
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => openDeleteDialog(lead)}
                      >
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <LeadFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        lead={editingLead}
        onSave={handleSave}
      />

      <DeleteLeadDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        lead={deletingLead}
        onConfirm={handleDelete}
      />
    </div>
  )
}
