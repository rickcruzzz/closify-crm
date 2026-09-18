import type { ComponentType, ReactNode, SVGProps } from 'react'
import { Check, Zap } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type LimiteDoPlano = {
  icone: ComponentType<SVGProps<SVGSVGElement>>
  valor: string
  rotulo: string
}

/**
 * O cartão de UM plano, e o único desenho de cartão de plano que existe.
 *
 * ## Por que ele saiu de dentro da tabela de comparação (18/09)
 *
 * Ele era uma função local de `plan-comparison-table.tsx`, e por isso o Max,
 * que mora em outro arquivo, foi desenhado do zero: `Card` do shadcn, preço
 * pequeno no canto, os benefícios em parágrafos soltos, sem os três limites em
 * faixa e sem um único `✓`.
 *
 * Na mesma tela, um embaixo do outro, davam duas linguagens diferentes. E a
 * mais pobre era a do plano de **R$ 250**, o mais caro dos três: quem rolava a
 * página via a oferta ficar menos cuidada conforme o preço subia.
 *
 * Compartilhar o componente é o que faz "mesmo desenho" continuar verdade
 * depois. Copiar o estilo resolveria hoje e divergiria no próximo ajuste, que
 * é exatamente o que aconteceu aqui.
 *
 * ## O que ele NÃO decide
 *
 * Onde o cartão aparece. Free e Pro vão lado a lado porque se excluem; o Max
 * vem depois, sozinho, porque não é uma terceira opção paralela, é tudo do Pro
 * mais uma coisa. Quem decide isso é quem monta a tela.
 */
export function CartaoDePlano({
  nome,
  preco,
  descricao,
  limites,
  recursos,
  ehAtual,
  recomendado,
  acao,
  aviso,
  observacao,
  className,
}: {
  nome: string
  /** Em reais, por mês. O `R$` e o `/mês` são desenhados aqui. */
  preco: number
  descricao: string
  limites: LimiteDoPlano[]
  recursos: string[]
  ehAtual: boolean
  recomendado?: boolean
  acao?: ReactNode
  aviso?: string | null
  /**
   * A letra miúda que precisa vir ANTES da compra, não depois.
   *
   * Hoje só o Max usa: ele é cobrado por empresa conectada, enquanto o Pro
   * cobre cinco pela mesma assinatura. Descobrir isso depois de pagar é o tipo
   * de surpresa que vira pedido de reembolso.
   */
  observacao?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex h-full flex-col gap-4 rounded-xl border p-5',
        // O plano ATUAL ganha o anel, mesmo não sendo o recomendado: a primeira
        // pergunta de quem abre esta tela é "em qual eu estou?", e ela precisa
        // ser respondida antes da segunda ("vale trocar?").
        ehAtual && 'border-primary/50 ring-primary/20 ring-2',
        !ehAtual && recomendado && 'border-primary/40 bg-primary/[0.03]',
        !ehAtual && !recomendado && 'border-border',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{nome}</span>
        {ehAtual ? (
          <Badge variant="secondary" className="gap-1">
            <Check className="size-3" aria-hidden />
            Plano atual
          </Badge>
        ) : (
          recomendado && (
            <Badge className="gap-1">
              <Zap className="size-3" aria-hidden />
              Recomendado
            </Badge>
          )
        )}
      </div>

      <div>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold tracking-tight tabular-nums">R$ {preco}</span>
          <span className="text-muted-foreground text-sm">/mês</span>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">{descricao}</p>
      </div>

      {/* Os três limites em faixa: é a pergunta que a pessoa traz ("cabe o meu
          caso?"), e ela não pode estar dissolvida numa lista onde tem o mesmo
          peso de "Funil visual". */}
      <div className="border-border/60 grid grid-cols-3 gap-2 rounded-lg border py-3">
        {limites.map((l) => {
          const Icone = l.icone
          return (
            <div key={l.rotulo} className="flex flex-col items-center gap-0.5 px-1 text-center">
              <Icone aria-hidden className="text-muted-foreground mb-0.5 size-4" />
              <span className="text-sm leading-tight font-semibold tabular-nums">{l.valor}</span>
              <span className="text-muted-foreground text-xs leading-tight">{l.rotulo}</span>
            </div>
          )
        })}
      </div>

      <ul className="flex flex-col gap-2 text-sm">
        {recursos.map((recurso) => (
          <li key={recurso} className="flex items-start gap-2">
            <Check aria-hidden className="text-primary mt-0.5 size-4 shrink-0" />
            <span>{recurso}</span>
          </li>
        ))}
      </ul>

      {observacao && (
        <p className="text-muted-foreground border-border/60 rounded-lg border p-3 text-xs leading-relaxed">
          {observacao}
        </p>
      )}

      {/* `mt-auto` empurra a ação para a base: com listas de tamanhos
          diferentes, os botões ficariam em alturas diferentes e a comparação
          lado a lado perderia a linha de base. */}
      {(acao || aviso) && (
        <div className="mt-auto pt-1">
          {acao}
          {aviso && <p className="text-muted-foreground text-sm">{aviso}</p>}
        </div>
      )}
    </div>
  )
}
