import { AlertTriangle, Thermometer } from 'lucide-react'

import type { DegrauDaProspeccao, LinhaDeObjecao, LinhaDeSegmento, Temperaturas } from '@/lib/dono/inteligencia'
import { MINIMO_PARA_TAXA } from '@/lib/dono/inteligencia'
import { cn } from '@/lib/utils'

/**
 * O painel da prospecção, desenhado para NÃO afirmar o que ainda não sabe.
 *
 * ## A escolha visual que carrega a decisão
 *
 * Toda superfície aqui mostra **contagem** em destaque e **taxa** só quando ela
 * existe. Onde a amostra não chegou, o lugar da taxa não fica vazio nem mostra
 * zero: ele diz quantas abordagens faltam. Vazio lê-se como "não deu nada";
 * zero lê-se como "ninguém respondeu"; e as duas leituras são falsas quando a
 * verdade é "ainda não dá para saber".
 */

const percentual = (v: number) => `${(v * 100).toFixed(1)}%`

export function FunilDaProspeccao({ funil }: { funil: DegrauDaProspeccao[] }) {
  const topo = funil[0]?.quantidade ?? 0

  return (
    <div className="border-border bg-card flex flex-col gap-3 rounded-lg border p-4">
      {funil.map((degrau, i) => {
        const largura = topo === 0 ? 0 : (degrau.quantidade / topo) * 100
        return (
          <div key={degrau.rotulo} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium">{degrau.rotulo}</span>
              <span className="text-muted-foreground flex items-baseline gap-2 tabular-nums">
                {degrau.taxa !== null && i > 0 && (
                  <span className="text-xs">{percentual(degrau.taxa)} do anterior</span>
                )}
                <span className="text-foreground font-semibold">{degrau.quantidade}</span>
              </span>
            </div>
            <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
              <div
                className="bg-primary h-full rounded-full transition-[width]"
                style={{ width: `${Math.max(largura, degrau.quantidade > 0 ? 1.5 : 0)}%` }}
              />
            </div>
            <p className="text-muted-foreground text-xs">{degrau.explicacao}</p>
          </div>
        )
      })}

      {/*
        A ausência dos dois últimos degraus é a informação, não uma falta de
        acabamento. Dizê-la na tela impede a conclusão errada — "ninguém chega
        ao checkout" — de nascer de um gráfico que simplesmente para.
      */}
      <p className="text-muted-foreground border-border mt-1 border-t pt-3 text-xs">
        <strong className="text-foreground">Checkout e pagamento não aparecem aqui.</strong> Não
        existe ligação entre um prospect abordado e uma conta que alguém criou depois — é o achado
        ALTO nº 4 da auditoria de 12/09, ainda aberto. Mostrar &ldquo;0 pagaram&rdquo; seria
        afirmar que ninguém chegou lá, quando a verdade é que não há como saber.
      </p>
    </div>
  )
}

export function Temperatura({ contagem }: { contagem: Temperaturas }) {
  const ordem: { chave: keyof Temperaturas; rotulo: string; cor: string }[] = [
    { chave: 'fechamento', rotulo: 'Fechamento', cor: 'bg-emerald-500' },
    { chave: 'muito_quente', rotulo: 'Muito quente', cor: 'bg-orange-500' },
    { chave: 'quente', rotulo: 'Quente', cor: 'bg-amber-500' },
    { chave: 'morno', rotulo: 'Morno', cor: 'bg-sky-500' },
    { chave: 'frio', rotulo: 'Frio', cor: 'bg-slate-400' },
  ]
  const total = ordem.reduce((s, o) => s + contagem[o.chave], 0)

  if (total === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Nenhuma resposta classificada ainda. A temperatura aparece quando a primeira for lida.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {ordem.map((o) => (
        <div key={o.chave} className="flex items-center gap-3 text-sm">
          <span className={cn('size-2.5 shrink-0 rounded-full', o.cor)} aria-hidden />
          <span className="flex-1">{o.rotulo}</span>
          <span className="tabular-nums font-medium">{contagem[o.chave]}</span>
        </div>
      ))}
    </div>
  )
}

export function Objecoes({ linhas, respostas }: { linhas: LinhaDeObjecao[]; respostas: number }) {
  if (linhas.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {respostas === 0
          ? 'Nenhuma resposta classificada ainda.'
          : 'Nenhuma das respostas lidas trouxe objeção. É informação, não vazio.'}
      </p>
    )
  }

  return (
    <ol className="flex flex-col gap-2">
      {linhas.map((l, i) => (
        <li key={l.objecao} className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground w-4 shrink-0 tabular-nums">{i + 1}</span>
          <span className="flex-1 font-medium">{l.objecao}</span>
          <span className="text-muted-foreground tabular-nums text-xs">
            {percentual(l.fatia)}
          </span>
          <span className="w-8 shrink-0 text-right tabular-nums font-medium">{l.quantidade}</span>
        </li>
      ))}
    </ol>
  )
}

/**
 * Um ranking de segmento — nicho, gancho ou faixa de pontos.
 *
 * A coluna da taxa é a razão de este componente existir em vez de uma tabela
 * genérica: ela precisa saber se recusar. Abaixo do piso de amostra ela diz
 * quantas faltam, e essa frase é o que impede alguém de comparar dois nichos
 * com sete abordagens cada.
 */
export function Ranking({
  linhas,
  rotuloDaColuna,
  vazio,
}: {
  linhas: LinhaDeSegmento[]
  rotuloDaColuna: string
  vazio: string
}) {
  if (linhas.length === 0) return <p className="text-muted-foreground text-sm">{vazio}</p>

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] text-sm">
        <thead>
          <tr className="text-muted-foreground border-border border-b text-left text-xs">
            <th className="py-2 pr-3 font-medium">{rotuloDaColuna}</th>
            <th className="py-2 pr-3 text-right font-medium">Abordados</th>
            <th className="py-2 pr-3 text-right font-medium">Responderam</th>
            <th className="py-2 pr-3 text-right font-medium">Interessados</th>
            <th className="py-2 text-right font-medium">Taxa</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.rotulo} className="border-border/60 border-b last:border-0">
              <td className="max-w-[18rem] truncate py-2 pr-3" title={l.rotulo}>
                {l.rotulo}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">{l.abordados}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{l.responderam}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{l.interessados}</td>
              <td className="py-2 text-right tabular-nums">
                {l.taxaDeResposta !== null ? (
                  <span className="font-medium">{percentual(l.taxaDeResposta)}</span>
                ) : (
                  <span className="text-muted-foreground text-xs">
                    faltam {l.faltamParaMedir}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-muted-foreground mt-3 flex items-start gap-2 text-xs">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>
          A taxa só aparece a partir de <strong>{MINIMO_PARA_TAXA} abordagens</strong> no segmento.
          Cold outreach responde de 3,8% a 7,2%: com trinta abordagens o esperado é UMA resposta, e
          a diferença entre uma e duas dobraria a &ldquo;taxa&rdquo; por puro acaso.
        </span>
      </p>
    </div>
  )
}

export function CartaoDeNumero({
  rotulo,
  valor,
  detalhe,
  alerta,
}: {
  rotulo: string
  valor: string
  detalhe?: string
  alerta?: boolean
}) {
  return (
    <div
      className={cn(
        'border-border bg-card flex flex-col gap-1 rounded-lg border p-4',
        alerta && 'border-amber-500/50',
      )}
    >
      <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
        {alerta && <Thermometer className="size-3.5" aria-hidden />}
        {rotulo}
      </span>
      <span className="text-2xl font-semibold tabular-nums">{valor}</span>
      {detalhe && <span className="text-muted-foreground text-xs">{detalhe}</span>}
    </div>
  )
}
