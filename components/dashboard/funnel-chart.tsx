'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Filter } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import { formatBRL, formatCompactBRL } from '@/lib/deals/metrics'
import type { FunnelStageCount } from '@/lib/dashboard/queries'
import { montarFunil, type LinhaDoFunil } from '@/lib/dashboard/funil'
import { stageAccent } from '@/lib/deals/stage-colors'
import { FUNIL, hrefDaEtapa } from '@/lib/dashboard/destinos'

/**
 * O funil, como LISTA de etapas e não como gráfico de barras.
 *
 * ## O gráfico anterior desperdiçava o card por construção
 *
 * Medido no workspace principal em 16/09/2026: **110 dos 132 negócios em "A
 * contatar"**. Numa barra proporcional isso dá uma barra cheia e cinco fios, e
 * as cinco etapas que somam os outros 22 negócios — inclusive "Negociação",
 * que é dinheiro decidindo agora — ficavam ilegíveis. Mais de dois terços da
 * largura do card eram grade vazia à direita.
 *
 * Três direções foram exploradas na Replicate a partir de uma captura real
 * (`scripts/design/explorar-dashboard.mjs`) antes de escrever esta linha. O
 * funil em trapézio, que é o desenho óbvio, foi RECUSADO por medição: com
 * 28/6/0/0/0/0 os segmentos saem quase do mesmo tamanho e blocos enormes
 * exibem "0". Ele é bonito e mente.
 *
 * ## O que a lista resolve
 *
 * A barra deixa de ser a portadora do número. Cada linha diz em texto quantos
 * negócios, quanto em dinheiro e que fatia do funil aquilo é; a barra fica
 * como leitura periférica, com piso de 2% para etapa com negócio dentro nunca
 * sumir. Nenhuma informação depende de hover, o que importa porque **este
 * painel entra no PDF do "Exportar relatório", e no PDF não existe hover**.
 *
 * ## O que foi PRESERVADO
 *
 * Clicar numa etapa continua abrindo os negócios dela, etapa vazia continua
 * não navegando, e o alvo continua alcançável por teclado. Agora o alvo é a
 * linha inteira (~1100x56px) em vez do rótulo de 12px do eixo.
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

  function abrirEtapa(linha: LinhaDoFunil) {
    if (linha.quantidade === 0) return
    router.push(hrefDaEtapa(linha.stage))
  }

  if (funil.vazio) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Funil de negócios</CardTitle>
          <CardDescription>
            Quantos negócios e quanto dinheiro há em cada etapa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-64 items-center justify-center">
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Funil de negócios</CardTitle>
        <CardDescription>
          {funil.abertos} em aberto, {formatCompactBRL(funil.valorAberto)} em jogo. Clique
          numa etapa para abrir os negócios dela.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-1">
        {/* Cabeçalho da tabela visual. Some no telefone, onde a linha vira
            duas alturas e o rótulo ficaria longe demais do número que nomeia. */}
        <div className="text-muted-foreground hidden px-3 pb-1 text-xs sm:grid sm:grid-cols-[minmax(9rem,1.4fr)_5rem_7rem_1fr] sm:gap-4">
          <span>Etapa</span>
          <span className="text-right">Negócios</span>
          <span className="text-right">Valor</span>
          <span className="text-right">Participação</span>
        </div>

        <ul className="flex flex-col">
          {funil.linhas.map((linha) => (
            <LinhaDaEtapa
              key={linha.stage}
              linha={linha}
              aoAbrir={() => abrirEtapa(linha)}
            />
          ))}
        </ul>

        {/* A frase que impede a coluna de valor de parecer defeito.
            Medido: 119 de 132 negócios reais estão com valor zerado. Sem isto a
            pessoa lê seis "R$ 0" e conclui que o sistema não está somando. */}
        {funil.abertosSemValor > 0 && (
          <p className="text-muted-foreground mt-2 px-3 text-xs">
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
 * `65,4%`, com VIRGULA.
 *
 * `{linha.participacao}%` direto no JSX imprime o número do jeito do
 * JavaScript, com ponto decimal — e num produto brasileiro, ao lado de
 * `R$ 34.550`, isso põe as duas convenções decimais na mesma linha. O
 * dashboard já pagou exatamente esse defeito em 08/09, quando a Central
 * mostrava `R$ 2,39` e `5.26%` lado a lado.
 *
 * Inteiro sai sem casa: `8%`, não `8,0%`.
 */
function formatarParticipacao(n: number): string {
  return `${Number.isInteger(n) ? n : n.toFixed(1).replace('.', ',')}%`
}

function LinhaDaEtapa({ linha, aoAbrir }: { linha: LinhaDoFunil; aoAbrir: () => void }) {
  const clicavel = linha.quantidade > 0

  const conteudo = (
    <>
      {/* No telefone o rótulo ocupa a LINHA inteira: com ele dividindo espaço
          com o valor, "Contato Realizado" saía cortado em "Contato Realiza…",
          e nome de etapa truncado deixa a pessoa sem saber que linha está
          lendo. A partir de `sm` ele volta a ser a primeira coluna da tabela. */}
      <span className="col-span-2 flex min-w-0 items-center gap-2.5 sm:col-span-1">
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: stageAccent[linha.stage].bar }}
        />
        <span className="truncate font-medium">{linha.label}</span>
      </span>

      <span className="tabular-nums sm:text-right">
        <span className="text-muted-foreground mr-1 text-xs sm:hidden">Negócios</span>
        {linha.quantidade}
      </span>

      {/* `formatBRL` e não compacto: aqui os valores são comparados entre si
          linha a linha, e "R$ 8,4 mil" ao lado de "R$ 11,9 mil" esconde a
          diferença que a pessoa quer ver. O compacto fica no resumo do topo,
          onde o número é lido sozinho. */}
      <span
        className={cn(
          'tabular-nums sm:text-right',
          linha.valor === 0 && 'text-muted-foreground',
        )}
      >
        <span className="text-muted-foreground mr-1 text-xs sm:hidden">Valor</span>
        {formatBRL(linha.valor)}
      </span>

      {/* A barra atravessa as duas colunas no telefone, pelo mesmo motivo do
          rótulo: espremida em meia largura ela vira um traço de 40px, e aí não
          informa proporção nenhuma. */}
      <span className="col-span-2 flex items-center gap-2 sm:col-span-1 sm:justify-end">
        {/* A barra vem ANTES do número na ordem visual e DEPOIS na leitura:
            ela é referência periférica, o número é o dado. */}
        <span
          aria-hidden
          className="bg-muted relative h-1.5 w-full max-w-24 overflow-hidden rounded-full sm:w-24"
        >
          <span
            className="bg-primary/70 group-hover/etapa:bg-primary absolute inset-y-0 left-0 rounded-full transition-[width,background-color] duration-200 motion-reduce:transition-none"
            style={{ width: `${linha.larguraDaBarra}%` }}
          />
        </span>
        <span className="text-muted-foreground w-11 shrink-0 text-right text-xs tabular-nums">
          {formatarParticipacao(linha.participacao)}
        </span>
      </span>
    </>
  )

  const classes =
    'group/etapa grid grid-cols-2 items-center gap-x-4 gap-y-1 rounded-lg px-3 py-2.5 text-sm sm:grid-cols-[minmax(9rem,1.4fr)_5rem_7rem_1fr] sm:gap-4'

  if (!clicavel) {
    return (
      <li>
        {/* Etapa vazia não é link: mandar alguém para uma coluna sem nada
            dentro é outro beco. Ela fica com opacidade menor para a diferença
            ser perceptível antes do clique que não acontece. */}
        <div className={cn(classes, 'text-muted-foreground opacity-70')}>{conteudo}</div>
      </li>
    )
  }

  return (
    <li>
      <button
        type="button"
        onClick={aoAbrir}
        aria-label={`${linha.label}: ${linha.quantidade} ${linha.quantidade === 1 ? 'negócio' : 'negócios'}, ${formatBRL(linha.valor)}, ${formatarParticipacao(linha.participacao)} do funil. Abrir.`}
        className={cn(
          classes,
          'hover:bg-muted/60 focus-visible:ring-ring/50 w-full cursor-pointer text-left transition-colors outline-none focus-visible:ring-3 motion-reduce:transition-none',
        )}
      >
        {conteudo}
      </button>
    </li>
  )
}
