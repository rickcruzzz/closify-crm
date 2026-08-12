'use client'

import Link from 'next/link'
import { Building2, CreditCard, Plug, Users, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

export type AbaDeConfiguracoes = 'empresa' | 'equipe' | 'plano' | 'integracoes'

const ABAS: { valor: AbaDeConfiguracoes; rotulo: string; icone: LucideIcon }[] = [
  { valor: 'empresa', rotulo: 'Empresa', icone: Building2 },
  { valor: 'equipe', rotulo: 'Equipe', icone: Users },
  { valor: 'plano', rotulo: 'Plano', icone: CreditCard },
  { valor: 'integracoes', rotulo: 'Integrações', icone: Plug },
]

/**
 * As abas de Configurações.
 *
 * São LINKS, não botões com estado. A aba escolhida vira `?aba=` na URL, então
 * recarregar mantém onde a pessoa estava, dá para mandar o link de uma aba
 * específica para um colega, e o botão de voltar do navegador funciona. Estado
 * de cliente perderia as três coisas.
 *
 * `scroll={false}` porque trocar de aba não é navegar para outra página: o
 * salto ao topo faria a tela piscar sem motivo.
 */
export function SettingsTabs({ ativa }: { ativa: AbaDeConfiguracoes }) {
  return (
    <div
      role="tablist"
      aria-label="Seções das configurações"
      // A borda percorre a largura toda e a aba ativa a interrompe — é o que
      // liga visualmente a aba ao conteúdo abaixo dela.
      className="border-border/60 -mb-px flex gap-1 overflow-x-auto border-b"
    >
      {ABAS.map((aba) => {
        const selecionada = aba.valor === ativa
        const Icone = aba.icone

        return (
          <Link
            key={aba.valor}
            href={`/settings?aba=${aba.valor}`}
            scroll={false}
            role="tab"
            aria-selected={selecionada}
            className={cn(
              'focus-visible:ring-ring/50 flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3',
              selecionada
                ? 'border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground border-transparent',
            )}
          >
            <Icone aria-hidden className="size-4" />
            {aba.rotulo}
          </Link>
        )
      })}
    </div>
  )
}
