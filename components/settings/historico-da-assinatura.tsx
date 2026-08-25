'use client'

import * as React from 'react'

import type { EventoDaAssinatura } from '@/lib/asaas/queries'

/**
 * O que aconteceu com a assinatura, em ordem.
 *
 * ## Por que existe
 *
 * `subscriptions` guarda **uma linha por empresa, só o estado atual**. Quem
 * assinou, cancelou e voltou não deixava rastro nenhum, e a única resposta para
 * "o que eu paguei e quando" era abrir o Asaas — uma marca que o cliente não
 * reconhece, com um login que ele não tem.
 *
 * Alimentado por `assinatura_eventos` (0055), escrito num lugar só:
 * `lib/asaas/aplicar-evento.ts`, o caminho compartilhado entre o webhook e o
 * cron de reconciliação.
 *
 * ## Por que fala em português e não em status
 *
 * `past_due → active` é o nosso vocabulário, não o de quem paga. A tradução
 * mora aqui e não no banco porque a coluna precisa continuar sendo o enum, que
 * é o que as regras leem.
 */

/** O que aconteceu, dito para quem paga. */
function descrever(evento: EventoDaAssinatura): string {
  const { de, para } = evento

  if (para === 'active') {
    // Voltar de `past_due` é retomada, não uma ativação nova. A diferença
    // importa para quem está conferindo se aquele pagamento atrasado entrou.
    return de === 'past_due' ? 'Pagamento confirmado, plano reativado' : 'Plano Pro ativado'
  }

  if (para === 'past_due') return 'Pagamento não confirmado'
  if (para === 'canceled') return 'Assinatura cancelada'
  if (para === 'trialing') return 'Assinatura criada, aguardando pagamento'

  return `Assinatura passou para ${para}`
}

/** A forma de pagamento, quando o Asaas informou qual foi. */
function comoFoiPago(billingType: string | null): string | null {
  if (!billingType) return null
  return (
    {
      CREDIT_CARD: 'cartão',
      BOLETO: 'boleto',
      PIX: 'Pix',
      // `UNDEFINED` é como o checkout cria a assinatura de propósito: uma
      // cobrança que aceita as três formas, e quem escolhe é o cliente na tela
      // do Asaas. Dizer "indefinido" para ele seria expor um detalhe nosso.
      UNDEFINED: null,
    }[billingType] ?? null
  )
}

export function HistoricoDaAssinatura({ eventos }: { eventos: EventoDaAssinatura[] }) {
  // Formatado no cliente: o servidor roda em UTC, e uma cobrança das 22h de São
  // Paulo apareceria com a data do dia seguinte para quem lê.
  const formatador = React.useMemo(
    () =>
      new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
    [],
  )

  // Sem histórico não desenha nada. Um bloco vazio dizendo "nenhum evento"
  // ocupa espaço para não informar — e toda assinatura nova começa assim.
  if (eventos.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-medium">Histórico</h3>

      <ul className="flex flex-col">
        {eventos.map((evento, i) => {
          const forma = comoFoiPago(evento.billingType)
          return (
            <li
              key={evento.id}
              className={
                i === 0
                  ? 'flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2'
                  : 'border-border/60 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-t py-2'
              }
            >
              <span className="text-sm">{descrever(evento)}</span>
              <span className="text-muted-foreground text-xs tabular-nums">
                {formatador.format(new Date(evento.criadoEm))}
                {forma ? ` · ${forma}` : ''}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
