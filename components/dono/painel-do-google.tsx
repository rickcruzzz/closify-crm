import { AlertTriangle, Check, X } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DesempenhoDoGoogle } from '@/lib/dono/google-ads'
import { cn } from '@/lib/utils'

/**
 * O Google Ads na Central, lido por API.
 *
 * ## O que esta tela substitui
 *
 * Até 08/09 a única forma de ver esta campanha era dirigir o navegador com
 * Chrome em porta de depuração, perfil temporário e login do dono — um
 * procedimento que custou uma sessão, quebra a cada mudança de layout do
 * painel, e deixa uma sessão viva do Google numa pasta temporária. Com o
 * developer token aprovado, tudo isto sai de uma consulta.
 *
 * ## Por que palavra a palavra, e ordenada por impressão
 *
 * O total da campanha esconde a única informação acionável. Medido em 08/09:
 * `crm de vendas` teve 22 impressões e ZERO cliques; `quanto custa um crm` teve
 * 16 e levou os dois. O agregado diria "38 impressões, CTR 5,26%" e mandaria
 * manter as duas.
 */

function Sim({ ligado, rotulo }: { ligado: boolean; rotulo: string }) {
  return (
    <span className="flex items-center gap-1.5 text-sm">
      {ligado ? (
        <Check className="size-4 text-emerald-500" aria-hidden />
      ) : (
        <X className="text-muted-foreground size-4" aria-hidden />
      )}
      {rotulo}
    </span>
  )
}

const dinheiro = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * Um centavo de diferença para o painel do Google é esperado, e não é defeito.
 *
 * Medido em 08/09: R$ 4,77 em 2 cliques dá R$ 2,385, que arredonda para R$ 2,39
 * aqui e aparece como R$ 2,38 no painel deles. O Google calcula sobre os micros
 * inteiros e trunca; nós dividimos o valor já convertido e arredondamos.
 *
 * Fica escrito para ninguém "consertar" isso depois achando que a leitura está
 * errada — ela não está, e perseguir o centavo exigiria replicar a regra de
 * arredondamento interna deles, que não é publicada.
 */

/**
 * `—` e não `0%`: sem impressão não existe CTR zero, existe ausência de dado.
 *
 * `toLocaleString` e não `toFixed`: a mesma tela mostrava `R$ 2,39` com vírgula
 * (vem de `Intl`) e `5.26%` com ponto (vinha de `toFixed`). Duas convenções
 * decimais lado a lado num painel em português leem como defeito.
 */
const percentual = (v: number | null) =>
  v === null
    ? '-'
    : (v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
      '%'

export function PainelDoGoogle({ dados }: { dados: DesempenhoDoGoogle }) {
  const semDisplay = dados.redes ? !dados.redes.display && !dados.redes.parceirosDePesquisa : false

  return (
    <Card>
      <CardHeader className="flex flex-col items-start gap-1">
        <CardTitle>Google Ads</CardTitle>
        <p className="text-muted-foreground text-sm">
          Conta {dados.conta.id} · {dados.conta.nome} · {dados.conta.moeda}
          {dados.conta.ehContaDeTeste ? (
            <span className="text-amber-500"> · CONTA DE TESTE</span>
          ) : null}
        </p>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        {dados.campanhas.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nenhuma campanha com dado nos últimos 7 dias.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {dados.campanhas.map((c) => (
              <div key={c.id} className="border-border/60 flex flex-col gap-1 rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{c.nome}</span>
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[11px] font-medium',
                      c.status === 'ENABLED'
                        ? 'bg-emerald-500/15 text-emerald-500'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {c.status}
                  </span>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {dinheiro(c.orcamentoDiario)}/dia
                  </span>
                </div>
                <div className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-1 text-sm tabular-nums">
                  <span>
                    <span className="text-foreground font-semibold">{c.impressoes}</span> impressões
                  </span>
                  <span>
                    <span className="text-foreground font-semibold">{c.cliques}</span> cliques
                  </span>
                  <span>CTR {percentual(c.ctr)}</span>
                  <span>CPC {c.cpcMedio === null ? '-' : dinheiro(c.cpcMedio)}</span>
                  <span>
                    gasto <span className="text-foreground font-semibold">{dinheiro(c.custo)}</span>
                  </span>
                  <span>
                    <span className="text-foreground font-semibold">{c.conversoes}</span> conversões
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {dados.redes ? (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Onde o dinheiro pode ser gasto</h3>
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <Sim ligado={dados.redes.pesquisaDoGoogle} rotulo="Pesquisa do Google" />
              <Sim ligado={dados.redes.parceirosDePesquisa} rotulo="Parceiros de pesquisa" />
              <Sim ligado={dados.redes.display} rotulo="Display" />
            </div>
            {/* Os dois desligados é o desenho certo, e a tela diz isso — senão
                a próxima pessoa lê dois "não" e acha que falta configurar. */}
            <p className="text-muted-foreground text-xs">
              {semDisplay
                ? 'Parceiros e Display desligados de propósito: os dois gastam fora da busca, e sem eles cada clique tem origem conhecida.'
                : 'Atenção: Display ou parceiros ligados gastam fora da busca do Google.'}
            </p>
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Palavras-chave, por impressão</h3>
          {dados.palavras.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhuma palavra com dado no período.</p>
          ) : (
            <ul className="divide-border/60 border-border/60 divide-y overflow-hidden rounded-lg border text-sm">
              {dados.palavras.map((p) => (
                <li
                  key={p.texto + p.correspondencia}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2"
                >
                  <span className="w-14 shrink-0 text-right tabular-nums">{p.impressoes} impr</span>
                  <span className="w-14 shrink-0 text-right tabular-nums">{p.cliques} cliq</span>
                  <span className="text-muted-foreground w-16 shrink-0 text-right tabular-nums">
                    {percentual(p.ctr)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{p.texto}</span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {p.correspondencia}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Conversão</h3>
          <ul className="text-muted-foreground flex flex-col gap-1 text-sm">
            {dados.conversoes.map((a) => (
              <li key={a.nome}>
                <span className="text-foreground font-medium">{a.nome}</span> · {a.status} ·{' '}
                {a.tipo} · {a.categoria} · conta {a.contagem} · janela{' '}
                {a.janelaDeCliqueEmDias} dias
              </li>
            ))}
          </ul>

          {/* O que separa "mede cadastro" de "mede receita", e o motivo exato.
              Sem esta linha, a ausência da conversão de pagamento parece
              esquecimento — e é falta de uma ação do tipo certo na conta. */}
          {!dados.podeImportarConversao ? (
            <p className="flex items-start gap-2 text-xs text-amber-500">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                Nenhuma ação do tipo <code>UPLOAD_CLICKS</code>: o Google mede cadastro, não
                receita. Ligar pagamento a anúncio exige criar essa ação na conta e enviar o{' '}
                <code>gclid</code> quando o Asaas confirmar — hoje o <code>gclid</code> é
                gravado e ninguém lê.
              </span>
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
