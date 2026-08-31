'use client'

import * as React from 'react'
import {
  Bug,
  Check,
  FileText,
  Lightbulb,
  Mail,
  Monitor,
  Search,
  Ban,
  Clock,
} from 'lucide-react'

import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { mudarStatusDoRelato, registrarSolucao } from '@/lib/dono/feedback-actions'
import { formatarTempoRelativo } from '@/lib/dono/formato'
import { formatarTamanho } from '@/lib/storage/anexo-de-feedback'
import type { FilaDeFeedback, RelatoNaTela } from '@/lib/dono/feedback-queries'
import type { StatusDeFeedback } from '@/types/supabase'
import { cn } from '@/lib/utils'

/**
 * Central de Suporte: tudo que veio do produto, e o que foi feito sobre isso.
 *
 * ## A ordem não é cronológica, e isso é a decisão principal
 *
 * Problema aberto vem primeiro, sempre. Depois problema em andamento, depois
 * sugestão, e por último o que já foi fechado. Ordenar por data misturaria os
 * quatro e faria uma sugestão de hoje empurrar para baixo um problema de
 * ontem que ninguém respondeu — que é exatamente o item que não pode esperar.
 *
 * ## Por que o filtro é por status, e não "esconder"
 *
 * A versão anterior só sabia esconder, num arquivo local. Esconder não é
 * acompanhar: não registra o que foi feito, e some ao trocar de máquina. Agora
 * o estado vive no banco (0061), a fila inteira vem, e quem escolhe o que ver
 * é quem está olhando.
 */
const FILTROS: { valor: StatusDeFeedback | 'todos'; rotulo: string }[] = [
  { valor: 'aberto', rotulo: 'Abertos' },
  { valor: 'em_andamento', rotulo: 'Em andamento' },
  { valor: 'resolvido', rotulo: 'Resolvidos' },
  { valor: 'descartado', rotulo: 'Descartados' },
  { valor: 'todos', rotulo: 'Todos' },
]

/** A ordem de urgência. Menor vem primeiro. */
function peso(relato: RelatoNaTela): number {
  if (relato.status === 'aberto') return relato.tipo === 'problema' ? 0 : 2
  if (relato.status === 'em_andamento') return relato.tipo === 'problema' ? 1 : 3
  return 4
}

export function CentralDeSuporte({
  fila,
  mostrandoInternos = false,
}: {
  fila: FilaDeFeedback
  mostrandoInternos?: boolean
}) {
  const [filtro, setFiltro] = React.useState<StatusDeFeedback | 'todos'>('aberto')
  const [busca, setBusca] = React.useState('')

  const visiveis = React.useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return fila.relatos
      .filter((r) => (filtro === 'todos' ? true : r.status === filtro))
      .filter((r) =>
        termo === ''
          ? true
          : // Busca no que se lembra: o texto, quem escreveu e a empresa.
            // Ninguém procura relato por id.
            [r.mensagem, r.pessoa.nome, r.pessoa.email, r.empresa]
              .join(' ')
              .toLowerCase()
              .includes(termo),
      )
      .sort((a, b) => peso(a) - peso(b) || b.criadoEm.localeCompare(a.criadoEm))
  }, [fila.relatos, filtro, busca])

  return (
    <div className="flex flex-col gap-4">
      {/* O teto avisado, e não silencioso. A versão anterior tinha `.limit()`
          sem sinal nenhum — o mesmo corte mudo do PostgREST que já custou três
          funções deste projeto. */}
      {fila.bateuNoTeto && (
        <p role="alert" className="text-destructive text-sm">
          A leitura bateu no teto de 300 relatos. Há mais do que está sendo mostrado.
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-1.5">
          {FILTROS.map((f) => {
            const quantos = f.valor === 'todos' ? fila.contagem.total : fila.contagem[f.valor]
            const ativo = filtro === f.valor
            return (
              <button
                key={f.valor}
                type="button"
                onClick={() => setFiltro(f.valor)}
                aria-pressed={ativo}
                className={cn(
                  'flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors',
                  ativo
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {f.rotulo}
                {/* O contador aparece SEMPRE, inclusive em zero — diferente do
                    badge da barra lateral. Aqui o zero é informação: "nenhum
                    aberto" é a resposta que se quer ver. */}
                <span className="text-xs tabular-nums opacity-70">{quantos}</span>
              </button>
            )
          })}
        </div>

        <div className="relative sm:ml-auto sm:w-64">
          <Search
            aria-hidden
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
          />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por texto, pessoa ou empresa"
            className="pl-8"
            aria-label="Buscar relatos"
          />
        </div>
      </div>

      {visiveis.length === 0 ? (
        <div className="border-border rounded-xl border border-dashed p-8 text-center">
          <p className="text-sm font-medium">
            {busca ? 'Nada encontrado nesta busca.' : `Nenhum relato ${rotuloDoVazio(filtro)}.`}
          </p>
          {/* "Nada aqui" e "nada existe" são estados diferentes, e confundi-los
              faz procurar defeito onde não há — o mesmo erro do painel de
              prazos, que dizia "nenhum negócio em aberto" havendo quatro. */}
          {!busca && fila.contagem.total > 0 && (
            <p className="text-muted-foreground mt-1 text-sm">
              Há {fila.contagem.total} no total. Troque o filtro para ver.
            </p>
          )}
          {/* O caso que o rodapé sozinho não cobria.
              Quem testa o canal manda de uma conta que é NOSSA — e aí a fila de
              cliente fica vazia, a tela diz "Nenhum relato aberto", e o relato
              recém-enviado está a um clique de distância sem nada apontando
              para ele. Foi o que aconteceu duas vezes em 30 e 31/08: as
              mensagens chegaram ao banco e o dono concluiu, com razão, que o
              canal não funcionava.
              A contagem vem de `fila.internos`, que é do TOTAL — `contagem`
              conta só o que está na fila mostrada, e por isso não serve aqui. */}
          {!busca && !mostrandoInternos && fila.internos > 0 && (
            <p className="text-muted-foreground mt-1 text-sm">
              E {fila.internos} de conta interna, fora desta fila.{' '}
              <a
                href="/dono/suporte?internos=1"
                className="text-foreground underline underline-offset-2"
              >
                Ver mesmo assim
              </a>
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visiveis.map((relato) => (
            <CartaoDeRelato key={relato.id} relato={relato} />
          ))}
        </div>
      )}

      {/* O rodapé é LINK, não texto.
          Em 30/08 o dono mandou três relatos pelo produto para conferir se o
          canal funcionava, logado numa conta que está em `contas-internas.ts`.
          Eles chegaram ao banco e a Central não os mostrou: este rodapé dizia
          "4 relatos de conta interna, fora da fila" e não havia como abri-los.
          Contar sem deixar ver é o mesmo defeito do "silenciar" sem "reexibir",
          já pago em Alertas. */}
      {/* Quando a lista está VAZIA, o próprio bloco de vazio já diz isto e com
          mais contexto. Repetir aqui deixaria a mesma frase duas vezes na
          mesma tela, a três linhas de distância — o que lê como defeito. */}
      {(visiveis.length > 0 && fila.internos > 0) || mostrandoInternos ? (
        <p className="text-muted-foreground text-xs">
          {mostrandoInternos ? (
            <>
              Mostrando também os relatos de conta interna.{' '}
              <a
                href="/dono/suporte"
                className="text-foreground underline underline-offset-2"
              >
                Ver só os de cliente
              </a>
            </>
          ) : (
            <>
              {fila.internos} relato{fila.internos > 1 ? 's' : ''} de conta interna, fora da
              fila.{' '}
              <a
                href="/dono/suporte?internos=1"
                className="text-foreground underline underline-offset-2"
              >
                Ver mesmo assim
              </a>
            </>
          )}
        </p>
      ) : null}
    </div>
  )
}

function rotuloDoVazio(filtro: StatusDeFeedback | 'todos'): string {
  if (filtro === 'todos') return 'ainda'
  if (filtro === 'em_andamento') return 'em andamento'
  return `${filtro}`
}

const ESTILO_DO_STATUS: Record<StatusDeFeedback, string> = {
  aberto: 'bg-destructive/10 text-destructive',
  em_andamento: 'bg-amber-500/15 text-amber-600 dark:text-amber-500',
  resolvido: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-500',
  descartado: 'bg-muted text-muted-foreground',
}

const NOME_DO_STATUS: Record<StatusDeFeedback, string> = {
  aberto: 'Aberto',
  em_andamento: 'Em andamento',
  resolvido: 'Resolvido',
  descartado: 'Descartado',
}

function CartaoDeRelato({ relato }: { relato: RelatoNaTela }) {
  const [pendente, iniciarTransicao] = React.useTransition()
  const [escrevendo, setEscrevendo] = React.useState(false)
  const [texto, setTexto] = React.useState(relato.solucao ?? '')
  const problema = relato.tipo === 'problema'
  const Icone = problema ? Bug : Lightbulb
  const fechado = relato.status === 'resolvido' || relato.status === 'descartado'

  return (
    <article
      className={cn(
        'border-border bg-card flex flex-col gap-3 rounded-xl border p-4',
        // Faixa só no problema ABERTO. Cor aqui É informação: um problema já
        // resolvido não precisa gritar, e manter a faixa faria a fila inteira
        // parecer urgente — que é como uma fila deixa de ser lida.
        problema && relato.status === 'aberto' && 'border-l-destructive border-l-4',
        fechado && 'opacity-75',
      )}
    >
      <header className="flex flex-wrap items-center gap-2">
        <Icone
          aria-hidden
          className={cn('size-4 shrink-0', problema ? 'text-destructive' : 'text-primary')}
        />
        {/* NOME e e-mail, os dois. O nome é o que permite reconhecer a pessoa;
            o e-mail é o que permite responder. */}
        <span className="text-sm font-medium">{relato.pessoa.nome}</span>
        <span className="text-muted-foreground text-xs">{relato.empresa}</span>
        <span className="text-muted-foreground text-xs">
          {relato.plano === 'pro' ? 'Pro' : 'Grátis'}
        </span>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-medium',
            ESTILO_DO_STATUS[relato.status],
          )}
        >
          {NOME_DO_STATUS[relato.status]}
        </span>
        {/* Só aparece quando a fila está mostrando internos — e aí é
            obrigatório. Um relato de teste sem marca no meio de relatos de
            cliente é indistinguível deles, que é o defeito de 20/08 (8 de 11
            alertas eram teste do dono) reaparecendo por outra porta. */}
        {relato.interno && (
          <span className="border-border text-muted-foreground rounded-full border border-dashed px-2 py-0.5 text-xs font-medium">
            conta interna
          </span>
        )}
        <span className="text-muted-foreground ml-auto text-xs">
          {formatarTempoRelativo(relato.criadoEm)}
        </span>
      </header>

      {/* `whitespace-pre-wrap`: o relato pode ter parágrafos, e colapsar as
          quebras transformaria um texto estruturado num bloco só. */}
      <p className="text-sm whitespace-pre-wrap">{relato.mensagem}</p>

      {relato.anexos.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {relato.anexos.map((anexo) => (
            <li key={anexo.caminho}>
              <a
                href={anexo.url ?? '#'}
                target="_blank"
                rel="noreferrer"
                className="border-border hover:bg-muted flex items-center gap-2 rounded-lg border p-1.5 pr-2.5 transition-colors"
              >
                {anexo.ehImagem && anexo.url ? (
                  // Miniatura de verdade, não ícone: reconhecer o print certo
                  // entre dois é visual, não textual.
                  // eslint-disable-next-line @next/next/no-img-element -- anexo de cliente, URL assinada e temporária
                  <img
                    src={anexo.url}
                    alt=""
                    className="size-10 shrink-0 rounded object-cover"
                  />
                ) : (
                  <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded">
                    <FileText aria-hidden className="text-muted-foreground size-4" />
                  </span>
                )}
                <span className="flex flex-col">
                  <span className="max-w-40 truncate text-xs font-medium">{anexo.nome}</span>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {formatarTamanho(anexo.tamanho)}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {/* O contexto técnico, discreto: importa quando importa, e não pode
          competir com o que a pessoa escreveu. */}
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {relato.rota && <span className="font-mono">{relato.rota}</span>}
        {relato.userAgent && (
          <span className="inline-flex items-center gap-1">
            <Monitor aria-hidden className="size-3" />
            {navegadorDe(relato.userAgent)}
          </span>
        )}
        {relato.resolvidoEm && (
          <span className="inline-flex items-center gap-1">
            <Clock aria-hidden className="size-3" />
            fechado {formatarTempoRelativo(relato.resolvidoEm)}
          </span>
        )}
      </div>

      {relato.solucao && !escrevendo && (
        <div className="border-border bg-muted/40 rounded-lg border p-3">
          <p className="text-muted-foreground text-xs font-medium">O que foi feito</p>
          <p className="mt-1 text-sm whitespace-pre-wrap">{relato.solucao}</p>
        </div>
      )}

      {escrevendo && (
        <div className="flex flex-col gap-2">
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={3}
            placeholder="Era cache do navegador, pedi para limpar e resolveu."
            aria-label="O que foi feito"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={pendente}
              onClick={() =>
                iniciarTransicao(async () => {
                  await registrarSolucao(relato.id, texto)
                  setEscrevendo(false)
                })
              }
            >
              Salvar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEscrevendo(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <footer className="flex flex-wrap items-center gap-2">
        <a
          href={`mailto:${relato.pessoa.email}?subject=${encodeURIComponent('Sobre o que você nos escreveu — Velo Funil')}`}
          className={cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'gap-2')}
        >
          <Mail className="size-4" />
          Responder
        </a>
        <span className="text-muted-foreground text-xs">{relato.pessoa.email}</span>

        <div className="ml-auto flex flex-wrap gap-1.5">
          {!escrevendo && (
            <Button size="sm" variant="ghost" onClick={() => setEscrevendo(true)}>
              {relato.solucao ? 'Editar solução' : 'Anotar o que foi feito'}
            </Button>
          )}
          {relato.status !== 'em_andamento' && !fechado && (
            <Button
              size="sm"
              variant="ghost"
              disabled={pendente}
              onClick={() =>
                iniciarTransicao(() => void mudarStatusDoRelato(relato.id, 'em_andamento'))
              }
            >
              <Clock className="size-4" />
              Estou vendo
            </Button>
          )}
          {!fechado ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                disabled={pendente}
                onClick={() =>
                  iniciarTransicao(() => void mudarStatusDoRelato(relato.id, 'resolvido'))
                }
              >
                <Check className="size-4" />
                Resolvido
              </Button>
              {/* "Descartar" é destino próprio, não um resolvido disfarçado:
                  "decidi não fazer" é a decisão que mais interessa reler
                  quando a mesma coisa for pedida de novo. */}
              <Button
                size="sm"
                variant="ghost"
                disabled={pendente}
                onClick={() =>
                  iniciarTransicao(() => void mudarStatusDoRelato(relato.id, 'descartado'))
                }
              >
                <Ban className="size-4" />
                Descartar
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              disabled={pendente}
              onClick={() => iniciarTransicao(() => void mudarStatusDoRelato(relato.id, 'aberto'))}
            >
              Reabrir
            </Button>
          )}
        </div>
      </footer>
    </article>
  )
}

/**
 * O navegador, em uma palavra.
 *
 * O user agent inteiro tem 120 caracteres e nenhum deles ajuda a decidir nada —
 * mas "Safari" ao lado de um relato de layout quebrado explica metade do caso.
 *
 * A ordem importa: Edge e Opera se declaram Chrome, e Chrome se declara
 * Safari. Testar do mais específico para o mais genérico é o que evita
 * classificar tudo como Safari.
 */
function navegadorDe(userAgent: string): string {
  if (/Edg\//.test(userAgent)) return 'Edge'
  if (/OPR\//.test(userAgent)) return 'Opera'
  if (/Firefox\//.test(userAgent)) return 'Firefox'
  if (/Chrome\//.test(userAgent)) return 'Chrome'
  if (/Safari\//.test(userAgent)) return 'Safari'
  return 'outro navegador'
}
