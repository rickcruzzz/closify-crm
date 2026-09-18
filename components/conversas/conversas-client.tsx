'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import {
  FILTROS_VAZIOS,
  filtrarConversas,
  temFiltroAtivo,
  type Filtros,
} from '@/lib/conversas/filtrar'
import { toast } from 'sonner'
import {
  Archive,
  ArrowLeft,
  Clock,
  Info,
  Loader2,
  Mic,
  Send,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { EmptyState } from '@/components/ui/empty-state'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { IconeWhatsapp } from '@/components/ui/icone-whatsapp'
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
import { iniciais } from '@/lib/leads/iniciais'
import { cn } from '@/lib/utils'
import {
  AVISO_DE_MIGRACAO,
  podeConectarWhatsapp,
} from '@/lib/integrations/whatsapp-estado'

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
 * chat é perder. O que o WhatsApp não sabe: quanto vale esta conversa, em que
 * etapa está o negócio, e o que era para acontecer depois.
 *
 * ## A escada de superfícies, e o erro que o primeiro corte cometeu
 *
 * O projeto tem uma escada no modo escuro, documentada em `globals.css`:
 * fundo 0.17, sidebar 0.195, card 0.215. A regra é "a navegação recua, o
 * conteúdo avança".
 *
 * A primeira versão desta tela pôs as TRÊS colunas em `--background`, o degrau
 * mais baixo, três vezes. O resultado foi um bloco só de preto, sem nenhuma
 * pista de que as colunas são coisas diferentes além do contorno de 1px.
 *
 * Agora cada coluna assume o papel que tem:
 *
 *     lista       bg-sidebar   é navegação: recua
 *     conversa    bg-card      é conteúdo: avança
 *     negócio     bg-sidebar   é apoio: recua
 *
 * Sem sombra, de propósito: `globals.css:208` anula a sombra do card no escuro,
 * porque sombra preta sobre fundo escuro não desenha profundidade, só suja.
 *
 * ## A régua que decide se a tela será usada
 *
 * 34% dos brasileiros mantêm o WhatsApp aberto o dia inteiro. **Se responder
 * por aqui for mais lento que abrir o WhatsApp, ninguém usa.** Por isso não há
 * modelo para escolher, categoria para marcar nem campo para preencher antes
 * de enviar. Abrir, ler, responder.
 */

/**
 * A cor de cada urgência.
 *
 * O relógio é o único número desta tela que decide dinheiro, e na primeira
 * versão ele era texto de 12px na cor `muted` — o elemento MENOS visível da
 * linha. Virou pastilha com fundo, que é o que o olho encontra primeiro.
 */
const CORES: Record<Urgencia, string> = {
  // Sem pastilha: quem já foi respondido não é problema, e pintar tudo faz
  // nada chamar atenção.
  respondida: 'text-muted-foreground',
  tranquila: 'text-muted-foreground bg-muted/60',
  atencao: 'text-amber-700 dark:text-amber-400 bg-amber-500/15',
  urgente: 'text-red-700 dark:text-red-400 bg-red-500/15',
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
   * ficaria congelado até a próxima navegação, que é o oposto do que a tela
   * promete. Antes do primeiro tick não há relógio nenhum: renderizar com a
   * hora do servidor causaria descasamento de hidratação, defeito que já pegou
   * o calendário deste projeto.
   */
  const [agora, setAgora] = React.useState<Date | null>(null)
  React.useEffect(() => {
    setAgora(new Date())
    const t = setInterval(() => setAgora(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const ordenadas = React.useMemo(() => ordenarPorEspera(conversas), [conversas])

  const [filtros, setFiltros] = React.useState<Filtros>(FILTROS_VAZIOS)
  const visiveis = React.useMemo(
    () => filtrarConversas(ordenadas, filtros, usuarioId),
    [ordenadas, filtros, usuarioId],
  )

  /**
   * A conversa aberta sai de `ordenadas` e NÃO de `visiveis`.
   *
   * Filtrar é uma lente sobre a lista, não uma navegação. Ler daqui faria a
   * conversa desaparecer da tela no instante em que a pessoa digitasse algo que
   * não casasse com ela — no meio de uma resposta, com o texto já escrito.
   */
  const aberta = ordenadas.find((c) => c.id === conversaAberta) ?? null

  const [detalheAberto, setDetalheAberto] = React.useState(false)

  if (conversas.length === 0) {
    return (
      <EmptyState
        icon={IconeWhatsapp}
        title={podeConectarWhatsapp() ? 'Nenhuma conversa ainda' : AVISO_DE_MIGRACAO.titulo}
        description={
          podeConectarWhatsapp()
            ? 'Quando um cliente mandar mensagem no WhatsApp, ela aparece aqui com o negócio dele do lado. Conecte o WhatsApp em Configurações, WhatsApp.'
            : `${AVISO_DE_MIGRACAO.detalhe} Esta tela já está pronta: assim que a aprovação sair, as conversas aparecem aqui com o negócio de cada cliente do lado.`
        }
      />
    )
  }

  return (
    <div className="border-border/60 bg-card flex h-[calc(100vh-11rem)] overflow-hidden rounded-xl border">
      {/* ─────────────────────────── coluna 1: quem espera ─────────────── */}
      <aside
        className={cn(
          'border-border/60 bg-sidebar flex w-full flex-col border-r',
          'md:w-80 lg:w-96',
          // No telefone a lista some quando uma conversa está aberta: duas
          // colunas em 390px não cabem, e meia lista ao lado de meia conversa
          // deixa as duas inúteis.
          aberta && 'hidden md:flex',
        )}
      >
        <BarraDeFiltro
          filtros={filtros}
          onMudar={setFiltros}
          total={ordenadas.length}
          visiveis={visiveis.length}
        />
        <ListaDeConversas
          conversas={visiveis}
          abertaId={conversaAberta}
          agora={agora}
          usuarioId={usuarioId}
          nomesPorUsuario={nomesPorUsuario}
        />
      </aside>

      {/* ─────────────────────────── coluna 2: a conversa ───────────────── */}
      <section className={cn('bg-card flex flex-1 flex-col', !aberta && 'hidden md:flex')}>
        {aberta ? (
          <Conversa
            conversa={aberta}
            mensagens={mensagens}
            agora={agora}
            onVoltar={() => router.push('/conversas')}
            onAbrirDetalhe={() => setDetalheAberto(true)}
          />
        ) : (
          <NadaEscolhido conversas={ordenadas} agora={agora} />
        )}
      </section>

      {/* ─────────────────────────── coluna 3: o negócio ────────────────── */}
      {aberta && (
        <aside className="border-border/60 bg-sidebar hidden w-72 flex-col border-l lg:flex">
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

/**
 * Busca e os dois filtros que respondem as perguntas do dia.
 *
 * ## Dois, e não sete
 *
 * "Não lidas" e "minhas" cobrem as duas perguntas que aparecem o tempo todo:
 * *o que falta atender* e *o que é meu*. Filtro por etapa, por valor e por
 * período existiriam e ninguém usaria — e cada um a mais é um controle que a
 * pessoa precisa ler antes de achar o que procura.
 *
 * É a mesma lição de `/dono/alertas`, onde 8 de 11 alertas eram ruído e o
 * efeito foi ninguém mais olhar a fila inteira.
 *
 * ## O contador só aparece quando FILTRA
 *
 * Sem filtro, "200 de 200" é ruído. Com filtro, "3 de 200" é a informação que
 * impede a leitura errada mais comum desta tela: uma lista curta que parece
 * "acabaram as conversas" quando o que houve foi uma busca esquecida ligada.
 */
function BarraDeFiltro({
  filtros,
  onMudar,
  total,
  visiveis,
}: {
  filtros: Filtros
  onMudar: (f: Filtros) => void
  total: number
  visiveis: number
}) {
  const ativo = temFiltroAtivo(filtros)

  return (
    <div className="border-border/60 flex flex-col gap-2 border-b p-3">
      <Input
        value={filtros.busca}
        onChange={(e) => onMudar({ ...filtros, busca: e.target.value })}
        placeholder="Buscar por nome, telefone ou mensagem"
        aria-label="Buscar conversa"
        className="h-9"
      />

      <div className="flex flex-wrap items-center gap-1.5">
        <Chip
          ligado={filtros.apenasEsperando}
          onClick={() =>
            onMudar({ ...filtros, apenasEsperando: !filtros.apenasEsperando })
          }
        >
          Esperando
        </Chip>
        <Chip
          ligado={filtros.apenasMinhas}
          onClick={() => onMudar({ ...filtros, apenasMinhas: !filtros.apenasMinhas })}
        >
          Minhas
        </Chip>

        {ativo && (
          <>
            <span className="text-muted-foreground ml-auto text-xs tabular-nums">
              {visiveis} de {total}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onMudar(FILTROS_VAZIOS)}
            >
              Limpar
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Um filtro que liga e desliga.
 *
 * `aria-pressed` e não `role="checkbox"`: para o leitor de tela isto é um botão
 * que fica pressionado, que é exatamente o que ele é. Mesmo padrão dos cartões
 * de ciclo em `subscribe-button.tsx`.
 *
 * `min-h-11` no telefone e compacto no desktop: a regra de alvo de toque de 44px
 * vale onde o dedo alcança, e uma barra de filtro com 44px de altura no desktop
 * comeria a lista que ela existe para ajudar a ler.
 */
function Chip({
  ligado,
  onClick,
  children,
}: {
  ligado: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={ligado}
      onClick={onClick}
      className={cn(
        'min-h-11 rounded-full border px-3 text-xs transition-colors md:min-h-0 md:py-1',
        ligado
          ? 'border-primary bg-primary/10 text-foreground'
          : 'border-border text-muted-foreground hover:border-foreground/20',
      )}
    >
      {children}
    </button>
  )
}

/**
 * O que aparece antes de escolher uma conversa.
 *
 * A primeira versão era uma linha cinza dizendo "Escolha uma conversa à
 * esquerda" — instrução óbvia ocupando a maior área da tela. Agora responde a
 * pergunta que trouxe a pessoa aqui: quantas esperam, e há quanto tempo a
 * mais antiga espera.
 */
function NadaEscolhido({
  conversas,
  agora,
}: {
  conversas: ConversaNaLista[]
  agora: Date | null
}) {
  const esperando = conversas.filter((c) => c.ultimoRecebidoEm && !c.respondidaEm)
  const maisAntiga = esperando[0]
  const minutos = agora && maisAntiga ? minutosEsperando(maisAntiga, agora) : null

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      {/* ## Verde AQUI, e `currentColor` no menu, e a distincao nao e capricho

          `icone-whatsapp.ts` registra por que o glifo herda a cor do texto: na
          barra lateral ele fica ao lado de seis irmaos, e um verde de marca
          gritaria acima de todos alem de brigar com o fundo do estado ativo.

          Aqui e o oposto. E o unico elemento de uma tela vazia, nao tem com
          quem competir, e a cor e o que faz a pessoa reconhecer de relance de
          qual aplicativo a tela fala. Um balao cinza generico nao diz nada, e
          e o mesmo balao que o lucide da para "Conversas". */}
      <IconeWhatsapp aria-hidden className="size-10 text-[#25D366]/70" />

      {esperando.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Ninguém está esperando resposta agora.
        </p>
      ) : (
        <>
          <p className="text-titulo-sm">
            {esperando.length}{' '}
            {esperando.length === 1 ? 'pessoa esperando' : 'pessoas esperando'}
          </p>
          {minutos !== null && (
            <p className="text-muted-foreground max-w-xs text-sm text-balance">
              A mais antiga espera há {textoDoRelogio(minutos)}. Comece por ela: é
              quem está mais perto de desistir.
            </p>
          )}
        </>
      )}
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
      <div className="border-border/60 flex items-center justify-between gap-2 border-b px-4 py-3">
        <span className="text-sm font-medium">Quem está esperando</span>
        {esperando.length > 0 && (
          <Badge variant="secondary" className="tabular-nums">
            {esperando.length}
          </Badge>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* ## Lista vazia com filtro ligado NÃO pode ser silêncio
            Vazio lê-se como "acabaram as conversas", e a verdade é "nenhuma
            casa com o que está ligado". As duas pedem ações opostas: parar de
            trabalhar, ou limpar o filtro. É a mesma distinção que o painel de
            inteligência faz entre "não deu nada" e "ainda não dá para saber". */}
        {conversas.length === 0 && (
          <p className="text-muted-foreground p-4 text-sm leading-relaxed">
            Nenhuma conversa com esse filtro. Limpe a busca para ver todas.
          </p>
        )}

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
          <div className="text-muted-foreground bg-sidebar/60 border-border/60 sticky top-0 border-y px-4 py-1.5 text-xs font-medium">
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
  const minutos = agora ? minutosEsperando(conversa, agora) : null
  const urgencia = agora ? urgenciaDaConversa(conversa, agora) : 'respondida'

  const colisao = quemEstaRespondendo(conversa, usuarioId, nomesPorUsuario, agora)

  return (
    <Link
      href={`/conversas?c=${conversa.id}`}
      // `min-h-16`: acima dos 44px mínimos de alvo de toque, e a linha tem três
      // informações empilhadas que precisam caber sem apertar.
      className={cn(
        'border-border/60 flex min-h-16 items-start gap-3 border-b px-3 py-3 transition-colors',
        'hover:bg-card/60 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
        // A conversa ativa sobe um degrau na escada, para o lado esquerdo
        // apontar o que está aberto à direita sem precisar de barra colorida.
        ativa && 'bg-card',
      )}
    >
      <Avatar size="sm" className="mt-0.5">
        {/* A foto primeiro, as iniciais como reserva. `AvatarImage` do Base UI
            so troca depois que a imagem CARREGA, entao uma URL assinada que
            venceu ou um arquivo que sumiu caem nas iniciais sozinhos, sem
            buraco na lista. */}
        {conversa.fotoUrl ? <AvatarImage src={conversa.fotoUrl} alt="" /> : null}
        <AvatarFallback>{iniciais(conversa.nome)}</AvatarFallback>
      </Avatar>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium">{conversa.nome}</span>

          {minutos !== null && (
            <span
              className={cn(
                'flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums',
                CORES[urgencia],
              )}
            >
              <Clock aria-hidden className="size-3" />
              {textoDoRelogio(minutos)}
            </span>
          )}
        </div>

        {conversa.previa && (
          <p className="text-muted-foreground truncate text-xs">{conversa.previa}</p>
        )}

        {(conversa.valorDoNegocio != null || conversa.etapaDoNegocio || colisao) && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {conversa.valorDoNegocio != null && (
              <span className="text-xs font-medium tabular-nums">
                {formatadorBRL.format(conversa.valorDoNegocio)}
              </span>
            )}
            {conversa.etapaDoNegocio && (
              <span className="text-muted-foreground text-xs">
                {rotuloDaEtapa(conversa.etapaDoNegocio)}
              </span>
            )}
            {colisao && (
              <span className="text-xs text-amber-700 dark:text-amber-400">{colisao}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}

/**
 * O nome da etapa em português.
 *
 * O enum do banco é `proposta_enviada`; o cliente lê "Proposta enviada". A
 * tradução mora aqui e não no banco porque a coluna precisa continuar sendo o
 * enum, que é o que as regras leem.
 */
function rotuloDaEtapa(etapa: string): string {
  return (
    {
      novo: 'Novo',
      contato_realizado: 'Contato feito',
      proposta_enviada: 'Proposta enviada',
      negociacao: 'Negociação',
      fechado_ganho: 'Ganho',
      fechado_perdido: 'Perdido',
    }[etapa] ?? etapa
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
  const urgencia = agora ? urgenciaDaConversa(conversa, agora) : 'respondida'

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

        <Avatar size="sm" className="hidden sm:flex">
          {/* A foto primeiro, as iniciais como reserva. `AvatarImage` do Base UI
            so troca depois que a imagem CARREGA, entao uma URL assinada que
            venceu ou um arquivo que sumiu caem nas iniciais sozinhos, sem
            buraco na lista. */}
        {conversa.fotoUrl ? <AvatarImage src={conversa.fotoUrl} alt="" /> : null}
        <AvatarFallback>{iniciais(conversa.nome)}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{conversa.nome}</p>
          {minutos !== null && (
            <p
              className={cn(
                'text-xs',
                urgencia === 'urgente'
                  ? 'text-red-700 dark:text-red-400'
                  : urgencia === 'atencao'
                    ? 'text-amber-700 dark:text-amber-400'
                    : 'text-muted-foreground',
              )}
            >
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

      {/* `justify-end` no contêiner: com poucas mensagens elas ficam coladas no
          campo de resposta, e não flutuando no topo de um vazio enorme — que é
          como a primeira versão desenhava e ficou evidente no primeiro print.
          Conversa se lê de baixo para cima. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <div className="mx-auto flex min-h-full max-w-2xl flex-col justify-end gap-2">
          {mensagens.map((m, i) => (
            <React.Fragment key={m.id}>
              {precisaDeSeparador(mensagens, i) && (
                <SeparadorDeData iso={m.criadaEm} />
              )}
              <Balao mensagem={m} />
            </React.Fragment>
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

/**
 * Precisa de separador de data antes desta mensagem?
 *
 * Sem ele, uma mensagem de terça cola na de hoje e a pessoa não sabe se aquele
 * "quanto fica?" foi agora ou semana passada — que é exatamente a informação
 * que decide o tom da resposta.
 */
function precisaDeSeparador(mensagens: MensagemNaTela[], i: number): boolean {
  if (i === 0) return true
  return diaDe(mensagens[i]!.criadaEm) !== diaDe(mensagens[i - 1]!.criadaEm)
}

/** O dia em São Paulo, como `2026-08-25`. O servidor roda em UTC. */
function diaDe(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}

function SeparadorDeData({ iso }: { iso: string }) {
  const hoje = diaDe(new Date().toISOString())
  const ontem = diaDe(new Date(Date.now() - 86400000).toISOString())
  const dia = diaDe(iso)

  const rotulo =
    dia === hoje
      ? 'Hoje'
      : dia === ontem
        ? 'Ontem'
        : new Intl.DateTimeFormat('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            day: 'numeric',
            month: 'long',
          }).format(new Date(iso))

  return (
    <div className="my-2 flex items-center gap-3">
      <div className="border-border/60 h-px flex-1 border-t" />
      <span className="text-muted-foreground text-xs">{rotulo}</span>
      <div className="border-border/60 h-px flex-1 border-t" />
    </div>
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
          // A mensagem do cliente vai em `muted`, um degrau ACIMA do card em
          // que ela está: é o que a separa do fundo sem precisar de contorno.
          nossa ? 'bg-primary text-primary-foreground' : 'bg-muted',
          mensagem.status === 'falhou' && 'border-destructive border',
        )}
      >
        {mensagem.tipo === 'audio' ? (
          // O áudio ainda não toca: baixar mídia depende do servidor de
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
 * O prazo da próxima ação, por extenso e no fuso de São Paulo.
 *
 * `timeZone` explícito e não o do navegador: o servidor roda em UTC, e às 21h
 * de São Paulo já é o dia seguinte lá. Sem isto, uma tarefa marcada para hoje à
 * noite apareceria com a data de amanhã — o mesmo defeito que `diaEmSaoPaulo`
 * fechou para as telas de tarefa em 12/08.
 *
 * Data EXATA e não "em 2 dias": o Kanban trocou o relativo pelo absoluto em
 * 16/09, e a razão vale igual aqui. "Amanhã" obriga quem lê a calcular contra
 * um relógio que ela não vê.
 */
function dataDoPrazo(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(new Date(iso))
    .replace(/\./g, '')
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
      <div className="flex items-center gap-3">
        <Avatar>
          {/* A foto primeiro, as iniciais como reserva. `AvatarImage` do Base UI
            so troca depois que a imagem CARREGA, entao uma URL assinada que
            venceu ou um arquivo que sumiu caem nas iniciais sozinhos, sem
            buraco na lista. */}
        {conversa.fotoUrl ? <AvatarImage src={conversa.fotoUrl} alt="" /> : null}
        <AvatarFallback>{iniciais(conversa.nome)}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col">
          <Link
            href={`/leads/${conversa.leadId}`}
            className="truncate text-sm font-medium underline-offset-4 hover:underline"
          >
            {conversa.nome}
          </Link>
          {conversa.telefone && (
            <span className="text-muted-foreground text-xs tabular-nums">
              {conversa.telefone}
            </span>
          )}
        </div>
      </div>

      <Separator />

      {/* ## A próxima ação vem ANTES do valor, e a ordem é a decisão
          O valor responde "quanto está em jogo"; a próxima ação responde "o que
          eu faço agora", que é a pergunta de quem abriu a conversa. Um CRM que
          mostra o dinheiro e esconde o compromisso é um relatório, não uma
          ferramenta de trabalho. */}
      {conversa.proximaAcao ? (
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">Próxima ação</span>
          <span className="text-sm leading-snug">{conversa.proximaAcao.titulo}</span>
          {conversa.proximaAcao.prazo && (
            <span className="text-muted-foreground text-xs tabular-nums">
              {dataDoPrazo(conversa.proximaAcao.prazo)}
            </span>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {/* "Sem próxima ação" e não silêncio: o card do Kanban já trata a
              ausência como alerta desde 16/09, porque 96% dos negócios abertos
              não tinham nenhuma. Aqui vale o mesmo — a conversa sem compromisso
              é a que se perde. */}
          <span className="text-muted-foreground text-xs">Sem próxima ação marcada</span>
          <Button
            variant="outline"
            size="sm"
            className="w-fit"
            render={<Link href={`/leads/${conversa.leadId}`} />}
          >
            Marcar o próximo passo
          </Button>
        </div>
      )}

      <Separator />

      {conversa.valorDoNegocio != null || conversa.etapaDoNegocio ? (
        <div className="flex flex-col gap-2">
          <span className="text-muted-foreground text-xs">Negócio em aberto</span>
          {conversa.valorDoNegocio != null && (
            // O valor é a informação mais forte desta coluna: é ele que diz o
            // que está em jogo naquela conversa, e precisa ser lido antes do
            // resto.
            <span className="text-titulo-sm tabular-nums">
              {formatadorBRL.format(conversa.valorDoNegocio)}
            </span>
          )}
          {conversa.etapaDoNegocio && (
            <Badge variant="secondary" className="w-fit">
              {rotuloDaEtapa(conversa.etapaDoNegocio)}
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
