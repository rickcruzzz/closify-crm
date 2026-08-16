import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { mockDeals } from '@/lib/deals/mock-data'
import { dealStageLabels, type DealStage } from '@/lib/deals/types'
import { stageAccent } from '@/lib/deals/stage-colors'

/**
 * Prévia do pipeline real, para a landing.
 *
 * A página vendia "pipeline visual Kanban" sem mostrar um. O único visual era
 * um resumo em barras — informativo, mas não parecido com a tela que a pessoa
 * vai usar, e a dúvida "como isso se parece de verdade?" ficava sem resposta
 * até depois do cadastro.
 *
 * Reproduz o card do Kanban (mesmo `stageAccent`, mesma hierarquia: valor em
 * destaque, título, empresa, avatar do responsável e prazo) sem importar o
 * componente real: `DealCard` depende de `useSortable`, que arrastaria o
 * dnd-kit inteiro para o bundle da landing por um bloco que ninguém arrasta.
 *
 * As três primeiras etapas bastam — as seis não caberiam legíveis, e o que se
 * quer comunicar é o formato, não o funil completo.
 */
const ETAPAS_VISIVEIS: DealStage[] = ['novo', 'contato_realizado', 'proposta_enviada']

/**
 * Os títulos do mock seguem "Serviço — Empresa"; a empresa sai daí em vez de
 * uma tabela de leads fictícios só para isto. Se o formato mudar, o card
 * simplesmente não mostra a linha da empresa — nada quebra.
 */
function empresaDoTitulo(titulo: string) {
  const partes = titulo.split('—')
  return partes.length > 1 ? partes[partes.length - 1]!.trim() : ''
}

/** Só o serviço, sem a empresa que já aparece na linha de baixo. */
function servicoDoTitulo(titulo: string) {
  return titulo.split('—')[0]!.trim()
}

function formatarBRL(valor: number) {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

function iniciais(nome: string) {
  return nome
    .split(' ')
    .slice(0, 2)
    .map((parte) => parte[0])
    .join('')
    .toUpperCase()
}

const colunas = ETAPAS_VISIVEIS.map((stage) => {
  const negocios = mockDeals.filter((d) => d.stage === stage).slice(0, 2)
  return {
    stage,
    label: dealStageLabels[stage],
    total: mockDeals.filter((d) => d.stage === stage).length,
    negocios,
  }
})

export function KanbanPreview() {
  return (
    <div
      // `aria-hidden`: é ilustração do produto, não conteúdo. Um leitor de tela
      // anunciando 6 cards de negócios fictícios atrapalharia mais do que
      // ajudaria — o que a seção comunica já está no texto ao lado.
      aria-hidden
      className="border-border/50 bg-card overflow-hidden rounded-2xl border shadow-2xl"
    >
      <div className="border-border/50 flex items-center gap-2 border-b px-4 py-3">
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-red-500/70" />
          <span className="size-2.5 rounded-full bg-amber-500/70" />
          <span className="size-2.5 rounded-full bg-emerald-500/70" />
        </span>
        <span className="text-muted-foreground font-mono text-xs">
          funil de vendas · Acme Corp
        </span>
      </div>

      {/* Rolagem horizontal em telas estreitas: três colunas de 176px não
          cabem em 375px, e espremer viraria card ilegível. */}
      <div className="flex gap-3 overflow-x-auto p-4">
        {colunas.map((coluna) => (
          <div key={coluna.stage} className="flex w-44 shrink-0 flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs font-medium">{coluna.label}</span>
              <Badge variant="secondary" className="shrink-0 px-1.5 text-[10px]">
                {coluna.total}
              </Badge>
            </div>

            {coluna.negocios.map((negocio) => (
              <Card
                key={negocio.id}
                size="sm"
                className={cn('border-l-2', stageAccent[negocio.stage])}
              >
                <CardContent className="flex flex-col gap-1">
                  <span className="text-sm font-semibold">
                    {formatarBRL(negocio.value)}
                  </span>
                  <span className="line-clamp-2 text-xs leading-snug">
                    {servicoDoTitulo(negocio.title)}
                  </span>
                  <span className="text-muted-foreground truncate text-[10px]">
                    {empresaDoTitulo(negocio.title)}
                  </span>
                  <div className="mt-0.5">
                    <Avatar size="sm" className="size-5">
                      <AvatarFallback className="text-[9px]">
                        {iniciais(negocio.owner)}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
