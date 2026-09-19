import Link from 'next/link'
import { Building2, Check } from 'lucide-react'

import { IconeWhatsapp } from '@/components/ui/icone-whatsapp'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CartaoDePlano, type LimiteDoPlano } from '@/components/settings/cartao-de-plano'
import { SubscribeButton } from '@/components/settings/subscribe-button'
import {
  MAX_PLAN_PRICE,
  MAX_WORKSPACE_LIMIT,
  PLANO_NA_TELA,
  PRO_PLAN_PRICE,
  PRO_WORKSPACE_LIMIT,
} from '@/lib/plans'

/**
 * A oferta do plano Max, depois da comparação Free contra Pro.
 *
 * ## Ele usa o MESMO cartão dos outros dois, desde 18/09
 *
 * Antes era um `Card` do shadcn desenhado à parte: preço pequeno no canto,
 * benefícios em parágrafos soltos, sem a faixa de limites e sem um único `✓`.
 * Na mesma tela, logo abaixo dos outros dois, dava duas linguagens visuais
 * diferentes — e a mais pobre era a do plano de **R$ {MAX_PLAN_PRICE}**, o mais
 * caro dos três. Quem rolava a página via a oferta ficar menos cuidada
 * conforme o preço subia.
 *
 * O conserto não foi copiar o estilo, foi passar a usar `CartaoDePlano`:
 * copiar resolveria hoje e divergiria no próximo ajuste, que é exatamente como
 * os dois desenhos se separaram.
 *
 * ## E ele continua FORA da grade de duas colunas
 *
 * A tabela compara duas coisas que se excluem: ou você está no Free, ou no Pro.
 * O Max não é uma terceira opção paralela, é **tudo do Pro mais uma coisa**.
 * Enfiá-lo como coluna faria a pessoa comparar três conjuntos de limites que
 * são iguais em duas colunas de três, e a diferença real (o WhatsApp) sumiria
 * no meio de dez linhas idênticas.
 *
 * Mesmo cartão, largura inteira, depois do argumento. A oferta vem depois da
 * comparação, nunca antes — a mesma razão que tirou o botão de assinar do topo
 * da página em 16/09.
 */

/**
 * Os três números do Max, e o primeiro é o que evita o pedido de reembolso.
 *
 * "1 empresa conectada" contra as 5 do Pro é a diferença que a pessoa precisa
 * ver ANTES de pagar, e numa faixa ela é lida junto com o preço em vez de
 * dissolvida numa lista.
 */
export const LIMITES_MAX: LimiteDoPlano[] = [
  // A escada 1 / 5 / 10 fica legivel na mesma posicao dos outros dois cartoes,
  // e o numero do WhatsApp vem LOGO DEPOIS para as duas coisas nao se
  // confundirem: dez empresas para administrar, UM numero conectado.
  { icone: Building2, valor: `${MAX_WORKSPACE_LIMIT}`, rotulo: 'empresas' },
  { icone: IconeWhatsapp, valor: '1 número', rotulo: 'de WhatsApp' },
  { icone: Check, valor: 'Tudo', rotulo: `do ${PLANO_NA_TELA.pro}` },
]

/**
 * ## A terceira linha descrevia a ORDEM, e a ordem mudou em 18/09
 *
 * Ela vendia o critério de ordenação antigo. A lista passou a pôr a mensagem
 * mais recente no topo, como todo aplicativo de mensagem, e a frase virou o
 * contrário do que o produto faz: numa peça de VENDA, que é o pior lugar para
 * isso acontecer. Ver `lib/conversas/ordenar.ts` para o porquê da troca.
 *
 * A frase nova diz o que a tela AINDA faz e que nenhum chat faz: o relógio
 * conta há quanto tempo cada um espera, e quem não foi respondido fica acima de
 * quem já foi. O argumento se move da posição para a cor, que é onde ele
 * continua verdadeiro.
 */
export const RECURSOS_MAX = [
  'Cada mensagem cai na conversa do contato, com o negócio dele do lado.',
  'O que você responde pelo celular aparece aqui também.',
  'Um relógio mostra há quanto tempo cada cliente espera resposta.',
  'O histórico fica na empresa, e não no celular de quem vendeu.',
]

export function MaxCard({
  temMax,
  isAdmin,
  temCobrancaEmAberto,
}: {
  temMax: boolean
  isAdmin: boolean
  /**
   * Já existe assinatura esperando pagamento.
   *
   * Sem isto, quem criou uma cobrança de Pro e ainda não pagou veria o botão do
   * Max e criaria uma segunda — e `createCheckout` recusaria com a frase de
   * troca de plano, que é a resposta certa e chega tarde demais: a pessoa já
   * clicou achando que ia funcionar.
   */
  temCobrancaEmAberto: boolean
}) {
  return (
    // A MESMA casca da comparacao: la o bloco e `Card` + titulo + conteudo, e
    // sem ela o cartao do Max flutuaria solto no nivel da pagina enquanto os
    // outros dois vivem dentro de uma caixa. O titulo em forma de pergunta
    // porque e isso que separa quem precisa do Max de quem nao precisa.
    <Card>
      <CardHeader>
        <CardTitle>Vai atender pelo WhatsApp?</CardTitle>
      </CardHeader>
      <CardContent>
        <CartaoDePlano
          nome={`Plano ${PLANO_NA_TELA.max}`}
          preco={MAX_PLAN_PRICE}
          descricao={`Tudo do ${PLANO_NA_TELA.pro}, mais o WhatsApp da sua empresa dentro do funil.`}
          limites={LIMITES_MAX}
          recursos={RECURSOS_MAX}
          ehAtual={temMax}
          // A frase que evita o chamado, e ela precisa vir ANTES da compra: o Pro é
          // cobrado pela empresa inteira e cobre até cinco empresas do mesmo dono.
          // O Max não. Descobrir isso depois de pagar vira pedido de reembolso.
          observacao={
            <>
              Administre até {MAX_WORKSPACE_LIMIT} empresas, e conecte o WhatsApp de uma
              delas. Ao contrário do {PLANO_NA_TELA.pro}, que custa R$ {PRO_PLAN_PRICE} pela
              empresa inteira e vale para até {PRO_WORKSPACE_LIMIT} empresas, o número de
              WhatsApp é cobrado por empresa conectada.
            </>
          }
          acao={
            temMax ? (
              <Link
                href="/conversas"
                className={buttonVariants({ variant: 'outline', className: 'w-full' })}
              >
                <IconeWhatsapp className="size-4" />
                Conectar o WhatsApp
              </Link>
            ) : isAdmin && !temCobrancaEmAberto ? (
              <SubscribeButton plano="max" className="w-full" />
            ) : null
          }
          aviso={
            temMax
              ? null
              : !isAdmin
                ? // Membro não mexe em cobrança. Mandá-lo para um botão que a Server
                  // Action vai recusar é a viagem inútil que `integration-card` já
                  // documenta: uma ida ao servidor para dizer não.
                  `Peça a um administrador da empresa para assinar o plano ${PLANO_NA_TELA.max}.`
                : temCobrancaEmAberto
                  ? 'Existe uma cobrança em aberto nesta empresa. Pague ou cancele a atual antes de trocar de plano.'
                  : null
          }
        />
      </CardContent>
    </Card>
  )
}
