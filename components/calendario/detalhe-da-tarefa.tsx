'use client'

import * as React from 'react'
import Link from 'next/link'
import { Check, ExternalLink, Loader2, Pencil, User } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { iconePorTipo, taskTypeLabels } from '@/lib/tasks/types'
import type { TaskRow } from '@/lib/tasks/types'

/**
 * O que a tarefa é, antes de virar formulário.
 *
 * ## O defeito que isto fecha
 *
 * A mesma tarefa se comportava de dois jeitos:
 *
 *     /hoje         clicar abre MENU: Editar, Concluir, Excluir
 *     /calendario   clicar chamava `setEmEdicao()` e abria o FORMULARIO
 *
 * A grade do mês é tela de **consulta** — um clique acidental abria campos
 * editáveis sobre um compromisso que a pessoa só queria conferir, e não havia
 * nada entre o clique e o risco de sobrescrever o que estava certo.
 *
 * ## Painel, e não o menu do `/hoje`
 *
 * Em `/hoje` a linha já mostra título, prazo, tipo e contato: o menu basta,
 * porque não sobrou nada para ler. No calendário o chip mostra **hora e um
 * nome truncado** — há o que ler antes de decidir, e um menu de três itens
 * obrigaria a abrir a edição só para descobrir do que se trata.
 */
export function DetalheDaTarefaDialog({
  tarefa,
  onOpenChange,
  onEditar,
  onConcluir,
  concluindo = false,
}: {
  /** `null` fecha o painel. */
  tarefa: TaskRow | null
  onOpenChange: (aberto: boolean) => void
  onEditar: () => void
  onConcluir: () => void
  concluindo?: boolean
}) {
  if (!tarefa) return null

  const Icone = iconePorTipo[tarefa.type]
  const quando = new Date(tarefa.due_at)
  const concluida = tarefa.done_at !== null

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-start gap-2 text-left">
            <Icone aria-hidden className="text-muted-foreground mt-0.5 size-5 shrink-0" />
            <span className="min-w-0 break-words">{tarefa.title}</span>
          </DialogTitle>
          <DialogDescription>
            {taskTypeLabels[tarefa.type]} ·{' '}
            {quando.toLocaleString('pt-BR', {
              day: '2-digit',
              month: 'long',
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'America/Sao_Paulo',
            })}
            {concluida && ' · concluída'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 text-sm">
          {/* O contato com link é o motivo desta tela existir: até 08/09 o
              calendário era a ÚNICA superfície do produto onde um nome
              aparecia e não levava a lugar nenhum. */}
          {tarefa.lead_id && tarefa.lead_name && (
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs">Contato</span>
              <Link
                href={`/leads/${tarefa.lead_id}`}
                className="text-primary flex items-center gap-1.5 font-medium underline-offset-2 hover:underline"
              >
                {tarefa.lead_name}
                <ExternalLink aria-hidden className="size-3.5 shrink-0" />
              </Link>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Responsável</span>
            <span className="flex items-center gap-1.5">
              <User aria-hidden className="text-muted-foreground size-3.5 shrink-0" />
              {tarefa.assignee_name ?? 'Sem responsável'}
            </span>
          </div>
        </div>

        {/* `sm:justify-start` porque a ação principal aqui é EDITAR, e o botão
            de concluir precisa ficar ao lado dela, não empurrado para a borda
            oposta — concluir por engano não tem desfazer depois que a linha
            sai da tela. */}
        <DialogFooter className="sm:justify-start">
          <Button onClick={onEditar}>
            <Pencil className="size-4" />
            Editar
          </Button>
          {!concluida && (
            <Button variant="outline" disabled={concluindo} onClick={onConcluir}>
              {concluindo ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Concluir
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
