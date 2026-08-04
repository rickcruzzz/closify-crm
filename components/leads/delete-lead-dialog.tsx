'use client'

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
import type { LeadRow } from '@/lib/leads/queries'

export function DeleteLeadDialog({
  open,
  onOpenChange,
  lead,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  lead?: LeadRow
  onConfirm: (id: string) => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir lead</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir {lead?.name}? Essa ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => lead && onConfirm(lead.id)}
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
