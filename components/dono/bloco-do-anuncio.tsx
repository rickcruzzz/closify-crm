import { Megaphone } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatarDinheiro } from '@/lib/dono/formato'
import type { Resultado, ResumoDoAnuncio } from '@/lib/dono/tipos'

/**
 * O que o anúncio está gastando e trazendo.
 *
 * ## Por que o estado desligado é instrutivo, e não vazio
 *
 * Hoje não existe token com permissão de ler gasto (só o de enviar conversão),
 * então este bloco não tem números. A tentação é mostrar "R$ 0,00" — e isso
 * seria mentira perigosa: gasto zero por falta de token é indistinguível de
 * gasto zero de verdade, e a diferença entre os dois é justamente o que decide
 * se há campanha rodando ou não.
 *
 * Então o bloco explica o que falta. Uma tela de monitoramento que não sabe
 * algo precisa dizer que não sabe.
 */
export function BlocoDoAnuncio({ anuncio }: { anuncio: Resultado<ResumoDoAnuncio> }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Megaphone aria-hidden className="size-5" />
        Anúncio
      </h2>

      {!anuncio.ok ? (
        <Card size="sm">
          <CardContent className="flex flex-col gap-2 py-6">
            <p className="text-sm font-medium">Ainda não consigo ler os números do anúncio.</p>
            <p className="text-muted-foreground text-sm text-pretty">{anuncio.erro}</p>
            <p className="text-muted-foreground text-sm text-pretty">
              Para ligar: gere um token na Meta com permissão <code>ads_read</code> e coloque em{' '}
              <code>META_ADS_TOKEN</code> no <code>.env.local</code>. O bloco liga sozinho depois
              disso.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MiniCard rotulo="Gasto (30 dias)" valor={formatarDinheiro(anuncio.dados.gasto)} />
            <MiniCard rotulo="Pessoas alcançadas" valor={anuncio.dados.alcance.toLocaleString('pt-BR')} />
            <MiniCard rotulo="Cliques" valor={anuncio.dados.cliques.toLocaleString('pt-BR')} />
            <MiniCard
              rotulo="Custo por clique"
              valor={formatarDinheiro(anuncio.dados.custoPorClique)}
            />
          </div>

          <Card size="sm">
            <CardHeader>
              <CardTitle className="text-sm">
                Campanhas em {anuncio.dados.contaNome}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {anuncio.dados.campanhas.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhuma campanha nesta conta.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {anuncio.dados.campanhas.map((campanha) => (
                    <li key={campanha.id} className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm">{campanha.nome}</span>
                        {campanha.ativa ? (
                          <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-500">
                            No ar
                          </Badge>
                        ) : (
                          <Badge variant="outline">Pausada</Badge>
                        )}
                      </div>
                      <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
                        {formatarDinheiro(campanha.gasto)} · {campanha.cliques} clique(s)
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </section>
  )
}

function MiniCard({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-muted-foreground text-sm font-medium">{rotulo}</CardTitle>
      </CardHeader>
      <CardContent>
        <span className="text-2xl font-semibold tabular-nums">{valor}</span>
      </CardContent>
    </Card>
  )
}
