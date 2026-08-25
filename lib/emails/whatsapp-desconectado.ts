import { escapeHtml, paragraph, rawParagraph, renderEmail } from '@/lib/emails/layout'

/**
 * E-mail de "seu WhatsApp caiu", disparado quando a sessão que estava
 * conectada perde a conexão e a tentativa automática de reconectar falha.
 *
 * ## Por que este e-mail existe (24/08)
 *
 * Até aqui, uma queda de sessão só aparecia como `last_error` na aba
 * Integrações — texto passivo que ninguém vê a menos que abra a tela por
 * acaso. Para uma integração que promete "não perder venda por
 * esquecimento", uma queda que ninguém percebe é o mesmo defeito ao
 * contrário: a empresa acha que está recebendo WhatsApp no CRM e não está.
 *
 * Só dispara depois que `tentarReconectarAutomaticamente` (no webhook) já
 * tentou e falhou — reconexão silenciosa que funciona não deveria virar
 * e-mail, senão toda oscilação normal de uma API não oficial vira spam.
 */
export function renderWhatsappDesconectadoEmail(params: {
  workspaceName: string
  appUrl: string
}): { subject: string; html: string } {
  const nome = escapeHtml(params.workspaceName)

  return {
    subject: `O WhatsApp de ${params.workspaceName} desconectou`,
    html: renderEmail({
      preheader: `O WhatsApp conectado a ${params.workspaceName} caiu, e tentamos reconectar sozinhos sem sucesso.`,
      title: 'Seu WhatsApp desconectou',
      bodyHtml: [
        rawParagraph(
          `O número de WhatsApp conectado a <strong style="color:#171717;font-weight:600;">${nome}</strong> caiu, e a tentativa automática de reconectar não funcionou.`,
        ),
        paragraph(
          'Enquanto isso, mensagens recebidas nesse número não estão virando contato nem tarefa no CRM. Reconecte escaneando um novo código em Configurações → Integrações.',
        ),
        paragraph(
          'Esta conexão usa o WhatsApp Web, não a API oficial da Meta, e pode cair sem aviso prévio por decisão do próprio WhatsApp. Reconectar costuma resolver.',
        ),
      ].join('\n'),
      action: { label: 'Reconectar o WhatsApp', url: `${params.appUrl}/settings?aba=integracoes` },
      footnote: 'Você recebe este aviso porque criou a empresa no Velo Funil.',
    }),
  }
}
