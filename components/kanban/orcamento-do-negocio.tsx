'use client'

import * as React from 'react'
import { CalendarClock, FileDown, Loader2, Pencil, Plus } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
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
import { Textarea } from '@/components/ui/textarea'
import { lerOrcamento, registrarOrcamento } from '@/lib/deals/actions'
import { diasAteVencer, textoDoPrazo } from '@/lib/deals/orcamento'
import { cn } from '@/lib/utils'

/**
 * O orçamento dentro do painel do negócio.
 *
 * ## O que este bloco entrega, e por que ele não é só um campo
 *
 * Medido em 61 concorrentes (07/09/2026), 59% anunciam proposta/orçamento e
 * este produto tinha, para ele, o NOME de uma etapa do Kanban. Pior: a
 * mensagem de prospecção que sai para os cinco nichos diz "quando você manda
 * um orçamento e o cliente não responde, quem lembra de cobrar de volta?" — o
 * produto cobrava por um recurso que não tinha.
 *
 * O que este bloco faz de diferente do mercado é a validade virar cobrança.
 * Dos 56 que anunciam proposta, 4% guardam validade e **0% avisam**.
 *
 * ## Carrega ao ABRIR o painel, não junto do board
 *
 * `orcamento_descricao` aceita 2.000 caracteres, e o `/kanban` carrega todo
 * card de todas as etapas de uma vez. Esta base já mediu que trocar 8 colunas
 * por 5 derrubou a consulta do board de 315 B para 198 B por negócio — pendurar
 * a descrição lá custaria dez vezes o card inteiro, numa tela que não a mostra.
 */

type Orcamento = {
  valor: number
  validade: string | null
  descricao: string | null
}

const dinheiro = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function OrcamentoDoNegocio({
  dealId,
  valorDoNegocio,
}: {
  dealId: string
  /** Pré-preenche o formulário quando ainda não há orçamento registrado. */
  valorDoNegocio: number
}) {
  const [orcamento, setOrcamento] = React.useState<Orcamento | null>(null)
  const [carregando, setCarregando] = React.useState(true)
  const [aberto, setAberto] = React.useState(false)
  const [salvando, setSalvando] = React.useState(false)
  const [baixando, setBaixando] = React.useState(false)

  // Nasce `null` e é preenchido num efeito. `new Date()` no primeiro render de
  // um componente cliente roda TAMBÉM no servidor durante o SSR, e o relógio
  // de lá é UTC — "vence hoje" viraria "venceu ontem" para quem abre o painel
  // à noite, e o texto trocaria sozinho na hidratação.
  const [agora, setAgora] = React.useState<Date | null>(null)
  React.useEffect(() => setAgora(new Date()), [])

  const [valor, setValor] = React.useState('')
  const [validade, setValidade] = React.useState('')
  const [descricao, setDescricao] = React.useState('')
  const [erro, setErro] = React.useState<string | null>(null)

  React.useEffect(() => {
    let vivo = true
    setCarregando(true)

    lerOrcamento(dealId).then((r) => {
      if (!vivo) return
      if ('orcamento' in r && r.orcamento) setOrcamento(r.orcamento)
      setCarregando(false)
    })

    // O painel troca de negócio sem desmontar (o mesmo `Sheet` serve a todos),
    // então uma resposta lenta do negócio ANTERIOR chegaria depois e pintaria
    // o orçamento errado no negócio novo. A trava fecha isso.
    return () => {
      vivo = false
    }
  }, [dealId])

  function abrirEditor() {
    setValor(String(orcamento?.valor || valorDoNegocio || ''))
    setValidade(orcamento?.validade ?? '')
    setDescricao(orcamento?.descricao ?? '')
    setErro(null)
    setAberto(true)
  }

  async function salvar(limpar = false) {
    setSalvando(true)
    setErro(null)

    const r = await registrarOrcamento({
      dealId,
      valor: Number(valor),
      validade: limpar ? '' : validade,
      descricao: limpar ? '' : descricao,
    })

    setSalvando(false)

    if ('error' in r && r.error) {
      setErro(r.error)
      return
    }

    setOrcamento({
      valor: Number(valor),
      validade: limpar ? null : validade || null,
      descricao: limpar ? null : descricao || null,
    })
    setAberto(false)
    toast.success(
      limpar
        ? 'Orçamento removido.'
        : validade
          ? 'Orçamento salvo. A cobrança do retorno está agendada.'
          : 'Orçamento salvo.',
    )
  }

  /**
   * O PDF vem de uma ROTA, então o erro dela chega como status HTTP e não como
   * `{ error }` de Server Action.
   *
   * `fetch` e não `<a download>` de propósito: com a âncora, um 402 de plano
   * abriria uma página com JSON cru na cara da pessoa. Lendo aqui, a recusa
   * vira um toast que explica o que fazer.
   */
  async function baixarPdf() {
    setBaixando(true)
    try {
      const r = await fetch(`/api/negocios/${dealId}/orcamento`)

      if (!r.ok) {
        const corpo = await r.json().catch(() => null)
        toast.error(corpo?.error ?? 'Não foi possível gerar o PDF.')
        return
      }

      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download =
        r.headers.get('Content-Disposition')?.match(/filename="(.+?)"/)?.[1] ?? 'orcamento.pdf'
      a.click()
      // Sem o revoke, cada download deixa o PDF inteiro preso na memória da
      // aba até ela ser fechada.
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Não foi possível gerar o PDF.')
    } finally {
      setBaixando(false)
    }
  }

  const dias = orcamento?.validade && agora ? diasAteVencer(orcamento.validade, agora) : null

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs">Orçamento</span>
        {!carregando && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={abrirEditor}
            aria-label={orcamento?.validade ? 'Editar orçamento' : 'Registrar orçamento'}
          >
            {orcamento?.validade ? (
              <>
                <Pencil aria-hidden className="size-3.5" /> Editar
              </>
            ) : (
              <>
                <Plus aria-hidden className="size-3.5" /> Registrar
              </>
            )}
          </Button>
        )}
      </div>

      {carregando ? (
        <p className="text-muted-foreground text-sm">Carregando…</p>
      ) : !orcamento?.validade ? (
        /* O vazio DIZ o que o recurso faz. "Nenhum orçamento" seria verdade e
           não ensinaria nada — e este é o recurso que a mensagem de prospecção
           promete, então é aqui que ele precisa se explicar. */
        <p className="text-muted-foreground text-sm">
          Registre valor e validade, e o sistema cobra o retorno antes de vencer.
        </p>
      ) : (
        <div className="mt-1 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-sm font-semibold tabular-nums">
              {dinheiro(orcamento.valor)}
            </span>
            <span
              className={cn(
                'flex items-center gap-1 text-xs',
                dias !== null && dias < 0
                  ? 'text-destructive font-medium'
                  : dias !== null && dias <= 2
                    ? 'font-medium text-amber-500'
                    : 'text-muted-foreground',
              )}
            >
              <CalendarClock aria-hidden className="size-3.5 shrink-0" />
              {/* `agora` só existe depois da hidratação; até lá não há como
                  dizer "vence hoje" sem arriscar o fuso do servidor. */}
              {agora ? textoDoPrazo(orcamento.validade, agora) : '…'}
            </span>
          </div>

          {orcamento.descricao && (
            <p className="text-muted-foreground text-sm whitespace-pre-line">
              {orcamento.descricao}
            </p>
          )}

          <Button
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={baixarPdf}
            disabled={baixando}
          >
            {baixando ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : (
              <FileDown aria-hidden className="size-4" />
            )}
            Baixar PDF
          </Button>
        </div>
      )}

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{orcamento?.validade ? 'Editar orçamento' : 'Registrar orçamento'}</DialogTitle>
            <DialogDescription>
              Ao salvar com uma validade, entra uma tarefa para cobrar o retorno dois dias antes
              de vencer.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="orcamento-valor">Valor</Label>
              <Input
                id="orcamento-valor"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                disabled={salvando}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="orcamento-validade">Válido até</Label>
              <Input
                id="orcamento-validade"
                type="date"
                value={validade}
                onChange={(e) => setValidade(e.target.value)}
                disabled={salvando}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="orcamento-descricao">O que foi proposto</Label>
              <Textarea
                id="orcamento-descricao"
                rows={4}
                maxLength={2000}
                placeholder="Dedetização de 3 dormitórios e garagem, 2 aplicações com 30 dias de intervalo."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                disabled={salvando}
              />
            </div>

            {erro && (
              <p role="alert" className="text-destructive text-sm">
                {erro}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            {orcamento?.validade ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive"
                onClick={() => salvar(true)}
                disabled={salvando}
              >
                Remover orçamento
              </Button>
            ) : (
              <span />
            )}

            <Button type="button" onClick={() => salvar(false)} disabled={salvando}>
              {salvando && <Loader2 aria-hidden className="size-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
