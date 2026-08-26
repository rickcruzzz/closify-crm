'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Archive,
  ArrowLeft,
  Clock,
  Info,
  Loader2,
  MessageCircle,
  Mic,
  Send,
  User,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { EmptyState } from '@/components/ui/empty-state'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  minutosEsperando,
  ordenarPorEspera,
  textoDoRelogio,
  urgenciaDaConversa,
  type Urgencia,
} from '@/lib/conversas/ordenar'
import {
  arquivarConversa,
  enviarMensagem,
  marcarComoRespondida,
} from '@/lib/conversas/actions'
import type { ConversaNaLista, MensagemNaTela } from '@/lib/conversas/queries'
import { cn } from '@/lib/utils'

/**
 * A tela de Conversas.
 *
 * ## A decisão que separa esta tela de todo concorrente
 *
 * Kommo, Agendor, SleekFlow e todo aplicativo de mensagem ordenam por mensagem
 * mais recente. É a ordem certa para CONVERSAR.
 *
 * A ordem certa para NÃO PERDER VENDA é quem espera há mais tempo:
 *
 *     5    minutos é o tempo que o cliente brasileiro considera ideal
 *     40%  desistem da compra se não responderem em 10 minutos
 *     62%  já desistiram por falha operacional, quase sempre demora
 *
 * Por isso a lista é "Quem está esperando", com relógio, e não "Conversas".
 *
 * ## A terceira coluna é o produto
 *
 * Sem ela isto é um chat pior que o WhatsApp — e competir com o WhatsApp em
 * chat é perder. O que o WhatsApp não sabe, e nenhum chat sabe: quanto vale
 * esta conversa, em que etapa está o negócio, e o que era para acontecer
 * depois.
 *
 * ## A régua que decide se a tela será usada
 *
 * 34% dos brasileiros mantêm o WhatsApp aberto o dia inteiro. **Se responder
 * por aqui for mais lento que abrir o WhatsApp, ninguém usa.** Por isso não há
 * modelo para escolher, categoria para marcar nem campo para preencher antes
 * de enviar. Abrir, ler, responder.
 */

const CORES: Record<Urgencia, { texto: string; ponto: string }> = {
  // Sem cor: quem já foi respondido não é problema, e pintar tudo faz nada
  // chamar atenção.
  respondida: { texto: 'text-muted-foreground', ponto: 'bg-transparent' },
  tranquila: { texto: 'text-muted-foreground', ponto: 'bg-muted-foreground/40' },
  atencao: { texto: 'text-amber-600 dark:text-amber-500', ponto: 'bg-amber-500' },
  urgente: { texto: 'text-destructive', ponto: 'bg-destructive' },
}

const formatadorBRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})

export function ConversasClient({
  conversas,
  conversaAberta,
  mensagens,
  usuarioId,
  nomesPorUsuario,
}: {
  conversas: ConversaNaLista[]
  conversaAberta: string | null
  mensagens: MensagemNaTela[]
  usuarioId: string
  nomesPorUsuario: Record<string, string>
}) {
  const router = useRouter()

  /**
   * O relógio nasce no cliente e anda de minuto em minuto.
   *
   * O servidor roda em UTC e renderiza uma vez; sem isto, "esperando há 3 min"
   * ficaria congelado até a próxima navegação, que é exatamente o oposto do
   * que a tela promete.
   */
  const [agora, setAgora] = React.useState<Date | null>(null)
  React.useEffect(() => {
    setAgora(new Date())
    const t = setInterval(() => setAgora(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const ordenadas = React.useMemo(() => ordenarPorEspera(conversas), [conversas])
  const aberta = ordenadas.find((c) => c.id === conversaAberta) ?? null

  const [detalheAberto, setDetalheAberto] = React.useState(false)

  if (conversas.length === 0) {
    return (
      <EmptyState
        icon={MessageCircle}
        title="Nenhuma conversa ainda"
        description="Quando um cliente mandar mensagem no WhatsApp, ela aparece aqui com o negócio dele do lado. Conecte o WhatsApp em Configurações, Integrações."
      />
    )
  }

  return (
    <div className="border-border/60 flex h-[calc(100vh-11rem)] overflow-hidden rounded-xl border">
      {/* ─────────────────────────── coluna 1: quem espera ─────────────── */}
      <aside
        className={cn(
          'border-border/60 flex w-full flex-col border-r md:w-80 lg:w-96',
          // No telefone a lista some quando uma conversa está aberta: duas
          // colunas em 390px não cabem, e meia lista ao lado de meia conversa
          // deixa as duas inúteis.
          aberta && 'hidden md:flex',
        )}
      >
        <ListaDeConversas
          conversas={ordenadas}
          abertaId={conversaAberta}
          agora={agora}
          usuarioId={usuarioId}
          nomesPorUsuario={nomesPorUsuario}
        />
      </aside>

      {/* ─────────────────────────── coluna 2: a conversa ───────────────── */}
      <section className={cn('flex flex-1 flex-col', !aberta && 'hidden md:flex')}>
        {aberta ? (
          <Conversa
            conversa={aberta}
            mensagens={mensagens}
            agora={agora}
            onVoltar={() => router.push('/conversas')}
            onAbrirDetalhe={() => setDetalheAberto(true)}
          />
        ) : (
          <div className="text-muted-foreground flex flex-1 items-center justify-center p-8 text-center text-sm">
            Escolha uma conversa à esquerda.
          </div>
        )}
      </section>

      {/* ─────────────────────────── coluna 3: o negócio ────────────────── */}
      {aberta && (
        <aside className="border-border/60 hidden w-72 flex-col border-l lg:flex">
          <PainelDoNegocio conversa={aberta} />
        </aside>
      )}

      {/* No mobile e no tablet a terceira coluna vira Sheet, mesmo primitivo
          do painel de negócio do Kanban. */}
      <Sheet open={detalheAberto} onOpenChange={setDetalheAberto}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{aberta?.nome ?? 'Contato'}</SheetTitle>
          </SheetHeader>
          {aberta && <PainelDoNegocio conversa={aberta} />}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function ListaDeConversas({
  conversas,
  abertaId,
  agora,
  usuarioId,
  nomesPorUsuario,
}: {
  conversas: ConversaNaLista[]
  abertaId: string | null
  agora: Date | null
  usuarioId: string
  nomesPorUsuario: Record<string, string>
}) {
  const esperando = conversas.filter((c) => c.ultimoRecebidoEm && !c.respondidaEm)
  const respondidas = conversas.filter((c) => !(c.ultimoRecebidoEm && !c.respondidaEm))

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-border/60 flex items-center justify-between border-b px-4 py-3">
        <span className="text-sm font-medium">Quem está esperando</span>
        {esperando.length > 0 && (
          <Badge variant="secondary" className="tabular-nums">
            {esperando.length}
          </Badge>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {esperando.map((c) => (
          <LinhaDaConversa
            key={c.id}
            conversa={c}
            ativa={c.id === abertaId}
            agora={agora}
            usuarioId={usuarioId}
            nomesPorUsuario={nomesPorUsuario}
          />
        ))}

        {respondidas.length > 0 && (
          <div className="text-muted-foreground border-border/60 border-y px-4 py-1.5 text-xs">
            Respondidas
          </div>
        )}

        {respondidas.map((c) => (
          <LinhaDaConversa
            key={c.id}
            conversa={c}
            ativa={c.id === abertaId}
            agora={agora}
            usuarioId={usuarioId}
            nomesPorUsuario={nomesPorUsuario}
          />
        ))}
      </div>
    </div>
  )
}

function LinhaDaConversa({
  conversa,
  ativa,
  agora,
  usuarioId,
  nomesPorUsuario,
}: {
  conversa: ConversaNaLista
  ativa: boolean
  agora: Date | null
  usuarioId: string
  nomesPorUsuario: Record<string, string>
}) {
  // Antes do primeiro tick do cliente não há relógio: renderizar com a hora do
  // servidor causaria descasamento de hidratação, e é o defeito que já pegou o
  // calendário deste projeto.
  const minutos = agora ? minutosEsperando(conversa, agora) : null
  const urgencia = agora ? urgenciaDaConversa(conversa, agora) : 'respondida'
  const cor = CORES[urgencia]

  const colisao = quemEstaRespondendo(conversa, usuarioId, nomesPorUsuario, agora)

  return (
    <Link
      href={`/conversas?c=${conversa.id}`}
      // `min-h-16`: alvo de toque acima dos 44px mínimos, e a linha tem três
      // informações empilhadas que precisam caber sem apertar.
      className={cn(
        'border-border/60 flex min-h-16 flex-col gap-1 border-b px-4 py-3 transition-colors',
        'hover:bg-muted/50 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
        ativa && 'bg-muted',
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-medium">{conversa.nome}</span>
        <span className={cn('flex shrink-0 items-center gap-1 text-xs', cor.texto)}>
          {minutos !== null && (
            <>
              <span className={cn('size-1.5 rounded-full', cor.ponto)} aria-hidden />
              <Clock aria-hidden className="size-3" />
              {textoDoRelogio(minutos)}
            </>
          )}
        </span>
      </div>

      {conversa.previa && (
        <p className="text-muted-foreground truncate text-xs">{conversa.previa}</p>
      )}

      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        {conversa.valorDoNegocio != null && (
          <span className="text-xs tabular-nums">
            {formatadorBRL.format(conversa.valorDoNegocio)}
          </span>
        )}
        {conversa.etapaDoNegocio && (
          <span className="text-muted-foreground text-xs">{conversa.etapaDoNegocio}</span>
        )}
        {colisao && (
          <span className="text-xs text-amber-600 dark:text-amber-500">{colisao}</span>
        )}
      </div>
    </Link>
  )
}

/**
 * Quem está respondendo esta conversa agora, se não for você.
 *
 * Com três pessoas dividindo o atendimento, duas responderem o mesmo cliente é
 * o erro mais constrangedor possível diante dele. Não usa presença em tempo
 * real: é um carimbo que expira, o que cobre o caso real sem WebSocket.
 */
const MINUTOS_DE_COLISAO = 5

function quemEstaRespondendo(
  conversa: ConversaNaLista,
  usuarioId: string,
  nomes: Record<string, string>,
  agora: Date | null,
): string | null {
  if (!agora || !conversa.donoId || !conversa.assumidaEm) return null
  if (conversa.donoId === usuarioId) return null

  const desde = new Date(conversa.assumidaEm).getTime()
  if (Number.isNaN(desde)) return null
  if ((agora.getTime() - desde) / 60_000 > MINUTOS_DE_COLISAO) return null

  const nome = nomes[conversa.donoId]
  return nome ? `${nome} está respondendo` : 'Alguém está respondendo'
}

function Conversa({
  conversa,
  mensagens,
  agora,
  onVoltar,
  onAbrirDetalhe,
}: {
  conversa: ConversaNaLista
  mensagens: MensagemNaTela[]
  agora: Date | null
  onVoltar: () => void
  onAbrirDetalhe: () => void
}) {
  const router = useRouter()
  const [texto, setTexto] = React.useState('')
  const [enviando, setEnviando] = React.useState(false)
  const fim = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    fim.current?.scrollIntoView({ block: 'end' })
  }, [mensagens.length, conversa.id])

  async function enviar() {
    const limpo = texto.trim()
    if (!limpo || enviando) return

    setEnviando(true)
    const r = await enviarMensagem(conversa.id, limpo)
    setEnviando(false)

    if ('error' in r) {
      toast.error(r.error)
      return
    }
    // Só limpa em caso de sucesso: apagar o que a pessoa escreveu quando o
    // envio falhou faria ela redigitar tudo.
    setTexto('')
  }

  async function marcar() {
    const r = await marcarComoRespondida(conversa.id)
    if ('error' in r) return toast.error(r.error)
    toast.success('Marcada como respondida.')
  }

  async function arquivar() {
    const r = await arquivarConversa(conversa.id)
    if ('error' in r) return toast.error(r.error)
    toast.success('Conversa arquivada.')
    router.push('/conversas')
  }

  const minutos = agora ? minutosEsperando(conversa, agora) : null

  return (
    <>
      <header className="border-border/60 flex items-center gap-2 border-b px-3 py-2.5">
        <Button
          variant="ghost"
          size="icon-sm"
          className="md:hidden"
          onClick={onVoltar}
          aria-label="Voltar para a lista"
        >
          <ArrowLeft className="size-4" />
        </Button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{conversa.nome}</p>
          {minutos !== null && (
            <p className="text-muted-foreground text-xs">
              esperando há {textoDoRelogio(minutos)}
            </p>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          className="lg:hidden"
          onClick={onAbrirDetalhe}
          aria-label="Ver o negócio deste contato"
        >
          <Info className="size-4" />
        </Button>

        <Button variant="ghost" size="icon-sm" onClick={arquivar} aria-label="Arquivar conversa">
          <Archive className="size-4" />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-2">
          {mensagens.map((m) => (
            <Balao key={m.id} mensagem={m} />
          ))}
          <div ref={fim} />
        </div>
      </div>

      <div className="border-border/60 border-t p-3">
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              // Enter envia, Shift+Enter quebra linha. É como o WhatsApp se
              // comporta, e a régua é não ser mais lento que ele.
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void enviar()
              }
            }}
            placeholder="Escreva sua resposta"
            rows={1}
            className="max-h-32 min-h-11 resize-none"
            aria-label="Sua resposta"
          />
          <Button
            onClick={() => void enviar()}
            disabled={enviando || texto.trim().length === 0}
            size="icon"
            aria-label="Enviar"
          >
            {enviando ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </div>

        <button
          type="button"
          onClick={() => void marcar()}
          className="text-muted-foreground hover:text-foreground mx-auto mt-2 block text-xs underline underline-offset-4"
        >
          Já respondi pelo celular
        </button>
      </div>
    </>
  )
}

function Balao({ mensagem }: { mensagem: MensagemNaTela }) {
  const nossa = mensagem.direcao === 'enviada'
  const hora = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(mensagem.criadaEm))

  return (
    <div className={cn('flex', nossa ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'flex max-w-[85%] flex-col gap-0.5 rounded-xl px-3 py-2 text-sm',
          nossa ? 'bg-primary text-primary-foreground' : 'bg-muted',
          mensagem.status === 'falhou' && 'border-destructive border',
        )}
      >
        {mensagem.tipo === 'audio' ? (
          // O áudio ainda não toca aqui: baixar mídia depende do servidor de
          // WhatsApp, e o contrato dele é o que está mudando. Até lá a tela diz
          // a verdade em vez de fingir um player que não funciona.
          <span className="flex items-center gap-2">
            <Mic aria-hidden className="size-4 shrink-0" />
            Mensagem de voz
            {mensagem.midiaSegundos ? ` · ${mensagem.midiaSegundos}s` : ''}
          </span>
        ) : (
          <span className="break-words whitespace-pre-wrap">{mensagem.texto}</span>
        )}

        <span
          className={cn(
            'text-[10px] tabular-nums',
            nossa ? 'text-primary-foreground/70' : 'text-muted-foreground',
          )}
        >
          {hora}
          {mensagem.status === 'pendente' && ' · enviando'}
          {mensagem.status === 'falhou' && ' · não enviada'}
        </span>
      </div>
    </div>
  )
}

/**
 * A coluna que só um CRM consegue desenhar.
 *
 * O WhatsApp guarda a conversa e não guarda o cliente: ele não sabe quanto
 * vale esta negociação, em que etapa ela está, nem o que era para acontecer
 * depois. É por isso que esta tela não é "WhatsApp no navegador".
 */
function PainelDoNegocio({ conversa }: { conversa: ConversaNaLista }) {
  return (
    <div className="flex flex-col gap-4 overflow-y-auto p-4">
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs">Contato</span>
        <Link
          href={`/leads/${conversa.leadId}`}
          className="flex items-center gap-2 text-sm underline-offset-4 hover:underline"
        >
          <User aria-hidden className="size-4 shrink-0" />
          {conversa.nome}
        </Link>
        {conversa.telefone && (
          <span className="text-muted-foreground text-xs tabular-nums">{conversa.telefone}</span>
        )}
      </div>

      <Separator />

      {conversa.valorDoNegocio != null || conversa.etapaDoNegocio ? (
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">Negócio em aberto</span>
          {conversa.valorDoNegocio != null && (
            <span className="text-lg font-medium tabular-nums">
              {formatadorBRL.format(conversa.valorDoNegocio)}
            </span>
          )}
          {conversa.etapaDoNegocio && (
            <Badge variant="secondary" className="w-fit">
              {conversa.etapaDoNegocio}
            </Badge>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <span className="text-muted-foreground text-xs">
            Este contato não tem negócio em aberto.
          </span>
          <Button variant="outline" size="sm" className="w-fit" render={<Link href="/kanban" />}>
            Abrir o funil
          </Button>
        </div>
      )}
    </div>
  )
}
