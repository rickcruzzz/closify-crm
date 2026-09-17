import { escapeHtml, paragraph, rawParagraph, renderEmail } from '@/lib/emails/layout'

/**
 * Um cliente Max pediu o WhatsApp dele, e ninguém pode criar a instância sozinho.
 *
 * ## Por que este e-mail existe
 *
 * O provisionamento automático depende do **Partner token**, e o programa
 * Partner da Z-API exige **10 instâncias contratadas** — R$ 899,90 por mês,
 * fixos. A conta que decide está medida:
 *
 *     ate 9 clientes Max    pagar por instancia sai mais barato
 *     a partir de 10        o Partner vira o barato
 *
 * Abaixo de nove, contratar o Partner é pagar por vaga vazia. Até lá o ciclo de
 * vida da instância é MANUAL, e este e-mail é o gatilho.
 *
 * ## E ele é urgente de um jeito que os outros não são
 *
 * Os outros e-mails do produto avisam sobre algo que já aconteceu. Este avisa
 * sobre alguém **esperando agora**: o cliente pagou R$ 250, clicou, e está
 * vendo uma tela que diz que o número está sendo preparado.
 *
 * Aquela tela é uma promessa. Enquanto ela estiver de pé e ninguém criar a
 * instância, o produto está mentindo para quem acabou de pagar.
 *
 * ## `rawParagraph` com `escapeHtml` à mão, e não `paragraph`
 *
 * `paragraph()` escapa o texto inteiro, então um `<strong>` sairia literal na
 * tela. `rawParagraph()` não escapa nada — e por isso o nome da empresa e o
 * e-mail, que vêm do banco e são digitados por gente, passam por `escapeHtml`
 * aqui, um a um.
 *
 * O `tsc` não pega isso: os dois recebem `string`. Quem pega é ler o helper.
 */
export function renderPedidoDeConexaoEmail(params: {
  nomeDaEmpresa: string
  emailDeQuemPediu: string
  appUrl: string
}): { subject: string; html: string } {
  const empresa = escapeHtml(params.nomeDaEmpresa)
  const quem = escapeHtml(params.emailDeQuemPediu)

  return {
    /**
     * O nome da empresa vai NO ASSUNTO, e não só no corpo.
     *
     * Este e-mail chega na mesma caixa do vigia, que manda alerta de hora em
     * hora. Assunto genérico viraria mais uma linha igual às outras, e a única
     * coisa que distingue este é qual cliente está esperando.
     *
     * O assunto NÃO passa por `escapeHtml`: ele não é HTML. Escapar ali faria
     * uma empresa chamada "Silva & Cia" virar "Silva &amp; Cia" na caixa de
     * entrada.
     */
    subject: `${params.nomeDaEmpresa} está esperando o WhatsApp`,
    html: renderEmail({
      preheader: 'Crie a instância na Z-API e cole as credenciais no Velo Funil.',
      title: 'Um cliente pediu a conexão do WhatsApp',
      bodyHtml: [
        rawParagraph(
          `A empresa <strong>${empresa}</strong> tem o plano Max ativo e pediu para conectar o WhatsApp. Quem clicou foi ${quem}.`,
        ),
        paragraph(
          'Ela está vendo uma tela dizendo que o número está sendo preparado. Enquanto ninguém criar a instância, essa frase é uma promessa em aberto.',
        ),
        rawParagraph(
          '<strong>1.</strong> No painel da Z-API, crie uma instância com o nome da empresa.<br />' +
            '<strong>2.</strong> Assine a instância, senão ela é apagada em 48 horas.<br />' +
            '<strong>3.</strong> Copie o ID e o token e cole em Configurações, WhatsApp, "Já tenho uma instância na Z-API".',
        ),
        paragraph(
          'Depois disso o cliente lê o QR Code e passa a receber as mensagens aqui dentro.',
        ),
      ].join(''),
      // O botão leva à tela DO PRODUTO, e não ao painel da Z-API: o passo que
      // só o Velo Funil faz é o terceiro, e é o que se esquece. O painel da
      // Z-API quem abre este e-mail já tem aberto.
      action: {
        label: 'Abrir a tela de WhatsApp',
        url: `${params.appUrl}/settings/whatsapp`,
      },
    }),
  }
}
