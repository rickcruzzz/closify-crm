'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  AlarmClock,
  CalendarPlus,
  Loader2,
  Plus,
  Trash2,
  ExternalLink,
} from 'lucide-react'

import { dealStageLabels, dealStages, type DealStage } from '@/lib/deals/types'
import type { DealRow, DealLeadRow } from '@/lib/deals/queries'
import { OrcamentoDoNegocio } from '@/components/kanban/orcamento-do-negocio'
import type { WorkspaceMember } from '@/lib/leads/queries'
import type { ProximaAcaoRow } from '@/lib/tasks/types'
import type { TaskFormValues } from '@/lib/validations/task'
import { criarTarefa, concluirTarefa } from '@/lib/tasks/actions'
import { agendarReuniaoNoGoogleCalendar } from '@/lib/integrations/workflow-actions'
import { deleteDeal } from '@/lib/deals/actions'
import { estadoDeMovimento } from '@/lib/deals/parado'
import { dataExata } from '@/lib/kanban/data-exata'
import { processando } from '@/lib/ui/estado-assincrono'
import { ProximaAcao } from '@/components/kanban/proxima-acao'
import { EscolherProximaAcao } from '@/components/tasks/escolher-proxima-acao'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button, buttonVariants } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { iniciais } from '@/lib/leads/iniciais'

function formatDate(date: string | null) {
  if (!date) return 'Sem data'
  return new Date(date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export function DealDetailSheet({
  deal,
  lead,
  proximaAcao,
  members,
  currentUserId,
  calendarConectado,
  open,
  abrirAgendamento = false,
  onAgendamentoAberto,
  onOpenChange,
  onStageChange,
  onDeleted,
}: {
  deal: DealRow | undefined
  lead: DealLeadRow | undefined
  proximaAcao: ProximaAcaoRow | undefined
  members: WorkspaceMember[]
  currentUserId: string
  /** Se dá pra oferecer "mandar pro Google Calendar", vem de Integrações. */
  calendarConectado: boolean
  open: boolean
  /**
   * Abrir já com o agendamento na tela.
   *
   * Vem do aviso "Sem próximo passo" do card: quem clicou ali já disse o que
   * quer fazer, e obrigar a achar o botão de agendar aqui dentro é o passo a
   * mais que mantém 96% dos negócios abertos sem próxima ação.
   */
  abrirAgendamento?: boolean
  /** Avisa o board para baixar a flag, senão reabrir o mesmo negócio pelo
   *  card cairia no agendamento de novo sem ninguém pedir. */
  onAgendamentoAberto?: () => void
  onOpenChange: (open: boolean) => void
  onStageChange: (dealId: string, stage: DealStage) => void
  /** Avisa o board para tirar o card sem esperar o refresh do servidor. */
  onDeleted: (dealId: string) => void
}) {
  const [confirmando, setConfirmando] = React.useState(false)
  const [excluindo, setExcluindo] = React.useState(false)
  const [agendando, setAgendando] = React.useState(false)

  // Abre o agendamento quando o painel foi chamado pelo aviso do card. Espera
  // `open` para não disparar com o painel ainda fechado, e avisa o board para
  // baixar a flag no mesmo passo.
  React.useEffect(() => {
    if (!open || !abrirAgendamento) return
    setAgendando(true)
    onAgendamentoAberto?.()
  }, [open, abrirAgendamento, onAgendamentoAberto])
  const [agendandoNoCalendario, setAgendandoNoCalendario] = React.useState(false)
  /**
   * O link do evento no Google, para quem acabou de cria-lo.
   *
   * `agendarReuniaoNoGoogleCalendar` ja devolvia `htmlLink` — o Google o manda
   * na resposta — e a tela DESCARTAVA: ele so aparecia dentro do texto da
   * atividade na timeline do contato. Quem clicava em "Google Calendar" via um
   * toast e nao tinha como abrir o que criou.
   *
   * **Limite conhecido, e nao e defeito:** nada em `tasks` guarda o id do
   * evento, entao o link vive so nesta sessao do painel. Fechar e reabrir traz
   * o botao de criar de volta. Guardar o id exige migration e tratar
   * `PATCH`/`DELETE` no Google, que e rodada propria — e sem ela mudar o prazo
   * da tarefa TAMBEM nao move o evento la, que e o problema maior dos dois.
   */
  const [linkDoEvento, setLinkDoEvento] = React.useState<string | null>(null)
  /**
   * A tarefa QUE ESTÁ SENDO concluída, não um "está concluindo".
   *
   * Um booleano só sabe que algo está em voo, e nada pode invalidá-lo — nem o
   * próprio dado que ele descrevia. Guardando o id, o sinal para de valer
   * sozinho quando outra tarefa assume a próxima ação. Ver
   * `lib/ui/estado-assincrono.ts` para o defeito medido.
   */
  const [concluindoId, setConcluindoId] = React.useState<string | null>(null)
  const concluindo = processando(concluindoId, proximaAcao?.id)

  // Relógio do cliente: o servidor roda em UTC e erraria a virada do dia.
  const [agora, setAgora] = React.useState<Date | null>(null)

  React.useEffect(() => {
    setAgora(new Date())
  }, [])

  const movimento = agora && deal ? estadoDeMovimento(deal, agora) : null

  async function agendar(values: TaskFormValues) {
    const resultado = await criarTarefa(values)

    if ('error' in resultado) {
      toast.error(resultado.error)
      return
    }

    toast.success('Próxima ação agendada.')
    // Sem router.refresh(): criarTarefa já revalida '/kanban', a rota
    // atual,, e o Next aplica o RSC atualizado sozinho na resposta da
    // própria Server Action.
  }

  async function adicionarAoCalendario() {
    if (!proximaAcao) return
    setAgendandoNoCalendario(true)
    const resultado = await agendarReuniaoNoGoogleCalendar(proximaAcao.id)
    setAgendandoNoCalendario(false)

    if ('error' in resultado) {
      toast.error(resultado.error)
      return
    }

    setLinkDoEvento(resultado.htmlLink ?? null)
    toast.success('Evento criado no Google Calendar.', {
      // A acao no toast e o caminho de quem quer conferir AGORA; o botao que
      // troca de papel logo abaixo atende quem so percebe depois.
      action: resultado.htmlLink
        ? {
            label: 'Abrir',
            onClick: () => window.open(resultado.htmlLink, '_blank', 'noopener'),
          }
        : undefined,
    })
    // Idem: a action já revalida '/kanban'.
  }

  async function concluir() {
    if (!proximaAcao || concluindo) return
    const alvo = proximaAcao.id
    setConcluindoId(alvo)

    let resultado
    try {
      resultado = await concluirTarefa(alvo)
    } catch (err) {
      // Server Action rejeitada — queda de rede é o caminho comum de quem usa
      // CRM no celular. Sem este `catch`, a promessa rejeitava, o `setState`
      // seguinte nunca rodava, e o botão ficava girando sem nada ter sido
      // gravado.
      console.error('concluir falhou', err)
      setConcluindoId(null)
      toast.error('Sem conexão para concluir agora. Tente de novo.')
      return
    }

    if ('error' in resultado) {
      setConcluindoId(null)
      toast.error(resultado.error)
      return
    }

    // ## Concluir devolvia o negócio ao alarme, sem oferecer a saída
    //
    // Relatado pelo dono com print: agenda, conclui, e a tela volta a dizer
    // "Nada marcado para este negócio" — com o card virando "Sem próximo
    // passo" no board ao lado. Tecnicamente certo: a única tarefa acabou de
    // ser fechada, logo não há próxima. E é exatamente aí que este produto
    // não pode calar.
    //
    // A tese inteira é que o orçamento morre quando ninguém marca o retorno.
    // Quem acabou de concluir o follow-up está no ÚNICO instante em que sabe
    // o que vem depois — e era o instante em que o produto tirava o assunto
    // da frente dela e trocava por um aviso vermelho.
    //
    // A oferta vai no toast, e não num diálogo que abre sozinho: quem fecha
    // cinco tarefas seguidas em `/hoje` não pode levar cinco diálogos na
    // cara. Um clique para quem quer, zero atrito para quem não quer, e o
    // botão "Agendar" continua onde sempre esteve para quem perceber depois.
    toast.success('Tarefa concluída.', {
      // Mais longo que o padrão de propósito: a decisão de marcar o próximo
      // passo não cabe nos 4s de um aviso de "deu certo".
      duration: 8000,
      action: {
        label: 'Marcar a próxima',
        onClick: () => setAgendando(true),
      },
    })
    // `concluirTarefa` já revalida '/kanban'.
    //
    // O id continua guardado de propósito: entre a Server Action resolver e o
    // RSC revalidado chegar existe uma janela real em que um segundo clique
    // dispara tudo de novo — medido com clique duplo real, 908ms de
    // intervalo. Enquanto a próxima ação for ESTA tarefa, o botão segue
    // travado.
    //
    // O que mudou é que agora ele se destrava sozinho: assim que outra tarefa
    // assume (ou o bloco vira o estado vazio), `processando` deixa de casar o
    // id e o botão volta. Antes disso, com um booleano, o spinner ficava para
    // sempre — foi o defeito que o dono viu.
  }

  async function handleExcluir() {
    if (!deal) return
    setExcluindo(true)
    const r = await deleteDeal(deal.id)
    setExcluindo(false)

    if (r?.error) {
      toast.error(r.error)
      return
    }

    toast.success('Negócio excluído.')
    setConfirmando(false)
    onOpenChange(false)
    onDeleted(deal.id)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        {deal && (
          <>
            {/* `shrink-0` no cabeçalho e no rodapé, rolagem só no miolo.
                Sem isso o painel inteiro cresce com o conteúdo e o rodapé sai
                da tela: `SheetContent` é `flex flex-col h-full` e não declara
                `overflow`, então o que não cabe vaza em vez de rolar.
                Acontecia em qualquer negócio com orçamento — o bloco do PDF e
                o da próxima ação somam ~200px, e em janela de notebook (800px
                ou menos) "Excluir negócio" e "Fechar" ficavam inalcançáveis. */}
            <SheetHeader className="shrink-0">
              <SheetTitle>{deal.title}</SheetTitle>
              {lead && <SheetDescription>{lead.company}</SheetDescription>}
            </SheetHeader>

            {/* `min-h-0` junto do `flex-1` não é redundância: item de flex tem
                `min-height: auto` por padrão, o que o impede de encolher abaixo
                do conteúdo — e aí `overflow-y-auto` nunca chega a rolar, porque
                a caixa cresce em vez de cortar. */}
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4">
              <div>
                <span className="text-muted-foreground text-xs">Valor do negócio</span>
                {/* Aqui o valor vai CHEIO, sem abreviar: o painel tem largura
                    de sobra e é onde a pessoa confere o número de verdade. O
                    card é que abrevia, porque lá o espaço é disputado. */}
                <p className="text-xl font-semibold">
                  {deal.value.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </p>
              </div>

              <Separator />

              <div>
                <span className="text-muted-foreground text-xs">Etapa</span>
                <Select
                  value={deal.stage}
                  onValueChange={(value) => onStageChange(deal.id, value as DealStage)}
                >
                  <SelectTrigger className="mt-1 w-full">
                    <SelectValue>
                      {(value) => dealStageLabels[value as DealStage]}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {dealStages.map((stage) => (
                      <SelectItem key={stage} value={stage}>
                        {dealStageLabels[stage]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <span className="text-muted-foreground text-xs">Próxima ação</span>

                {proximaAcao ? (
                  <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">
                        {proximaAcao.title}
                      </span>
                      <ProximaAcao task={proximaAcao} />
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {/* Ícone sozinho, antes, dependia só do `title` (tooltip)
                          pra alguém entender o que o botão faz, igual ao
                          Gmail (`lead-detail-client.tsx`) já é ícone + texto,
                          este passa a ser também. */}
                      {/* ## Um botao, dois papeis

                          Antes de agendar ele cria; depois de agendar ele abre
                          o que foi criado. Dois botoes lado a lado fariam
                          alguem criar o MESMO evento duas vezes, que e o erro
                          que nao tem desfazer aqui — o evento duplicado vai
                          para a agenda de quem foi convidado. */}
                      {linkDoEvento ? (
                        <a
                          href={linkDoEvento}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            buttonVariants({ variant: 'outline', size: 'sm' }),
                            'flex-1 sm:flex-initial',
                          )}
                        >
                          <ExternalLink className="size-4" />
                          Abrir no Google Calendar
                        </a>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 sm:flex-initial"
                          disabled={agendandoNoCalendario}
                          onClick={adicionarAoCalendario}
                        >
                          {agendandoNoCalendario ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <CalendarPlus className="size-4" />
                          )}
                          Google Calendar
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 sm:flex-initial"
                        disabled={concluindo}
                        onClick={concluir}
                      >
                        {concluindo && <Loader2 className="size-4 animate-spin" />}
                        Concluir
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      {/* "Nenhuma agendada." era a raiz da confusão relatada:
                          lida como "não há tarefa", quando significa "não há
                          tarefa NESTE negócio" — o contato podia ter várias. A
                          frase que nomeia o escopo deixa de contradizer o que a
                          pessoa acabou de ver na página do contato. */}
                      <span className="text-muted-foreground text-sm">
                        Nada marcado para este negócio.
                      </span>
                      {/* ## O botão ganha destaque quando o negócio está parado

                          `outline` em todo caso tratava dois estados muito
                          diferentes do mesmo jeito: um negócio que mudou de
                          etapa hoje e não precisa de nada, e um parado há
                          semanas sem ninguém marcado para voltar nele.

                          O segundo é o caso que este produto existe para
                          resolver, e era onde a tela dizia "parado há 2
                          semanas" em vermelho e oferecia a saída em cinza
                          apagado — o alarme e o remédio com pesos invertidos.

                          Só muda de variante, não de posição nem de tamanho:
                          o botão não pula de lugar quando o negócio envelhece,
                          e quem já conhece a tela continua achando no mesmo
                          ponto. */}
                      <Button
                        variant={movimento?.parado ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setAgendando(true)}
                      >
                        <Plus className="size-4" />
                        Agendar
                      </Button>
                    </div>
                    {/* Só quando o Calendar está conectado, sem isso a dica
                        prometeria um botão que ainda não vai aparecer depois
                        de agendar. Prepara quem tá vendo pela primeira vez:
                        quando o botão de verdade surgir (depois de agendar),
                        já não é surpresa. */}
                    {calendarConectado && (
                      <p className="text-muted-foreground text-xs">
                        Depois de agendar, dá pra mandar direto pro Google Calendar.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Há quanto tempo o negócio não muda de etapa. Fica aqui e não
                  no card: lá já mora a próxima ação, e duas datas competindo
                  fazem a pessoa não saber qual obedecer, a mesma razão pela
                  qual o prazo saiu de lá. */}
              <div>
                <span className="text-muted-foreground text-xs">Movimento</span>
                {movimento === null ? (
                  <p className="text-muted-foreground text-sm">Calculando…</p>
                ) : (
                  /* ## A data exata, parado ou não

                     Aqui cabe a forma LONGA — o painel tem 400px, contra os
                     288 do card. Mesma ordem, mesmo separador, mesmos campos:
                     é isso que faz as duas serem a mesma convenção, e não duas.

                     As três frases relativas que saíram daqui ("Mudou de etapa
                     hoje", "ontem", "Na mesma etapa há N dias") eram o mesmo
                     defeito das do card, com o agravante de que este painel é
                     onde a pessoa decide o que fazer com o negócio.

                     O ESTADO continua visível e continua vermelho quando é
                     parado: `estadoDeMovimento` não mudou, `AlarmClock` e a
                     cor não mudaram. O que saiu foi a contagem. */
                  <p
                    className={cn(
                      'flex items-center gap-1.5 text-sm',
                      movimento.parado && 'text-destructive font-medium',
                    )}
                  >
                    {movimento.parado && (
                      <AlarmClock aria-hidden className="size-4 shrink-0" />
                    )}
                    <span>
                      {movimento.parado ? 'Parado desde ' : 'Última movimentação: '}
                      {dataExata(deal.stage_changed_at)}
                    </span>
                  </p>
                )}
              </div>

              {/* Acima do contato e do prazo de propósito: para quem vende por
                  orçamento — que é o ICP inteiro da prospecção deste projeto —
                  a pergunta "quanto eu propus e até quando vale" vem antes de
                  qualquer outra coisa do negócio. */}
              <OrcamentoDoNegocio dealId={deal.id} valorDoNegocio={deal.value} />

              {/* ## O cadastro desce, e a acao sobe

                  A ordem era: valor, etapa, orcamento, contato, responsavel,
                  prazo, criado em, movimento, proxima acao — com "Proxima
                  acao" em PENULTIMO, depois de sete blocos de cadastro.

                  Quem abre um negocio quer saber, nesta ordem: o que e isto,
                  o que eu faco agora, esta parado. A proxima acao e o motivo
                  de o produto existir, e era a ultima coisa a aparecer.

                  O que e cadastro fica abaixo do filete, junto, e continua
                  inteiro: nada saiu da tela, so mudou de vizinhanca. */}
              <Separator />

              {lead && (
                <div>
                  <span className="text-muted-foreground text-xs">Contato vinculado</span>
                  <p className="text-sm font-medium">{lead.name}</p>
                  <p className="text-muted-foreground text-xs">{lead.email}</p>
                  <p className="text-muted-foreground text-xs">{lead.phone}</p>
                </div>
              )}

              <div>
                <span className="text-muted-foreground text-xs">Responsável</span>
                <div className="mt-1 flex items-center gap-2">
                  <Avatar size="sm">
                    <AvatarFallback>{iniciais(deal.owner_name ?? '?')}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{deal.owner_name ?? 'Sem responsável'}</span>
                </div>
              </div>

              <div className="flex justify-between">
                <div>
                  {/* O prazo saiu do card do Kanban e mora aqui: ele é
                      previsão de fechamento, não ordem do dia. O card mostra a
                      próxima ação, que é o que dá para cumprir hoje. */}
                  <span className="text-muted-foreground text-xs">Prazo</span>
                  <p className="text-sm">{formatDate(deal.due_date)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Criado em</span>
                  <p className="text-sm">{formatDate(deal.created_at)}</p>
                </div>
              </div>
            </div>

            {/* A exclusão vive aqui, e não no card do Kanban: no card ela
                ficaria a um clique de distância do arrastar, e apagar negócio
                por engano não tem desfazer. */}
            {/* `shrink-0` e borda: o rodapé fica ancorado na base e ganha um
                fio que o separa do conteúdo que rola por trás. Sem a borda, o
                texto passando por baixo dos botões lê como sobreposição. */}
            <SheetFooter className="border-border/60 shrink-0 border-t sm:justify-between">
              <Button
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
                disabled={excluindo}
                onClick={() => setConfirmando(true)}
              >
                {excluindo ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                Excluir negócio
              </Button>
              <SheetClose render={<Button variant="outline" />}>Fechar</SheetClose>
            </SheetFooter>
          </>
        )}
      </SheetContent>

      {/* Antes isto abria o formulário direto, e era o defeito relatado: o
          contato podia já ter tarefa aberta e o painel oferecia criar outra,
          porque `getProximaAcaoPorNegocio` só enxerga tarefa com `deal_id`.

          `EscolherProximaAcao` mostra as candidatas primeiro e cai no mesmo
          formulário quando não há nenhuma — sem clique a mais no caso comum.

          A tarefa continua nascendo presa ao negócio E ao lead dele: só ao
          negócio faria ela sumir da página do cliente, que é onde a pessoa vai
          procurar. */}
      {deal && (
        <EscolherProximaAcao
          open={agendando}
          onOpenChange={setAgendando}
          onCriar={agendar}
          members={members}
          currentUserId={currentUserId}
          dealId={deal.id}
          leadId={deal.lead_id}
          leadNome={lead?.name}
          stage={deal.stage}
        />
      )}

      <Dialog open={confirmando} onOpenChange={setConfirmando}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir este negócio?</DialogTitle>
            <DialogDescription>
              {deal?.title
                ? `"${deal.title}" sai do funil em definitivo. O lead vinculado continua cadastrado.`
                : 'O negócio sai do funil em definitivo.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-between">
            <Button
              variant="ghost"
              onClick={() => setConfirmando(false)}
              disabled={excluindo}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleExcluir} disabled={excluindo}>
              {excluindo && <Loader2 className="size-4 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  )
}
