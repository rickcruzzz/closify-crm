import { escapeHtml, paragraph, rawParagraph, renderEmail } from '@/lib/emails/layout'
import { FREE_LEAD_LIMIT, FREE_ORCAMENTO_LIMIT } from '@/lib/plans'

/**
 * E-mail de "seu teste está acabando".
 *
 * ## O buraco que ele fecha
 *
 * O aviso de vencimento só alcançava quem **já paga**: a varredura do cron
 * filtra `subscriptions` com `status = 'active'`, e quem está em trial **não
 * tem linha em `subscriptions`** — o trial nasce em
 * `create_workspace_with_admin` gravando `workspaces.trial_ate`, e a assinatura
 * só existe depois do primeiro checkout.
 *
 * O único aviso de trial que existia era a tarja dentro do produto
 * (`components/layout/aviso-de-trial.tsx`), que alcança quem abre o produto. E
 * quem está prestes a sumir é justamente quem não abre.
 *
 * Medido em 25/08: **5 empresas em trial ao mesmo tempo**, e a conversão de
 * trial para pagante nunca aconteceu uma vez com cliente externo.
 *
 * ## Por que o texto fala de perda concreta, e não de prazo
 *
 * O WhatsApp saiu deste texto junto com os outros três lugares que o citavam:
 * `FASE_DO_WHATSAPP` é 'migrando' desde 28/08 e ele não traz mensagem para
 * ninguém, em plano nenhum. Anunciar como perda do fim do trial uma coisa que
 * já não funciona é pior do que não anunciar nada — e este e-mail chega junto
 * de um pedido de pagamento.
 *
 * "Seu teste expira em 3 dias" é sobre o nosso processo. "Em 3 dias o WhatsApp
 * para de trazer as mensagens para cá" é sobre o dia da pessoa. É a perda que
 * decide, não a data — mesma régua de `textoDoAviso` em `lib/plans/trial.ts`,
 * e os dois textos precisam continuar dizendo a mesma coisa.
 *
 * ## O que ele deliberadamente NÃO faz
 *
 * Não inventa escassez, não promete desconto de última hora, e não esconde o
 * que acontece depois. Diz por escrito que a conta continua funcionando no
 * plano gratuito e que nada é apagado. Quem decidir não pagar tem que sair
 * sabendo que os dados são dela — é a mesma garantia que a landing publica.
 */

/**
 * O corpo para cada dia restante. Pura, exportada para o teste travar cada
 * degrau sem montar HTML.
 */
export function corpoDoTrial(params: {
  diasRestantes: number
  nomeEscapado: string
  valorFormatado: string
}): { bodyHtml: string; footnote: string } {
  const { diasRestantes, nomeEscapado, valorFormatado } = params

  const quando = diasRestantes <= 1 ? 'amanhã' : `em ${diasRestantes} dias`

  const abertura = rawParagraph(
    `O teste do Pro de <strong style="color:#171717;font-weight:600;">${nomeEscapado}</strong> termina ${escapeHtml(quando)}.`,
  )

  // O que PARA de funcionar. É a mesma lista da tarja dentro do produto, e as
  // duas precisam continuar batendo: ler uma coisa no e-mail e outra na tela é
  // como se perde a confiança de quem está decidindo pagar.
  const oQuePara = paragraph(
    `Depois disso o orçamento com lembrete trava em ${FREE_ORCAMENTO_LIMIT} ao mesmo tempo, e o cadastro de contatos trava em ${FREE_LEAD_LIMIT}.`,
  )

  const oQueFica = paragraph(
    'A conta continua funcionando no plano gratuito. Seus contatos, negócios e histórico ficam aqui, inteiros: nada é apagado.',
  )

  if (diasRestantes <= 1) {
    return {
      bodyHtml: [
        abertura,
        oQuePara,
        paragraph(
          `Se quiser continuar com tudo liberado, são ${valorFormatado} por mês pela empresa inteira, sem cobrar por pessoa e sem prazo de fidelidade.`,
        ),
        oQueFica,
      ].join('\n'),
      footnote: 'Dá para assinar e cancelar quando quiser, sem multa.',
    }
  }

  if (diasRestantes === 2) {
    return {
      bodyHtml: [
        abertura,
        oQuePara,
        paragraph(
          `O Pro custa ${valorFormatado} por mês pela empresa inteira, quantas pessoas você quiser.`,
        ),
      ].join('\n'),
      footnote: 'Sem fidelidade: cancele quando quiser, direto na tela de cobrança.',
    }
  }

  if (diasRestantes === 3) {
    return {
      bodyHtml: [
        abertura,
        paragraph(
          `Se estiver fazendo sentido, o Pro sai por ${valorFormatado} por mês pela empresa toda, não por pessoa.`,
        ),
      ].join('\n'),
      footnote: 'Sem fidelidade: cancele quando quiser, direto na tela de cobrança.',
    }
  }

  // Primeiro aviso. Lembra do prazo sem cobrar decisão: ainda dá tempo de a
  // pessoa terminar de avaliar, e é isso que faz ela decidir bem.
  return {
    bodyHtml: [
      abertura,
      paragraph(
        'Ainda dá tempo de testar o que faltou. Se tiver ficado alguma dúvida, é só responder este e-mail.',
      ),
      paragraph(
        `Quando quiser continuar, o Pro é ${valorFormatado} por mês pela empresa inteira, sem cobrar por pessoa.`,
      ),
    ].join('\n'),
    footnote: 'Sem fidelidade: cancele quando quiser, direto na tela de cobrança.',
  }
}

export function renderTrialTerminandoEmail(params: {
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

  const quando = params.diasRestantes <= 1 ? 'amanhã' : `em ${params.diasRestantes} dias`

  const { bodyHtml, footnote } = corpoDoTrial({
    diasRestantes: params.diasRestantes,
    nomeEscapado: nome,
    valorFormatado: valor,
  })

  return {
    subject:
      params.diasRestantes <= 1
        ? 'Último dia do seu teste, Velo Funil'
        : `Seu teste termina ${quando}, Velo Funil`,
    html: renderEmail({
      preheader: `O teste de ${params.workspaceName} termina ${quando}. Depois disso a conta segue no plano gratuito.`,
      title: params.diasRestantes <= 1 ? 'Último dia do seu teste' : `Seu teste termina ${quando}`,
      bodyHtml,
      // `?assinar=1` e não `?pagar=1`: quem está em trial ainda não tem
      // assinatura, então o caminho é o `SubscribeButton` (que pede CPF/CNPJ e
      // cria a cobrança), não o `PagarDialog` de quem já tem uma. A tela de
      // cobrança já lê este parâmetro desde antes.
      action: { label: 'Assinar o Pro', url: `${params.appUrl}/settings/billing?assinar=1` },
      footnote,
    }),
  }
}
