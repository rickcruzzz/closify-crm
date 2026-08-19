'use client'

import { Loader2 } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

/**
 * A confirmação de uma ação que apaga algo, num lugar só.
 *
 * ## Por que existe
 *
 * O produto tinha duas classes de exclusão convivendo. Umas confirmavam
 * (lead, negócio, atividade, logo, conta); outras apagavam com **um clique**
 * no menu — excluir tarefa, remover colaborador e cancelar convite. Não era
 * uma escolha de design: as três primeiras nasceram com diálogo e as outras
 * três nasceram sem, e ninguém reconciliou.
 *
 * O caso mais desconfortável era o de tarefa: **concluir** oferecia "Desfazer"
 * no toast, e **excluir**, que é mais destrutivo, não oferecia nada. A ação
 * mais grave tinha a proteção mais fraca.
 *
 * `AlertDialog`, e não `Dialog`: o primeiro é o primitivo desenhado para
 * interromper — prende o foco, não fecha ao clicar fora e é anunciado como
 * `alertdialog`. Metade das confirmações do projeto usava `Dialog` genérico,
 * que fecha se a pessoa clicar fora sem querer. As novas usam o certo.
 *
 * `descricao` é `ReactNode` de propósito: alguns casos precisam do nome do
 * item em negrito no meio da frase, e passar string obrigaria o chamador a
 * escolher entre perder o destaque ou montar o próprio diálogo — que é
 * exatamente como as cópias nasceram.
 */
export function ConfirmarExclusao({
  open,
  onOpenChange,
  titulo,
  descricao,
  rotuloDaAcao = 'Excluir',
  pendente = false,
  onConfirmar,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  titulo: string
  descricao: React.ReactNode
  /** "Excluir" na maioria; "Remover"/"Cancelar convite" onde couber melhor. */
  rotuloDaAcao?: string
  /** true enquanto a Server Action está em voo: trava os dois botões para o
   * clique duplo não disparar a exclusão duas vezes. */
  pendente?: boolean
  onConfirmar: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription>{descricao}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pendente}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pendente}
            onClick={() => !pendente && onConfirmar()}
          >
            {pendente && <Loader2 aria-hidden className="size-4 animate-spin" />}
            {rotuloDaAcao}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
