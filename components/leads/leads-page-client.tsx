'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
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
import { createLead, deleteLead, updateLead } from '@/lib/leads/actions'
import type { LeadRow, WorkspaceMember } from '@/lib/leads/queries'
import { leadStatusLabels, type LeadStatus } from '@/lib/leads/types'
import type { LeadFormValues } from '@/lib/validations/lead'

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' })

export function LeadsPageClient({
  leads,
  members,
  nextCursor,
  search: initialSearch,
  status: initialStatus,
}: {
  leads: LeadRow[]
  members: WorkspaceMember[]
  nextCursor: string | null
  search: string
  status: LeadStatus | 'todos'
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [search, setSearch] = React.useState(initialSearch)
  const [formOpen, setFormOpen] = React.useState(false)
  const [editingLead, setEditingLead] = React.useState<LeadRow | undefined>()
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deletingLead, setDeletingLead] = React.useState<LeadRow | undefined>()

  function updateFilters(next: { search?: string; status?: string | null; cursor?: string | null }) {
    const params = new URLSearchParams(searchParams)
    if (next.search !== undefined) {
      if (next.search) params.set('search', next.search)
      else params.delete('search')
    }
    if (next.status !== undefined) {
      if (next.status && next.status !== 'todos') params.set('status', next.status)
      else params.delete('status')
    }
    if (next.cursor !== undefined) {
      if (next.cursor) params.set('cursor', next.cursor)
      else params.delete('cursor')
    } else {
      params.delete('cursor')
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    updateFilters({ search })
  }

  function openCreateForm() {
    setEditingLead(undefined)
    setFormOpen(true)
  }

  function openEditForm(lead: LeadRow) {
    setEditingLead(lead)
    setFormOpen(true)
  }

  async function handleSave(values: LeadFormValues, id?: string) {
    const result = id ? await updateLead(id, values) : await createLead(values)
    if (result?.error) {
      toast.error(result.error)
      return
    }
    toast.success(id ? 'Lead atualizado com sucesso.' : 'Lead criado com sucesso.')
    setFormOpen(false)
    router.refresh()
  }

  function openDeleteDialog(lead: LeadRow) {
    setDeletingLead(lead)
    setDeleteOpen(true)
  }

  async function handleDelete(id: string) {
    const result = await deleteLead(id)
    if (result?.error) {
      toast.error(result.error)
      return
    }
    toast.success('Lead excluído.')
    setDeleteOpen(false)
    router.refresh()
  }

  return (
    <div>
      <PageHeader title="Leads" description="Busque, filtre e acompanhe seus leads." />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearchSubmit} className="flex flex-1 flex-col gap-2 sm:flex-row">
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
            value={initialStatus}
            onValueChange={(value) => updateFilters({ status: value })}
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
        </form>

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
            {leads.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground py-8 text-center">
                  Nenhum lead encontrado.
                </TableCell>
              </TableRow>
            )}
            {leads.map((lead) => (
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
                <TableCell>{lead.owner_name ?? '—'}</TableCell>
                <TableCell>{currencyFormatter.format(lead.value)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {dateFormatter.format(new Date(lead.created_at))}
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

      {nextCursor && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={() => updateFilters({ cursor: nextCursor })}>
            Carregar mais
          </Button>
        </div>
      )}

      <LeadFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        lead={editingLead}
        members={members}
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
