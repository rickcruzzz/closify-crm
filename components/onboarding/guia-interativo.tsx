'use client'

import * as React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeft, Check, PartyPopper } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  FOLGA_DO_RECORTE,
  LARGURA_DO_CARTAO,
  MARGEM_DA_JANELA,
  concluidosNoGuia,
  guiaCumprido,
  montarGuia,
  naRotaDoPasso,
  passoAtivo,
  posicionarCartao,
  visitaCumpridaEm,
  type EstadoDoGuia,
  type PassoResolvido,
  type Retangulo,
} from '@/lib/onboarding/guia'
import {
  lerProgressoDoGuia,
  marcarTour,
  marcarVisitaDoGuia,
} from '@/lib/onboarding/actions'
import { registrar } from '@/lib/onboarding/eventos'

/**
 * O onboarding interativo: o produto apontando onde clicar, na tela real.
 *
 * ## Por que ele mora no LAYOUT, e nao numa pagina
 *
 * Esta e a decisao que faz o guia existir. No App Router, trocar de rota
 * desmonta a arvore da pagina, e os passos falam de telas diferentes: um guia
 * montado em `/leads` morre no instante em que a pessoa vai para `/kanban`,
 * que e exatamente o momento em que ela mais precisa dele.
 *
 * `app/(dashboard)/layout.tsx` sobrevive a navegacao dentro do grupo. Montado
 * ali, o guia atravessa as seis telas sem perder estado e sem remontar, que e o
 * requisito de "evite reinicializar o tour a cada navegacao".
 *
 * ## O destaque nao bloqueia o clique
 *
 * O veu inteiro leva `pointer-events: none`, e o buraco e desenhado por uma
 * sombra de 9999px em volta de um retangulo vazio. O elemento destacado
 * continua sendo o elemento da pagina, com o `onClick` dele: o guia nao
 * intercepta nada, so escurece o resto.
 *
 * Clonar o botao para dentro do veu seria o caminho obvio e o errado, o clone
 * nao carrega o estado do React nem o handler, e o projeto ja pagou essa conta
 * em 08/09 com o `render={<a/>}` do Base UI engolindo o `onClick`.
 *
 * ## E ele some quando um dialogo abre
 *
 * Todo passo de acao termina num formulario. Enquanto ele esta aberto o guia
 * nao tem o que apontar, e um veu por cima do dialogo seria so uma tela mais
 * escura para preencher. A presenca de `[role="dialog"]` no documento e o
 * sinal, observada por `MutationObserver`.
 */
export function GuiaInterativo() {
  const router = useRouter()
  const rotaAtual = usePathname()

  const [estado, setEstado] = React.useState<EstadoDoGuia | null>(null)
  const [encerrado, setEncerrado] = React.useState(false)
  const [indiceManual, setIndiceManual] = React.useState<number | null>(null)
  const [dialogoAberto, setDialogoAberto] = React.useState(false)
  const [alvo, setAlvo] = React.useState<Retangulo | null>(null)
  const [alturaDoCartao, setAlturaDoCartao] = React.useState(160)
  const [janela, setJanela] = React.useState({ largura: 0, altura: 0 })

  const cartao = React.useRef<HTMLDivElement | null>(null)

  const recarregar = React.useCallback(async () => {
    const progresso = await lerProgressoDoGuia()
    // `null` e falha de leitura ou sessao perdida. Manter o estado anterior e
    // o certo: zerar faria o guia voltar ao passo 1 e mandar refazer o que ja
    // foi feito, que e o pior erro que ele pode cometer.
    if (progresso) setEstado(progresso)
  }, [])

  React.useEffect(() => {
    registrar('tour_started')
    void recarregar()
  }, [recarregar])

  const passos = React.useMemo(() => (estado ? montarGuia(estado) : []), [estado])
  const ativo = passoAtivo(passos)
  const cumprido = guiaCumprido(passos)

  /**
   * O passo na tela. `indiceManual` existe so para o botao Voltar: ele fixa um
   * passo ja concluido para releitura, e qualquer avanco real o solta.
   */
  const passo: PassoResolvido | null =
    indiceManual != null ? (passos[indiceManual] ?? ativo) : ativo

  // Chegar numa tela cumpre o passo dela, mesmo fora da ordem do guia.
  //
  // ## Quem impede a repeticao e o proprio estado, e nao um `ref`
  //
  // A primeira versao guardava as chaves ja marcadas num `useRef`, como trava
  // extra contra chamada repetida. Ela transformou o `ref` em fonte de verdade
  // paralela, e o `reactStrictMode` do Next 14 cobrou a conta na hora: em
  // desenvolvimento ele monta, desmonta e remonta preservando `ref` e estado.
  // Na remontagem `estado` ainda era `null`, o efeito saia cedo; quando o
  // progresso chegava, o `ref` ja dizia "marcado" e a atualizacao otimista
  // nunca acontecia. Resultado visivel: o contador do cartao travado em
  // `0/6 feitos` com a visita gravada no banco.
  //
  // Sem o `ref`, a propria atualizacao otimista fecha a porta: a segunda
  // passagem encontra a chave dentro de `estado.visitadas` e para ali. E
  // `marcarVisitaDoGuia` ja e idempotente no servidor, entao uma chamada a mais
  // nao escreve nada.
  React.useEffect(() => {
    if (!estado || encerrado) return
    const chave = visitaCumpridaEm(rotaAtual)
    if (!chave || estado.visitadas.includes(chave)) return

    setIndiceManual(null)
    // Otimista: a tela avanca no mesmo quadro em que a rota muda. O servidor
    // confirma depois, e um erro ali nao volta o passo atras, ele so nao
    // persiste, e a proxima visita marca de novo.
    setEstado((atual) =>
      atual && !atual.visitadas.includes(chave)
        ? { ...atual, visitadas: [...atual.visitadas, chave] }
        : atual,
    )
    void marcarVisitaDoGuia(chave)
  }, [rotaAtual, estado, encerrado])

  /**
   * Confere o banco enquanto a pessoa esta fazendo a acao.
   *
   * So enquanto o passo e de DADO, a pessoa esta na tela dele e a aba esta a
   * vista. Fora disso nao ha o que mudar, e um relogio rodando em toda
   * navegacao seria custo permanente para um recurso que dura um dia.
   *
   * Existe porque nem toda criacao volta pelo servidor: `revalidatePath`
   * atualiza a PAGINA, e o guia mora no layout. Sem esta conferencia, criar o
   * contato e ficar parado deixaria o passo aceso, e "o sistema percebeu que
   * eu concluí a ação?" e justamente a pergunta que o pedido manda responder.
   */
  const esperandoDado = Boolean(
    passo && !passo.concluido && passo.conclusao.tipo === 'dado' && naRotaDoPasso(passo, rotaAtual),
  )

  React.useEffect(() => {
    if (!esperandoDado || encerrado) return

    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void recarregar()
    }, 4000)

    const aoVoltar = () => void recarregar()
    window.addEventListener('focus', aoVoltar)

    return () => {
      clearInterval(id)
      window.removeEventListener('focus', aoVoltar)
    }
  }, [esperandoDado, encerrado, recarregar])

  // Fechar o formulario e o momento mais provavel de o passo ter terminado.
  React.useEffect(() => {
    if (encerrado) return

    const conferir = () => {
      setDialogoAberto((antes) => {
        const agora = temModalAberto()
        if (antes && !agora) void recarregar()
        return agora
      })
    }

    conferir()
    const observador = new MutationObserver(conferir)
    observador.observe(document.body, { childList: true, subtree: true })
    return () => observador.disconnect()
  }, [encerrado, recarregar])

  // A posicao do alvo, seguida quadro a quadro.
  //
  // `requestAnimationFrame` e nao ouvintes de `scroll` e `resize`: o alvo se
  // move por rolagem de container interno, por abrir e fechar a barra lateral e
  // por reflow depois de carregar dado, e nenhum desses tres emite os eventos
  // da janela. Ler um `getBoundingClientRect` por quadro custa menos que errar
  // a posicao.
  const chaveDoAlvo = passo?.alvo ?? null
  const visivel = Boolean(passo) && !encerrado && !dialogoAberto && estado !== null

  React.useEffect(() => {
    if (!visivel || !chaveDoAlvo) {
      setAlvo(null)
      return
    }

    let quadro = 0
    let jaRolou = false

    const medir = () => {
      const elemento = elementoVisivel(chaveDoAlvo)

      if (!elemento) {
        setAlvo(null)
      } else {
        const r = elemento.getBoundingClientRect()
        setAlvo((antes) =>
          antes &&
          Math.abs(antes.top - r.top) < 0.5 &&
          Math.abs(antes.left - r.left) < 0.5 &&
          Math.abs(antes.width - r.width) < 0.5 &&
          Math.abs(antes.height - r.height) < 0.5
            ? antes
            : { top: r.top, left: r.left, width: r.width, height: r.height },
        )

        // Alvo fora da vista e alvo inexistente do ponto de vista de quem le.
        // Uma rolagem so, na primeira medicao: repetir brigaria com a pessoa
        // tentando rolar para outro lugar.
        if (!jaRolou && (r.top < 0 || r.bottom > window.innerHeight)) {
          jaRolou = true
          elemento.scrollIntoView({ block: 'center', behavior: 'smooth' })
        }
      }

      // Objeto NOVO a cada quadro seria um `setState` a 60 por segundo, ou seja
      // uma re-renderizacao por quadro para um valor que quase nunca muda. E a
      // familia do React #185 que este projeto ja pagou em 06/09: o laco nao
      // estoura, so consome a maquina e atrasa todo o resto.
      const largura = window.innerWidth
      const altura = alturaUtil()
      setJanela((antes) =>
        antes.largura === largura && antes.altura === altura ? antes : { largura, altura },
      )

      quadro = requestAnimationFrame(medir)
    }

    quadro = requestAnimationFrame(medir)
    return () => cancelAnimationFrame(quadro)
  }, [visivel, chaveDoAlvo, rotaAtual])

  // A janela tambem precisa ser medida quando NAO ha alvo: ali o laco de
  // `requestAnimationFrame` nem comeca, e sem isto `janela` ficaria 0x0 e o
  // cartao encalharia no canto superior esquerdo.
  React.useEffect(() => {
    const medir = () => setJanela({ largura: window.innerWidth, altura: alturaUtil() })
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [])

  React.useEffect(() => {
    const no = cartao.current
    if (!no) return
    const observador = new ResizeObserver(() => setAlturaDoCartao(no.offsetHeight))
    observador.observe(no)
    setAlturaDoCartao(no.offsetHeight)
    return () => observador.disconnect()
  }, [visivel, passo?.chave, cumprido])

  async function encerrar(status: 'skipped' | 'completed') {
    setEncerrado(true)
    await marcarTour(status)
    // O que decide se o guia abre e o estado no banco, e ele acabou de mudar.
    // Sem recarregar os dados do servidor o layout continuaria com
    // `tourStatus: 'not_started'` em memoria e o guia voltaria na proxima
    // navegacao interna, exatamente o defeito que o tour antigo documentava.
    router.refresh()
  }

  if (encerrado || !estado || dialogoAberto) return null
  if (!passo && !cumprido) return null

  const estreita = janela.largura > 0 && janela.largura < 640
  const largura = Math.min(LARGURA_DO_CARTAO, Math.max(240, janela.largura - MARGEM_DA_JANELA * 2))

  const recorte = alvo
    ? {
        top: alvo.top - FOLGA_DO_RECORTE,
        left: alvo.left - FOLGA_DO_RECORTE,
        width: alvo.width + FOLGA_DO_RECORTE * 2,
        height: alvo.height + FOLGA_DO_RECORTE * 2,
      }
    : null

  const posicao = posicionarCartao({
    recorte: estreita ? null : recorte,
    alturaDoCartao,
    largura,
    janela,
  })

  const total = passos.length
  const feitos = concluidosNoGuia(passos)

  return (
    <div
      // `pointer-events-none` no veu inteiro e o que mantem o elemento
      // destacado clicavel. O cartao devolve `auto` so para si.
      className="pointer-events-none fixed inset-0 z-40"
      // O guia nao e um dialogo: ele nao captura o foco, porque a pessoa
      // precisa continuar usando a tela por baixo. `polite` anuncia o passo
      // sem interromper o que o leitor de tela estiver falando.
      role="region"
      aria-live="polite"
      aria-label="Guia de primeiros passos"
    >
      {recorte && (
        <div
          aria-hidden
          className="ring-primary absolute rounded-xl ring-2 transition-[top,left,width,height] duration-200 motion-reduce:transition-none"
          style={{
            top: recorte.top,
            left: recorte.left,
            width: recorte.width,
            height: recorte.height,
            boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.55)',
          }}
        />
      )}

      {/* Sem alvo na tela o veu ainda escurece, senao o cartao flutuaria sobre
          a interface normal sem nada dizendo que ha um guia rodando. */}
      {!recorte && <div aria-hidden className="absolute inset-0 bg-black/55" />}

      <div
        ref={cartao}
        className={cn(
          'bg-card text-card-foreground pointer-events-auto absolute flex flex-col gap-3 rounded-xl border p-4 shadow-2xl',
          'animate-entrada fade-in slide-in-from-bottom-2 fill-mode-both ease-entrada duration-entrada',
        )}
        style={{ top: posicao.top, left: posicao.left, width: largura }}
      >
        {cumprido ? (
          <>
            <div className="flex items-center gap-2">
              <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                <PartyPopper aria-hidden className="size-4.5" />
              </span>
              <p className="text-sm font-semibold">Seu funil está de pé</p>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Contato, negócio e a cobrança do retorno já existem. Daqui pra frente é só
              repetir, e a tela Hoje avisa a hora.
            </p>
            <Button type="button" size="sm" onClick={() => void encerrar('completed')}>
              <Check className="size-4" />
              Concluir
            </Button>
          </>
        ) : (
          passo && (
            <>
              <div className="text-muted-foreground flex items-center justify-between text-xs">
                <span className="tabular-nums">
                  Passo {passo.indice + 1} de {total}
                </span>
                <span className="tabular-nums">
                  {feitos}/{total} feitos
                </span>
              </div>

              <div aria-hidden className="flex gap-1">
                {passos.map((p) => (
                  <span
                    key={p.chave}
                    className={cn(
                      'h-1 flex-1 rounded-full transition-colors',
                      p.concluido
                        ? 'bg-primary'
                        : p.chave === passo.chave
                          ? 'bg-primary/40'
                          : 'bg-muted',
                    )}
                  />
                ))}
              </div>

              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold">{passo.titulo}</p>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {passo.texto}
                </p>
              </div>

              {/* Tres saidas possiveis, e a ordem entre elas e a do que a
                  pessoa precisa AGORA:

                  1. esta na tela errada          leva ela ate la
                  2. esta na tela e o alvo sumiu  idem, com o mesmo botao
                  3. esta relendo um passo feito  volta para onde parou

                  Nao ha "Continuar" para passo em aberto, de proposito: e o
                  botao que transformaria o guia no slideshow que ele
                  substituiu. */}
              {!naRotaDoPasso(passo, rotaAtual) || !alvo ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setIndiceManual(null)
                    router.push(passo.rota)
                  }}
                >
                  Ir para esta tela
                </Button>
              ) : passo.concluido ? (
                <Button type="button" size="sm" onClick={() => setIndiceManual(null)}>
                  Voltar ao passo atual
                </Button>
              ) : null}

              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => void encerrar('skipped')}
                >
                  Pular guia
                </Button>

                {passo.indice > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIndiceManual(passo.indice - 1)}
                  >
                    <ArrowLeft className="size-4" />
                    Anterior
                  </Button>
                )}
              </div>
            </>
          )
        )}
      </div>
    </div>
  )
}

/**
 * Ha um dialogo MODAL aberto na tela?
 *
 * ## O que parecia obvio e estava errado, medido em 17/09
 *
 * A primeira versao procurava `[role="dialog"]` e pronto. O **banner de
 * consentimento de cookies** carrega esse papel, fica no DOM ate a pessoa
 * responder, e e justamente quem acabou de criar conta que ainda nao
 * respondeu: o guia nascia escondido para todo usuario novo, que e a unica
 * populacao que ele atende. Sem erro nenhum no console.
 *
 * O que separa os dois foi medido no navegador, atributo por atributo:
 *
 *     banner de cookies    role=dialog   sem data-open
 *     Dialog do Base UI    role=dialog   data-open, data-slot=dialog-content
 *
 * `aria-modal` NAO serve, e essa foi a segunda hipotese descartada: nenhum dos
 * dois o declara. `aria-modal="true"` fica na condicao mesmo assim, para um
 * `<dialog>` nativo ou outra biblioteca no futuro, mas quem decide hoje e o
 * `data-open`.
 *
 * O modo de falhar tambem mudou de lado. Antes, um sinal errado escondia o guia
 * para sempre; agora ele no maximo deixa o guia visivel um instante a mais
 * sobre um formulario.
 */
function temModalAberto(): boolean {
  return Array.from(
    document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]'),
  ).some(
    (el) =>
      (el.hasAttribute('data-open') || el.getAttribute('aria-modal') === 'true') &&
      el.getClientRects().length > 0,
  )
}

/**
 * A altura da janela DESCONTANDO o banner de consentimento.
 *
 * O banner publica a propria altura em `--altura-do-banner` desde 02/09,
 * justamente porque so ele sabe quanto ocupa, e ele e `z-50` contra o `z-40`
 * do guia. Sem descontar, o cartao no rodape nasceria atras dele, para a mesma
 * conta nova que ainda nao respondeu o banner.
 *
 * Esta pagina ja teve o CTA tapado por esse banner tres vezes, em 23/08, 24/08
 * e 02/09. Nao e hipotese.
 */
function alturaUtil(): number {
  const bruto = getComputedStyle(document.documentElement).getPropertyValue('--altura-do-banner')
  const banner = Number.parseFloat(bruto)
  return window.innerHeight - (Number.isFinite(banner) ? banner : 0)
}

/**
 * O primeiro elemento VISIVEL com aquele `data-tour`.
 *
 * O mesmo alvo existe mais de uma vez de proposito: "Novo contato" aparece na
 * barra de acoes e dentro do estado vazio, e qual dos dois esta na tela depende
 * de a empresa ter contato ou nao. Pegar o primeiro do documento apontaria para
 * um botao com `display: none` metade das vezes.
 *
 * `getClientRects().length` cobre os dois casos que importam: elemento oculto
 * por `display` e elemento dentro de container recolhido.
 */
function elementoVisivel(chave: string): HTMLElement | null {
  const candidatos = document.querySelectorAll<HTMLElement>(
    `[data-tour="${CSS.escape(chave)}"]`,
  )
  // `for...of` sobre `NodeListOf` exige `downlevelIteration`, e o alvo do
  // `tsconfig` deste projeto e anterior a isso. `Array.from` resolve sem mexer
  // na configuracao do compilador inteiro por causa de um laco.
  return Array.from(candidatos).find((el) => el.getClientRects().length > 0) ?? null
}
