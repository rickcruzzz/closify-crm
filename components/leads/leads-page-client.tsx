'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, MoreHorizontal, Plus, Search, SearchX, Upload, Users } from 'lucide-react'

import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
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
import { ImportLeadsDialog } from '@/components/leads/import-leads-dialog'
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
  const [trocandoFiltro, startTransition] = React.useTransition()

  const [search, setSearch] = React.useState(initialSearch)
  const [formOpen, setFormOpen] = React.useState(false)
  const [editingLead, setEditingLead] = React.useState<LeadRow | undefined>()
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deletingLead, setDeletingLead] = React.useState<LeadRow | undefined>()
  const [excluindoLeadId, setExcluindoLeadId] = React.useState<string | null>(null)
  const [importOpen, setImportOpen] = React.useState(false)

  function updateFilters(next: {
    search?: string
    status?: string | null
    cursor?: string | null
  }) {
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
    // `useTransition` em vez de `router.push` cru: sem isso, trocar o filtro
    // de status não dava sinal nenhum até a lista nova chegar — nem a barra
    // de progresso global cobre isso, porque ela só liga em clique de link
    // (`<a>`), e o Select não é um. `trocandoFiltro` desabilita o Select e
    // mostra um spinner visível no mesmo instante do clique.
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    updateFilters({ search })
  }

  // Usa os valores vindos do servidor, não o state local da busca: o input
  // muda a cada tecla, mas a tabela só reflete o que já foi submetido.
  const hasActiveFilters = !!initialSearch || initialStatus !== 'todos'

  function clearFilters() {
    setSearch('')
    updateFilters({ search: '', status: 'todos' })
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
    // Sem router.refresh(): create/updateLead já revalidam '/leads' — a
    // rota atual.
  }

  function openDeleteDialog(lead: LeadRow) {
    setDeletingLead(lead)
    setDeleteOpen(true)
  }

  async function handleDelete(id: string) {
    if (excluindoLeadId) return
    setExcluindoLeadId(id)
    const result = await deleteLead(id)
    setExcluindoLeadId(null)

    if (result?.error) {
      toast.error(result.error)
      return
    }
    toast.success('Lead excluído.')
    setDeleteOpen(false)
    // Sem router.refresh(): deleteLead já revalida '/leads'.
  }

  // Extraído para ser reaproveitado pela tabela (desktop) e pela lista de
  // cards (mobile), que renderizam os mesmos dados em layouts diferentes.
  const emptyState = hasActiveFilters ? (
    <EmptyState
      icon={SearchX}
      title="Nenhum lead corresponde aos filtros"
      description="Tente outro termo de busca ou volte a ver todos os leads."
    >
      <Button variant="outline" onClick={clearFilters}>
        Limpar filtros
      </Button>
    </EmptyState>
  ) : (
    <EmptyState
      icon={Users}
      title="Nenhum lead ainda"
      description="Cadastre seu primeiro lead ou traga sua planilha atual para começar a acompanhar oportunidades no funil."
    >
      <Button onClick={openCreateForm}>
        <Plus className="size-4" />
        Novo lead
      </Button>
      <Button variant="outline" onClick={() => setImportOpen(true)}>
        <Upload className="size-4" />
        Importar CSV
      </Button>
    </EmptyState>
  )

  function leadActions(lead: LeadRow) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label={`Ações de ${lead.name}`}>
              <MoreHorizontal className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem render={<Link href={`/leads/${lead.id}`} />}>
            Ver detalhes
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openEditForm(lead)}>Editar</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => openDeleteDialog(lead)}>
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <div>
      <PageHeader title="Leads" description="Busque, filtre e acompanhe seus leads." />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <form
          onSubmit={handleSearchSubmit}
          className="flex flex-1 flex-col gap-2 lg:flex-row"
        >
          <div className="relative max-w-sm flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input
              placeholder="Buscar por nome ou empresa..."
              aria-label="Buscar leads por nome ou empresa"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          <Select
            value={initialStatus}
            onValueChange={(value) => updateFilters({ status: value })}
            disabled={trocandoFiltro}
          >
            <SelectTrigger className="relative w-full lg:w-56">
              <SelectValue placeholder="Filtrar por status">
                {(value) =>
                  value === 'todos'
                    ? 'Todos os status'
                    : leadStatusLabels[value as LeadStatus]
                }
              </SelectValue>
              {trocandoFiltro && (
                <Loader2
                  aria-hidden
                  className="text-muted-foreground pointer-events-none absolute top-1/2 right-8 size-3.5 -translate-y-1/2 animate-spin"
                />
              )}
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

        <div className="flex shrink-0 gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="size-4" />
            Importar CSV
          </Button>
          <Button onClick={openCreateForm}>
            <Plus className="size-4" />
            Novo lead
          </Button>
        </div>
      </div>

      {/* Abaixo de `lg` a tabela de 7 colunas viraria um scroll horizontal
          longo e sem pista visual (em 768px o sidebar já ocupa 256px), então os
          mesmos dados viram cards. */}
      <div className="ring-foreground/10 overflow-hidden rounded-xl ring-1 lg:hidden">
        {leads.length === 0 ? (
          <div className="p-4">{emptyState}</div>
        ) : (
          <ul className="divide-y">
            {leads.map((lead) => (
              <li key={lead.id} className="flex items-start gap-3 p-4">
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex min-w-0 flex-col">
                    <Link
                      href={`/leads/${lead.id}`}
                      className="-my-1 truncate py-1 font-medium hover:underline"
                    >
                      {lead.name}
                    </Link>
                    <span className="text-muted-foreground truncate text-xs">
                      {lead.email ?? 'Sem e-mail'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <LeadStatusBadge status={lead.status} />
                    <span className="font-medium">
                      {currencyFormatter.format(lead.value)}
                    </span>
                  </div>

                  <dl className="text-muted-foreground grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs">
                    <dt>Empresa</dt>
                    <dd className="text-foreground truncate">{lead.company}</dd>
                    <dt>Responsável</dt>
                    <dd className="text-foreground truncate">
                      {lead.owner_name ?? 'Sem responsável'}
                    </dd>
                    <dt>Criado em</dt>
                    <dd className="text-foreground">
                      {dateFormatter.format(new Date(lead.created_at))}
                    </dd>
                  </dl>
                </div>

                {leadActions(lead)}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="ring-foreground/10 hidden overflow-hidden rounded-xl ring-1 lg:block">
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
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7}>{emptyState}</TableCell>
              </TableRow>
            )}
            {leads.map((lead) => (
              <TableRow key={lead.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/leads/${lead.id}`}
                    className="-my-1 inline-block py-1 hover:underline"
                  >
                    {lead.name}
                  </Link>
                  <div className="text-muted-foreground text-xs">{lead.email ?? 'Sem e-mail'}</div>
                </TableCell>
                <TableCell>{lead.company}</TableCell>
                <TableCell>
                  <LeadStatusBadge status={lead.status} />
                </TableCell>
                <TableCell>{lead.owner_name ?? 'Sem responsável'}</TableCell>
                <TableCell>{currencyFormatter.format(lead.value)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {dateFormatter.format(new Date(lead.created_at))}
                </TableCell>
                <TableCell>{leadActions(lead)}</TableCell>
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

      <ImportLeadsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => router.refresh()}
      />

      <DeleteLeadDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        lead={deletingLead}
        pending={excluindoLeadId !== null}
        onConfirm={handleDelete}
      />
    </div>
  )
}
