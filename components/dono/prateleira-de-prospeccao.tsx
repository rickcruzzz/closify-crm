'use client'

import * as React from 'react'
import { Check, ExternalLink, MessageCircle, Undo2, X } from 'lucide-react'
import { toast } from 'sonner'

import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  confirmarEnvio,
  descartar,
  desfazerEnvio,
  marcarEnviado,
} from '@/lib/dono/prateleira-actions'
import {
  contarPorEstado,
  mensagemPara,
  PISO_DOS_MELHORES,
  type EstadoNaPrateleira,
  type Prospect,
} from '@/lib/dono/prateleira'
import { cn } from '@/lib/utils'

/**
 * A prateleira de prospecção.
 *
 * ## Por que lista densa, e não cartão
 *
 * `quem-esta-decidindo.tsx` usa cartão e está certo lá: são três ou quatro
 * linhas, e cada uma merece contexto. Aqui são ~882 empresas, e o trabalho é
 * VARRER. Cartão daria seis por tela; a linha dá vinte, e o que decide a
 * velocidade de um turno de prospecção é quantas decisões cabem sem rolar.
 *
 * ## O botão de enviar é uma âncora de verdade
 *
 * `<a href target="_blank">` com `buttonVariants`, e NÃO o componente `Button`.
 * Duas decisões empilhadas, e a segunda custou uma medição.
 *
 * Âncora e não `window.open`: bloqueador de pop-up mata `window.open` em alguns
 * contextos, Ctrl+clique e botão do meio param de funcionar, e o alvo deixa de
 * ser alcançável por teclado.
 *
 * Âncora CRUA e não `<Button render={<a/>}>`: o Base UI trata o elemento como
 * botão, e medido no navegador o `onClick` simplesmente não disparava no clique
 * real — a aba abria e a linha nunca saía da fila, **sem erro em lugar nenhum**.
 * Chamando `props.onClick` à mão pelo DOM a ação rodava, o que prova que o
 * handler estava lá e que o clique é que não chegava nele. `central-de-suporte.tsx`
 * já usa `buttonVariants` numa âncora pela mesma razão.
 *
 * ## O envio é otimista, com Desfazer
 *
 * Mesmo padrão de `hoje-client.tsx`: a linha sai da lista antes de o servidor
 * responder, e volta se ele recusar. A decisão do dono foi um clique por
 * empresa — em 500 empresas, o passo de confirmar custaria 500 cliques a mais.
 * O erro possível (marcar enviado e fechar o WhatsApp sem mandar) custa um
 * clique em "Desfazer".
 */

const ABAS: { estado: EstadoNaPrateleira; rotulo: string }[] = [
  { estado: 'novo', rotulo: 'Novos' },
  { estado: 'enviado', rotulo: 'Enviados' },
  { estado: 'confirmado', rotulo: 'Confirmados' },
  { estado: 'descartado', rotulo: 'Fora' },
]

/**
 * Quantas linhas por vez.
 *
 * Não é preferência estética: cada linha renderizada monta a mensagem inteira
 * e codifica o `wa.me`, que passa de 500 caracteres. Renderizar 882 de uma vez
 * seria meio megabyte de string construído a cada tecla digitada na busca.
 */
const POR_PAGINA = 80

function Pontos({ valor }: { valor: number }) {
  const forte = valor >= PISO_DOS_MELHORES
  return (
    <span
      className={cn(
        'w-9 shrink-0 rounded-md px-1.5 py-0.5 text-center text-xs font-semibold tabular-nums',
        forte ? 'bg-emerald-500/15 text-emerald-500' : 'bg-muted text-muted-foreground',
      )}
      title={`${valor} pontos de propensão`}
    >
      {valor}
    </span>
  )
}

export function PrateleiraDeProspeccao({ prospects }: { prospects: Prospect[] }) {
  const [lista, setLista] = React.useState(prospects)
  const [aba, setAba] = React.useState<EstadoNaPrateleira>('novo')
  const [busca, setBusca] = React.useState('')
  const [nicho, setNicho] = React.useState('')
  const [soOsMelhores, setSoOsMelhores] = React.useState(true)
  const [quantas, setQuantas] = React.useState(POR_PAGINA)
  const [focada, setFocada] = React.useState(0)

  // O RSC pode chegar depois de uma revalidação: sem isto, a lista otimista
  // ficaria congelada na versão que veio no primeiro render.
  React.useEffect(() => setLista(prospects), [prospects])

  const contagem = React.useMemo(() => contarPorEstado(lista), [lista])

  const nichos = React.useMemo(
    () => Array.from(new Set(lista.map((p) => p.vertical))).sort(),
    [lista],
  )

  const filtrada = React.useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return lista.filter((p) => {
      if (p.estado !== aba) return false
      if (nicho && p.vertical !== nicho) return false
      // O piso só vale na fila de novos: depois de enviada, a empresa importa
      // independentemente da nota que a trouxe até aqui.
      if (soOsMelhores && aba === 'novo' && p.pontos < PISO_DOS_MELHORES) return false
      if (!termo) return true
      return (
        p.dominio.includes(termo) ||
        (p.nome ?? '').toLowerCase().includes(termo) ||
        p.vertical.includes(termo)
      )
    })
  }, [lista, aba, nicho, soOsMelhores, busca])

  React.useEffect(() => {
    setQuantas(POR_PAGINA)
    setFocada(0)
  }, [aba, busca, nicho, soOsMelhores])

  const visiveis = filtrada.slice(0, quantas)

  /** Move a linha na hora e desfaz se o servidor recusar. */
  const mover = React.useCallback(
    async (p: Prospect, destino: EstadoNaPrateleira, executar: () => Promise<{ ok: boolean; erro?: string; mensagem?: string }>) => {
      const anterior = lista
      setLista((atual) =>
        atual.map((x) => (x.dominio === p.dominio ? { ...x, estado: destino } : x)),
      )
      const r = await executar()
      if (!r.ok) {
        setLista(anterior)
        toast.error(r.erro ?? 'Não consegui gravar.')
      }
      return r
    },
    [lista],
  )

  const enviar = React.useCallback(
    async (p: Prospect) => {
      await mover(p, 'enviado', () => marcarEnviado(p.dominio))
      toast.success(`${p.nome ?? p.dominio} foi para Enviados.`, {
        action: {
          label: 'Desfazer',
          onClick: async () => {
            setLista((atual) =>
              atual.map((x) => (x.dominio === p.dominio ? { ...x, estado: 'novo' } : x)),
            )
            const r = await desfazerEnvio(p.dominio)
            if (!r.ok) toast.error(r.erro)
          },
        },
      })
    },
    [mover],
  )

  const confirmar = React.useCallback(
    async (p: Prospect) => {
      const r = await mover(p, 'confirmado', () => confirmarEnvio(p))
      if (r.ok) toast.success(r.mensagem ?? 'Confirmado.')
    },
    [mover],
  )

  const jogarFora = React.useCallback(
    async (p: Prospect) => {
      await mover(p, 'descartado', () => descartar(p.dominio))
    },
    [mover],
  )

  const devolver = React.useCallback(
    async (p: Prospect) => {
      await mover(p, 'novo', () => desfazerEnvio(p.dominio))
    },
    [mover],
  )

  /**
   * O teclado, que é o que separa rápido de MUITO rápido.
   *
   * Percorrer cem empresas com o mouse são cem miras; com o teclado, cem
   * teclas. O atalho só age quando o foco não está num campo de texto — senão
   * digitar "extintores" na busca dispararia `E` de enviar em cada letra.
   */
  React.useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement | null
      if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const p = visiveis[focada]
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault()
        setFocada((i) => Math.min(i + 1, visiveis.length - 1))
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault()
        setFocada((i) => Math.max(i - 1, 0))
      } else if (e.key === 'e' && p) {
        const { link } = mensagemPara(p)
        if (!link) {
          toast.error('Sem WhatsApp para essa empresa.')
          return
        }
        window.open(link, '_blank', 'noopener')
        void enviar(p)
      } else if (e.key === 'x' && p) {
        void jogarFora(p)
      } else if (e.key === 'Enter' && p && p.estado === 'enviado') {
        void confirmar(p)
      }
    }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [visiveis, focada, enviar, jogarFora, confirmar])

  return (
    <div className="flex flex-col gap-4">
      <div className="border-border/60 flex flex-wrap items-center gap-1 border-b">
        {ABAS.map((a) => (
          <button
            key={a.estado}
            type="button"
            onClick={() => setAba(a.estado)}
            className={cn(
              'min-h-11 rounded-t-md px-3 text-sm font-medium transition-colors sm:min-h-9',
              aba === a.estado
                ? 'border-primary text-foreground border-b-2'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {a.rotulo}{' '}
            <span className="tabular-nums opacity-70">{contagem[a.estado]}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, domínio ou nicho"
          className="h-9 max-w-xs"
        />
        <select
          value={nicho}
          onChange={(e) => setNicho(e.target.value)}
          className="border-input bg-background h-9 rounded-md border px-2 text-sm"
        >
          <option value="">Todos os nichos</option>
          {nichos.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        {aba === 'novo' ? (
          <label className="text-muted-foreground flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={soOsMelhores}
              onChange={(e) => setSoOsMelhores(e.target.checked)}
              className="accent-primary size-4"
            />
            Só os melhores ({PISO_DOS_MELHORES}+ pontos)
          </label>
        ) : null}
        <span className="text-muted-foreground ml-auto text-sm tabular-nums">
          {filtrada.length} {filtrada.length === 1 ? 'empresa' : 'empresas'}
        </span>
      </div>

      {visiveis.length === 0 ? (
        <p className="text-muted-foreground border-border/60 rounded-lg border border-dashed px-4 py-10 text-center text-sm">
          {aba === 'novo'
            ? 'Nenhuma empresa nessa faixa. Desmarque "só os melhores" para ver a lista inteira.'
            : 'Nada aqui ainda.'}
        </p>
      ) : (
        <ul className="divide-border/60 border-border/60 divide-y overflow-hidden rounded-lg border">
          {visiveis.map((p, i) => {
            const { link } = mensagemPara(p)
            return (
              <li
                key={p.dominio}
                onMouseEnter={() => setFocada(i)}
                className={cn(
                  'flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm transition-colors',
                  i === focada ? 'bg-muted/60' : 'hover:bg-muted/30',
                )}
              >
                <Pontos valor={p.pontos} />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{p.nome ?? p.dominio}</span>
                    {p.leadId ? (
                      <span
                        className="bg-muted text-muted-foreground shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
                        title="Já é contato no CRM"
                      >
                        no CRM
                      </span>
                    ) : null}
                  </div>
                  <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
                    <a
                      href={`https://${p.dominio}`}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex items-center gap-1 hover:underline"
                    >
                      {p.dominio}
                      <ExternalLink className="size-3" aria-hidden />
                    </a>
                    <span aria-hidden>·</span>
                    <span>{p.vertical}</span>
                    {p.motivos.length > 0 ? (
                      <>
                        <span aria-hidden>·</span>
                        <span className="truncate">{p.motivos.slice(0, 3).join(' · ')}</span>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {p.estado === 'novo' ? (
                    <>
                      {link ? (
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => void enviar(p)}
                          className={cn(
                            buttonVariants({ size: 'sm' }),
                            'min-h-11 gap-1.5 sm:min-h-8',
                          )}
                        >
                          <MessageCircle className="size-4" aria-hidden />
                          Enviar
                        </a>
                      ) : (
                        <span className="text-muted-foreground px-2 text-xs">sem WhatsApp</span>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="min-h-11 sm:min-h-8"
                        onClick={() => void jogarFora(p)}
                        aria-label={`Descartar ${p.nome ?? p.dominio}`}
                      >
                        <X className="size-4" aria-hidden />
                      </Button>
                    </>
                  ) : null}

                  {p.estado === 'enviado' ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-11 sm:min-h-8"
                        onClick={() => void confirmar(p)}
                      >
                        <Check className="size-4" aria-hidden />
                        Falei
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="min-h-11 sm:min-h-8"
                        onClick={() => void devolver(p)}
                        aria-label={`Devolver ${p.dominio} para a fila`}
                      >
                        <Undo2 className="size-4" aria-hidden />
                      </Button>
                    </>
                  ) : null}

                  {p.estado === 'confirmado' || p.estado === 'descartado' ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="min-h-11 sm:min-h-8"
                      onClick={() => void devolver(p)}
                      aria-label={`Devolver ${p.dominio} para a fila`}
                    >
                      <Undo2 className="size-4" aria-hidden />
                    </Button>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {filtrada.length > visiveis.length ? (
        <Button
          variant="outline"
          onClick={() => setQuantas((q) => q + POR_PAGINA)}
          className="self-center"
        >
          Mostrar mais ({filtrada.length - visiveis.length} restantes)
        </Button>
      ) : null}

      <p className="text-muted-foreground border-border/60 border-t pt-3 text-xs">
        <strong className="text-foreground">Teclado:</strong> <kbd>J</kbd>/<kbd>K</kbd> para
        andar, <kbd>E</kbd> envia a linha marcada, <kbd>X</kbd> descarta,{' '}
        <kbd>Enter</kbd> confirma quem já foi. Enviar abre o WhatsApp em outra aba — você
        não sai daqui.
      </p>
    </div>
  )
}
