'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Building2, CreditCard, Loader2, Plug, Users, type LucideIcon } from 'lucide-react'

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
 * A URL continua sendo a fonte da verdade (`?aba=`), então recarregar mantém
 * onde a pessoa estava, dá para mandar o link de uma aba específica para um
 * colega, e o botão de voltar do navegador funciona — nada disso muda.
 *
 * O que mudou: de `<Link>` puro para `router.push` dentro de `useTransition`,
 * com spinner na aba clicada. Cada aba carrega uma quantidade diferente de
 * dado no servidor (Plano roda uma RPC de escrita, Integrações busca duas
 * consultas a mais), e sem nenhum sinal entre o clique e o conteúdo novo
 * aparecer, o clique parece não ter feito nada — a pessoa clica de novo,
 * às vezes uma terceira, achando que travou. É a mesma classe de queixa já
 * resolvida em `workspace-switcher.tsx` e `user-menu.tsx`: o problema nunca
 * foi demora, foi ausência de feedback durante a espera.
 *
 * `scroll={false}` equivalente via `router.push(..., { scroll: false })`:
 * trocar de aba não é navegar para outra página, o salto ao topo faria a
 * tela piscar sem motivo.
 */
export function SettingsTabs({ ativa }: { ativa: AbaDeConfiguracoes }) {
  const router = useRouter()
  const [abaPendente, setAbaPendente] = React.useState<AbaDeConfiguracoes | null>(null)
  const [, startTransition] = React.useTransition()

  function trocarAba(aba: AbaDeConfiguracoes) {
    if (aba === ativa || abaPendente) return
    setAbaPendente(aba)
    startTransition(() => {
      router.push(`/settings?aba=${aba}`, { scroll: false })
    })
  }

  // A troca real de `ativa` (prop vinda do servidor) é o sinal de que a
  // navegação de fato terminou — desliga o pendente nesse momento, não num
  // temporizador fixo que poderia desligar cedo demais ou tarde demais.
  React.useEffect(() => {
    setAbaPendente(null)
  }, [ativa])

  return (
    <div
      role="tablist"
      aria-label="Seções das configurações"
      // A borda percorre a largura toda e a aba ativa a interrompe, é o que
      // liga visualmente a aba ao conteúdo abaixo dela.
      className="border-border/60 -mb-px flex gap-1 overflow-x-auto border-b"
    >
      {ABAS.map((aba) => {
        const selecionada = aba.valor === ativa
        const pendente = aba.valor === abaPendente
        const Icone = aba.icone

        return (
          <button
            key={aba.valor}
            type="button"
            onClick={() => trocarAba(aba.valor)}
            role="tab"
            aria-selected={selecionada}
            disabled={!!abaPendente}
            className={cn(
              'focus-visible:ring-ring/50 flex min-h-11 shrink-0 cursor-pointer items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3 disabled:cursor-default',
              selecionada
                ? 'border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground border-transparent',
            )}
          >
            {pendente ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : (
              <Icone aria-hidden className="size-4" />
            )}
            {aba.rotulo}
          </button>
        )
      })}
    </div>
  )
}
