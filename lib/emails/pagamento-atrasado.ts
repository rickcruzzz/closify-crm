import { escapeHtml, paragraph, rawParagraph, renderEmail } from '@/lib/emails/layout'

/**
 * E-mail de "seu pagamento não foi confirmado".
 *
 * Mesmo silêncio que o pagamento-confirmado.ts resolveu, só que no sentido
 * contrário: hoje, quando o Asaas manda PAYMENT_OVERDUE (cartão recusado,
 * boleto ou Pix vencido), o banco marca `past_due` certinho e a tela de
 * Configurações → Plano mostra o selo — mas só quem entra no produto e olha
 * aquela tela vê isso. Ninguém é avisado ativamente, e cartão recusado é a
 * categoria de churn mais barata de recuperar em qualquer SaaS justamente
 * porque um e-mail resolve a maioria dos casos (venceu sem querer, cartão
 * trocado, saldo baixo naquele dia).
 */
export function renderPagamentoAtrasadoEmail(params: {
  workspaceName: string
  valor: number
  appUrl: string
}): { subject: string; html: string } {
  const nome = escapeHtml(params.workspaceName)
  const valor = params.valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })

  return {
    subject: 'Seu pagamento não foi confirmado — Velo Funil',
    html: renderEmail({
      preheader: `Não conseguimos confirmar o pagamento de ${valor}. Atualize antes de perder o Pro.`,
      title: 'Pagamento não confirmado',
      bodyHtml: [
        rawParagraph(
          `Não conseguimos confirmar o pagamento de <strong style="color:#171717;font-weight:600;">${escapeHtml(valor)}</strong> do plano Pro de <strong style="color:#171717;font-weight:600;">${nome}</strong>.`,
        ),
        paragraph(
          'Pode ter sido cartão vencido, saldo insuficiente ou o boleto/Pix que expirou sem pagamento. O acesso Pro continua ativo por enquanto, mas some se o pagamento não for regularizado.',
        ),
      ].join('\n'),
      action: { label: 'Atualizar pagamento', url: `${params.appUrl}/settings/billing` },
      footnote: 'Se você já pagou, pode levar algumas horas até o Asaas confirmar.',
    }),
  }
}
