'use client'

import * as React from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Loader2,
  Pause,
  Play,
  Wallet,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  ligarCampanha,
  mudarOrcamentoDiario,
  pausarCampanha,
} from '@/lib/dono/anuncio-actions'
import type { DesempenhoDaCampanha, ResumoDaAtribuicao } from '@/lib/dono/atribuicao'
import {
  diagnosticar,
  rotuloDoObjetivo,
  type Impedimento,
} from '@/lib/dono/diagnostico-do-anuncio'
import { formatarDinheiro, formatarTempoRelativo } from '@/lib/dono/formato'
import type { ProntidaoDaConta } from '@/lib/dono/meta-ads'
import { cn } from '@/lib/utils'
import { CardDeFalha, NumeroCard } from './numeros'

/**
 * A página de anúncio, nos dois estados.
 *
 * Enquanto nenhuma campanha rodou, a pergunta é "posso ligar?" — e a resposta é
 * uma lista de conferência, não uma tabela de zeros. Depois que liga, a
 * pergunta vira "está valendo a pena?", e aí o que importa é quanto custou cada
 * cliente que paga.
 *
 * O estado não é escolhido por prop: ele é consequência de haver ou não gasto.
 */
export function PainelDoAnuncio({
  prontidao,
  desempenho,
  resumo,
  mensalidade,
}: {
  prontidao: ProntidaoDaConta
  desempenho: DesempenhoDaCampanha[]
  resumo: ResumoDaAtribuicao
  mensalidade: number
}) {
  const jaGastou = resumo.gastoTotal > 0
  const impedimentos = diagnosticar(prontidao)

  // Quantos anúncios pendem de cada campanha, para o botão Ligar saber que não
  // adianta clicar. `DesempenhoDaCampanha` vem do cruzamento com o banco e não
  // carrega a árvore; o mapa liga as duas sem duplicar o tipo.
  const anunciosPorCampanha = new Map(prontidao.campanhas.map((c) => [c.id, c.totalDeAnuncios]))

  return (
    <div className="flex flex-col gap-8">
      {/* Primeiro de tudo: o que impede de rodar. Um painel bonito acima de
          uma campanha que não veicula é pior que nenhum painel. */}
      {impedimentos.length > 0 && <Impedimentos lista={impedimentos} />}

      <Dinheiro saude={prontidao.saude} moeda={prontidao.moeda} />

      {jaGastou ? (
        <Resultado resumo={resumo} mensalidade={mensalidade} />
      ) : (
        <Prontidao prontidao={prontidao} />
      )}

      <Serie serie={prontidao.serie} />

      <Arvore campanhas={prontidao.campanhas} />

      <Campanhas
        campanhas={desempenho}
        podeAgir={prontidao.podeAgir}
        jaGastou={jaGastou}
        anunciosPorCampanha={anunciosPorCampanha}
      />

      {prontidao.recomendacoesDaMeta.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">O que a Meta sugere</h2>
          <ul className="flex flex-col gap-2">
            {prontidao.recomendacoesDaMeta.map((r) => (
              <li key={r.titulo} className="ring-foreground/10 rounded-xl p-3 text-sm ring-1">
                {r.titulo}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

/**
 * O que impede de rodar, no topo e antes de qualquer número.
 *
 * Trava em vermelho, desperdício em âmbar — a mesma escala de `/dono/alertas`.
 * Cada item diz o que fazer, porque aviso sem saída devolve o problema para
 * quem lê.
 */
function Impedimentos({ lista }: { lista: Impedimento[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">O que impede de rodar</h2>
      <ul className="flex flex-col gap-2">
        {lista.map((i, idx) => {
          const trava = i.tipo === 'trava'
          return (
            <li
              key={`${i.titulo}-${idx}`}
              className={cn(
                'flex gap-3 rounded-xl p-4 ring-1',
                trava
                  ? 'bg-destructive/5 ring-destructive/25'
                  : 'bg-amber-500/5 ring-amber-500/25',
              )}
            >
              <AlertTriangle
                className={cn(
                  'mt-0.5 size-4 shrink-0',
                  trava ? 'text-destructive' : 'text-amber-600 dark:text-amber-500',
                )}
              />
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">
                  {i.titulo}
                  {i.campanha && (
                    <span className="text-muted-foreground font-normal"> · {i.campanha}</span>
                  )}
                </p>
                <p className="text-muted-foreground text-sm">{i.oQueFazer}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** O dinheiro da conta: o que ela já gastou, o que tem e até onde pode ir. */
function Dinheiro({
  saude,
  moeda,
}: {
  saude: ProntidaoDaConta['saude']
  moeda: string
}) {
  if (!saude.dados) {
    return (
      <CardDeFalha mensagem="O dinheiro da conta" detalhe={saude.erro} />
    )
  }
  const d = saude.dados
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <NumeroCard
        rotulo="Já gastou"
        valor={formatarDinheiro(d.gastoTotal)}
        icone={Wallet}
        nota="na vida da conta"
      />
      <NumeroCard
        rotulo="Saldo"
        valor={formatarDinheiro(d.saldo)}
        icone={Wallet}
        // Saldo zero é o normal em conta de pós-pago, e por isso a nota
        // explica em vez de o card ficar vermelho.
        nota={d.saldo === 0 ? 'zero é normal em pós-pago' : undefined}
      />
      <NumeroCard
        rotulo="Teto de gasto"
        valor={d.tetoDeGasto > 0 ? formatarDinheiro(d.tetoDeGasto) : 'sem teto'}
        icone={CircleDashed}
      />
      <NumeroCard
        rotulo="Situação"
        valor={d.status === 1 ? 'Ativa' : `Status ${d.status}`}
        icone={d.status === 1 ? CheckCircle2 : XCircle}
        tom={d.status === 1 ? undefined : 'ruim'}
        nota={moeda}
      />
    </section>
  )
}

/**
 * O gasto dia a dia, em barras de CSS.
 *
 * Sem biblioteca de gráfico: a Central não tem uma, e não vai ganhar
 * dependência por causa de uma tela local. `FunilDeAtivacao` já resolve o
 * mesmo problema com `div` proporcional, e este segue o padrão dele.
 */
function Serie({ serie }: { serie: ProntidaoDaConta['serie'] }) {
  if (!serie.dados) return <CardDeFalha mensagem="Gasto por dia" detalhe={serie.erro} />
  if (serie.dados.length === 0) return null

  const teto = Math.max(...serie.dados.map((d) => d.gasto), 1)

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Gasto por dia, últimos 30</h2>
      <div className="ring-foreground/10 flex h-32 items-end gap-1 rounded-xl p-4 ring-1">
        {serie.dados.map((d) => (
          <div
            key={d.dia}
            className="bg-primary/70 hover:bg-primary min-w-0 flex-1 rounded-t transition-colors"
            style={{ height: `${Math.max((d.gasto / teto) * 100, 2)}%` }}
            title={`${d.dia}: ${formatarDinheiro(d.gasto)} · ${d.cliques} cliques`}
          />
        ))}
      </div>
    </section>
  )
}

/**
 * A árvore: campanha, conjunto, anúncio.
 *
 * O conjunto é onde moram o público e o objetivo de otimização, e nenhum dos
 * dois existe no nível da campanha — era por isso que a tela anterior não
 * tinha como mostrar que esta conta otimiza por clique.
 */
function Arvore({ campanhas }: { campanhas: ProntidaoDaConta['campanhas'] }) {
  if (campanhas.length === 0) return null

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Como está montado</h2>
      <div className="flex flex-col gap-3">
        {campanhas.map((c) => (
          <div key={c.id} className="ring-foreground/10 rounded-xl p-4 ring-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{c.nome}</span>
              <Badge variant={c.ativa ? 'default' : 'secondary'}>
                {c.ativa ? 'No ar' : 'Pausada'}
              </Badge>
              {c.objetivo && (
                <span className="text-muted-foreground text-xs">
                  {rotuloDoObjetivo(c.objetivo)}
                </span>
              )}
            </div>

            {c.conjuntos.length === 0 ? (
              <p className="text-muted-foreground mt-3 text-sm">Nenhum conjunto.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-3">
                {c.conjuntos.map((s) => (
                  <li key={s.id} className="border-border border-l-2 pl-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{s.nome}</span>
                      <Badge variant="secondary" className="text-xs">
                        {s.status === 'ACTIVE' ? 'No ar' : 'Pausado'}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {[
                        s.objetivo ? `otimiza por ${rotuloDoObjetivo(s.objetivo)}` : null,
                        s.publico,
                        s.orcamentoDiario
                          ? `${formatarDinheiro(s.orcamentoDiario)}/dia`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    <p
                      className={cn(
                        'mt-1 text-xs',
                        s.totalDeAnuncios === 0
                          ? 'text-destructive font-medium'
                          : 'text-muted-foreground',
                      )}
                    >
                      {s.totalDeAnuncios === 0
                        ? 'nenhum anúncio — não veicula'
                        : `${s.totalDeAnuncios} anúncio(s)`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

/** A lista de conferência de antes de ligar. */
function Prontidao({ prontidao }: { prontidao: ProntidaoDaConta }) {
  const eventos = prontidao.eventos
  const temCadastro = eventos.some((e) => e.nome === 'CompleteRegistration')

  const itens = [
    {
      ok: prontidao.temPixelCerto,
      titulo: prontidao.temPixelCerto
        ? `Pixel certo ligado nesta conta (${prontidao.pixelNome})`
        : 'O pixel do site NÃO está nesta conta de anúncio',
      detalhe: prontidao.temPixelCerto
        ? prontidao.pixelDisparandoDesde
          ? `Último evento ${formatarTempoRelativo(prontidao.pixelDisparandoDesde)}.`
          : 'Ainda sem eventos registrados.'
        : 'Sem isso, a campanha otimiza às cegas: ela não enxerga quem se cadastrou.',
    },
    {
      ok: prontidao.fusoHorario.includes('Sao_Paulo'),
      titulo: `Fuso da conta: ${prontidao.fusoHorario}`,
      detalhe:
        'É o fuso que define o que conta como "hoje" nos relatórios e quando o orçamento diário zera.',
    },
    {
      ok: eventos.length > 0,
      titulo:
        eventos.length > 0
          ? `Site mandando eventos: ${eventos.map((e) => `${e.nome} (${e.quantidade})`).join(', ')}`
          : 'Nenhum evento chegando do site',
      detalhe: temCadastro
        ? 'Dá para otimizar por cadastro, que é bem melhor que otimizar por clique.'
        : 'Sem evento de cadastro, a campanha só sabe otimizar por clique: mais barato por clique, pior por cliente.',
    },
    {
      ok: prontidao.campanhas.length > 0,
      titulo:
        prontidao.campanhas.length > 0
          ? `${prontidao.campanhas.length} campanha(s) criada(s), nenhuma gastou ainda`
          : 'Nenhuma campanha criada',
      detalhe: 'Criar campanha continua sendo pelo chat, que é onde erro custa caro.',
    },
    {
      ok: prontidao.podeAgir,
      titulo: prontidao.podeAgir
        ? 'Posso pausar e mudar orçamento daqui'
        : 'Só leitura: falta a permissão ads_management no token',
      detalhe: prontidao.podeAgir
        ? ''
        : 'Os botões abaixo ficam desligados até o token ter ads_management.',
    },
  ]

  const prontos = itens.filter((i) => i.ok).length

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Dá para ligar o anúncio?</h2>
        <p className="text-muted-foreground text-sm">
          {prontos} de {itens.length} pontos prontos na conta {prontidao.contaNome} (
          {prontidao.moeda}).
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {itens.map((item) => (
          <li
            key={item.titulo}
            className="ring-foreground/10 flex items-start gap-3 rounded-xl p-4 ring-1"
          >
            {item.ok ? (
              <CheckCircle2 aria-hidden className="mt-0.5 size-5 shrink-0 text-emerald-500" />
            ) : (
              <AlertTriangle aria-hidden className="mt-0.5 size-5 shrink-0 text-amber-500" />
            )}
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-medium text-pretty">{item.titulo}</span>
              {item.detalhe && (
                <span className="text-muted-foreground text-sm text-pretty">{item.detalhe}</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * O que o dinheiro comprou.
 *
 * O custo por cliente pagante vem primeiro e maior porque é o único número que
 * decide alguma coisa. Custo por clique é barato de melhorar e não paga conta.
 */
function Resultado({
  resumo,
  mensalidade,
}: {
  resumo: ResumoDaAtribuicao
  mensalidade: number
}) {
  const paybackLongo = resumo.mesesParaSePagar !== null && resumo.mesesParaSePagar > 6

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">O que o anúncio trouxe</h2>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Numero rotulo="Gasto" valor={formatarDinheiro(resumo.gastoTotal)} />
        <Numero rotulo="Contas criadas" valor={String(resumo.cadastros)} />
        <Numero rotulo="Viraram pagante" valor={String(resumo.clientesPagantes)} />
        <Numero
          rotulo="Custo por cliente"
          destaque
          valor={
            resumo.custoPorCliente === null ? '-' : formatarDinheiro(resumo.custoPorCliente)
          }
          nota={
            resumo.mesesParaSePagar === null
              ? 'ninguém virou pagante ainda'
              : `se paga em ${resumo.mesesParaSePagar.toFixed(1)} meses de R$ ${mensalidade}`
          }
          tom={paybackLongo ? 'atencao' : undefined}
        />
      </div>

      {paybackLongo && (
        <p className="rounded-xl bg-amber-500/5 p-4 text-sm text-pretty ring-1 ring-amber-500/20">
          Cada cliente leva mais de 6 meses para pagar o que custou trazer. Em produto de PME isso
          é apertado, porque o cancelamento costuma chegar antes.
        </p>
      )}

      {resumo.semCampanhaIdentificada > 0 && (
        <p className="text-muted-foreground rounded-xl p-4 text-sm text-pretty ring-1 ring-white/10">
          {resumo.semCampanhaIdentificada} conta(s) vieram de clique de anúncio, mas sem dizer de
          qual campanha: falta o <code>utm_campaign</code> na URL do anúncio. Os números por
          campanha abaixo estão subestimados.
        </p>
      )}
    </section>
  )
}

function Numero({
  rotulo,
  valor,
  nota,
  destaque,
  tom,
}: {
  rotulo: string
  valor: string
  nota?: string
  destaque?: boolean
  tom?: 'atencao'
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-muted-foreground text-sm font-medium">{rotulo}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-0.5">
        <span
          className={cn(
            'font-semibold tabular-nums',
            destaque ? 'text-3xl' : 'text-2xl',
            tom === 'atencao' && 'text-amber-500',
          )}
        >
          {valor}
        </span>
        {nota && <span className="text-muted-foreground text-xs">{nota}</span>}
      </CardContent>
    </Card>
  )
}

function Campanhas({
  campanhas,
  podeAgir,
  jaGastou,
  anunciosPorCampanha,
}: {
  campanhas: DesempenhoDaCampanha[]
  podeAgir: boolean
  jaGastou: boolean
  anunciosPorCampanha: Map<string, number>
}) {
  if (campanhas.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Campanhas</h2>
        <p className="text-muted-foreground ring-foreground/10 rounded-xl p-6 text-sm ring-1">
          Nenhuma campanha nesta conta ainda.
        </p>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Campanhas</h2>
      <ul className="flex flex-col gap-3">
        {campanhas.map((campanha) => (
          <LinhaDeCampanha
            key={campanha.id}
            campanha={campanha}
            podeAgir={podeAgir}
            jaGastou={jaGastou}
            totalDeAnuncios={anunciosPorCampanha.get(campanha.id) ?? 0}
          />
        ))}
      </ul>
    </section>
  )
}

function LinhaDeCampanha({
  campanha,
  podeAgir,
  jaGastou,
  totalDeAnuncios,
}: {
  campanha: DesempenhoDaCampanha
  podeAgir: boolean
  jaGastou: boolean
  /** `0` desabilita o botao Ligar: sem anuncio, ligar nao veicula nada. */
  totalDeAnuncios: number
}) {
  const [pendente, setPendente] = React.useState(false)
  const [editandoOrcamento, setEditandoOrcamento] = React.useState(false)

  async function rodar(acao: () => Promise<{ ok: boolean; mensagem?: string; erro?: string }>) {
    setPendente(true)
    try {
      const r = await acao()
      if (r.ok) toast.success(r.mensagem ?? 'Pronto.')
      else toast.error(r.erro ?? 'Não deu certo.', { duration: 8000 })
    } catch {
      toast.error('Falhou. O erro completo está no terminal.')
    } finally {
      setPendente(false)
      setEditandoOrcamento(false)
    }
  }

  return (
    <li
      className={cn(
        'flex flex-col gap-3 rounded-xl p-4 ring-1',
        campanha.desperdicio ? 'bg-amber-500/5 ring-amber-500/20' : 'ring-foreground/10',
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{campanha.nome}</span>
            {campanha.ativa ? (
              <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-500">
                No ar
              </Badge>
            ) : (
              <Badge variant="outline">Pausada</Badge>
            )}
          </div>

          <p className="text-muted-foreground text-sm tabular-nums">
            {formatarDinheiro(campanha.gasto)} gastos · {campanha.cliques} clique(s)
            {jaGastou && (
              <>
                {' '}
                · {campanha.cadastros} cadastro(s) · {campanha.clientesPagantes} pagante(s)
              </>
            )}
            {campanha.orcamentoDiario !== null && (
              <> · {formatarDinheiro(campanha.orcamentoDiario)}/dia</>
            )}
          </p>

          {campanha.custoPorCliente !== null && (
            <p className="text-sm">
              <span className="text-muted-foreground">Cada cliente pagante custou</span>{' '}
              <span className="font-medium tabular-nums">
                {formatarDinheiro(campanha.custoPorCliente)}
              </span>
            </p>
          )}

          {campanha.desperdicio && (
            <p className="flex items-center gap-1.5 text-sm text-amber-500">
              <XCircle aria-hidden className="size-4 shrink-0" />
              Gastou e não trouxe ninguém. É aqui que o dinheiro vaza.
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            // ## Ligar fica desabilitado quando nao ha anuncio
            //
            // Medido em 02/09: a campanha desta conta tem conjunto e criativo
            // e ZERO anuncios. Clicar em Ligar deixaria o status `ACTIVE` sem
            // veicular coisa nenhuma — e a tela passaria a afirmar, pelo
            // proprio badge, que o anuncio esta no ar.
            //
            // Botao que nao faz nada e pior que botao ausente: ele consome a
            // decisao e devolve silencio.
            disabled={!podeAgir || pendente || (!campanha.ativa && totalDeAnuncios === 0)}
            title={
              !podeAgir
                ? 'Falta a permissão ads_management no token'
                : !campanha.ativa && totalDeAnuncios === 0
                  ? 'Esta campanha não tem anúncio: ligar não veicularia nada'
                  : undefined
            }
            onClick={() => setEditandoOrcamento((antes) => !antes)}
          >
            <Wallet aria-hidden className="size-4" />
            Orçamento
          </Button>

          <Button
            variant={campanha.ativa ? 'outline' : 'default'}
            size="sm"
            disabled={!podeAgir || pendente}
            title={podeAgir ? undefined : 'Falta a permissão ads_management no token'}
            onClick={() =>
              rodar(() =>
                campanha.ativa
                  ? pausarCampanha(campanha.id, campanha.nome)
                  : ligarCampanha(campanha.id, campanha.nome),
              )
            }
          >
            {pendente ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : campanha.ativa ? (
              <Pause aria-hidden className="size-4" />
            ) : (
              <Play aria-hidden className="size-4" />
            )}
            {campanha.ativa ? 'Pausar' : 'Ligar'}
          </Button>
        </div>
      </div>

      {editandoOrcamento && (
        <FormularioDeOrcamento
          atual={campanha.orcamentoDiario}
          pendente={pendente}
          onSalvar={(valor) => rodar(() => mudarOrcamentoDiario(campanha.id, campanha.nome, valor))}
          onCancelar={() => setEditandoOrcamento(false)}
        />
      )}
    </li>
  )
}

/**
 * Mudar orçamento mostra o valor atual ao lado do novo.
 *
 * É a única das três ações cujo efeito não é óbvio ao desfazer: pausar e ligar
 * a pessoa vê na hora, orçamento errado só aparece na fatura. Ver os dois
 * números lado a lado é o que evita trocar R$ 20 por R$ 200 sem perceber.
 */
function FormularioDeOrcamento({
  atual,
  pendente,
  onSalvar,
  onCancelar,
}: {
  atual: number | null
  pendente: boolean
  onSalvar: (valor: number) => void
  onCancelar: () => void
}) {
  const [texto, setTexto] = React.useState(atual !== null ? String(atual) : '')
  const valor = Number(texto.replace(',', '.'))
  const valido = Number.isFinite(valor) && valor >= 6

  return (
    <div className="flex flex-col gap-2 border-t border-white/5 pt-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
          <CircleDashed aria-hidden className="size-4" />
          Hoje: {atual !== null ? formatarDinheiro(atual) : 'sem orçamento diário'}
        </span>
        <span className="text-muted-foreground text-sm">→</span>
        <Input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          inputMode="decimal"
          placeholder="30"
          className="h-9 w-28"
          aria-label="Novo orçamento diário em reais"
        />
        <span className="text-muted-foreground text-sm">por dia</span>
      </div>

      <div className="flex gap-2">
        <Button size="sm" disabled={!valido || pendente} onClick={() => onSalvar(valor)}>
          {pendente && <Loader2 aria-hidden className="size-4 animate-spin" />}
          Salvar orçamento
        </Button>
        <Button variant="ghost" size="sm" disabled={pendente} onClick={onCancelar}>
          Cancelar
        </Button>
      </div>

      {texto && !valido && (
        <p className="text-sm text-amber-500">
          A Meta não aceita orçamento diário abaixo de ~R$ 6 nesta conta.
        </p>
      )}
    </div>
  )
}
