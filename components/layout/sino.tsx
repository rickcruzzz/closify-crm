'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, Check, Loader2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import {
  carregarNotificacoes,
  dispensarNotificacao,
  marcarComoLida,
  marcarTodasComoLidas,
} from '@/lib/notificacoes/actions'
import { gravidadeDe, tempoRelativo, type Notificacao } from '@/lib/notificacoes/tipos'

/**
 * O sino da barra superior.
 *
 * ## O contador só existe quando há o que cobrar
 *
 * Nada de "0" no ponto, e nada de "tudo em dia" quando a lista está vazia. É a
 * mesma decisão do contador de tarefas da barra lateral, de 19/08: contador em
 * zero vira ruído e treina a pessoa a ignorar o lugar. E é a mesma doutrina do
 * vigia de 01/09 — **silêncio é resposta**. Um "está tudo certo" diário parece
 * cuidado e é o contrário: ensina a arquivar sem ler, e no dia em que o assunto
 * for grave o reflexo já está formado.
 *
 * ## A lista é buscada ao ABRIR, nunca antes
 *
 * O layout passa só o número, que custa um `count` agregado no banco. A lista
 * vem por Server Action no primeiro clique. A maioria das navegações nunca
 * abre o sino, e pendurar 30 linhas no layout faria todas elas pagarem por uma
 * tela que quase ninguém vê.
 */
export function Sino({ naoLidas }: { naoLidas: number }) {
  const router = useRouter()
  const [aberto, setAberto] = React.useState(false)
  const [carregando, setCarregando] = React.useState(false)
  const [erro, setErro] = React.useState<string | null>(null)
  const [itens, setItens] = React.useState<Notificacao[] | null>(null)
  const [marcandoTodas, setMarcandoTodas] = React.useState(false)

  // O relógio de "há 5 min" nasce no CLIENTE, num efeito, e nunca no servidor:
  // a Vercel roda em UTC, e formatar tempo relativo no servidor produziria
  // "há 3 horas" para algo de agora. Mesma armadilha registrada em
  // `lib/tasks/buckets.ts`.
  const [agora, setAgora] = React.useState<Date | null>(null)

  React.useEffect(() => {
    if (!aberto) return
    setAgora(new Date())
  }, [aberto])

  const buscar = React.useCallback(async () => {
    setCarregando(true)
    setErro(null)
    const r = await carregarNotificacoes()
    if ('error' in r) {
      setErro(r.error)
      setItens([])
    } else {
      setItens(r.notificacoes)
    }
    setCarregando(false)
  }, [])

  function aoAbrir(proximo: boolean) {
    setAberto(proximo)
    // Rebusca a cada abertura, e não só na primeira: a pessoa deixa o CRM
    // aberto o dia inteiro, e uma lista congelada no primeiro clique da manhã
    // mostraria um estado que deixou de existir há horas.
    if (proximo) void buscar()
  }

  async function abrirItem(n: Notificacao) {
    // Otimista, e a razão é a mesma da janela de desfazer de `/hoje`: o
    // servidor leva a viagem inteira de `revalidatePath` para responder, e
    // esperar por ele deixa o clique 1,5s sem sinal na tela. A cópia local
    // VENCE a do servidor até ele concordar.
    if (!n.lidaEm) {
      setItens((atual) =>
        atual?.map((i) => (i.id === n.id ? { ...i, lidaEm: new Date().toISOString() } : i)) ?? null,
      )
      void marcarComoLida(n.id).then(() => router.refresh())
    }
    if (n.href) setAberto(false)
  }

  /**
   * Tira o aviso da lista.
   *
   * Otimista pela mesma razão de `abrirItem`: o servidor leva a viagem inteira
   * de `revalidatePath`, e esperar deixaria o clique 1,5s sem sinal. Some da
   * tela na hora; se o servidor recusar, ele volta e o erro aparece.
   */
  function dispensar(n: Notificacao) {
    const antes = itens
    setItens((atual) => atual?.filter((i) => i.id !== n.id) ?? null)
    void dispensarNotificacao(n.id).then((r) => {
      if (r && 'error' in r && r.error) {
        setItens(antes)
        setErro(r.error)
        return
      }
      router.refresh()
    })
  }

  async function marcarTodas() {
    setMarcandoTodas(true)
    const agoraIso = new Date().toISOString()
    setItens((atual) => atual?.map((i) => (i.lidaEm ? i : { ...i, lidaEm: agoraIso })) ?? null)
    await marcarTodasComoLidas()
    router.refresh()
    setMarcandoTodas(false)
  }

  const temNaoLida = (itens ?? []).some((i) => !i.lidaEm)

  return (
    <DropdownMenu open={aberto} onOpenChange={aoAbrir}>
      <DropdownMenuTrigger
        aria-label={
          naoLidas > 0
            ? `Avisos, ${naoLidas} ${naoLidas === 1 ? 'não lido' : 'não lidos'}`
            : 'Avisos'
        }
        className="hover:bg-muted relative flex size-11 shrink-0 items-center justify-center rounded-lg transition-colors outline-none md:size-9"
      >
        <Bell aria-hidden className="size-[18px]" />
        {naoLidas > 0 && (
          // O ponto carrega o NÚMERO até 9, e "9+" acima disso. Dois erros
          // possíveis aqui: sem número, "tem algo" e "tem trinta coisas" ficam
          // indistinguíveis; com número exato acima de 9, a bolha estoura o
          // ícone. O corte é a mesma distinção que o vigia usa para decidir se
          // um alerta PIOROU — comparar o número é o que separa "continua" de
          // "está pior".
          <span
            aria-hidden
            className="bg-primary text-primary-foreground absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-4 font-semibold tabular-nums md:top-0.5 md:right-0.5"
          >
            {naoLidas > 9 ? '9+' : naoLidas}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[min(22rem,calc(100vw-1.5rem))] p-0">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <span className="text-sm font-medium">Avisos</span>
          <div className="flex items-center gap-1">
          {temNaoLida && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground h-7 px-2 text-xs"
              disabled={marcandoTodas}
              onClick={marcarTodas}
            >
              {marcandoTodas ? (
                <Loader2 aria-hidden className="size-3.5 animate-spin" />
              ) : (
                <Check aria-hidden className="size-3.5" />
              )}
              Marcar todos como lidos
            </Button>
          )}
          {/* Fechar explícito.
              
              O dropdown já fecha com Esc e com clique fora, e as duas coisas
              são invisíveis: no telefone não existe Esc, e "clique fora" num
              painel que ocupa quase a largura da tela é um alvo que a pessoa
              não sabe que existe. */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Fechar avisos"
            className="text-muted-foreground size-7 shrink-0 p-0"
            onClick={() => setAberto(false)}
          >
            <X aria-hidden className="size-4" />
          </Button>
          </div>
        </div>

        <div className="max-h-[min(26rem,60vh)] overflow-y-auto">
          {carregando && itens === null && (
            <p className="text-muted-foreground px-3 py-6 text-center text-sm">
              <Loader2 aria-hidden className="mx-auto size-4 animate-spin" />
            </p>
          )}

          {erro && <p className="text-muted-foreground px-3 py-6 text-center text-sm">{erro}</p>}

          {/* Vazio NÃO diz "tudo certo". Ele diz o que o lugar é e quando vai
              falar — a diferença entre um sino confiável e um que afirma
              saúde que ninguém conferiu. `null` significa "não sei", nunca
              "está zerado": é a distinção que fez a Central declarar R$ 490/mês
              de receita com R$ 0,00 real em 30/08. */}
          {!carregando && !erro && itens?.length === 0 && (
            <p className="text-muted-foreground px-4 py-8 text-center text-sm text-balance">
              Nada por aqui. Avisamos sobre cobrança, plano e integração. O
              resto do dia a dia fica na tela Hoje.
            </p>
          )}

          <ul>
            {itens?.map((n) => {
              const alta = gravidadeDe(n.tipo) === 'alta'
              const conteudo = (
                <>
                  <span
                    aria-hidden
                    className={cn(
                      'mt-1.5 size-2 shrink-0 rounded-full',
                      n.lidaEm
                        ? 'bg-transparent'
                        : alta
                          ? 'bg-destructive'
                          : 'bg-primary',
                    )}
                  />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span
                      className={cn(
                        'text-sm leading-snug text-balance',
                        n.lidaEm ? 'text-muted-foreground' : 'font-medium',
                      )}
                    >
                      {n.titulo}
                    </span>
                    {n.corpo && (
                      <span className="text-muted-foreground text-xs leading-snug">{n.corpo}</span>
                    )}
                    <span className="text-muted-foreground/80 text-[11px]">
                      {/* Só depois de o relógio do cliente existir: renderizar
                          antes causaria descasamento de hidratação. */}
                      {agora ? tempoRelativo(n.criadaEm, agora) : ''}
                    </span>
                  </span>
                </>
              )

              return (
                // O `X` é IRMÃO da área clicável, nunca filho.
                //
                // Botão dentro de link é elemento interativo aninhado: HTML
                // inválido, e na prática o clique no `X` navegaria junto. O
                // `group` existe para o `X` aparecer no hover do item inteiro
                // em vez de poluir a lista com um ícone por linha o tempo todo.
                <li key={n.id} className="group flex items-start border-b last:border-b-0">
                  {n.href ? (
                    <Link
                      href={n.href}
                      onClick={() => void abrirItem(n)}
                      className="hover:bg-muted flex min-h-11 flex-1 items-start gap-2.5 py-2.5 pr-1 pl-3 text-left transition-colors"
                    >
                      {conteudo}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void abrirItem(n)}
                      className="hover:bg-muted flex min-h-11 flex-1 items-start gap-2.5 py-2.5 pr-1 pl-3 text-left transition-colors"
                    >
                      {conteudo}
                    </button>
                  )}
                  {/* Sempre visível no telefone, no hover no desktop: `hover`
                      não existe em toque, e esconder atrás dele deixaria o
                      recurso inalcançável em metade dos aparelhos. */}
                  <button
                    type="button"
                    aria-label={`Dispensar aviso: ${n.titulo}`}
                    onClick={() => dispensar(n)}
                    className="text-muted-foreground hover:text-foreground hover:bg-muted flex size-11 shrink-0 items-center justify-center self-stretch transition-colors md:size-9 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                  >
                    <X aria-hidden className="size-4" />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
