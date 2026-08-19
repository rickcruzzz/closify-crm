'use client'

import * as React from 'react'
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
import { signOut } from '@/lib/supabase/actions'

/**
 * Confirmação de saída da conta.
 *
 * ## Por que confirmar, se Gmail e Notion não confirmam
 *
 * Decisão do dono, com um caso concreto: o produto é usado em computador de
 * escritório, muitas vezes compartilhado, e "Sair" fica a um clique dentro de
 * um menu que também tem Perfil e Configurações — vizinhança em que o dedo
 * erra. Errar aqui não perde dado, mas tranca a pessoa para fora até ela
 * lembrar a senha, no meio do trabalho.
 *
 * A descrição diz o que acontece em vez de perguntar "tem certeza?": quem
 * clicou por engano precisa de informação para reconsiderar, e "tem certeza"
 * não é informação.
 *
 * ## O defeito que isto também conserta
 *
 * O clique em "Sair" não mostrava **nada** entre a ação e o redirect. Duas
 * causas somadas: `user-menu.tsx` descartava o pending do `useTransition`
 * (`const [, startTransition]`), e a barra de progresso global
 * (`navigation-progress.tsx`) só liga em clique de `<a>` — um item de menu é
 * um `<div>` com papel de `menuitem`, então ela nunca disparava. Resultado:
 * a tela ficava parada e parecia travada. Aqui o pending é usado de verdade.
 *
 * `signOut` termina em `redirect('/login')`, que no React 19 propaga como
 * exceção de controle de fluxo — por isso não há `finally` limpando o
 * pending: o componente é desmontado pela navegação, e voltar o botão ao
 * normal antes disso só faria piscar.
 */
export function LogoutDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [saindo, setSaindo] = React.useState(false)

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sair da sua conta?</AlertDialogTitle>
          <AlertDialogDescription>
            Você vai precisar entrar de novo com e-mail e senha. Nada do seu trabalho é
            perdido.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saindo}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={saindo}
            onClick={() => {
              setSaindo(true)
              void signOut()
            }}
          >
            {saindo && <Loader2 aria-hidden className="size-4 animate-spin" />}
            Sair
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
