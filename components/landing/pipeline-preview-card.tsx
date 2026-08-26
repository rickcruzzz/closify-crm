import { dealStages, dealStageLabels } from '@/lib/deals/types'
import { mockDeals } from '@/lib/deals/mock-data'
import { formatCompactBRL } from '@/lib/deals/metrics'
import { stageAccent } from '@/lib/deals/stage-colors'

const stageSummary = dealStages.map((stage) => {
  const deals = mockDeals.filter((deal) => deal.stage === stage)
  return {
    stage,
    label: dealStageLabels[stage],
    count: deals.length,
    value: deals.reduce((sum, deal) => sum + deal.value, 0),
  }
})

const maxCount = Math.max(...stageSummary.map((s) => s.count))
const totalValue = stageSummary.reduce((sum, s) => sum + s.value, 0)

/**
 * O funil do hero, em HTML puro.
 *
 * A moldura segue o mesmo padrao do `produto-print`, e pelas mesmas razoes
 * medidas em 26/08: a borda a meia opacidade dava 1,16:1 contra o card branco,
 * ou seja, moldura invisivel no modo claro; e `shadow-2xl`
 * (`0 25px 50px -12px rgba(0,0,0,0.25)`) sumia no escuro e virava borrao
 * pesado no claro. `superficie-elevada` resolve os dois: sombra curta no
 * claro, nenhuma no escuro.
 */
export function PipelinePreviewCard() {
  return (
    <div className="border-border bg-card superficie-elevada overflow-hidden rounded-2xl border">
      <div className="border-border flex items-center gap-2 border-b px-4 py-3">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-red-500/70" />
          <span className="size-2.5 rounded-full bg-amber-500/70" />
          <span className="size-2.5 rounded-full bg-emerald-500/70" />
        </div>
        <span className="text-muted-foreground font-mono text-xs">
          funil de vendas · Acme Corp
        </span>
      </div>

      {/* Respiro e tipografia um passo acima do que era (tudo `text-xs`, gap-3,
          barra de 8px). Medido antes: o card tinha 276px de altura contra 532
          da coluna de texto ao lado, e o grid do Hero centraliza, então
          sobravam ~128px vazios acima e abaixo dele. É isso que se lê como
          "espaço vazio à direita", não largura: em largura o card sempre
          ocupou os 560px da coluna, sobra zero.

          A correção é dar corpo ao conteúdo, não esticar o card: escala por
          `transform` borraria o texto, e altura fixa deixaria o miolo boiando. */}
      <div className="flex flex-col gap-4 p-5 md:gap-5 md:p-6">
        {stageSummary.map((s) => (
          <div key={s.stage} className="flex items-center gap-3">
            {/* `w-36`, não `w-28`: com a fonte em `text-sm` os rótulos mais
                longos ("Contato Realizado", "Proposta Enviada") passavam de
                112px e o `truncate` os cortava com reticências. Nome de etapa
                cortado num mockup que existe para mostrar o produto é o pior
                lugar possível para economizar largura. */}
            <span className="text-muted-foreground w-36 shrink-0 truncate text-sm font-medium">
              {s.label}
            </span>
            <div className="bg-muted h-2.5 flex-1 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${maxCount === 0 ? 0 : (s.count / maxCount) * 100}%`,
                  backgroundColor: stageAccent[s.stage].bar,
                }}
              />
            </div>
            <span className="w-16 shrink-0 text-right text-sm font-medium whitespace-nowrap">
              {formatCompactBRL(s.value)}
            </span>
            <span className="text-muted-foreground w-5 shrink-0 text-right text-sm">
              {s.count}
            </span>
          </div>
        ))}
      </div>

      <div className="border-border flex items-center justify-between border-t px-5 py-4 md:px-6">
        <span className="text-muted-foreground font-mono text-xs">total no funil</span>
        <span className="text-base font-semibold">{formatCompactBRL(totalValue)}</span>
      </div>
    </div>
  )
}
