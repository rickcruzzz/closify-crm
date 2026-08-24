'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, CreditCard, ExternalLink, FileText, Loader2, QrCode } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { obterFormasDePagamento, pagamentoFoiConfirmado } from '@/lib/asaas/actions'
import { avisoDeValidade } from '@/lib/asaas/pix'
import { cn } from '@/lib/utils'
import { CONTROLADOR } from '@/lib/legal'

type Metodo = 'pix' | 'boleto' | 'cartao'

type Pagamento = {
  valor: number
  pix: { imagemDataUrl: string; copiaECola: string; expiraEm: string | null } | null
  boleto: { linhaFormatada: string; linhaParaCopiar: string } | null
  boletoPdfUrl: string | null
  urlDoCartao: string
}

/** De quanto em quanto tempo perguntamos se o pagamento caiu. */
const INTERVALO_DE_CONFERENCIA_MS = 5_000
/** Por quanto tempo continuamos perguntando. */
const TEMPO_MAXIMO_MS = 15 * 60_000

/**
 * Pagamento dentro do produto.
 *
 * ## Por que esta tela existe
 *
 * Antes, "Assinar Pro" abria a página do Asaas em outra aba. Dois custos:
 *
 * 1. A pessoa **sai do produto** no momento de maior intenção de compra.
 * 2. A página do Asaas mostra **o nome civil do titular em destaque** — para
 *    MEI não existe nome fantasia na base do CNPJ desde 15/11/2023 (dado da
 *    Receita, não limitação do Asaas). Quem clicou em "Assinar o Velo Funil"
 *    cai numa tela com o nome de um desconhecido no topo, e é dessa
 *    não-identificação que nasce a desistência.
 *
 * Pix e boleto agora acontecem aqui, com a nossa marca. Cartão continua no
 * Asaas de propósito: processar cartão por API colocaria o número no nosso
 * servidor e nos jogaria no escopo do PCI-DSS.
 *
 * ## Por que o aviso sobre o nome
 *
 * O nome do titular AINDA aparece no app do banco, na confirmação. Avisar antes
 * transforma surpresa em detalhe — e surpresa na hora de pagar é desistência,
 * ou pior, contestação trinta dias depois.
 */
export function PagarDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [carregando, setCarregando] = React.useState(false)
  const [erro, setErro] = React.useState<string | null>(null)
  const [pagamento, setPagamento] = React.useState<Pagamento | null>(null)
  const [metodo, setMetodo] = React.useState<Metodo>('pix')
  const [copiado, setCopiado] = React.useState<Metodo | null>(null)

  React.useEffect(() => {
    if (!open) return

    let cancelado = false
    setCarregando(true)
    setErro(null)

    obterFormasDePagamento()
      .then((resultado) => {
        if (cancelado) return
        if ('error' in resultado && resultado.error) {
          setErro(resultado.error)
          return
        }
        if ('pagamento' in resultado && resultado.pagamento) {
          setPagamento(resultado.pagamento as Pagamento)
          // Abre no primeiro método que de fato carregou: se o Pix falhou,
          // abrir na aba dele mostraria um vazio para quem quer pagar.
          setMetodo(resultado.pagamento.pix ? 'pix' : resultado.pagamento.boleto ? 'boleto' : 'cartao')
        }
      })
      .finally(() => {
        if (!cancelado) setCarregando(false)
      })

    return () => {
      cancelado = true
    }
  }, [open])

  // Enquanto o código está na tela, pergunta de tempo em tempo se caiu. Quem
  // ATIVA o plano continua sendo o webhook do Asaas — isto só lê, então não há
  // duas fontes mexendo no mesmo estado.
  //
  // `document.hidden` corta a pergunta quando a aba está em segundo plano, que
  // é exatamente onde ela fica: a pessoa sai para o app do banco e volta. Sem
  // isso, quem abre o Pix e vai almoçar gera 180 consultas para nada — e a
  // resposta só interessa quando alguém está olhando a tela.
  React.useEffect(() => {
    if (!open || !pagamento) return

    const comecou = Date.now()
    const timer = setInterval(async () => {
      if (Date.now() - comecou > TEMPO_MAXIMO_MS) {
        clearInterval(timer)
        return
      }
      if (document.hidden) return

      const { confirmado } = await pagamentoFoiConfirmado()
      if (confirmado) {
        clearInterval(timer)
        toast.success('Pagamento confirmado. Seu Pro está ativo.')
        onOpenChange(false)
        router.refresh()
      }
    }, INTERVALO_DE_CONFERENCIA_MS)

    // Volta do app do banco: confere na hora, sem esperar o próximo ciclo.
    // É o momento em que a pessoa mais quer ver a confirmação.
    async function conferirAoVoltar() {
      if (document.hidden) return
      const { confirmado } = await pagamentoFoiConfirmado()
      if (confirmado) {
        clearInterval(timer)
        toast.success('Pagamento confirmado. Seu Pro está ativo.')
        onOpenChange(false)
        router.refresh()
      }
    }

    document.addEventListener('visibilitychange', conferirAoVoltar)

    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', conferirAoVoltar)
    }
  }, [open, pagamento, onOpenChange, router])

  async function copiar(texto: string, qual: Metodo) {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(qual)
      setTimeout(() => setCopiado(null), 2500)
    } catch {
      // Navegador sem permissão de área de transferência: o texto está na tela
      // e pode ser selecionado à mão. Avisar é melhor que fingir que copiou.
      toast.error('Não consegui copiar. Selecione o código na tela.')
    }
  }

  const avisoPix = pagamento?.pix ? avisoDeValidade(pagamento.pix.expiraEm) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assinar o Plano Pro</DialogTitle>
          <DialogDescription>
            R$ {pagamento?.valor ?? 49} por mês, pela empresa inteira. Cancele quando quiser.
          </DialogDescription>
        </DialogHeader>

        {carregando && (
          <div className="text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Preparando o pagamento…
          </div>
        )}

        {erro && (
          <div className="flex flex-col gap-3 py-2">
            <p role="alert" className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
              {erro}
            </p>
            <p className="text-muted-foreground text-sm">
              Se continuar, escreva para {CONTROLADOR.email} que resolvemos por lá.
            </p>
          </div>
        )}

        {pagamento && !carregando && (
          <div className="flex flex-col gap-4">
            <div className="bg-muted/50 flex gap-1 rounded-lg p-1">
              {(
                [
                  { id: 'pix' as const, rotulo: 'Pix', icone: QrCode, ativo: !!pagamento.pix },
                  { id: 'boleto' as const, rotulo: 'Boleto', icone: FileText, ativo: !!pagamento.boleto },
                  { id: 'cartao' as const, rotulo: 'Cartão', icone: CreditCard, ativo: true },
                ] satisfies Array<{
                  id: Metodo
                  rotulo: string
                  icone: typeof QrCode
                  ativo: boolean
                }>
              )
                .filter((aba) => aba.ativo)
                .map((aba) => (
                  <button
                    key={aba.id}
                    type="button"
                    onClick={() => setMetodo(aba.id)}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      metodo === aba.id
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <aba.icone className="size-4" />
                    {aba.rotulo}
                  </button>
                ))}
            </div>

            {metodo === 'pix' && pagamento.pix && (
              <div className="flex flex-col items-center gap-3">
                {/* O QR vem do Asaas em Base64. `unoptimized` não se aplica: é
                    `img` mesmo, porque `next/image` não otimiza data URL e
                    ainda exigiria configurar domínio. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pagamento.pix.imagemDataUrl}
                  alt="QR Code do Pix para pagar a assinatura"
                  className="size-52 rounded-lg bg-white p-2"
                />
                <p className="text-muted-foreground text-center text-sm">
                  Abra o app do seu banco, escolha Pix e aponte a câmera.
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => copiar(pagamento.pix!.copiaECola, 'pix')}
                >
                  {copiado === 'pix' ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {copiado === 'pix' ? 'Código copiado' : 'Copiar código Pix'}
                </Button>
                {avisoPix && <p className="text-muted-foreground text-xs">{avisoPix}</p>}
              </div>
            )}

            {metodo === 'boleto' && pagamento.boleto && (
              <div className="flex flex-col gap-3">
                <p className="bg-muted/50 rounded-lg px-3 py-3 text-center font-mono text-sm break-all">
                  {pagamento.boleto.linhaFormatada}
                </p>
                <Button
                  variant="outline"
                  onClick={() => copiar(pagamento.boleto!.linhaParaCopiar, 'boleto')}
                >
                  {copiado === 'boleto' ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {copiado === 'boleto' ? 'Linha copiada' : 'Copiar linha digitável'}
                </Button>
                {pagamento.boletoPdfUrl && (
                  <a
                    href={pagamento.boletoPdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1.5 text-sm underline underline-offset-4"
                  >
                    Baixar o boleto em PDF
                    <ExternalLink className="size-3.5" />
                  </a>
                )}
                <p className="text-muted-foreground text-xs">
                  O boleto leva até 3 dias úteis para compensar. No Pix, o Pro é liberado em
                  segundos.
                </p>
              </div>
            )}

            {metodo === 'cartao' && (
              <div className="flex flex-col gap-3">
                <p className="text-muted-foreground text-sm">
                  O cartão é processado com segurança pelo Asaas, nosso meio de pagamento. Você
                  será levado para a página segura deles.
                </p>
                {/* Âncora estilizada, não `Button asChild`: o `Button` deste
                    projeto não repassa `asChild`, e envolver um link num botão
                    quebraria abrir em nova aba e o menu de contexto. */}
                <a
                  href={pagamento.urlDoCartao}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors md:h-10"
                >
                  <CreditCard className="size-4" />
                  Pagar com cartão
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
            )}

            {/* Avisar antes transforma surpresa em detalhe. O nome do titular
                aparece no app do banco e não há como trocá-lo: para MEI, o nome
                fantasia saiu da base do CNPJ em 15/11/2023. */}
            <p className="text-muted-foreground border-t pt-3 text-xs">
              No seu banco, o recebedor aparece como{' '}
              <strong>{CONTROLADOR.razaoSocial}</strong>, o CNPJ por trás do Velo Funil.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
