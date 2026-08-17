import { escapeHtml, paragraph, rawParagraph, renderEmail } from '@/lib/emails/layout'

/**
 * E-mail de "seu Pro vence em X dias".
 *
 * Único aviso do produto que sai ANTES de algo dar errado. Os outros dois
 * (`pagamento-confirmado.ts`, `pagamento-atrasado.ts`) reagem a um evento do
 * Asaas que já aconteceu; este é disparado pelo job diário olhando a data de
 * validade, porque não existe evento nenhum para "está perto de vencer".
 *
 * No caminho feliz o Asaas cobra sozinho (ciclo MONTHLY) e a pessoa não
 * precisa fazer nada, então o texto não pode soar como cobrança nem sugerir
 * que o acesso vai cair. Quem tem cartão salvo lê isso como aviso; quem paga
 * boleto ou Pix lê como lembrete de gerar o próximo, que é o caso em que este
 * e-mail de fato evita o corte.
 */
export function renderPlanoVencendoEmail(params: {
  workspaceName: string
  valor: number
  diasRestantes: number
  appUrl: string
}): { subject: string; html: string } {
  const nome = escapeHtml(params.workspaceName)
  const valor = params.valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })

  // "em 1 dia" lê como erro de sistema; "amanhã" é como uma pessoa falaria.
  const quando = params.diasRestantes <= 1 ? 'amanhã' : `em ${params.diasRestantes} dias`

  return {
    subject: `Seu plano Pro vence ${quando}, Velo Funil`,
    html: renderEmail({
      preheader: `O Pro de ${params.workspaceName} vence ${quando}. A renovação de ${valor} é automática.`,
      title: `Seu plano Pro vence ${quando}`,
      bodyHtml: [
        rawParagraph(
          `O plano Pro de <strong style="color:#171717;font-weight:600;">${nome}</strong> vence ${escapeHtml(quando)}.`,
        ),
        paragraph(
          `A cobrança de ${valor} é automática: se você paga no cartão, não precisa fazer nada. Se paga por boleto ou Pix, é hora de gerar a próxima cobrança para não perder o acesso.`,
        ),
      ].join('\n'),
      action: { label: 'Ver minha cobrança', url: `${params.appUrl}/settings/billing` },
      footnote: 'Se o pagamento não entrar, o acesso volta para o plano gratuito.',
    }),
  }
}
