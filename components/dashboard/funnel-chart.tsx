'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Filter } from 'lucide-react'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { formatBRL, formatCompactBRL } from '@/lib/deals/metrics'
import type { FunnelStageCount } from '@/lib/dashboard/queries'
import { montarFunil, type LinhaDoFunil } from '@/lib/dashboard/funil'
import { stageAccent } from '@/lib/deals/stage-colors'
import { FUNIL, hrefDaEtapa } from '@/lib/dashboard/destinos'

/**
 * Negócios por etapa, em barras verticais.
 *
 * ## A etapa dominante, e por que ela NÃO apaga as outras aqui
 *
 * Medido no workspace principal em 16/09/2026: **110 dos 132 negócios em "A
 * contatar"**, 83% numa etapa só. Numa barra proporcional pura isso dá uma
 * barra cheia e cinco fios de dois pixels, e as cinco etapas que somam os
 * outros 22 negócios — inclusive "Negociação", que é dinheiro decidindo
 * agora — deixam de existir na tela.
 *
 * Três coisas resolvem isso ao mesmo tempo, e nenhuma delas é distorcer a
 * escala:
 *
 * 1. **O número vai ESCRITO acima de cada barra.** A barra deixa de ser a
 *    única portadora do dado; ela vira a comparação, o número vira o fato.
 *    Com "3" escrito em cima, uma barra de 2% continua informando.
 * 2. **O valor vai escrito embaixo**, no eixo, junto do nome da etapa. Duas
 *    perguntas respondidas por coluna, sem nenhum hover.
 * 3. **`minPointSize`**: etapa com negócio dentro nunca desenha zero pixel.
 *    Etapa VAZIA continua desenhando nada, porque aí o vazio é a informação.
 *
 * Escala truncada ou logarítmica foi recusada: ela some com o fato de que uma
 * etapa domina, e esse fato é o diagnóstico mais importante que este funil
 * dá — a fila de entrada entupida é o problema do negócio, não do gráfico.
 *
 * ## Nada depende de hover
 *
 * Este painel entra no PDF do "Exportar relatório" (`ReportArea` envolve os
 * três), e **no PDF não existe hover**. Até 16/09 o relatório que o cliente
 * recebia saía com barras sem nenhum valor legível.
 */
export function FunnelChart({
  data,
  abertosSemValor = 0,
}: {
  data: FunnelStageCount[]
  /** Negócios abertos com `value` zerado. Ver `ResumoDoFunil`. */
  abertosSemValor?: number
}) {
  const router = useRouter()
  const funil = montarFunil(data, abertosSemValor)

  function abrirEtapa(linha: LinhaDoFunil | undefined) {
    if (!linha || linha.quantidade === 0) return
    router.push(hrefDaEtapa(linha.stage))
  }

  if (funil.vazio) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Negócios por etapa</CardTitle>
          <CardDescription>
            Quantos negócios e quanto dinheiro há em cada etapa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-72 items-center justify-center">
            <EmptyState
              icon={Filter}
              title="Seu funil começa aqui"
              description="Crie o primeiro negócio para acompanhar quantas oportunidades estão em cada etapa e quanto elas valem."
            >
              <Button render={<Link href={FUNIL}>Criar negócio</Link>} />
            </EmptyState>
          </div>
        </CardContent>
      </Card>
    )
  }

  const maior = Math.max(...funil.linhas.map((l) => l.quantidade))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Negócios por etapa</CardTitle>
        <CardDescription>
          {funil.abertos} em aberto, {formatCompactBRL(funil.valorAberto)} em jogo. Clique
          numa etapa para abrir os negócios dela.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {/* A altura caiu de `h-80` para `h-72` na segunda passada.
            
            Com 24 contra 2 na etapa menor, os 320px de altura viravam meia
            tela de ar acima das cinco barras pequenas: o card ficava enorme e
            a densidade, baixa. Encurtar não muda a proporção entre as barras
            (ela é o dado), muda a quantidade de vazio ao redor delas. */}
        <div className="h-60 w-full sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={funil.linhas}
              // `top: 28` reserva a faixa do número escrito acima da barra
              // mais alta. Sem ela o rótulo da maior etapa é cortado pelo topo
              // do card, que é justamente a etapa que mais importa ler.
              margin={{ top: 28, right: 8, left: 8, bottom: 0 }}
              barCategoryGap="22%"
            >
              {/* ## O eixo perdeu os rótulos, e a LEGENDA virou o eixo
                  
                  Na segunda passada ficou evidente: o nome da etapa aparecia
                  duas vezes, no eixo e na legenda logo abaixo, a 40px de
                  distância. Duplicação que não informa — só consome altura e
                  faz a tela parecer cheia sem estar dizendo mais.
                  
                  Quem ficou foi a legenda, e por três razões: ela nomeia, ela
                  carrega o dinheiro, e ela é um BOTÃO de verdade. O rótulo do
                  eixo era um `<text>` de 12px com `tabIndex` — alvo que
                  ninguém acerta com o dedo e que leitor de tela anuncia mal.
                  
                  A linha do eixo fica: é ela que dá a base sobre a qual as
                  barras se apoiam, sem a qual elas flutuam. */}
              <XAxis
                dataKey="label"
                tick={false}
                tickLine={false}
                axisLine={{ stroke: 'var(--border)' }}
                height={1}
              />
              {/* Eixo Y escondido: o número já está escrito em cada barra, e
                  uma régua numérica ao lado seria a MESMA informação lida duas
                  vezes, roubando largura das barras. O eixo continua existindo
                  para o Recharts calcular a escala. */}
              <YAxis hide domain={[0, Math.max(1, maior)]} />
              <Tooltip
                content={<DicaDaEtapa />}
                // O realce padrão do Recharts pinta um bloco cinza da altura
                // inteira do card, mais pesado que a própria barra. Com
                // opacidade baixa ele vira contexto, não protagonista.
                cursor={{ fill: 'var(--muted)', opacity: 0.35 }}
              />
              <Bar
                dataKey="quantidade"
                radius={[6, 6, 0, 0]}
                maxBarSize={72}
                // 6px e nao 3: com 2 negocios contra 24, a barra menor dava 3px
                // e lia como risco, nao como barra. O piso nao distorce a
                // comparacao — ele garante que a etapa EXISTA na tela.
                minPointSize={6}
                isAnimationActive={false}
                onClick={(entrada: unknown) => abrirEtapa(entrada as LinhaDoFunil)}
                label={<NumeroNaBarra />}
              >
                {funil.linhas.map((linha) => (
                  <Cell
                    key={linha.stage}
                    fill={stageAccent[linha.stage].bar}
                    // Etapa vazia não navega: mandar alguém para uma coluna
                    // sem nada dentro é outro beco sem saída.
                    cursor={linha.quantidade > 0 ? 'pointer' : 'default'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ## A lista de atalhos, e por que ela não é redundante

            O SVG do Recharts não entra na ordem de tabulação e não é lido por
            leitor de tela como seis itens navegáveis. Até 16/09 a única forma
            de abrir uma etapa pelo teclado era o rótulo do eixo, um `<text>`
            com `tabIndex` — alvo de 12px que ninguém acha com o dedo.

            Estes botões são o MESMO destino, alcançáveis por Tab, com 44px de
            altura. Eles também são o que mantém o painel legível em 375px,
            onde seis rótulos no eixo não cabem lado a lado. */}
        {/* `grid-cols-6` a partir de `sm`: cada item cai exatamente sob a
            barra que nomeia, e e isso que faz a legenda poder SUBSTITUIR o
            eixo em vez de so acompanha-lo. Abaixo disso ela vira lista de duas
            colunas, na mesma ordem das etapas. */}
        <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-6">
          {funil.linhas.map((linha) => (
            <li key={linha.stage}>
              <button
                type="button"
                disabled={linha.quantidade === 0}
                onClick={() => abrirEtapa(linha)}
                aria-label={`${linha.label}: ${linha.quantidade} ${linha.quantidade === 1 ? 'negócio' : 'negócios'}, ${formatBRL(linha.valor)}. Abrir.`}
                className="hover:bg-muted/60 focus-visible:ring-ring/50 flex min-h-11 w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none"
              >
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: stageAccent[linha.stage].bar }}
                />
                <span className="min-w-0 flex-1">
                  {/* `title` porque `truncate` corta de verdade: medido em
                      1024px, onde a grade de 6 colunas divide a area util com
                      a barra lateral, cinco dos seis rotulos cortam. O nome
                      inteiro ja esta no `aria-label` para quem usa leitor de
                      tela; o `title` e para quem usa o mouse. */}
                  <span
                    title={linha.label}
                    className="text-muted-foreground block truncate text-xs"
                  >
                    {linha.label}
                  </span>
                  <span className="block text-sm font-medium tabular-nums">
                    {linha.quantidade}
                    {linha.valor > 0 && (
                      <span className="text-muted-foreground ml-1.5 text-xs font-normal">
                        {formatCompactBRL(linha.valor)}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>

        {/* A frase que impede a coluna de valor de parecer defeito.
            Medido: 119 de 132 negócios reais estão com valor zerado. */}
        {funil.abertosSemValor > 0 && (
          <p className="text-muted-foreground text-xs">
            {funil.abertosSemValor}{' '}
            {funil.abertosSemValor === 1
              ? 'negócio aberto está sem valor preenchido e não entra na soma.'
              : 'negócios abertos estão sem valor preenchido e não entram na soma.'}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * O número escrito acima da barra.
 *
 * É ele que faz a etapa de 2% continuar informando quando outra tem 83%. Zero
 * não é escrito: uma etapa vazia com "0" flutuando sobre o eixo lê como rótulo
 * órfão, e a ausência da barra já diz o que precisa.
 */
function NumeroNaBarra(props: {
  x?: number
  y?: number
  width?: number
  value?: number
}) {
  const { x = 0, y = 0, width = 0, value = 0 } = props
  if (!value) return null

  return (
    <text
      x={x + width / 2}
      y={y - 8}
      textAnchor="middle"
      className="fill-foreground text-sm font-semibold"
      style={{ fontVariantNumeric: 'tabular-nums' }}
    >
      {value}
    </text>
  )
}

/** Quantidade, valor e participação, na ordem em que a pergunta é feita. */
function DicaDaEtapa({
  active,
  payload,
}: {
  active?: boolean
  payload?: { payload: LinhaDoFunil }[]
}) {
  if (!active || !payload?.length) return null
  const linha = payload[0]!.payload

  return (
    <div className="bg-popover text-popover-foreground ring-foreground/10 rounded-lg px-3 py-2 text-xs shadow-sm ring-1">
      <p className="font-medium">{linha.label}</p>
      <p className="tabular-nums">
        {linha.quantidade} {linha.quantidade === 1 ? 'negócio' : 'negócios'} ·{' '}
        {formatBRL(linha.valor)}
      </p>
      <p className="text-muted-foreground tabular-nums">
        {linha.participacao}% do funil
        {linha.quantidade > 0 ? ' · clique para abrir' : ''}
      </p>
    </div>
  )
}
