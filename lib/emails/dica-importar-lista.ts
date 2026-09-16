import { paragraph, renderEmail } from '@/lib/emails/layout'

/**
 * A dica de importação de lista.
 *
 * ## Por que este e-mail existe, e o caso que o motivou
 *
 * O primeiro usuário externo do produto cadastrou 19 contatos à mão, um por
 * minuto, em 13 minutos. A importação de planilha existe desde 11/08.
 *
 * Ele não pulou nada: completou o assistente e o tour em 33 segundos, e o
 * checklist de ativação está visível na conta dele. O recurso passou batido
 * mesmo assim — que é o normal, porque ninguém lê tour.
 *
 * No ritmo dele, uma base de 300 contatos custaria três horas e meia.
 *
 * ## O texto NÃO diz o que a pessoa fez
 *
 * Nada de "vi que você cadastrou 19 contatos". Dado de uso citado de volta
 * para o usuário assusta mesmo sendo legítimo — a reação é "como você sabe?",
 * e ela custa mais confiança do que a dica entrega.
 *
 * O texto funciona para qualquer pessoa, e é essa generalidade que prova que
 * não é vigilância.
 *
 * ## Dois detalhes que não são enfeite
 *
 * **"o arquivo que sai do Excel em português, com ponto e vírgula"** é
 * verdade e é específico: `escolherSeparador` julga o conteúdo inteiro por
 * consistência, justamente porque a planilha brasileira usa `;`. É o tipo de
 * detalhe que faz a pessoa acreditar que vai funcionar antes de tentar.
 *
 * **"se a sua lista estiver no WhatsApp"** existe porque o ICP deste produto
 * vende por WhatsApp — 82% da PME brasileira, medido — e a base dele é lista
 * de telefone, não de e-mail. É a mesma razão pela qual a 0025 deixou
 * `email` ser nulo em `leads`.
 *
 * ## O link leva à importação ABERTA
 *
 * `?importar=1`, não `/leads` puro. Mandar a pessoa para a tela e pedir que
 * ache o botão é repetir o passo que já falhou uma vez.
 */
export function renderDicaImportarListaEmail(params: {
  appUrl: string
}): { subject: string; html: string } {
  return {
    /**
     * Sem "Velo Funil" no assunto: o remetente já diz isso, e a caixa de
     * entrada mostra os dois lado a lado. O espaço do assunto rende mais com
     * o benefício — é a mesma regra que os outros transacionais seguem.
     */
    subject: 'Sua lista inteira, em vez de um contato por vez',
    html: renderEmail({
      preheader: 'Importe de uma planilha do Excel ou CSV, em segundos.',
      title: 'Dá para importar sua lista',
      bodyHtml: [
        paragraph(
          'Uma coisa do Velo Funil que costuma passar batido: você pode importar sua lista de contatos de uma planilha, em vez de cadastrar um por um.',
        ),
        paragraph(
          'Serve Excel (.xlsx) ou CSV, inclusive o arquivo que sai do Excel em português, com ponto e vírgula. A gente lê as colunas e você confere o que vai entrar antes de salvar.',
        ),
        paragraph(
          'Se a sua lista estiver no WhatsApp, dá para exportar os contatos de lá e trazer o arquivo direto.',
        ),
      ].join('\n'),
      action: {
        label: 'Importar minha lista',
        url: `${params.appUrl}/leads?importar=1`,
      },
      footnote: 'Qualquer dúvida é só responder este e-mail.',
    }),
  }
}
