import { escapeHtml, paragraph, rawParagraph, renderEmail } from '@/lib/emails/layout'

/**
 * E-mail de "seu Pro está ativo".
 *
 * Existia um silêncio no momento mais importante do produto: a pessoa pagava e
 * não recebia nada do Velo Funil. O único contato era a fatura do próprio
 * Asaas, que traz a razão social do MEI e não a marca — quem paga por Pix, à
 * noite, ficava sem nenhuma confirmação de que o acesso tinha sido liberado.
 *
 * Isso importa mais aqui do que em qualquer outro e-mail porque o Pro é
 * assíncrono: o pagamento acontece fora do app, o webhook chega depois, e a
 * pessoa não tem como saber quando olhar. Este e-mail é o aviso de que já pode.
 */
export function renderPagamentoConfirmadoEmail(params: {
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
    /**
     * Sem escape, pelo mesmo motivo do convite: assunto é texto puro, não
     * HTML. Escapar faria "Silva & Cia" virar "Silva &amp; Cia" na lista da
     * caixa de entrada.
     */
    subject: 'Seu plano Pro está ativo — Velo Funil',
    html: renderEmail({
      preheader: `Pagamento de ${valor} confirmado. O Pro já está liberado.`,
      title: 'Pagamento confirmado',
      bodyHtml: [
        rawParagraph(
          `Recebemos seu pagamento de <strong style="color:#171717;font-weight:600;">${escapeHtml(valor)}</strong> e o plano Pro já está ativo em <strong style="color:#171717;font-weight:600;">${nome}</strong>.`,
        ),
        paragraph(
          'A partir de agora não há teto de leads nem de colaboradores, e você pode gerenciar mais de uma empresa na mesma conta.',
        ),
      ].join('\n'),
      action: { label: 'Abrir o Velo Funil', url: `${params.appUrl}/dashboard` },
      footnote:
        'A renovação é mensal e automática. Você pode cancelar quando quiser em Configurações → Cobrança.',
    }),
  }
}
