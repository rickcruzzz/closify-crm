'use client'

import * as React from 'react'
import Link from 'next/link'
import { MessageCircle, MoreHorizontal, Undo2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ConfirmarExclusao } from '@/components/comum/confirmar-exclusao'
import { rotuloDePrazo } from '@/lib/tasks/buckets'
import { linkDoWhatsApp } from '@/lib/leads/whatsapp'
import { iconePorTipo, taskTypeLabels, type TaskRow } from '@/lib/tasks/types'

const horaFormatada = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  hour: '2-digit',
  minute: '2-digit',
})

export function TaskItem({
  task,
  agora,
  atrasada,
  pendente = false,
  onConcluir,
  confirmarConclusao = false,
  onDesfazer,
  onEditar,
  onExcluir,
}: {
  task: TaskRow
  /** O instante vem de fora para que a lista inteira use o mesmo relógio. */
  agora: Date
  atrasada: boolean
  /** true enquanto concluir/excluir esta tarefa está em voo, trava a linha
   * para o clique duplo não disparar a Server Action duas vezes. */
  pendente?: boolean
  onConcluir: (taskId: string) => void
  /**
   * Pergunta antes de concluir.
   *
   * `false` por padrão, e é o que preserva as outras telas: no painel do lead e
   * na agenda do calendário o clique continua concluindo direto, porque lá a
   * lista é curta e o gesto é deliberado. Em `/hoje` a lista é longa e o
   * checkbox fica na borda esquerda, ao lado de onde o olho percorre — é a tela
   * onde o clique errado acontece.
   */
  confirmarConclusao?: boolean
  /**
   * Só chega preenchido enquanto a tarefa está saindo da lista — os poucos
   * segundos em que ela aparece riscada. É o que põe o desfazer AO LADO da
   * tarefa, em vez de num aviso no canto oposto da tela que some sozinho.
   */
  onDesfazer?: (taskId: string) => void
  onEditar?: (task: TaskRow) => void
  onExcluir?: (taskId: string) => void
}) {
  const Icone = iconePorTipo[task.type]
  const concluida = Boolean(task.done_at)
  // O diálogo vive AQUI, e não em cada tela que lista tarefas, porque quem
  // pode apagar é este item. Nos dois consumidores atuais (`/hoje` e o painel
  // do lead) o pai só recebe a confirmação já dada, e qualquer tela nova que
  // renderize `TaskItem` nasce protegida sem precisar lembrar disso.
  const [confirmandoExclusao, setConfirmandoExclusao] = React.useState(false)
  const [confirmandoConclusao, setConfirmandoConclusao] = React.useState(false)

  // Só para tarefa de WhatsApp: pôr o botão em toda tarefa com telefone
  // encheria a lista de um atalho que ninguém pediu, e diluiria o sinal
  // justamente onde ele importa.
  /**
   * Para onde o botao "Responder" leva.
   *
   * Ate a tela de Conversas existir, so havia o `wa.me`: mandava a pessoa para
   * fora do produto porque nao havia dentro. Agora ha, e continuar exportando
   * contradiz a tela que acabou de subir.
   *
   * Quando existe conversa daquele contato, vai para ela. Quando NAO existe —
   * contato cadastrado a mao, sem historico de WhatsApp — cai no `wa.me`,
   * porque mandar para uma tela vazia e pior que mandar para o aplicativo.
   */
  const ehWhatsapp = task.type === 'whatsapp'
  const linkDaConversa = ehWhatsapp && task.conversa_id ? `/conversas?c=${task.conversa_id}` : null
  const linkWhatsapp = ehWhatsapp && !linkDaConversa ? linkDoWhatsApp(task.lead_phone) : null
  const destinoDeResposta = linkDaConversa ?? linkWhatsapp

  return (
    <li className="hover:bg-accent/40 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors">
      <Checkbox
        checked={concluida}
        disabled={concluida || pendente}
        onCheckedChange={() => {
          if (concluida || pendente) return
          // Com confirmação, o estado NÃO muda aqui: quem marca a caixa é o
          // "Sim, concluir". Alterar antes deixaria a caixa marcada durante o
          // diálogo e desmarcada no cancelamento — um pisca que sugere que
          // algo aconteceu e foi desfeito, quando nada aconteceu.
          if (confirmarConclusao) setConfirmandoConclusao(true)
          else onConcluir(task.id)
        }}
        aria-label={`Concluir: ${task.title}`}
      />

      <Icone
        aria-hidden
        className={cn(
          'size-4 shrink-0',
          atrasada ? 'text-destructive' : 'text-muted-foreground',
        )}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <span className={cn('truncate text-sm', concluida && 'text-muted-foreground line-through')}>
          {task.title}
        </span>
        <span className="text-muted-foreground truncate text-xs">
          {task.lead_id && task.lead_name ? (
            <Link href={`/leads/${task.lead_id}`} className="hover:underline">
              {task.lead_name}
            </Link>
          ) : (
            taskTypeLabels[task.type]
          )}
          {task.assignee_name && ` · ${task.assignee_name}`}
        </span>
      </div>

      {/* ## O verbo do título precisa ter um botão embaixo
          A tarefa se chama "Responder no WhatsApp" e, até aqui, não havia como
          responder de lugar nenhum: a pessoa lia, saía da tela, procurava o
          contato, abria e só então achava o link. Quatro passos para cumprir
          uma tarefa de um passo, e cada passo é uma chance de desistir — num
          produto cuja promessa é justamente não deixar a resposta cair.

          `wa.me` abre a conversa no aplicativo instalado ou no web, sem
          depender de sessão conectada: funciona mesmo para quem nunca ligou a
          integração. E reusa `linkDoWhatsApp`, que já separa celular de fixo e
          recusa número estrangeiro do mesmo tamanho — prefixar 55 num número
          de 11 dígitos transformaria telefone dos EUA em brasileiro. */}
      {!concluida && destinoDeResposta ? (
        <a
          href={destinoDeResposta}
          // Aba nova SO quando sai do produto. Abrir `/conversas` em aba nova
          // duplicaria a aplicacao inteira, e a pessoa acabaria com duas
          // sessoes do mesmo CRM abertas sem saber por que.
          {...(linkDaConversa
            ? {}
            : { target: '_blank', rel: 'noopener noreferrer' })}
          onClick={(e) => e.stopPropagation()}
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'shrink-0')}
        >
          <MessageCircle className="size-4" />
          <span className="hidden sm:inline">Responder</span>
        </a>
      ) : null}

      {onDesfazer && (
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => onDesfazer(task.id)}
        >
          <Undo2 className="size-4" />
          Desfazer
        </Button>
      )}

      <span
        className={cn(
          'shrink-0 text-right text-xs font-medium whitespace-nowrap',
          atrasada ? 'text-destructive' : 'text-muted-foreground',
        )}
      >
        {/* Hora e rótulo relativo juntos: "hoje" sozinho não diz se é agora ou
            às 18h, e "14:30" sozinho não diz se é hoje ou semana que vem. */}
        {horaFormatada.format(new Date(task.due_at))}
        <span className="block font-normal">
          {rotuloDePrazo(task.due_at, agora, task.done_at)}
        </span>
      </span>

      {(onEditar || onExcluir) && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label="Ações da tarefa">
                <MoreHorizontal className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            {onEditar && (
              <DropdownMenuItem disabled={pendente} onClick={() => onEditar(task)}>
                Editar
              </DropdownMenuItem>
            )}
            {onExcluir && (
              <DropdownMenuItem
                variant="destructive"
                disabled={pendente}
                onClick={() => setConfirmandoExclusao(true)}
              >
                Excluir
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* `AlertDialog` direto, e não `ConfirmarExclusao`: aquele componente fixa
          `variant="destructive"` e o texto inteiro dele é sobre apagar. Concluir
          tarefa não é destrutivo, e um botão vermelho aqui ensinaria a pessoa a
          hesitar no gesto mais repetido do produto.

          O primitivo é o mesmo que o resto do projeto padronizou: `AlertDialog`
          prende o foco e não fecha ao clicar fora, ao contrário do `Dialog`
          genérico. */}
      {confirmarConclusao && (
        <AlertDialog open={confirmandoConclusao} onOpenChange={setConfirmandoConclusao}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Concluir esta tarefa?</AlertDialogTitle>
              <AlertDialogDescription>
                &quot;{task.title}&quot; sai da sua lista de hoje. Ela continua no
                histórico do contato, e você pode reabrir depois.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pendente}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                disabled={pendente}
                onClick={() => {
                  setConfirmandoConclusao(false)
                  onConcluir(task.id)
                }}
              >
                Sim, concluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {onExcluir && (
        <ConfirmarExclusao
          open={confirmandoExclusao}
          onOpenChange={setConfirmandoExclusao}
          titulo="Excluir esta tarefa?"
          descricao={
            <>
              &quot;{task.title}&quot; sai da sua lista em definitivo. Se o objetivo é
              marcar como feita, use a caixa de seleção. Assim ela fica no histórico.
            </>
          }
          pendente={pendente}
          onConfirmar={() => {
            setConfirmandoExclusao(false)
            onExcluir(task.id)
          }}
        />
      )}
    </li>
  )
}
