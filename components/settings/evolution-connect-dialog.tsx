'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  conectarWhatsapp,
  estadoDaConexao,
  renovarQrCode,
} from '@/lib/integrations/evolution/actions'

/** O QR do Evolution expira rápido — renova sozinho enquanto a tela está aberta. */
const INTERVALO_RENOVAR_QR_MS = 18_000
/** Intervalo de checagem se a leitura já aconteceu. */
const INTERVALO_CHECAR_ESTADO_MS = 3_000

/**
 * Diálogo de conexão do WhatsApp via Evolution API.
 *
 * ## Por que o aviso de risco vai aqui, não só na documentação
 *
 * O Evolution não é a API oficial da Meta — é engenharia reversa do WhatsApp
 * Web (Baileys). A Meta pode restringir o número a qualquer momento, sem aviso
 * e sem recurso. As proteções do projeto (limite de envio por idade da
 * conexão, nenhuma função que aceite lista de destinatários) reduzem o risco,
 * não zeram. Quem vai escanear o QR Code com o número comercial da empresa
 * precisa ler isso ANTES de escanear, não depois que já tomou o bloqueio —
 * por isso o aviso é a primeira coisa que aparece no diálogo, não um rodapé.
 */
export function EvolutionConnectDialog({
  open,
  onOpenChange,
  workspaceId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
}) {
  const [qrCode, setQrCode] = React.useState<string | null>(null)
  const [carregando, setCarregando] = React.useState(false)
  const [erro, setErro] = React.useState<string | null>(null)
  const [conectado, setConectado] = React.useState(false)

  const iniciarConexao = React.useCallback(async () => {
    setCarregando(true)
    setErro(null)
    const resultado = await conectarWhatsapp(workspaceId)
    setCarregando(false)
    if (!resultado.ok) {
      setErro(resultado.erro)
      return
    }
    setQrCode(resultado.qrCode)
  }, [workspaceId])

  // Abrir o diálogo já dispara a criação da instância e o primeiro QR Code.
  React.useEffect(() => {
    if (!open) return
    setQrCode(null)
    setErro(null)
    setConectado(false)
    void iniciarConexao()
  }, [open, iniciarConexao])

  // O QR expira em segundos — sem renovar sozinho, a pessoa veria um código
  // morto na tela sem saber por quê.
  React.useEffect(() => {
    if (!open || conectado || erro) return
    const intervalo = setInterval(async () => {
      const resultado = await renovarQrCode(workspaceId)
      if (resultado.ok) setQrCode(resultado.qrCode)
    }, INTERVALO_RENOVAR_QR_MS)
    return () => clearInterval(intervalo)
  }, [open, conectado, erro, workspaceId])

  // Checa se a leitura já aconteceu, para o diálogo fechar sozinho — ninguém
  // deveria precisar clicar em "já escaneei".
  React.useEffect(() => {
    if (!open || conectado || erro) return
    const intervalo = setInterval(async () => {
      const resultado = await estadoDaConexao(workspaceId)
      if (resultado.conectado) {
        setConectado(true)
        toast.success('WhatsApp conectado.')
      }
    }, INTERVALO_CHECAR_ESTADO_MS)
    return () => clearInterval(intervalo)
  }, [open, conectado, erro, workspaceId])

  // Fecha sozinho um instante depois de conectar, para a pessoa ver a
  // confirmação antes da tela sumir.
  React.useEffect(() => {
    if (!conectado) return
    const t = setTimeout(() => onOpenChange(false), 1500)
    return () => clearTimeout(t)
  }, [conectado, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Conectar WhatsApp</DialogTitle>
          <DialogDescription>
            Escaneie com o WhatsApp do número da empresa, em Aparelhos conectados.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-amber-500/10 text-amber-600 dark:text-amber-400 flex gap-2 rounded-md px-3 py-2 text-xs">
          <AlertTriangle aria-hidden className="size-4 shrink-0" />
          <p>
            Esta conexão não usa a API oficial da Meta. Ela pode ser restringida sem aviso.
            Use um número que não seja crítico para o negócio até confiar na estabilidade.
          </p>
        </div>

        <div className="flex min-h-56 flex-col items-center justify-center gap-3">
          {conectado ? (
            <p className="text-sm font-medium">Conectado. Fechando…</p>
          ) : erro ? (
            <>
              <p role="alert" className="text-destructive text-center text-sm">
                {erro}
              </p>
              <Button variant="outline" size="sm" onClick={iniciarConexao} disabled={carregando}>
                {carregando ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Tentar de novo
              </Button>
            </>
          ) : carregando && !qrCode ? (
            <Loader2 className="text-muted-foreground size-6 animate-spin" />
          ) : qrCode ? (
            // eslint-disable-next-line @next/next/no-img-element -- base64 do Evolution, não é asset do projeto
            <img
              src={qrCode}
              alt="QR Code para conectar o WhatsApp"
              className="size-56 rounded-md border"
            />
          ) : (
            <p className="text-muted-foreground text-sm">Não consegui gerar o código.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
