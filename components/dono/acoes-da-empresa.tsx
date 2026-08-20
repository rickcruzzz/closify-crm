'use client'

import * as React from 'react'
import { ArrowDownCircle, Copy, Loader2, MoreHorizontal, Sparkles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apagarEmpresa, liberarProDeCortesia, voltarParaGratis } from '@/lib/dono/actions'
import type { EmpresaNaCentral } from '@/lib/dono/tipos'

/**
 * As ações que o dono pode tomar sobre uma empresa.
 *
 * ## Sobre a exclusão
 *
 * O diálogo exige digitar o nome exato da empresa, padrão do GitHub para
 * apagar repositório. A razão é específica: "tem certeza?" é respondido no
 * reflexo, digitar o nome obriga a ler o que está prestes a sumir. A mesma
 * conferência acontece no servidor (`apagarEmpresa`), porque validação que só
 * existe no cliente não é validação — doutrina que este projeto já pagou três
 * vezes em produção.
 */
export function AcoesDaEmpresa({ empresa }: { empresa: EmpresaNaCentral }) {
  const [dialogoDeExclusao, setDialogoDeExclusao] = React.useState(false)
  const [pendente, setPendente] = React.useState(false)

  async function executar(acao: () => Promise<{ ok: boolean; mensagem?: string; erro?: string }>) {
    setPendente(true)
    try {
      const resultado = await acao()
      if (resultado.ok) toast.success(resultado.mensagem ?? 'Pronto.')
      else toast.error(resultado.erro ?? 'Não deu certo.', { duration: 8000 })
    } catch {
      toast.error('A ação falhou. O erro completo está no terminal.')
    } finally {
      setPendente(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" disabled={pendente} aria-label="Ações">
              {pendente ? (
                <Loader2 aria-hidden className="size-4 animate-spin" />
              ) : (
                <MoreHorizontal aria-hidden className="size-4" />
              )}
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          {empresa.email && (
            <DropdownMenuItem
              onClick={() => {
                void navigator.clipboard.writeText(empresa.email as string)
                toast.success('E-mail copiado.')
              }}
            >
              <Copy aria-hidden className="size-4" />
              Copiar e-mail
            </DropdownMenuItem>
          )}

          {empresa.pagando ? (
            <DropdownMenuItem onClick={() => executar(() => voltarParaGratis(empresa.id))}>
              <ArrowDownCircle aria-hidden className="size-4" />
              Voltar para o Grátis
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => executar(() => liberarProDeCortesia(empresa.id))}>
              <Sparkles aria-hidden className="size-4" />
              Liberar Pro por 30 dias
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem variant="destructive" onClick={() => setDialogoDeExclusao(true)}>
            <Trash2 aria-hidden className="size-4" />
            Apagar empresa
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DialogoDeExclusao
        empresa={empresa}
        open={dialogoDeExclusao}
        onOpenChange={setDialogoDeExclusao}
      />
    </>
  )
}

function DialogoDeExclusao({
  empresa,
  open,
  onOpenChange,
}: {
  empresa: EmpresaNaCentral
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [digitado, setDigitado] = React.useState('')
  const [pendente, setPendente] = React.useState(false)

  // Zerar ao fechar: reabrir o diálogo com o nome já preenchido da tentativa
  // anterior derrotaria inteiramente o propósito da confirmação.
  React.useEffect(() => {
    if (!open) setDigitado('')
  }, [open])

  const confere = digitado.trim() === empresa.nome

  async function apagar() {
    setPendente(true)
    try {
      const resultado = await apagarEmpresa(empresa.id, digitado)
      if (resultado.ok) {
        toast.success(resultado.mensagem)
        onOpenChange(false)
      } else {
        toast.error(resultado.erro, { duration: 8000 })
      }
    } catch {
      toast.error('Não consegui apagar. O erro completo está no terminal.')
    } finally {
      setPendente(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Apagar {empresa.nome}?</AlertDialogTitle>
          <AlertDialogDescription>
            Isso apaga a empresa e tudo que está dentro dela:{' '}
            {empresa.quantidadeDeContatos} contato(s), {empresa.quantidadeDeNegocios} negócio(s),
            as tarefas, o histórico e a assinatura. Não tem como desfazer.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor="confirmar-nome">
            Para confirmar, digite <strong className="text-foreground">{empresa.nome}</strong>
          </Label>
          <Input
            id="confirmar-nome"
            value={digitado}
            onChange={(e) => setDigitado(e.target.value)}
            autoComplete="off"
            disabled={pendente}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pendente}>Cancelar</AlertDialogCancel>
          {/* Fora do `AlertDialogAction` de propósito: aquele fecha o diálogo
              ao clicar, e aqui o fechamento precisa esperar o servidor
              responder — senão um erro apareceria com o diálogo já fechado. */}
          <Button
            variant="destructive"
            disabled={!confere || pendente}
            onClick={apagar}
          >
            {pendente && <Loader2 aria-hidden className="size-4 animate-spin" />}
            Apagar para sempre
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
