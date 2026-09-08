'use client'

import * as React from 'react'
import Link from 'next/link'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { Loader2, User } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ActivityType } from '@/lib/leads/types'
import type { WorkspaceMember } from '@/lib/leads/queries'
import { taskTypeLabels } from '@/lib/tasks/types'
import {
  exemploDeTitulo,
  taskTypesCriaveis,
  tipoSugerido,
  type TaskTypeCriavel,
} from '@/lib/tasks/tipo-sugerido'
import type { DealStage } from '@/lib/deals/types'
import {
  atalhosDePrazo,
  paraCampoLocal,
  sugestaoDePrazo,
  type AtalhoDePrazo,
} from '@/lib/tasks/atalhos-de-prazo'
import {
  negocioSugerido,
  textoDoCampoDeNegocio,
  type NegocioParaTarefa,
} from '@/lib/tasks/negocio-sugerido'
import { taskSchema, type TaskFormInput, type TaskFormValues } from '@/lib/validations/task'

/**
 * O valor do item "nenhum" do seletor de negócio.
 *
 * `SelectItem` não aceita string vazia (o Base UI a trata como "sem seleção" e
 * o item viraria inclicável), e "nenhum" precisa ser escolhível de verdade:
 * tarefa só do contato é uso legítimo. A sentinela é convertida de volta para
 * `null` antes de chegar ao schema.
 */
const SEM_NEGOCIO = '__sem_negocio__'

export type TarefaEmEdicao = {
  id: string
  title: string
  type: ActivityType
  due_at: string
  assignee_id: string | null
  /**
   * De quem é a tarefa, quando ela pertence a um contato.
   *
   * Existe porque o Calendário era a ÚNICA tela do produto onde o nome de uma
   * pessoa aparecia e não levava a lugar nenhum. O chip mostra
   * `task.lead_name` (`task-chip.tsx:58`), mas o clique abria só o formulário
   * de edição — e o nome virava texto num campo, sem caminho até o contato.
   *
   * `/hoje` já resolvia isso desde sempre (`task-item.tsx:157`, o nome é um
   * `<Link>`), então não era recurso faltando: era a mesma informação tratada
   * de dois jeitos em duas telas. Aqui, no diálogo, o conserto vale para as
   * quatro que o usam.
   */
  lead_id?: string | null
  lead_name?: string | null
}

export function TaskFormDialog({
  open,
  onOpenChange,
  onSubmit: onSubmitProp,
  members,
  currentUserId,
  leadId,
  dealId,
  tarefa,
  stage,
  negociosDoLead,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (values: TaskFormValues) => void | Promise<void>
  members: WorkspaceMember[]
  currentUserId: string
  /** A tarefa nasce presa a um lead ou a um negócio, o banco exige um dos dois. */
  leadId?: string | null
  dealId?: string | null
  /** Presente: o diálogo edita em vez de criar. */
  tarefa?: TarefaEmEdicao | null
  /** A etapa do negócio, quando há um: decide o tipo que já vem escolhido. */
  stage?: DealStage
  /**
   * Os negócios abertos do contato, quando o diálogo é aberto pela página dele.
   *
   * Faz aparecer o campo "Negócio". Sem ele, a tarefa nascia só com `lead_id` e
   * o painel do negócio — que só enxerga `deal_id` — jamais a mostraria,
   * levando a pessoa a criar uma segunda para o mesmo compromisso.
   */
  negociosDoLead?: NegocioParaTarefa[]
}) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  /**
   * Os atalhos nascem vazios e só são calculados quando o diálogo abre.
   *
   * Eles dependem do relógio, e o servidor da Vercel roda em UTC: calcular na
   * renderização daria um conjunto no servidor e outro no cliente, que é
   * descasamento de hidratação. É a mesma razão de o relógio das telas de
   * tarefa nascer num `useEffect`.
   */
  const [atalhos, setAtalhos] = React.useState<AtalhoDePrazo[]>([])

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TaskFormInput, unknown, TaskFormValues>({
    resolver: zodResolver(taskSchema),
  })

  // `watch` e não `getValues`: o exemplo precisa mudar no MESMO instante em que
  // a pessoa troca o Tipo, e `getValues` não re-renderiza.
  const tipoEscolhido = watch('type') ?? 'ligacao'

  React.useEffect(() => {
    if (!open) return

    // Um relógio só para os dois: os atalhos e o prazo inicial não podem
    // divergir por causa de duas leituras em instantes diferentes.
    const agora = new Date()
    setAtalhos(atalhosDePrazo(agora))

    reset({
      title: tarefa?.title ?? '',
      // Editar uma tarefa antiga preserva o tipo dela, inclusive `nota`, que
      // não se cria mais mas existe em produção. Só a criação usa a sugestão.
      type: tarefa?.type ?? tipoSugerido(stage),
      dueAt: tarefa ? paraCampoLocal(new Date(tarefa.due_at)) : sugestaoDePrazo(agora),
      assigneeId: tarefa?.assignee_id ?? currentUserId,
      leadId: leadId ?? null,
      // `dealId` explícito vence a sugestão: quem abriu pelo painel do negócio
      // já disse de qual negócio se trata.
      dealId: dealId ?? negocioSugerido(negociosDoLead ?? []),
    })
  }, [open, reset, tarefa, currentUserId, leadId, dealId, stage, negociosDoLead])

  async function submeter(values: TaskFormValues) {
    setIsSubmitting(true)
    try {
      await onSubmitProp(values)
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tarefa ? 'Editar tarefa' : 'Nova tarefa'}</DialogTitle>
          <DialogDescription>
            O que precisa ser feito, e quando. Ela aparece na tela Hoje e no card do
            negócio.
          </DialogDescription>
        </DialogHeader>

        {/* De quem é esta tarefa, e como chegar até a pessoa.

            Fica ACIMA do formulário de propósito: a primeira pergunta de quem
            abre uma tarefa que não criou é "quem é essa pessoa", e a resposta
            estava a uma navegação que a tela não oferecia. */}
        {tarefa?.lead_id && tarefa.lead_name ? (
          <Link
            href={`/leads/${tarefa.lead_id}`}
            className="border-border/60 hover:bg-muted flex min-h-11 items-center justify-between gap-2 rounded-lg border px-3 text-sm transition-colors sm:min-h-10"
          >
            <span className="flex min-w-0 items-center gap-2">
              <User className="text-muted-foreground size-4 shrink-0" aria-hidden />
              <span className="truncate font-medium">{tarefa.lead_name}</span>
            </span>
            <span className="text-muted-foreground shrink-0 text-xs">Ver contato</span>
          </Link>
        ) : null}

        <form onSubmit={handleSubmit(submeter)} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-title">O que fazer</Label>
            <Input
              id="task-title"
              // O exemplo acompanha o Tipo: fixo em "Ligar para confirmar a
              // proposta", ele ficava sugerindo ligar com o Tipo já em E-mail.
              placeholder={exemploDeTitulo(tipoEscolhido)}
              aria-invalid={!!errors.title}
              // `role="alert"` anuncia o erro UMA vez, quando ele aparece.
              // Quem volta ao campo depois, com Tab, não ouve mais nada — o
              // campo não sabe que tem erro. `aria-describedby` é o que liga os
              // dois, e o formulário inteiro não tinha nenhum.
              aria-describedby={errors.title ? 'task-title-erro' : undefined}
              disabled={isSubmitting}
              {...register('title')}
            />
            {errors.title && (
              <p id="task-title-erro" role="alert" className="text-destructive text-xs">
                {errors.title.message}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-type">Tipo</Label>
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="task-type" className="w-full">
                      <SelectValue placeholder="Selecione">
                        {(value) => taskTypeLabels[value as ActivityType]}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {/* `nota` não entra na lista, mas se a tarefa em edição
                          for uma das antigas com esse tipo, ele precisa
                          aparecer: sem isso o seletor abriria vazio e salvar
                          trocaria o tipo dela sem ninguém pedir. */}
                      {(tarefa && !taskTypesCriaveis.includes(tarefa.type as TaskTypeCriavel)
                        ? [tarefa.type, ...taskTypesCriaveis]
                        : [...taskTypesCriaveis]
                      ).map((tipo) => (
                        <SelectItem key={tipo} value={tipo}>
                          {taskTypeLabels[tipo as ActivityType]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-due">Quando</Label>
              <Input
                id="task-due"
                type="datetime-local"
                aria-invalid={!!errors.dueAt}
                aria-describedby={errors.dueAt ? 'task-due-erro' : undefined}
                disabled={isSubmitting}
                {...register('dueAt')}
              />
              {errors.dueAt && (
                <p id="task-due-erro" role="alert" className="text-destructive text-xs">
                  {errors.dueAt.message}
                </p>
              )}
            </div>
          </div>

          {/* Os atalhos ficam FORA da grade de duas colunas e abaixo dela: em
              390px eles seriam espremidos ao lado do Tipo, e alvo de toque
              apertado é pior que atalho nenhum.

              Existem porque `<input type="datetime-local">` é o controle mais
              difícil da tela — campo segmentado, que exige navegar dia, mês,
              ano, hora e minuto um a um, com teclado ou com leitor de tela. O
              caso comum de um CRM de venda é sempre "amanhã de manhã", e isso
              cabe num toque. O campo continua ali, intacto, para data qualquer.

              `type="button"` explícito: dentro de um `<form>`, botão sem tipo
              é `submit` e enviaria a tarefa em vez de preencher o prazo. */}
          {atalhos.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span id="task-atalhos" className="text-muted-foreground text-xs">
                Ou escolha um horário comum
              </span>
              <div className="flex flex-wrap gap-2" role="group" aria-labelledby="task-atalhos">
                {atalhos.map((atalho) => (
                  <Button
                    key={atalho.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    // 44px de alvo no telefone, a regra de toque já aplicada em
                    // 27 lugares do projeto; no desktop volta ao compacto.
                    className="min-h-11 md:min-h-9"
                    disabled={isSubmitting}
                    onClick={() =>
                      setValue('dueAt', atalho.valor, {
                        shouldValidate: true,
                        shouldDirty: true,
                      })
                    }
                  >
                    {atalho.rotulo}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-assignee">Responsável</Label>
            <Controller
              name="assigneeId"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value ?? ''}
                  onValueChange={field.onChange}
                  disabled={isSubmitting}
                >
                  <SelectTrigger
                    id="task-assignee"
                    className="w-full"
                    aria-invalid={!!errors.assigneeId}
                    aria-describedby={errors.assigneeId ? 'task-assignee-erro' : undefined}
                  >
                    <SelectValue placeholder="Selecione">
                      {(value) =>
                        members.find((m) => m.id === value)?.name ?? 'Selecione'
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((membro) => (
                      <SelectItem key={membro.id} value={membro.id}>
                        {membro.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.assigneeId && (
              <p id="task-assignee-erro" role="alert" className="text-destructive text-xs">
                {errors.assigneeId.message}
              </p>
            )}
          </div>

          {/* O campo que fecha a causa raiz.

              A página do Contato criava tarefa passando só `leadId`, e o painel
              do negócio só enxerga `deal_id` — a tarefa nascia invisível para
              ele, que então oferecia criar outra. Duas tarefas para o mesmo
              compromisso, e a pessoa descobre quando as duas cobram.

              Só aparece quando há negócio aberto: um seletor vazio num contato
              sem negócio é campo que só serve para confundir. */}
          {negociosDoLead && negociosDoLead.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-deal">Negócio</Label>
              <Controller
                name="dealId"
                control={control}
                render={({ field }) => (
                  <Select
                    // `SEM_NEGOCIO` porque `SelectItem` não aceita valor vazio,
                    // e "nenhum" precisa ser escolhível: tarefa só do contato é
                    // uso legítimo (`tasks_alvo_minimo`, 0029, exige lead OU
                    // negócio, não os dois).
                    value={field.value ?? SEM_NEGOCIO}
                    onValueChange={(v) => field.onChange(v === SEM_NEGOCIO ? null : v)}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="task-deal" className="w-full">
                      <SelectValue placeholder="Nenhum">
                        {(value) =>
                          negociosDoLead.find((n) => n.id === value)?.title ??
                          'Nenhum, só para o contato'
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SEM_NEGOCIO}>Nenhum, só para o contato</SelectItem>
                      {negociosDoLead.map((negocio) => (
                        <SelectItem key={negocio.id} value={negocio.id}>
                          {negocio.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-muted-foreground text-xs">
                {textoDoCampoDeNegocio(negociosDoLead)}
              </p>
            </div>
          )}

          {/* O erro do refine `tasks_alvo_minimo` pousa em `leadId`. Ele só
              aparece se a tarefa chegar sem lead e sem negócio, o que a tela
              não deixa acontecer, mas se acontecer, a pessoa precisa ler o
              motivo em vez de ver o botão não fazer nada. */}
          {errors.leadId && (
            <p role="alert" className="text-destructive text-xs">
              {errors.leadId.message}
            </p>
          )}

          {/* Este era o ÚNICO diálogo committal do produto sem saída visível:
              só dava para sair por `Esc` ou pelo X, e nenhum dos dois é
              descobrível. Outros treze componentes já ofereciam "Cancelar". */}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {tarefa ? 'Salvar' : 'Criar tarefa'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
