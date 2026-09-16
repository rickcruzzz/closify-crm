import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { formatBRL } from '@/lib/deals/metrics'
import { medidasDeDesempenho, type DesempenhoCru } from '@/lib/dashboard/desempenho'

/**
 * Ticket médio, tempo até fechar, e o dinheiro ganho e perdido no período.
 *
 * ## Por que este painel some inteiro em vez de mostrar zeros
 *
 * Empresa que ainda não fechou negócio nenhum não tem ticket médio nem ciclo.
 * Desenhar "R$ 0" e "0 dias" ali afirmaria desempenho ruim onde a verdade é
 * ausência de dado — a mesma distinção que `textoDaConversao` fez em 26/08 com
 * o percentual de conversão, e a razão de `medidasDeDesempenho` devolver lista
 * vazia em vez de quatro zeros.
 *
 * E some sem deixar buraco: o dashboard é uma coluna, então o card
 * simplesmente não existe naquele render.
 *
 * ## Cada número carrega a base ou a ressalva
 *
 * Ticket médio diz de quantas vendas saiu. Tempo até fechar diz que é
 * aproximado, porque `stage_changed_at` é a última troca de etapa e não a data
 * de fechamento. Número sem base é o defeito que este dashboard já teve com os
 * "100% de conversão" de um negócio só.
 */
export function PainelDeDesempenho({ desempenho }: { desempenho: DesempenhoCru }) {
  const medidas = medidasDeDesempenho(desempenho)
  if (medidas.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Desempenho</CardTitle>
        <CardDescription>O que os negócios fechados no período dizem.</CardDescription>
      </CardHeader>
      <CardContent>
        {/* `sm:grid-cols-2 lg:grid-cols-4` e não uma coluna por medida: o
            painel mostra de uma a quatro, e uma grade fixa em 4 deixaria vão
            morto quando só o ganho existe. `auto-cols` resolveria a largura e
            não a quebra no telefone. */}
        <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
          {medidas.map((m) => (
            <div key={m.chave} className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground text-xs font-medium">{m.rotulo}</dt>
              <dd className="text-xl leading-none font-semibold tabular-nums">
                {m.formato === 'dinheiro' ? formatBRL(m.valor) : `${m.valor} dias`}
              </dd>
              {m.nota && <p className="text-muted-foreground text-xs">{m.nota}</p>}
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}
