import { escapeHtml, paragraph, rawParagraph, renderEmail } from '@/lib/emails/layout'

/**
 * O aviso de que um cliente relatou um PROBLEMA.
 *
 * ## Por que só problema, e nunca sugestão
 *
 * Os dois tipos têm urgências opostas. Sugestão espera dias sem custo — fica
 * na Central e é lida quando der. Problema é alguém travado, com assinatura
 * ativa, e o dono sem saber.
 *
 * Mandar e-mail para os dois pareceria mais completo e seria pior: a Central
 * do Dono já pagou essa lição em 20/08, quando 8 de 11 alertas eram teste do
 * próprio dono e a fila inteira virou algo a ignorar. Junto do item chato vai
 * embora o alerta que importa.
 *
 * ## Por que a Central não substitui este e-mail
 *
 * `/dono/feedback` só existe em `localhost`: ela não avisa, precisa ser
 * aberta. É exatamente o defeito que o WhatsApp pagou — a queda de sessão
 * *"nunca chegava a ninguém: só aparecia como texto passivo em Configurações,
 * sem e-mail, sem alerta ativo"*. A Central é onde se trabalha; este e-mail é
 * o sino.
 *
 * ## O que ele NÃO faz
 *
 * Não tem botão. Todos os outros e-mails do produto levam a uma tela
 * (`/settings/billing`, o convite, o checkout), e aqui não há para onde
 * mandar: a Central roda em localhost e um link para lá quebraria no celular,
 * que é onde este e-mail vai ser lido. O que o destinatário precisa fazer é
 * responder para o cliente — e o endereço dele está no corpo.
 */
export function renderFeedbackRecebidoEmail(params: {
  /** Quem relatou. Vai no corpo porque responder É a ação deste e-mail. */
  emailDoCliente: string
  /** Nome da empresa, para saber de quem se trata sem abrir nada. */
  empresa: string
  /** `free` ou `pro` — muda a urgência, e por isso aparece no assunto. */
  plano: string
  /** A tela de onde o relato saiu. */
  rota: string | null
  mensagem: string
  /**
   * Quantos arquivos vieram junto — só o NÚMERO, nunca os arquivos.
   *
   * Anexar três imagens de 10 MB seria 30 MB num e-mail: o Gmail recusa acima
   * de 25 MB, e o Resend cobra por volume. O destinatário precisa dos arquivos
   * na Central, onde abrem por link assinado, não na caixa de entrada. O que o
   * e-mail precisa dizer é que EXISTEM, para valer a pena abrir a Central.
   */
  quantidadeDeAnexos?: number
}): { subject: string; html: string } {
  const { emailDoCliente, empresa, plano, rota, mensagem } = params
  const anexos = params.quantidadeDeAnexos ?? 0

  // O plano entra no ASSUNTO, não só no corpo: cliente pagante travado é outra
  // urgência, e o assunto é a única parte lida na notificação do celular.
  const etiquetaDoPlano = plano === 'pro' ? 'Pro' : 'Grátis'

  return {
    subject: `Problema relatado por ${empresa} (${etiquetaDoPlano})`,
    html: renderEmail({
      // A prévia da caixa de entrada carrega o começo do relato, não uma
      // frase de sistema: é o que permite decidir se abre agora sem abrir.
      preheader: mensagem.slice(0, 120),
      title: 'Um cliente relatou um problema',
      bodyHtml: [
        rawParagraph(
          `<strong style="color:#171717;font-weight:600;">${escapeHtml(empresa)}</strong> ` +
            `(${escapeHtml(etiquetaDoPlano)}) relatou um problema` +
            (rota ? ` em <strong style="color:#171717;font-weight:600;">${escapeHtml(rota)}</strong>` : '') +
            '.',
        ),
        // O relato entre aspas e em bloco próprio, separado do texto de
        // sistema: misturar os dois faz a leitura rápida confundir o que a
        // pessoa escreveu com o que o produto escreveu.
        rawParagraph(
          `<span style="display:block;border-left:3px solid #e5e5e5;padding-left:12px;color:#404040;">` +
            `${escapeHtml(mensagem).replace(/\n/g, '<br />')}</span>`,
        ),
        ...(anexos > 0
          ? [
              rawParagraph(
                `Veio com <strong style="color:#171717;font-weight:600;">${anexos} ${anexos === 1 ? 'anexo' : 'anexos'}</strong>, que abrem na Central.`,
              ),
            ]
          : []),
        rawParagraph(
          `Responda direto para <strong style="color:#171717;font-weight:600;">${escapeHtml(emailDoCliente)}</strong>.`,
        ),
        paragraph('O relato completo, com navegador e histórico, está na Central do Dono.'),
      ].join('\n'),
    }),
  }
}
