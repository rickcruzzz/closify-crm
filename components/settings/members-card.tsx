'use client'

import * as React from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { avisarLimite } from '@/components/plano/avisar-limite'
import { Loader2, MoreHorizontal, Plus, UserPlus } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmarExclusao } from '@/components/comum/confirmar-exclusao'
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
import type { PlanoEfetivo } from '@/lib/plans'
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
  /**
   * O plano EFETIVO, de `planoEfetivo()`: a funcao vence a coluna.
   *
   * Era `'free' | 'pro'`, alimentado por `workspaces.plan`. A coluna nunca e
   * promovida, entao uma empresa coberta pela assinatura de outra do mesmo
   * dono (ramo 3 de `pro_vigente`) chegava aqui como `'free'` e o convite de
   * colaborador travava em dois — enquanto `validar_limite_de_membros`, que le
   * a funcao, teria aceitado. A tela prendia o que o banco libertava.
   */
  plan: PlanoEfetivo
}) {
  const [inviteOpen, setInviteOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<InviteMemberValues>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { email: '', role: 'membro' },
  })

  // Usa a constante compartilhada em vez de repetir o número: com o `2`
  // escrito à mão aqui, mudar o limite do plano faria a tela dizer uma coisa e
  // o servidor aplicar outra, o tipo de divergência que faz o usuário achar
  // que o limite "não funciona".
  const totalOccupied = members.length + invites.length
  // ## `plan` aqui e o EFETIVO, e a diferenca nao e cosmetica
  //
  // Enquanto ele vinha de `workspaces.plan`, uma empresa coberta pela
  // assinatura de outra do mesmo dono (ramo 3 de `pro_vigente`) chegava como
  // `'free'` e esta linha TRAVAVA o convite em duas pessoas — enquanto
  // `validar_limite_de_membros`, que le a funcao, teria aceitado.
  //
  // O banco libertava e a tela prendia, num recurso ja pago. Era o inverso do
  // defeito que costuma acontecer aqui, e por isso ninguem o via: ele nao gera
  // erro, gera um botao desabilitado.
  const atLimit = plan === 'free' && totalOccupied >= FREE_MEMBER_LIMIT

  // Workspace nunca fica com zero membros (quem cria já entra como admin), então
  // o estado vazio real é "só eu, sem convite pendente", comum em conta nova.
  const isAlone = members.length <= 1 && invites.length === 0

  async function onInvite(values: InviteMemberValues) {
    setIsSubmitting(true)
    try {
      const result = await inviteMember(values)
      if (result?.error) {
        // Recusa por limite de plano ganha o caminho junto, como já acontece
        // na importação de planilha e ao criar empresa: dizer "faça upgrade"
        // sem mostrar onde deixa a pessoa num beco, no exato momento em que
        // ela demonstrou intenção de pagar.
        // A regra de "isto é limite de plano?" era escrita AQUI à mão, com
        // `.includes('limite de')`, duração própria e um destino sem o
        // `?assinar=1`. Ela virou `ehLimiteDePlano`, em `lib/plans.ts`, pura e
        // testada — e agora vale para os sete lugares do produto que mandam
        // fazer upgrade, não só para este.
        avisarLimite(result.error)
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
    if (result?.error) avisarLimite(result.error)
    else toast.success('Papel atualizado.')
  }

  // Um estado só para as duas confirmações: são mutuamente exclusivas (não dá
  // para remover alguém e cancelar um convite ao mesmo tempo), e dois booleanos
  // separados permitiriam o estado impossível de ambos abertos.
  const [confirmando, setConfirmando] = React.useState<
    { tipo: 'remover'; id: string; nome: string } | { tipo: 'convite'; id: string; email: string } | null
  >(null)
  const [executando, setExecutando] = React.useState(false)

  async function handleRemove(userId: string) {
    const result = await removeMember(userId)
    if (result?.error) avisarLimite(result.error)
    else toast.success('Membro removido.')
  }

  async function handleRevoke(inviteId: string) {
    const result = await revokeInvite(inviteId)
    if (result?.error) avisarLimite(result.error)
    else toast.success('Convite cancelado.')
  }

  async function confirmar() {
    if (!confirmando) return
    setExecutando(true)
    try {
      if (confirmando.tipo === 'remover') await handleRemove(confirmando.id)
      else await handleRevoke(confirmando.id)
      setConfirmando(null)
    } finally {
      setExecutando(false)
    }
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
            title="Você está sozinho nesta empresa"
            description={
              isAdmin
                ? 'Convide seu time para dividir o funil e acompanhar os contatos em conjunto.'
                : 'Um admin pode convidar mais pessoas para esta empresa.'
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
                              onClick={() =>
                                setConfirmando({
                                  tipo: 'remover',
                                  id: member.user_id,
                                  nome: member.name,
                                })
                              }
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
                        onClick={() =>
                          setConfirmando({ tipo: 'convite', id: invite.id, email: invite.email })
                        }
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

      {/* Remover colaborador e cancelar convite apagavam com um clique no
          menu, enquanto excluir lead, negócio e atividade já confirmavam.
          Remover é o mais grave dos três: a pessoa perde o acesso na hora e,
          se o plano estiver no limite de vagas, readmiti-la pode nem ser
          possível sem upgrade. */}
      <ConfirmarExclusao
        open={confirmando !== null}
        onOpenChange={(aberto) => !aberto && setConfirmando(null)}
        titulo={
          confirmando?.tipo === 'convite' ? 'Cancelar este convite?' : 'Remover este colaborador?'
        }
        descricao={
          confirmando?.tipo === 'convite' ? (
            <>
              O link enviado para <strong>{confirmando.email}</strong> para de funcionar. Você pode
              convidar de novo depois.
            </>
          ) : (
            <>
              <strong>{confirmando?.nome}</strong> perde o acesso a esta empresa imediatamente. Os
              leads, negócios e atividades registrados por essa pessoa continuam aqui.
            </>
          )
        }
        rotuloDaAcao={confirmando?.tipo === 'convite' ? 'Cancelar convite' : 'Remover'}
        pendente={executando}
        onConfirmar={confirmar}
      />

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Convidar colaborador</DialogTitle>
            <DialogDescription>
              Quem entrar trabalha nesta mesma empresa e vê os mesmos contatos,
              funil e tarefas. Enviamos um link de convite por e-mail.
            </DialogDescription>
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
              {/* `Controller` em vez de `watch` + `setValue`: sem registrar o
                  campo, `role` podia não chegar ao resolver, e o zod reprovava
                  num campo que a tela não exibia erro nenhum, o clique em
                  "Enviar convite" não fazia nada, sem toast e sem fechar o
                  diálogo. Mesmo modo de falha do bug do reset de senha. */}
              <Controller
                name="role"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="role" className="w-full">
                      <SelectValue placeholder="Selecione">
                        {(value) => (value === 'admin' ? 'Admin' : 'Membro')}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="membro">Membro</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.role && (
                <p role="alert" className="text-destructive text-xs">
                  {errors.role.message}
                </p>
              )}
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
