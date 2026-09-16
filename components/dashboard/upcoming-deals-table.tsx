import Link from 'next/link'
import { CalendarClock, CalendarPlus } from 'lucide-react'

import { cn } from '@/lib/utils'
import { dealStageLabels } from '@/lib/deals/types'
import type { UpcomingDeal } from '@/lib/dashboard/queries'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { formatBRL } from '@/lib/deals/metrics'
import { FUNIL, hrefDoNegocio } from '@/lib/dashboard/destinos'

// Devolve `null` sempre que não há prazo confiável para mostrar, quem chama
// exibe "Sem prazo". Antes a função aceitava qualquer string e calculava em
// cima do que `new Date()` devolvesse, o que produzia dois defeitos visíveis:
//
// 1) String vazia ou fora do formato vira `Invalid Date`, e todo o cálculo
//    vira `NaN`, a célula mostrava "vence em NaN dias".
// 2) Ano de dois dígitos ou zerado ("0026-08-09") é remapeado por
//    `new Date(ano, ...)` para 1900+ano, e a diferença virava dezenas de
//    milhares de dias: o famoso "atrasado há 46.000 dias".
//
// A validação abaixo cobre os dois, mais data que não existe no calendário
// (31/02, que o Date silenciosamente empurra para março).
function dueDateInfo(dueDate: string | null | undefined) {
  if (!dueDate) return null

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dueDate.trim())
  if (!match) return null

  const ano = Number(match[1])
  const mes = Number(match[2])
  const dia = Number(match[3])

  // Constrói em horário local de propósito: `due_date` é `date` no Postgres
  // (sem fuso), e `new Date('2026-08-09')` seria interpretado como meia-noite
  // UTC, em UTC-3 isso desloca a comparação contra a meia-noite local.
  const due = new Date(ano, mes - 1, dia)

  const dataReal =
    due.getFullYear() === ano && due.getMonth() === mes - 1 && due.getDate() === dia
  if (!dataReal) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000)

  if (diffDays < 0) {
    const label = diffDays === -1 ? 'atrasado há 1 dia' : `atrasado há ${-diffDays} dias`
    return { label, className: 'text-destructive' }
  }
  if (diffDays === 0)
    return { label: 'vence hoje', className: 'text-amber-500 dark:text-amber-400' }
  if (diffDays <= 3) {
    const label = diffDays === 1 ? 'vence em 1 dia' : `vence em ${diffDays} dias`
    return { label, className: 'text-amber-500 dark:text-amber-400' }
  }
  return { label: `vence em ${diffDays} dias`, className: 'text-muted-foreground' }
}

export function UpcomingDealsTable({
  deals,
  abertosSemPrazo = 0,
}: {
  deals: UpcomingDeal[]
  /**
   * Quantos negócios abertos existem sem prazo marcado.
   *
   * Só faz diferença quando `deals` sai vazio, e é ele que impede a tela de
   * mentir: ver a seção do estado vazio abaixo.
   */
  abertosSemPrazo?: number
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Negócios mais próximos do prazo</CardTitle>
        {/* O filtro de período do topo NÃO se aplica a este painel, e está
            certo: o período filtra `created_at` (quando o negócio nasceu) e
            aqui a pergunta é `due_date` (o que vence à frente). Recortar o que
            vem pela frente pela data de nascimento seria o defeito. O que
            faltava era a tela dizer isso, em vez de parecer que ignora o
            filtro em silêncio. */}
        <CardDescription>
          Sempre o que vem à frente, independente do período acima.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {deals.length === 0 ? (
          // Dois estados diferentes, que a versão anterior tratava como um.
          //
          // A lista sai vazia tanto para quem não tem negócio nenhum quanto
          // para quem tem vários e nenhum com prazo — e a tela dizia "Nenhum
          // negócio em aberto" nos dois casos, mandando criar o que já existe.
          // Medido em 26/08/2026: 4 negócios abertos no card ao lado, zero com
          // `due_date`, e esta caixa afirmando que não havia nenhum.
          abertosSemPrazo > 0 ? (
            <EmptyState
              icon={CalendarPlus}
              title={
                abertosSemPrazo === 1
                  ? 'Seu negócio em aberto está sem prazo'
                  : `Seus ${abertosSemPrazo} negócios em aberto estão sem prazo`
              }
              description="Marque uma data de fechamento em cada um e eles passam a aparecer aqui, do mais urgente para o menos."
            >
              <Button
                variant="outline"
                render={<Link href={FUNIL}>Definir prazos</Link>}
              />
            </EmptyState>
          ) : (
            <EmptyState
              icon={CalendarClock}
              title="Nenhum negócio em aberto"
              description="Assim que você criar negócios no funil, os prazos mais próximos aparecem aqui."
            >
              <Button
                variant="outline"
                render={<Link href={FUNIL}>Ir para o funil</Link>}
              />
            </EmptyState>
          )
        ) : (
          <>
            {/* Mesmos dados em cards abaixo de `lg`: cinco colunas com
                `whitespace-nowrap` só cabem quando o sidebar não divide a tela. */}
            <ul className="divide-y lg:hidden">
              {deals.map((deal) => {
                const due = dueDateInfo(deal.due_date)
                return (
                  <li key={deal.id}>
                    {/* O bloco INTEIRO é o link, não o título.
                        Ver "vence em 2 dias" e não conseguir abrir o negócio
                        era o beco sem saída que este trabalho fecha. As
                        margens negativas devolvem a área de toque até a borda
                        do cartão, sem mexer no alinhamento do texto. */}
                    <Link
                      href={hrefDoNegocio(deal.id)}
                      className="hover:bg-accent/40 focus-visible:ring-ring/50 -mx-2 flex flex-col gap-2 rounded-lg px-2 py-3 transition-colors outline-none focus-visible:ring-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-medium">{deal.title}</span>
                          {(deal.lead_name || deal.lead_company) && (
                            <span className="text-muted-foreground truncate text-xs">
                              {[deal.lead_name, deal.lead_company]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          )}
                        </div>
                        <span className="shrink-0 font-medium tabular-nums">
                          {formatBRL(deal.value)}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge variant="secondary">{dealStageLabels[deal.stage]}</Badge>
                        <span className={cn('font-medium', due?.className)}>
                          {due?.label ?? 'Sem prazo'}
                        </span>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>

            <div className="hidden lg:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    {/* ## "Contato" no lugar de "Responsável", e a ordem mudou
                        
                        O responsável saiu porque ele repete: medido no board
                        de prova, a mesma pessoa em cinco de cinco linhas. Numa
                        empresa de uma pessoa — que é o caso do público deste
                        produto — a coluna inteira é a mesma palavra cinco
                        vezes, e coluna que não distingue linha nenhuma só
                        consome largura.
                        
                        O que a pessoa precisa para AGIR sobre um prazo é quem
                        está do outro lado. Esse nome já existia no banco e a
                        tela nunca mostrou.
                        
                        E o VALOR foi para o fim, alinhado à direita: números
                        comparados entre si se leem por coluna, e coluna de
                        número no meio de texto obriga o olho a saltar. */}
                    <TableHead>Negócio</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Etapa</TableHead>
                    <TableHead>Prazo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deals.map((deal) => {
                    const due = dueDateInfo(deal.due_date)
                    return (
                      // `relative` na linha + `after:inset-0` no link: um
                      // único link cobre a linha inteira, então clicar na
                      // coluna "Prazo" abre o mesmo negócio que clicar no
                      // nome. Continua sendo um `<a>` de verdade — abre em
                      // nova aba, é alcançável por Tab e o leitor de tela
                      // anuncia o nome do negócio, o que `onClick` na linha
                      // não daria.
                      <TableRow
                        key={deal.id}
                        className="hover:bg-accent/40 relative cursor-pointer transition-colors"
                      >
                        <TableCell>
                          <div className="flex flex-col">
                            <Link
                              href={hrefDoNegocio(deal.id)}
                              className="focus-visible:ring-ring/50 rounded-sm font-medium outline-none after:absolute after:inset-0 focus-visible:ring-3"
                            >
                              {deal.title}
                            </Link>
                            {deal.lead_company && (
                              <span className="text-muted-foreground text-xs">
                                {deal.lead_company}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {deal.lead_name ? (
                            <span className="truncate">{deal.lead_name}</span>
                          ) : (
                            // Negócio sem contato vinculado existe: o funil
                            // aceita negócio solto. Dizer "Sem contato" é
                            // melhor que a célula vazia, que lê como falha de
                            // carregamento.
                            <span className="text-muted-foreground">Sem contato</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{dealStageLabels[deal.stage]}</Badge>
                        </TableCell>
                        <TableCell className={cn('font-medium', due?.className)}>
                          {due?.label ?? 'Sem prazo'}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatBRL(deal.value)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
