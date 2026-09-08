'use client'

import * as React from 'react'
import Link from 'next/link'
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
 * ## A frase descreve as QUATRO categorias, e isso foi corrigido
 *
 * Até 08/09 ela dizia "contratação, expansão, mudança". Conferido contra
 * `dominio/sinais.ts`: **`expansão` e `mudança` não existem** — não há uma
 * expressão sequer que case com elas. E as duas que o classificador mais
 * encontra ficavam de fora da frase: `investimento` e `reclamacao`.
 *
 * O defeito é da família que este projeto mais persegue: a tela prometia três
 * coisas, o produto entregava quatro, e nenhuma das listas continha a outra.
 * Quem clicasse esperando "mudança" receberia uma reclamação do Reclame Aqui —
 * que é útil, e não é o que foi prometido.
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

        {/* Sem Pro, LINK e não botão morto.
            
            A primeira versão desabilitava o botão e escrevia "Pesquisar (Pro)".
            Controle desabilitado não faz nada ao ser clicado e não diz para
            onde ir — quem quisesse o recurso ficava sem caminho, e o card
            gastava a mesma área da tela para bloquear em vez de converter.

            É a mesma correção que `mensagem-bloqueio-pro.ts` já fez do lado do
            servidor em 18/08: dizer o que fazer, não só que não pode. */}
        {status === null &&
          (ehPro ? (
            <Button
              variant="outline"
              size="sm"
              onClick={pedir}
              disabled={pedindo}
              // 44px em mobile: a regra de alvo de toque do projeto.
              className="min-h-11 sm:min-h-9"
            >
              {pedindo && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Pesquisar
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="min-h-11 sm:min-h-9"
              render={<Link href="/settings/billing?assinar=1">Conhecer o Pro</Link>}
            />
          ))}
      </CardHeader>

      <CardContent className="text-sm">
        {status === null && (
          <p className="text-muted-foreground">
            {ehPro
              ? 'Procura o que foi publicado sobre esta empresa: contratação, investimento, reclamação e sinais de dificuldade. Sempre com link para a fonte.'
              : 'No Pro, o sistema procura o que foi publicado sobre esta empresa: contratação, investimento, reclamação e sinais de dificuldade. E mostra com link para a fonte.'}
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
