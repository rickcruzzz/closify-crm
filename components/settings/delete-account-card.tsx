'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { deleteAccount } from '@/lib/workspace/actions'

/**
 * Exclusão de conta, LGPD, art. 18, VI.
 *
 * A confirmação exige digitar EXCLUIR em vez de um "tem certeza?": a ação é
 * irreversível e apaga leads e negócios junto, então o custo de um clique
 * acidental é alto demais para um botão simples.
 */
export function DeleteAccountCard({
  workspacesQueSeraoApagados,
}: {
  /** Nomes dos workspaces onde a pessoa é o único membro. */
  workspacesQueSeraoApagados: string[]
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [confirmacao, setConfirmacao] = React.useState('')
  const [excluindo, setExcluindo] = React.useState(false)

  const podeExcluir = confirmacao.trim().toUpperCase() === 'EXCLUIR'

  async function handleDelete() {
    if (!podeExcluir) return

    setExcluindo(true)
    const result = await deleteAccount()

    if (result?.error) {
      toast.error(result.error)
      setExcluindo(false)
      return
    }

    // A sessão já foi encerrada no servidor; `refresh` garante que o
    // middleware veja o cookie limpo antes de renderizar a próxima rota.
    toast.success('Conta excluída.')
    router.replace('/')
    router.refresh()
  }

  return (
    <>
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2 text-base">
            <AlertTriangle aria-hidden className="size-4" />
            Excluir conta
          </CardTitle>
          <CardDescription>
            Remove sua conta e todos os dados associados, em definitivo. Esta ação não
            pode ser desfeita.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setOpen(true)}>
            Excluir minha conta
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir conta permanentemente?</DialogTitle>
            <DialogDescription>
              Não há como recuperar depois. Exporte o que precisar antes de continuar.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {/* Ser explícito sobre o que morre junto: a pessoa costuma pensar
                só na própria conta e esquecer que os dados dos clientes dela
                estão dentro do workspace. */}
            {workspacesQueSeraoApagados.length > 0 && (
              <div className="border-destructive/30 bg-destructive/5 rounded-lg border p-3">
                <p className="mb-1.5 text-sm font-medium">
                  Também serão apagados, com todos os leads e negócios:
                </p>
                <ul className="text-muted-foreground flex list-disc flex-col gap-0.5 pl-5 text-sm">
                  {workspacesQueSeraoApagados.map((nome) => (
                    <li key={nome}>{nome}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirmacao">
                Para confirmar, digite <span className="text-foreground">EXCLUIR</span>
              </Label>
              <Input
                id="confirmacao"
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
                placeholder="EXCLUIR"
                autoComplete="off"
                disabled={excluindo}
              />
            </div>
          </div>

          <DialogFooter className="sm:justify-between">
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={excluindo}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={!podeExcluir || excluindo}
            >
              {excluindo && <Loader2 className="size-4 animate-spin" />}
              Excluir conta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
