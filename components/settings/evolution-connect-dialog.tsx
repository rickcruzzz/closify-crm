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

/**
 * De quanto em quanto tempo buscar o QR novo do servidor.
 *
 * 20s porque é o ciclo REAL do Evolution GO, medido nos logs da instância em
 * 22/08: ele gera um QR novo a cada 20 segundos e invalida o anterior. O
 * valor antigo (18s) ficava fora de fase — a tela pegava um código com 2
 * segundos de vida pela frente, e quem levasse esse tempo para apontar a
 * câmera escaneava um QR já morto.
 */
const INTERVALO_RENOVAR_QR_MS = 20_000

/**
 * De quanto em quanto tempo reabrir a sessão do zero.
 *
 * O achado que explicava "escaneio e não conecta": o Evolution GO gera no
 * MÁXIMO 6 QR codes por sessão e então mata tudo — nos logs,
 * `QR timeout — signaling kill channel`, seguido de `Restarting client` e
 * `No jid found. Creating new device`. Isso acontece por volta dos 160
 * segundos.
 *
 * Sem isto, passado esse tempo a tela seguia mostrando o último QR buscado,
 * que pertencia a uma sessão que já não existia: escanear não conectava e
 * não produzia erro nenhum, nem na tela nem no log — o pior tipo de falha.
 *
 * 140s deixa 20 segundos de folga antes do corte, tempo de a nova sessão
 * subir e entregar o primeiro QR sem que a tela pisque vazia.
 */
const INTERVALO_RECONECTAR_MS = 140_000

/** Intervalo de checagem se a leitura já aconteceu. */
const INTERVALO_CHECAR_ESTADO_MS = 3_000

/**
 * Espera entre tentativas quando o servidor respondeu certo mas ainda não
 * tinha QR pronto. Curto de propósito: deixar isso para o ciclo de renovação
 * (20s) faria a tela parecer travada justamente no primeiro contato com a
 * funcionalidade.
 */
const INTERVALO_TENTAR_QR_MS = 3_000

/**
 * Quantas vezes insistir antes de admitir que o código não vem.
 *
 * Sem teto, a tela giraria "Preparando…" para sempre e esconderia falha de
 * servidor — que foi exatamente o caso encontrado em 22/08: o Postgres da VPS
 * respondia `sorry, too many clients already`, o whatsmeow não conseguia criar
 * o store da instância e o QR nunca era gerado. Uma espera infinita teria
 * transformado um defeito diagnosticável em "o produto não funciona".
 */
const MAX_TENTATIVAS_QR = 5

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
  // Só serve para reagendar a retentativa: sem ele, uma tentativa que volta
  // sem QR não muda estado nenhum, as dependências do efeito ficam iguais, o
  // cleanup não roda e nunca há uma próxima tentativa.
  const [tentativaQr, setTentativaQr] = React.useState(0)

  /**
   * @param silencioso Renovação de fundo (a sessão vai expirar): mantém o QR
   * atual na tela enquanto o novo não chega. Sem isto, a cada reconexão
   * automática o código sumia e virava spinner por um instante — piscada
   * gratuita, e pior, bem no momento em que a pessoa pode estar mirando a
   * câmera.
   */
  const iniciarConexao = React.useCallback(
    async (silencioso = false) => {
      if (!silencioso) setCarregando(true)
      setErro(null)
      const resultado = await conectarWhatsapp(workspaceId)
      if (!silencioso) setCarregando(false)
      if (!resultado.ok) {
        setErro(resultado.erro)
        return
      }
      // Reconectar um número que já está pareado não devolve QR, e antes
      // isso caía no mesmo caminho de "sem código" — a tela pedia para
      // escanear algo que não existia, para uma conexão que já funcionava.
      if (resultado.jaConectado) {
        setConectado(true)
        toast.success('WhatsApp já estava conectado.')
        return
      }
      setQrCode(resultado.qrCode)
    },
    [workspaceId],
  )

  // Abrir o diálogo já dispara a criação da instância e o primeiro QR Code.
  React.useEffect(() => {
    if (!open) return
    setQrCode(null)
    setErro(null)
    setConectado(false)
    setTentativaQr(0)
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

  // Reabre a sessão antes de o servidor matá-la (ver INTERVALO_RECONECTAR_MS).
  // Sem isto, a tela mostrava indefinidamente o QR de uma sessão encerrada, e
  // escanear simplesmente não fazia nada — sem erro, sem aviso, sem conexão.
  React.useEffect(() => {
    if (!open || conectado || erro) return
    const intervalo = setInterval(() => {
      void iniciarConexao(true)
    }, INTERVALO_RECONECTAR_MS)
    return () => clearInterval(intervalo)
  }, [open, conectado, erro, iniciarConexao])

  // A sessão pode ainda estar subindo quando o QR é pedido: `/instance/connect`
  // responde 200 ao ACEITAR o pedido, não ao terminar de parear. O servidor já
  // espera até 12s (`esperarQrCode`), e aqui a tela continua tentando em vez de
  // desistir — era exatamente esta janela que devolvia
  // `no QR code available. Please wait a moment and try again` em vermelho.
  React.useEffect(() => {
    if (!open || conectado || erro || qrCode || carregando) return
    if (tentativaQr >= MAX_TENTATIVAS_QR) {
      setErro(
        'O servidor do WhatsApp não conseguiu abrir a sessão para gerar o código. Tente de novo em alguns minutos; se continuar, fale com o suporte.',
      )
      return
    }
    const t = setTimeout(() => {
      void (async () => {
        const resultado = await renovarQrCode(workspaceId)
        if (resultado.ok && resultado.qrCode) setQrCode(resultado.qrCode)
        else setTentativaQr((n) => n + 1)
      })()
    }, INTERVALO_TENTAR_QR_MS)
    return () => clearTimeout(t)
  }, [open, conectado, erro, qrCode, carregando, tentativaQr, workspaceId])

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
              {/* Arrow function, não `onClick={iniciarConexao}`: o handler
                  receberia o MouseEvent como primeiro argumento, e qualquer
                  objeto é truthy — o clique cairia no modo silencioso e não
                  mostraria spinner nenhum. */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => void iniciarConexao()}
                disabled={carregando}
              >
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
            // Não é erro: é a sessão subindo. O efeito acima segue tentando,
            // então a tela informa o que está acontecendo em vez de acusar
            // uma falha que não houve.
            <>
              <Loader2 className="text-muted-foreground size-6 animate-spin" />
              <p className="text-muted-foreground text-center text-sm">
                Preparando o código no servidor. Isso leva alguns segundos.
              </p>
            </>
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
