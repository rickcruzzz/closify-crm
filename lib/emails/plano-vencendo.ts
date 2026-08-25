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
 *
 * ## Por que o corpo muda a cada dia
 *
 * O aviso passou a sair todo dia na reta final (D-4, D-3, D-2, D-1). Quatro
 * e-mails idênticos em quatro dias lêem como robô de cobrança, e a pessoa marca
 * como spam — o que faz ela perder também o e-mail de pagamento confirmado, que
 * sai do mesmo remetente.
 *
 * Então cada dia diz uma coisa diferente, e a escada de tom é deliberada:
 * informa, lembra, explica a consequência, avisa que é o último dia.
 *
 * **Nenhum deles inventa urgência.** Sem contagem regressiva falsa, sem
 * "última chance", sem sugerir perda de dados. O de véspera diz por escrito que
 * a conta volta ao plano gratuito e que **nada é apagado** — é a informação que
 * a pessoa quer nesse momento, e escondê-la para pressionar seria o oposto do
 * que a landing promete na garantia de porta de saída.
 */

/**
 * O corpo do e-mail para cada dia restante.
 *
 * Função pura e exportada para o teste conseguir travar cada degrau da escada
 * sem montar HTML. Recebe o nome já escapado, porque quem chama é quem sabe se
 * a origem é confiável.
 */
export function corpoDoAviso(params: {
  diasRestantes: number
  nomeEscapado: string
  valorFormatado: string
  quando: string
}): { bodyHtml: string; footnote: string } {
  const { diasRestantes, nomeEscapado, valorFormatado, quando } = params

  const abertura = rawParagraph(
    `O plano Pro de <strong style="color:#171717;font-weight:600;">${nomeEscapado}</strong> vence ${escapeHtml(quando)}.`,
  )

  // Véspera. É o único que descreve o que acontece depois, porque é o único
  // momento em que a pessoa ainda pode agir e precisa saber o que está em jogo.
  if (diasRestantes <= 1) {
    return {
      bodyHtml: [
        abertura,
        paragraph(
          `Se você paga no cartão, a cobrança de ${valorFormatado} entra sozinha e não há nada a fazer. Se paga por Pix ou boleto, este é o dia de gerar a cobrança.`,
        ),
        paragraph(
          'Sem o pagamento, a conta volta para o plano gratuito. Seus contatos, negócios e histórico continuam aqui, inteiros: nada é apagado, e o Pro volta assim que você pagar.',
        ),
      ].join('\n'),
      footnote: 'Você recebe este aviso porque tem uma assinatura ativa no Velo Funil.',
    }
  }

  // Dois dias. Traz a consequência, ainda sem dramatizar.
  if (diasRestantes === 2) {
    return {
      bodyHtml: [
        abertura,
        paragraph(
          `A cobrança de ${valorFormatado} é automática no cartão. No Pix e no boleto, ela precisa ser gerada por você.`,
        ),
        paragraph(
          'Se o pagamento não entrar até a data, a conta volta para o plano gratuito sem perder nada do que já está cadastrado.',
        ),
      ].join('\n'),
      footnote: 'Você recebe este aviso porque tem uma assinatura ativa no Velo Funil.',
    }
  }

  // Três dias. Lembrete curto: quem leu o de ontem não precisa ler tudo de novo.
  if (diasRestantes === 3) {
    return {
      bodyHtml: [
        abertura,
        paragraph(
          `São ${valorFormatado}, automáticos no cartão. No Pix ou no boleto, dá para adiantar por aqui.`,
        ),
      ].join('\n'),
      footnote: 'Se você já pagou, pode levar algumas horas até o Asaas confirmar.',
    }
  }

  // Primeiro aviso. Informa e sai do caminho: não pede ação de quem não precisa.
  return {
    bodyHtml: [
      abertura,
      paragraph(
        `A renovação de ${valorFormatado} é automática. Se você paga no cartão, não precisa fazer nada — este e-mail é só para você não ser pego de surpresa.`,
      ),
      paragraph(
        'Se paga por Pix ou boleto, o botão abaixo já abre a cobrança para pagar quando quiser.',
      ),
    ].join('\n'),
    footnote: 'Você recebe este aviso porque tem uma assinatura ativa no Velo Funil.',
  }
}

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

  const { bodyHtml, footnote } = corpoDoAviso({
    diasRestantes: params.diasRestantes,
    nomeEscapado: nome,
    valorFormatado: valor,
    quando,
  })

  return {
    subject: `Seu plano Pro vence ${quando}, Velo Funil`,
    html: renderEmail({
      preheader: `O Pro de ${params.workspaceName} vence ${quando}. A renovação de ${valor} é automática.`,
      title: `Seu plano Pro vence ${quando}`,
      bodyHtml,
      // `?pagar=1` e não `/settings/billing` seco: o parâmetro abre o diálogo de
      // pagamento já com o QR Code do Pix na tela. Antes a pessoa caía numa tela
      // e ainda precisava achar o botão, no exato momento em que ela já tinha
      // decidido pagar — o clique mais caro do fluxo inteiro.
      action: { label: 'Pagar agora', url: `${params.appUrl}/settings/billing?pagar=1` },
      footnote,
    }),
  }
}
