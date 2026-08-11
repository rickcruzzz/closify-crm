import { escapeHtml, paragraph, rawParagraph, renderEmail } from '@/lib/emails/layout'

/**
 * E-mail de convite de colaborador.
 *
 * É o e-mail mais importante do produto do ponto de vista comercial: vai para
 * alguém que ainda não conhece o Velo Funil e cuja primeira impressão da marca
 * é esta mensagem. Antes era um `<p>` com link azul de navegador.
 *
 * O segundo parágrafo existe porque quem recebe pode não fazer ideia do que é
 * o produto — o convite chega sem contexto, às vezes de um colega que só
 * avisou "te mandei lá".
 */
export function renderConviteEmail(params: {
  workspaceName: string
  inviteUrl: string
}): { subject: string; html: string } {
  const nome = escapeHtml(params.workspaceName)

  return {
    /**
     * Sem escape: assunto é texto puro, não HTML. Escapar aqui faria um nome
     * como "Silva & Cia" aparecer literalmente como "Silva &amp; Cia" na lista
     * da caixa de entrada.
     */
    subject: `Você foi convidado para o workspace ${params.workspaceName}`,
    html: renderEmail({
      preheader: `Acesse o workspace ${params.workspaceName} no Velo Funil.`,
      title: 'Você foi convidado',
      bodyHtml: [
        rawParagraph(
          `Você foi convidado para colaborar no workspace <strong style="color:#171717;font-weight:600;">${nome}</strong> no Velo Funil.`,
        ),
        paragraph(
          'O Velo Funil é o CRM onde o time acompanha leads e negócios num funil compartilhado — sem planilha e sem treinamento.',
        ),
      ].join('\n'),
      action: { label: 'Aceitar convite', url: params.inviteUrl },
      footnote:
        'Este link expira em 7 dias. Se você não esperava este convite, pode ignorar esta mensagem.',
    }),
  }
}
