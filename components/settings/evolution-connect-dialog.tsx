'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatarTelefoneBR } from '@/lib/format-input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  conectarPorCodigo,
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
 * Confirmado numa tentativa real em 23/08: primeiro QR às 19:26:59, corte às
 * 19:29:39 — 160 segundos exatos.
 *
 * 110s deixa 50 segundos de folga. Eram 140s, margem apertada demais para um
 * reinício que leva alguns segundos e precisa entregar o QR novo antes de o
 * antigo virar pó.
 */
const INTERVALO_RECONECTAR_MS = 110_000

/** Intervalo de checagem se a leitura já aconteceu. */
const INTERVALO_CHECAR_ESTADO_MS = 3_000

/**
 * Espera entre tentativas quando o servidor respondeu certo mas ainda não
 * tinha QR pronto.
 *
 * A busca em si já custa ~3s no servidor do WhatsApp (medido em 23/08), então
 * este intervalo é o respiro ENTRE buscas, não o tempo total — na prática cada
 * ciclo leva uns 5s. Deixar isso para o ciclo de renovação (20s) faria a tela
 * parecer travada justamente no primeiro contato com a funcionalidade.
 */
const INTERVALO_TENTAR_QR_MS = 2_000

/**
 * Quantas vezes insistir antes de admitir que o código não vem.
 *
 * Sem teto, a tela giraria "Preparando…" para sempre e esconderia falha de
 * servidor — que foi exatamente o caso encontrado em 22/08: o Postgres da VPS
 * respondia `sorry, too many clients already`, o whatsmeow não conseguia criar
 * o store da instância e o QR nunca era gerado. Uma espera infinita teria
 * transformado um defeito diagnosticável em "o produto não funciona".
 *
 * Seis tentativas a ~5s cada dão cerca de 30 segundos de paciência, que é
 * bastante mais do que os ~3s que o servidor leva quando está saudável.
 */
const MAX_TENTATIVAS_QR = 6

/**
 * Por quanto tempo total insistir em conectar antes de desistir e mostrar erro.
 *
 * ## O bug que isto corrige (24/08)
 *
 * Os três efeitos abaixo (renovar QR a cada 20s, recriar sessão a cada 110s,
 * checar se conectou a cada 3s) rodavam **para sempre** enquanto
 * `!conectado && !erro` — e nenhum deles jamais setava `erro`. Se o
 * pareamento nunca completasse do lado do WhatsApp, a tela girava QR novo
 * indefinidamente, sem nunca admitir que algo estava errado. Reportado pelo
 * dono como "loop infinito", junto do sintoma que já estava documentado em
 * `lib/integrations/evolution/actions.ts`: o WhatsApp recusando a leitura
 * com "verifique sua conexão e tente mais tarde" — mensagem NATIVA do
 * WhatsApp, não deste código, sinal de que o servidor está rejeitando o
 * pareamento antes de completar (hipótese mais forte: IP de datacenter da
 * VPS, que o WhatsApp trata como sinal de automação desde jan/2026).
 *
 * ## Por que 5 minutos, não menos
 *
 * `INTERVALO_RECONECTAR_MS` é 110s — um teto menor que ~2 ciclos completos
 * (220s) desistiria antes da segunda tentativa de sessão nova sequer
 * terminar, o que pareceria abandonar cedo demais para quem só estava sendo
 * lento pra pegar o celular. 5 minutos cobre 2 recriações de sessão inteiras
 * com folga.
 */
const TEMPO_MAXIMO_DE_TENTATIVA_MS = 5 * 60_000

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
  // Marca quando o primeiro QR chegou — é a partir daqui que o teto de 5
  // minutos conta. `Date.now()` num `useState` inicial travaria no valor do
  // PRIMEIRO render do componente, não de quando a conexão de fato começou.
  const inicioDaTentativaRef = React.useRef<number | null>(null)
  // Só serve para reagendar a retentativa: sem ele, uma tentativa que volta
  // sem QR não muda estado nenhum, as dependências do efeito ficam iguais, o
  // cleanup não roda e nunca há uma próxima tentativa.
  const [tentativaQr, setTentativaQr] = React.useState(0)
  // Duas formas de conectar, e a por código é a que sobrevive melhor: o QR
  // vive ~20s e a sessão morre em ~160s, janela em que a leitura falhava.
  const [modo, setModo] = React.useState<'qr' | 'codigo'>('qr')
  const [telefone, setTelefone] = React.useState('')
  const [codigo, setCodigo] = React.useState<string | null>(null)
  const [pedindoCodigo, setPedindoCodigo] = React.useState(false)

  /**
   * @param silencioso Renovação de fundo (a sessão vai expirar): mantém o QR
   * atual na tela enquanto o novo não chega. Sem isto, a cada reconexão
   * automática o código sumia e virava spinner por um instante — piscada
   * gratuita, e pior, bem no momento em que a pessoa pode estar mirando a
   * câmera.
   */
  const iniciarConexao = React.useCallback(
    async (silencioso = false) => {
      // Reseta o relógio do teto de 5 minutos: as duas chamadas não-silenciosas
      // (abrir o diálogo, clicar "Tentar de novo") são pedidos NOVOS de
      // conectar. `silencioso` nunca é passado como `true` neste arquivo hoje,
      // mas o guarda continua certo se um dia existir renovação de fundo: essa
      // não deveria reiniciar o prazo de quem já está tentando há um tempo.
      if (!silencioso) inicioDaTentativaRef.current = Date.now()
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
    setModo('qr')
    setCodigo(null)
    setTelefone('')
    // `iniciarConexao()` abaixo já zera o relógio do teto de 5 minutos (é uma
    // chamada não-silenciosa) — reabrir o diálogo é um pedido novo de
    // conectar, não continuação do anterior.
    void iniciarConexao()
  }, [open, iniciarConexao])

  /**
   * Verdadeiro quando já passou tempo demais tentando, sem nunca conectar.
   *
   * Chamado no TOPO dos três efeitos sem teto (renovar QR, recriar sessão,
   * checar conexão) — cada um confere isto antes de agendar a próxima
   * rodada, e desiste com uma mensagem que nomeia a causa mais provável em
   * vez de deixar a pessoa achando que o produto travou.
   */
  const estourouOTempo = React.useCallback(() => {
    const inicio = inicioDaTentativaRef.current
    if (inicio === null || Date.now() - inicio < TEMPO_MAXIMO_DE_TENTATIVA_MS) return false
    setErro(
      'Não conseguimos confirmar a conexão depois de várias tentativas. O WhatsApp pode estar recusando o pareamento vindo do nosso servidor. Tente de novo em alguns minutos, ou fale com o suporte se continuar.',
    )
    return true
  }, [])

  // O QR expira em segundos — sem renovar sozinho, a pessoa veria um código
  // morto na tela sem saber por quê.
  React.useEffect(() => {
    if (!open || conectado || erro || modo !== 'qr') return
    const intervalo = setInterval(async () => {
      if (estourouOTempo()) return
      const resultado = await renovarQrCode(workspaceId)
      if (resultado.ok) setQrCode(resultado.qrCode)
    }, INTERVALO_RENOVAR_QR_MS)
    return () => clearInterval(intervalo)
  }, [open, conectado, erro, modo, workspaceId, estourouOTempo])

  // Reabre a sessão antes de o servidor matá-la (ver INTERVALO_RECONECTAR_MS).
  // Sem isto, a tela mostrava indefinidamente o QR de uma sessão encerrada, e
  // escanear simplesmente não fazia nada — sem erro, sem aviso, sem conexão.
  //
  // Chamava `iniciarConexao`, que faz `/instance/connect` — e o servidor IGNORA
  // quando a instância já está rodando, dizendo no log "Instance already
  // running, settings updated without restarting client". A reconexão
  // preventiva, portanto, nunca reconectou nada: a sessão morria no horário do
  // mesmo jeito. `renovarQrCode(id, true)` recria a instância, que é o único
  // caminho que o servidor aceita.
  //
  // `modo !== 'qr'` é o guarda mais importante deste arquivo: este efeito APAGA
  // e recria a instância, e fazer isso enquanto alguém digita um código de
  // pareamento invalidaria justamente o código que está na tela dela.
  React.useEffect(() => {
    if (!open || conectado || erro || modo !== 'qr') return
    const intervalo = setInterval(async () => {
      if (estourouOTempo()) return
      const resultado = await renovarQrCode(workspaceId, true)
      if (!resultado.ok) return
      if (resultado.jaConectado) {
        setConectado(true)
        toast.success('WhatsApp conectado.')
        return
      }
      if (resultado.qrCode) setQrCode(resultado.qrCode)
    }, INTERVALO_RECONECTAR_MS)
    return () => clearInterval(intervalo)
  }, [open, conectado, erro, modo, workspaceId, estourouOTempo])

  // A sessão pode ainda estar subindo quando o QR é pedido: `/instance/connect`
  // responde 200 ao ACEITAR o pedido, não ao terminar de parear. O servidor já
  // espera até 12s (`esperarQrCode`), e aqui a tela continua tentando em vez de
  // desistir — era exatamente esta janela que devolvia
  // `no QR code available. Please wait a moment and try again` em vermelho.
  React.useEffect(() => {
    if (!open || conectado || erro || qrCode || carregando || modo !== 'qr') return
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
  }, [open, conectado, erro, qrCode, carregando, tentativaQr, modo, workspaceId])

  // Checa se a leitura já aconteceu, para o diálogo fechar sozinho — ninguém
  // deveria precisar clicar em "já escaneei".
  React.useEffect(() => {
    if (!open || conectado || erro) return
    const intervalo = setInterval(async () => {
      if (estourouOTempo()) return
      const resultado = await estadoDaConexao(workspaceId)

      // O número pode ter parado de pé e ainda assim ser recusado: a mesma
      // conta de WhatsApp em duas empresas faz as duas disputarem os mesmos
      // eventos, e a mensagem do cliente vira loteria. O servidor já desfez o
      // pareamento nesse caso — a tela precisa PARAR de girar e dizer o
      // porquê, senão a pessoa escaneia de novo e cai no mesmo lugar.
      if (resultado.erro) {
        setErro(resultado.erro)
        return
      }

      if (resultado.conectado) {
        setConectado(true)
        toast.success('WhatsApp conectado.')
      }
    }, INTERVALO_CHECAR_ESTADO_MS)
    return () => clearInterval(intervalo)
  }, [open, conectado, erro, workspaceId, estourouOTempo])

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
            {modo === 'qr'
              ? 'Escaneie com o WhatsApp do número da empresa, em Aparelhos conectados.'
              : 'Informe o número da empresa e digite o código no WhatsApp dele.'}
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
          ) : modo === 'codigo' ? (
            <BlocoCodigo
              telefone={telefone}
              setTelefone={setTelefone}
              codigo={codigo}
              pedindo={pedindoCodigo}
              onPedir={async () => {
                setPedindoCodigo(true)
                setErro(null)
                const r = await conectarPorCodigo(workspaceId, telefone)
                setPedindoCodigo(false)
                if (r.ok) setCodigo(r.codigo)
                else setErro(r.erro)
              }}
              erro={erro}
            />
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

        {/* A troca de caminho fica visível o tempo todo, não escondida atrás de
            uma falha: quem abre o CRM pelo celular não tem como escanear a
            própria tela, e para essa pessoa o código é o único caminho. */}
        {!conectado && (
          <button
            type="button"
            onClick={() => {
              setModo((m) => (m === 'qr' ? 'codigo' : 'qr'))
              setErro(null)
              setCodigo(null)
            }}
            className="text-muted-foreground hover:text-foreground text-center text-xs underline underline-offset-4"
          >
            {modo === 'qr'
              ? 'Não consegue escanear? Conectar com um código'
              : 'Voltar para o QR Code'}
          </button>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * O caminho por código de 8 letras.
 *
 * Separado em componente próprio porque o diálogo já carrega três estados
 * concorrentes (carregando, erro, conectado) e embutir mais um ramo inline
 * tornaria o `return` ilegível.
 *
 * O código aparece em fonte monoespaçada e tamanho grande de propósito: ele é
 * digitado à mão em outro aparelho, e `0/O` ou `1/I` confundidos custam uma
 * tentativa inteira.
 */
function BlocoCodigo({
  telefone,
  setTelefone,
  codigo,
  pedindo,
  onPedir,
  erro,
}: {
  telefone: string
  setTelefone: (v: string) => void
  codigo: string | null
  pedindo: boolean
  onPedir: () => void
  erro: string | null
}) {
  if (codigo) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-muted-foreground text-sm">
          No WhatsApp do número, toque em <strong>Aparelhos conectados</strong> →{' '}
          <strong>Conectar aparelho</strong> → <strong>Conectar com número</strong> e digite:
        </p>
        <p className="bg-muted rounded-lg px-4 py-3 font-mono text-2xl font-semibold tracking-[0.2em]">
          {codigo}
        </p>
        <p className="text-muted-foreground text-xs">
          Assim que confirmar no celular, esta janela fecha sozinha.
        </p>
      </div>
    )
  }

  return (
    <div className="flex w-full max-w-xs flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="telefone-whatsapp">Número do WhatsApp da empresa</Label>
        <Input
          id="telefone-whatsapp"
          inputMode="numeric"
          placeholder="(11) 98888-7777"
          value={telefone}
          disabled={pedindo}
          onChange={(e) => setTelefone(formatarTelefoneBR(e.target.value))}
        />
      </div>
      {erro && (
        <p role="alert" className="text-destructive text-sm">
          {erro}
        </p>
      )}
      <Button onClick={onPedir} disabled={pedindo || telefone.trim().length < 10}>
        {pedindo && <Loader2 className="size-4 animate-spin" />}
        Receber código
      </Button>
    </div>
  )
}
