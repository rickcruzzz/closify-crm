import Link from 'next/link'
import { MessageCircle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { SubscribeButton } from '@/components/settings/subscribe-button'
import { MAX_PLAN_PRICE, PLANO_NA_TELA, PRO_PLAN_PRICE } from '@/lib/plans'

/**
 * A oferta do plano Max, depois da comparação Free contra Pro.
 *
 * ## Por que um CARD e não uma terceira coluna na tabela
 *
 * A tabela compara duas coisas que se excluem: ou você está no Free, ou no Pro.
 * O Max não é uma terceira opção paralela — é **tudo do Pro mais uma coisa**.
 * Enfiá-lo como coluna faria a pessoa comparar três conjuntos de limites que
 * são iguais em duas colunas de três, e a diferença real (o WhatsApp) sumiria
 * no meio de dez linhas idênticas.
 *
 * Card abaixo, com a diferença escrita em uma frase, é o formato que a
 * diferença tem.
 *
 * ## E ele fica DEPOIS da comparação, de propósito
 *
 * A mesma razão que tirou o botão de assinar do topo da página em 16/09: a
 * oferta vem depois do argumento, nunca antes. Quem ainda está decidindo entre
 * Free e Pro não precisa de um terceiro preço na cara antes de resolver o
 * primeiro.
 */
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
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MessageCircle className="text-muted-foreground size-5" />
            <CardTitle>Plano {PLANO_NA_TELA.max}</CardTitle>
          </div>
          {temMax ? (
            <Badge variant="outline" className="border-emerald-600/40 text-emerald-600">
              Seu plano
            </Badge>
          ) : (
            <span className="text-lg font-semibold tabular-nums">
              R$ {MAX_PLAN_PRICE}
              <span className="text-muted-foreground text-xs font-normal">/mês</span>
            </span>
          )}
        </div>
        <CardDescription>
          Tudo do {PLANO_NA_TELA.pro}, mais o WhatsApp da sua empresa dentro do funil.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <ul className="text-muted-foreground flex flex-col gap-2 text-sm">
          <li>Cada mensagem cai na conversa do contato, com o negócio dele do lado.</li>
          <li>O que você responde pelo celular aparece aqui também.</li>
          <li>Quem espera há mais tempo fica no topo, e não quem falou por último.</li>
          <li>O histórico fica na empresa, e não no celular de quem vendeu.</li>
        </ul>

        {/* ## A frase que evita o chamado, e ela precisa vir ANTES da compra
            O Pro é cobrado pela empresa inteira e cobre até cinco empresas do
            mesmo dono. O Max não: cada empresa conectada consome um número e
            uma instância paga no provedor. Descobrir isso depois de pagar é
            exatamente o tipo de surpresa que vira pedido de reembolso. */}
        <p className="text-muted-foreground border-border/60 rounded-lg border p-3 text-xs leading-relaxed">
          Um número de WhatsApp por empresa. Ao contrário do {PLANO_NA_TELA.pro}, que
          custa R$ {PRO_PLAN_PRICE} pela empresa inteira e vale para até cinco empresas
          suas, o {PLANO_NA_TELA.max} é cobrado por empresa conectada.
        </p>

        {temMax ? (
          <Link
            href="/settings/whatsapp"
            className={buttonVariants({ variant: 'outline', size: 'sm', className: 'w-fit' })}
          >
            <MessageCircle className="size-4" />
            Conectar o WhatsApp
          </Link>
        ) : !isAdmin ? (
          // Membro não mexe em cobrança. Mandá-lo para um botão que a Server
          // Action vai recusar é a viagem inútil que `integration-card` já
          // documenta: uma ida ao servidor para dizer não.
          <p className="text-muted-foreground text-xs">
            Peça a um administrador da empresa para assinar o plano{' '}
            {PLANO_NA_TELA.max}.
          </p>
        ) : temCobrancaEmAberto ? (
          <p className="text-muted-foreground text-xs">
            Existe uma cobrança em aberto nesta empresa. Pague ou cancele a atual antes
            de trocar de plano.
          </p>
        ) : (
          <SubscribeButton plano="max" />
        )}
      </CardContent>
    </Card>
  )
}
