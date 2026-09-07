'use client'

import * as React from 'react'
import { ExternalLink, Loader2, Radar } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { enfileirarEnriquecimento } from '@/lib/inteligencia-de-mercado/actions'
import type { EstadoDaPesquisa } from '@/lib/inteligencia-de-mercado/queries'
import { tempoRelativo } from '@/lib/notificacoes/tipos'

/**
 * O que a pesquisa de mercado achou sobre este contato.
 *
 * ## Toda linha tem link, e isso não é enfeite
 *
 * `fonte_url` é `not null` na 0072 pela razão que governa esta tela inteira:
 * **insight sem link é opinião da máquina.** Com link, a pessoa confere em um
 * clique — e é o que separa este recurso de um gerador de texto plausível.
 *
 * Por isso o resumo nunca aparece sozinho: ou vem com a fonte clicável, ou não
 * aparece.
 *
 * ## O vazio não afirma que está tudo certo
 *
 * Mesma regra do sino, de 02/09: "sino vazio é sino vazio, nunca 'tudo certo'".
 * Aqui, `sem_sinal` diz que a busca rodou e não achou nada publicado — que é
 * diferente de "esta empresa não tem novidade", e a frase reflete isso.
 */
export function SinaisDeMercado({
  leadId,
  estado,
  ehPro,
}: {
  leadId: string
  estado: EstadoDaPesquisa
  /** Quando falso, o botão explica em vez de falhar depois do clique. */
  ehPro: boolean
}) {
  const [pedindo, iniciar] = React.useTransition()
  // Otimista só para o rótulo do botão: a linha real chega no
  // `revalidatePath`, e a consulta ao Exa só acontece no cron.
  const [pedido, setPedido] = React.useState(false)
  const status = pedido ? 'pendente' : estado.status

  function pedir() {
    iniciar(async () => {
      const r = await enfileirarEnriquecimento(leadId)
      if (!r.ok) {
        toast.error(r.erro)
        return
      }
      setPedido(true)
      toast.success(
        r.jaEstava
          ? 'Este contato já está na fila de pesquisa.'
          : 'Pesquisa pedida. O resultado aparece aqui quando chegar.',
      )
    })
  }

  return (
    <Card>
      <CardHeader className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="flex items-center gap-2">
          <Radar className="size-4 text-muted-foreground" aria-hidden />
          Sinais de mercado
        </CardTitle>

        {status === null && (
          <Button
            variant="outline"
            size="sm"
            onClick={pedir}
            disabled={pedindo || !ehPro}
            // 44px em mobile: a regra de alvo de toque do projeto.
            className="min-h-11 sm:min-h-9"
          >
            {pedindo && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {ehPro ? 'Pesquisar' : 'Pesquisar (Pro)'}
          </Button>
        )}
      </CardHeader>

      <CardContent className="text-sm">
        {status === null && (
          <p className="text-muted-foreground">
            {ehPro
              ? 'Procura o que esta empresa publicou na web — contratação, expansão, mudança — com link para a fonte.'
              : 'Pesquisa de mercado é um recurso Pro. Faça upgrade para usar.'}
          </p>
        )}

        {status === 'pendente' && (
          <p className="text-muted-foreground">
            Na fila. A busca roda a cada 15 minutos e o resultado aparece aqui.
          </p>
        )}

        {status === 'falhou' && (
          // Dizer que falhou, e não fingir que não achou nada: "não consegui
          // conferir" e "conferi e está zerado" são coisas diferentes — a mesma
          // distinção que o vigia faz desde 01/09.
          <p className="text-muted-foreground">
            A busca não completou. Ela é tentada de novo na próxima passagem.
          </p>
        )}

        {status === 'sem_sinal' && estado.sinais.length === 0 && (
          <p className="text-muted-foreground">
            A busca rodou e não achou nada publicado sobre esta empresa
            {estado.consultadoEm ? ` (${tempoRelativo(estado.consultadoEm)})` : ''}.
          </p>
        )}

        {estado.sinais.length > 0 && (
          <ul className="flex flex-col gap-3">
            {estado.sinais.map((s) => (
              <li key={s.id} className="flex flex-col gap-1 border-l-2 border-border pl-3">
                <p className="text-foreground">{s.resumo}</p>
                <a
                  href={s.fonteUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  <ExternalLink className="size-3" aria-hidden />
                  Ver a fonte
                </a>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
