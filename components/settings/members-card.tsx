'use client'

import * as React from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Loader2, MoreHorizontal, Plus, UserPlus } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import {
  inviteMember,
  removeMember,
  revokeInvite,
  updateMemberRole,
} from '@/lib/workspace/actions'
import { inviteMemberSchema, type InviteMemberValues } from '@/lib/validations/workspace'
import { FREE_MEMBER_LIMIT } from '@/lib/plans'

type Member = { user_id: string; role: 'admin' | 'membro'; name: string }
type Invite = { id: string; email: string; role: 'admin' | 'membro'; expires_at: string }

export function MembersCard({
  currentUserId,
  isAdmin,
  members,
  invites,
  plan,
}: {
  currentUserId: string
  isAdmin: boolean
  members: Member[]
  invites: Invite[]
  plan: 'free' | 'pro'
}) {
  const [inviteOpen, setInviteOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<InviteMemberValues>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { email: '', role: 'membro' },
  })

  // Usa a constante compartilhada em vez de repetir o número: com o `2`
  // escrito à mão aqui, mudar o limite do plano faria a tela dizer uma coisa e
  // o servidor aplicar outra — o tipo de divergência que faz o usuário achar
  // que o limite "não funciona".
  const totalOccupied = members.length + invites.length
  const atLimit = plan === 'free' && totalOccupied >= FREE_MEMBER_LIMIT

  // Workspace nunca fica com zero membros (quem cria já entra como admin), então
  // o estado vazio real é "só eu, sem convite pendente" — comum em conta nova.
  const isAlone = members.length <= 1 && invites.length === 0

  async function onInvite(values: InviteMemberValues) {
    setIsSubmitting(true)
    try {
      const result = await inviteMember(values)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success('Convite enviado.')
      reset({ email: '', role: 'membro' })
      setInviteOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleRoleChange(userId: string, role: 'admin' | 'membro') {
    const result = await updateMemberRole(userId, role)
    if (result?.error) toast.error(result.error)
    else toast.success('Papel atualizado.')
  }

  async function handleRemove(userId: string) {
    const result = await removeMember(userId)
    if (result?.error) toast.error(result.error)
    else toast.success('Membro removido.')
  }

  async function handleRevoke(inviteId: string) {
    const result = await revokeInvite(inviteId)
    if (result?.error) toast.error(result.error)
    else toast.success('Convite cancelado.')
  }

  return (
    <Card>
      <CardHeader className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between sm:gap-4">
        <div>
          <CardTitle>Colaboradores</CardTitle>
          <CardDescription>
            {plan === 'free'
              ? `Plano Free: ${totalOccupied}/${FREE_MEMBER_LIMIT} vagas usadas${
                  invites.length > 0 ? ` (${invites.length} convite pendente)` : ''
                }.`
              : `${members.length} membro(s).`}
          </CardDescription>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setInviteOpen(true)} disabled={atLimit}>
            <Plus className="size-4" />
            Convidar
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isAlone ? (
          <EmptyState
            icon={UserPlus}
            title="Você está sozinho neste workspace"
            description={
              isAdmin
                ? 'Convide seu time para dividir o pipeline e acompanhar os leads em conjunto.'
                : 'Um admin pode convidar mais pessoas para este workspace.'
            }
          >
            {isAdmin && (
              <Button onClick={() => setInviteOpen(true)} disabled={atLimit}>
                <Plus className="size-4" />
                Convidar colaborador
              </Button>
            )}
          </EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Papel</TableHead>
                {isAdmin && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.user_id}>
                  <TableCell>{member.name}</TableCell>
                  <TableCell>
                    <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>
                      {member.role === 'admin' ? 'Admin' : 'Membro'}
                    </Badge>
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      {member.user_id !== currentUserId && (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Ações de ${member.name}`}
                              >
                                <MoreHorizontal className="size-4" />
                              </Button>
                            }
                          />
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                handleRoleChange(
                                  member.user_id,
                                  member.role === 'admin' ? 'membro' : 'admin',
                                )
                              }
                            >
                              {member.role === 'admin' ? 'Tornar membro' : 'Tornar admin'}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => handleRemove(member.user_id)}
                            >
                              Remover
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {invites.map((invite) => (
                <TableRow key={invite.id} className="text-muted-foreground">
                  <TableCell>{invite.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      Convite pendente · {invite.role === 'admin' ? 'Admin' : 'Membro'}
                    </Badge>
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevoke(invite.id)}
                      >
                        Cancelar
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Convidar colaborador</DialogTitle>
            <DialogDescription>Enviamos um link de convite por e-mail.</DialogDescription>
          </DialogHeader>

          <form
            onSubmit={handleSubmit(onInvite)}
            noValidate
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="colaborador@empresa.com"
                aria-invalid={!!errors.email}
                disabled={isSubmitting}
                {...register('email')}
              />
              {errors.email && (
                <p role="alert" className="text-destructive text-xs">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role">Papel</Label>
              <Select
                value={watch('role')}
                onValueChange={(value) => setValue('role', value as 'admin' | 'membro')}
                disabled={isSubmitting}
              >
                <SelectTrigger id="role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="membro">Membro</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                Enviar convite
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
