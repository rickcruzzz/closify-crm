'use client'

import * as React from 'react'
import {
  AlertTriangle,
  BellOff,
  CheckCircle2,
  ChevronDown,
  Loader2,
  RotateCcw,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  consertarAssinatura,
  reexibirAlerta,
  reexibirTodosOsAlertas,
  silenciarAlerta,
} from '@/lib/dono/actions'
import { agruparPendencias } from '@/lib/dono/pendencias'
import type { Pendencia } from '@/lib/dono/tipos'
import { cn } from '@/lib/utils'

/**
 * A fila de trabalho completa.
 *
 * ## Por que agrupada
 *
 * Cinco e-mails que falharam são cinco cartões idênticos empurrando o alerta de
 * dinheiro para fora da tela. Agrupados, viram uma linha que expande — a
 * informação continua toda ali, só para de competir por espaço com o que é
 * mais grave.
 *
 * ## Por que grupo de dinheiro nasce aberto
 *
 * O que custa por dia parado não pode depender de mais um clique para ser
 * visto. O resto começa fechado.
 */
export function ListaDeAlertas({
  pendencias,
  silenciadas,
}: {
  pendencias: Pendencia[]
  silenciadas: Pendencia[]
}) {
  const grupos = React.useMemo(() => agruparPendencias(pendencias), [pendencias])
  const dinheiro = pendencias.filter((p) => p.gravidade === 'dinheiro').length

  return (
    <div className="flex flex-col gap-6">
      {pendencias.length === 0 ? (
        <div className="ring-foreground/10 flex flex-col items-center gap-2 rounded-xl p-10 text-center ring-1">
          <CheckCircle2 aria-hidden className="size-8 text-emerald-500" />
          <p className="font-medium">Nada precisa de você agora.</p>
          <p className="text-muted-foreground max-w-md text-sm text-pretty">
            Conferi assinaturas contra o Asaas, cobranças em aberto, e-mails que não chegaram,
            cadastros com e-mail errado e clientes que sumiram.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <AlertTriangle aria-hidden className="size-5 text-amber-500" />
            <h2 className="text-lg font-semibold">
              {pendencias.length === 1
                ? '1 coisa precisa de você'
                : `${pendencias.length} coisas precisam de você`}
            </h2>
            {dinheiro > 0 && (
              <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-500">
                {dinheiro === 1 ? '1 envolve dinheiro' : `${dinheiro} envolvem dinheiro`}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {grupos.map((grupo) => (
              <Grupo
                key={grupo.tipo}
                titulo={grupo.titulo}
                gravidade={grupo.gravidade}
                itens={grupo.itens}
              />
            ))}
          </div>
        </>
      )}

      {silenciadas.length > 0 && <Silenciadas itens={silenciadas} />}
    </div>
  )
}

function Grupo({
  titulo,
  gravidade,
  itens,
}: {
  titulo: string
  gravidade: 'dinheiro' | 'atencao'
  itens: Pendencia[]
}) {
  const eDinheiro = gravidade === 'dinheiro'
  const [aberto, setAberto] = React.useState(eDinheiro || itens.length === 1)

  return (
    <section
      className={cn(
        'overflow-hidden rounded-xl ring-1',
        eDinheiro ? 'bg-red-500/5 ring-red-500/20' : 'bg-amber-500/5 ring-amber-500/20',
      )}
    >
      <button
        type="button"
        onClick={() => setAberto((antes) => !antes)}
        aria-expanded={aberto}
        className="flex w-full cursor-pointer items-center justify-between gap-3 p-4 text-left"
      >
        <span className="font-medium">{titulo}</span>
        <ChevronDown
          aria-hidden
          className={cn(
            'text-muted-foreground size-4 shrink-0 transition-transform duration-micro',
            aberto && 'rotate-180',
          )}
        />
      </button>

      {aberto && (
        <ul className="flex flex-col gap-3 border-t border-white/5 p-4">
          {itens.map((item) => (
            <Item key={item.id} pendencia={item} />
          ))}
        </ul>
      )}
    </section>
  )
}

function Item({ pendencia }: { pendencia: Pendencia }) {
  const [ocupado, setOcupado] = React.useState<'consertando' | 'silenciando' | null>(null)

  async function rodar(tarefa: 'consertando' | 'silenciando', acao: () => Promise<unknown>) {
    setOcupado(tarefa)
    try {
      const r = (await acao()) as { ok: boolean; mensagem?: string; erro?: string }
      if (r.ok) toast.success(r.mensagem ?? 'Pronto.')
      // Duração longa: a mensagem de erro aqui explica um estado do gateway de
      // pagamento, não é algo que se entenda de relance.
      else toast.error(r.erro ?? 'Não deu certo.', { duration: 10_000 })
    } catch {
      toast.error('Falhou. O erro completo está no terminal.')
    } finally {
      setOcupado(null)
    }
  }

  return (
    <li className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-muted-foreground text-sm text-pretty">{pendencia.detalhe}</p>
        {pendencia.email && (
          <a
            href={`mailto:${pendencia.email}`}
            className="text-foreground w-fit text-sm underline underline-offset-4"
          >
            {pendencia.email}
          </a>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {pendencia.acao && (
          <Button
            size="sm"
            disabled={ocupado !== null}
            onClick={() =>
              rodar('consertando', () => consertarAssinatura(pendencia.acao?.alvo ?? ''))
            }
          >
            {ocupado === 'consertando' && <Loader2 aria-hidden className="size-4 animate-spin" />}
            {ocupado === 'consertando' ? 'Corrigindo…' : pendencia.acao.rotulo}
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          disabled={ocupado !== null}
          onClick={() => rodar('silenciando', () => silenciarAlerta(pendencia.id))}
          title="Parar de mostrar este alerta"
        >
          {ocupado === 'silenciando' ? (
            <Loader2 aria-hidden className="size-4 animate-spin" />
          ) : (
            <BellOff aria-hidden className="size-4" />
          )}
          Silenciar
        </Button>
      </div>
    </li>
  )
}

/**
 * O que foi silenciado, e o caminho de volta.
 *
 * Fechado por padrão e discreto — mas presente. Silenciar sem poder desfazer é
 * o mesmo que perder, e quem esconde um alerta hoje precisa conseguir lembrar
 * disso daqui a um mês.
 */
function Silenciadas({ itens }: { itens: Pendencia[] }) {
  const [aberto, setAberto] = React.useState(false)
  const [pendente, setPendente] = React.useState(false)

  return (
    <section className="flex flex-col gap-3 border-t border-white/5 pt-6">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setAberto((antes) => !antes)}
          aria-expanded={aberto}
          className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-2 text-sm transition-colors"
        >
          <BellOff aria-hidden className="size-4" />
          {itens.length === 1 ? '1 alerta silenciado' : `${itens.length} alertas silenciados`}
          <ChevronDown
            aria-hidden
            className={cn('size-4 transition-transform duration-micro', aberto && 'rotate-180')}
          />
        </button>

        {aberto && (
          <Button
            variant="outline"
            size="sm"
            disabled={pendente}
            onClick={async () => {
              setPendente(true)
              try {
                const r = await reexibirTodosOsAlertas()
                if (r.ok) toast.success(r.mensagem)
              } finally {
                setPendente(false)
              }
            }}
          >
            <RotateCcw aria-hidden className="size-4" />
            Mostrar todos de novo
          </Button>
        )}
      </div>

      {aberto && (
        <ul className="flex flex-col gap-2">
          {itens.map((item) => (
            <li
              key={item.id}
              className="text-muted-foreground flex items-start justify-between gap-3 text-sm"
            >
              <span className="min-w-0 text-pretty">{item.titulo}</span>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={async () => {
                  const r = await reexibirAlerta(item.id)
                  if (r.ok) toast.success(r.mensagem)
                }}
              >
                Mostrar
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
