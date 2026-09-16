'use client'

import { Crown } from 'lucide-react'
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
 * ## O destino leva ao ARGUMENTO, não ao CPF
 *
 * Levava para `?assinar=1`, que abre o formulário de documento sozinho. O dono
 * percorreu isso como cliente em 16/09 e o defeito ficou óbvio: o botão diz
 * "Conhecer o Pro" e entrega um campo de CPF. Pedir documento antes de mostrar
 * o que a pessoa compra é a ordem invertida de qualquer venda.
 *
 * Agora é `#comparar`, a âncora dos dois cartões de plano. O `?assinar=1`
 * continua existindo para quem JÁ decidiu: e-mails de trial, reconciliação e a
 * landing logada.
 *
 * ## Não é `toast.error`, e isso não é detalhe
 *
 * Era. O `error` do sonner pinta círculo vermelho com X e barra vermelha na
 * lateral — a linguagem de "você fez algo errado".
 *
 * Bater no limite do Free não é erro: é o produto funcionando exatamente como
 * projetado, e é o instante em que ele VENDE. Vermelho ali transforma uma
 * oferta em repreensão, no único momento em que a pessoa está considerando
 * pagar.
 *
 * E há o custo que `lib/kanban/urgencia.ts` já registra por escrito: quando
 * tudo é vermelho, nada é urgente. O aviso de limite competia visualmente com
 * falha de rede e erro de gravação, que são coisas de outra natureza.
 *
 * A coroa em âmbar foi escolha do dono, entre cinco opções desenhadas com os
 * tokens reais. Fica registrado que ela é o único ícone do produto sem par em
 * nenhuma outra tela — o raio, que é o que o botão "Assinar Pro", o selo
 * "Recomendado" e o CTA da barra lateral já usam, era a alternativa
 * consistente.
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

  toast(mensagem, {
    // `icon` explícito porque isto não é nenhuma das variantes do sonner: não
    // é erro, não é sucesso, não é aviso de sistema. É oferta.
    icon: <Crown aria-hidden className="text-warning size-5 shrink-0" />,
    // A barra lateral acompanha o ícone. Trocar um sem o outro deixaria coroa
    // âmbar ao lado de faixa vermelha, que lê como defeito de tema.
    className: 'border-l-warning border-l-2',
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
