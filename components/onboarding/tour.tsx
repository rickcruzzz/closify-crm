'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  CalendarCheck,
  KanbanSquare,
  LayoutDashboard,
  PartyPopper,
  Users,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { marcarTour } from '@/lib/onboarding/actions'
import { registrar } from '@/lib/onboarding/eventos'

type Passo = {
  icone: LucideIcon
  titulo: string
  texto: string
}

/**
 * Cinco passos, e todos falam de tela que EXISTE.
 *
 * Tarefas entra porque foi entregue na 0029. Se não existisse, o passo sairia
 * do tour em vez de virar navegação para uma tela que não está lá, tour que
 * promete o que o produto não tem é o pior primeiro contato possível.
 */
const PASSOS: Passo[] = [
  {
    icone: LayoutDashboard,
    titulo: 'Seu centro de vendas',
    texto:
      'Resultados reúne os números do seu funil: quantos contatos, quanto há em negociação e quantos viraram venda.',
  },
  {
    icone: Users,
    titulo: 'Gerencie seus leads',
    texto:
      'Cadastre seus contatos, ou importe a planilha que você já usa. Cada contato tem histórico próprio.',
  },
  {
    icone: KanbanSquare,
    titulo: 'Acompanhe suas oportunidades',
    texto:
      'O funil mostra cada negócio na etapa em que está. Arraste o card para mover conforme a conversa avança.',
  },
  {
    icone: CalendarCheck,
    titulo: 'Não perca os próximos passos',
    texto:
      'Em Hoje ficam as tarefas por prazo. E o card de um negócio sem próxima ação avisa, é o que costuma morrer calado no funil.',
  },
  {
    icone: PartyPopper,
    titulo: 'Tudo pronto',
    texto:
      'Tudo pronto. Cadastre o primeiro contato. A lista em Resultados guia o resto.',
  },
]

/**
 * Tour em diálogo, não em balão preso a elemento da tela.
 *
 * Balão apontando para item de menu quebra no celular: abaixo de `lg` a barra
 * lateral está escondida atrás do botão de menu, e a seta apontaria para um
 * elemento invisível. O diálogo funciona igual nos dois tamanhos, e o produto
 * já usa `Dialog` em toda parte, nenhuma dependência nova.
 */
export function TourDeBoasVindas({ aberto }: { aberto: boolean }) {
  const router = useRouter()
  const [visivel, setVisivel] = React.useState(aberto)
  const [indice, setIndice] = React.useState(0)

  React.useEffect(() => {
    if (aberto) registrar('tour_started')
  }, [aberto])

  const passo = PASSOS[indice]!
  const ultimo = indice === PASSOS.length - 1
  const Icone = passo.icone

  async function encerrar(status: 'skipped' | 'completed') {
    setVisivel(false)
    await marcarTour(status)
    // `refresh` e não `replace`: o que decide se o tour abre é o estado no
    // banco, e ele acabou de mudar. Sem recarregar os dados do servidor, o
    // Dashboard continuaria com `tourStatus: 'not_started'` em memória e
    // reabriria o tour na próxima navegação interna.
    router.refresh()
  }

  return (
    <Dialog
      open={visivel}
      // Fechar pelo ESC ou clicando fora conta como pular. Fechar sem gravar
      // faria o tour voltar no próximo carregamento, e insistir depois de a
      // pessoa ter fechado é o comportamento que faz desativar notificação.
      onOpenChange={(estado) => {
        if (!estado) void encerrar('skipped')
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="bg-primary/10 text-primary mb-1 flex size-10 items-center justify-center rounded-lg">
            <Icone aria-hidden className="size-5" />
          </div>
          <DialogTitle>{passo.titulo}</DialogTitle>
          <DialogDescription>{passo.texto}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-1.5" aria-hidden>
          {PASSOS.map((p, i) => (
            <span
              key={p.titulo}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors',
                i <= indice ? 'bg-primary' : 'bg-muted',
              )}
            />
          ))}
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => void encerrar('skipped')}
          >
            Pular tour
          </Button>

          <div className="flex gap-2">
            {indice > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIndice((i) => i - 1)}
              >
                Voltar
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (ultimo) void encerrar('completed')
                else setIndice((i) => i + 1)
              }}
            >
              {ultimo ? 'Começar a usar' : 'Próximo'}
            </Button>
          </div>
        </DialogFooter>

        <p className="text-muted-foreground text-center text-xs">
          {indice + 1} de {PASSOS.length}
        </p>
      </DialogContent>
    </Dialog>
  )
}
