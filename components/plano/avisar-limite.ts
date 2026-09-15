'use client'

import { toast } from 'sonner'

import { DESTINO_DO_UPGRADE, ehLimiteDePlano } from '@/lib/plans'

/**
 * Mostra um erro — e, quando ele é limite de plano, o CAMINHO para resolver.
 *
 * ## O beco que isto fecha
 *
 * Sete lugares do produto devolvem "faça upgrade para o Pro": orçamento,
 * contato, importação, membro, empresa, integração e o PDF. As sete chegavam à
 * tela como texto dentro de um toast, sem nada clicável.
 *
 * É o pior momento possível para não ter botão. A pessoa foi interrompida no
 * meio do trabalho, foi informada de que existe um plano que resolve, e não
 * recebeu caminho nenhum até ele — então volta para o que estava fazendo e a
 * intenção morre. `workspace-switcher.tsx` já tinha a lição escrita em
 * comentário: *"dizer 'faça upgrade' sem mostrar onde deixa a pessoa num
 * beco"*.
 *
 * ## Por que um helper, e não um toast com ação em cada chamada
 *
 * Porque são sete chamadas hoje e a oitava vai esquecer. A decisão de quando
 * oferecer mora em `ehLimiteDePlano`, que é pura e testada; aqui fica só o
 * toast.
 *
 * ## O destino leva `?assinar=1`, e isso é o que evita o segundo beco
 *
 * Sem o parâmetro, o clique deposita a pessoa numa tela de cobrança onde ela
 * precisa procurar o botão de novo — depois de já ter decidido duas vezes.
 * Com ele, o formulário de CPF abre sozinho.
 *
 * ## Duração longa de propósito
 *
 * O padrão do sonner é 4s, e um toast com botão que some antes de a pessoa
 * ler a frase e decidir é o mesmo que não ter botão.
 */
export function avisarLimite(
  mensagem: string,
  /**
   * Repassadas ao sonner, e elas VENCEM o padrão.
   *
   * Existe para o caso em que o erro tem um caminho melhor que o upgrade:
   * `leads-page-client` oferece "Ver contato" quando o e-mail já existe, e
   * mandar essa pessoa para a tela de cobrança seria responder outra pergunta.
   */
  opcoes?: Parameters<typeof toast.error>[1],
): void {
  if (!ehLimiteDePlano(mensagem)) {
    toast.error(mensagem, opcoes)
    return
  }

  toast.error(mensagem, {
    duration: 12000,
    action: {
      label: 'Conhecer o Pro',
      // `window.location` e não `router.push`: este helper é chamado de dentro
      // de handlers em componentes que nem sempre têm o router à mão, e a
      // navegação aqui é uma saída do fluxo atual — não uma transição que
      // precise preservar estado da tela que a pessoa está deixando.
      onClick: () => {
        window.location.href = DESTINO_DO_UPGRADE
      },
    },
    ...opcoes,
  })
}
