'use client'

import * as React from 'react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import {
  CHAVE_CONSENTIMENTO,
  COOKIE_CONSENTIMENTO,
  MAX_AGE_CONSENTIMENTO,
  interpretarConsentimento,
  type Consentimento,
} from '@/lib/analytics/consentimento'

/**
 * O evento que avisa o resto da página que a escolha mudou.
 *
 * `storage` do navegador só dispara em OUTRAS abas, nunca na que escreveu —
 * então sem um evento próprio o pixel só ligaria no próximo carregamento, e
 * quem acabou de aceitar não seria medido na visita em que aceitou, que é
 * justamente a visita que veio do anúncio.
 */
export const EVENTO_CONSENTIMENTO = 'vf:consentimento'

/**
 * A altura que o banner ocupa AGORA, publicada no `<html>` para o resto do
 * site se posicionar em cima dela.
 *
 * Existe porque a terceira reincidência do mesmo defeito provou que corrigir
 * posição não fecha a classe: cada vez que um elemento saía de trás do banner,
 * o seguinte entrava. Quem sabe a altura do banner é o banner; todo o resto
 * estava chutando um número que muda com a largura da tela, o tamanho da fonte
 * e a quebra do texto.
 *
 * Zero quando não há banner — então quem lê a variável não precisa saber se
 * ele existe.
 */
export const VAR_ALTURA_DO_BANNER = '--altura-do-banner'

export function lerConsentimentoDoNavegador(): Consentimento | null {
  if (typeof window === 'undefined') return null
  try {
    return interpretarConsentimento(window.localStorage.getItem(CHAVE_CONSENTIMENTO))
  } catch {
    // Navegador com storage bloqueado (aba anônima restrita, política de
    // empresa). Sem onde guardar a escolha, o seguro é não rastrear.
    return null
  }
}

/**
 * Banner de consentimento de cookies.
 *
 * ## As decisões que a LGPD obriga, e que aparecem no código
 *
 * **"Recusar" tem o mesmo peso visual que "Aceitar".** Os dois são botões, de
 * mesmo tamanho, lado a lado. A ANPD recomenda isso explicitamente, e é também
 * o que separa um banner de um dark pattern: esconder a recusa atrás de "saiba
 * mais" invalida o consentimento, porque ele deixa de ser livre.
 *
 * **Nada dispara antes da escolha.** O pixel não é carregado e depois desligado
 * — ele nem chega a existir enquanto não houver "aceito". Bloqueio prévio é o
 * ponto todo; consentimento pedido depois do rastreamento não é consentimento.
 *
 * **Não há botão de fechar.** Um "X" seria uma terceira saída ambígua: a pessoa
 * some com o banner sem ter dito nada, e alguém precisa decidir o que isso
 * significa. Aqui só existem duas respostas, as duas explícitas.
 *
 * O texto diz o que está em jogo em uma frase, sem juridiquês — quem quiser o
 * detalhe tem o link para a Política de Privacidade ali do lado.
 */
export function BannerConsentimento() {
  // Nasce `null` e só decide no cliente: o servidor não tem localStorage, e
  // renderizar o banner no HTML causaria descasamento de hidratação.
  const [decidido, setDecidido] = React.useState<boolean | null>(null)
  const caixa = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    setDecidido(lerConsentimentoDoNavegador() !== null)
  }, [])

  // ## Publica a própria altura, e é isso que fecha a classe do defeito
  //
  // `ResizeObserver` e não uma medição única: a altura muda com a largura da
  // tela, com o zoom de fonte do sistema e com a quebra do texto. Um número
  // medido uma vez no `mount` estaria errado no primeiro giro do aparelho.
  //
  // Escrito no `<html>` e não no `<body>` porque `:root` é onde as custom
  // properties deste projeto vivem, e porque o `body` é justamente quem lê a
  // variável para reservar espaço — quem escreve e quem lê não podem ser o
  // mesmo elemento sem virar dependência circular de leitura de layout.
  React.useEffect(() => {
    const alvo = caixa.current
    const raiz = document.documentElement
    if (!alvo) {
      raiz.style.removeProperty(VAR_ALTURA_DO_BANNER)
      return
    }

    const medir = () => {
      raiz.style.setProperty(VAR_ALTURA_DO_BANNER, `${Math.ceil(alvo.offsetHeight)}px`)
    }
    medir()

    const observador = new ResizeObserver(medir)
    observador.observe(alvo)

    return () => {
      observador.disconnect()
      // Ao responder, a variável precisa voltar a zero no MESMO instante em
      // que o banner some. Deixá-la preenchida manteria uma faixa de espaço
      // reservado para um elemento que não existe mais — o mesmo tipo de
      // sobra que este arquivo já produziu duas vezes, ao contrário.
      raiz.style.removeProperty(VAR_ALTURA_DO_BANNER)
    }
  }, [decidido])

  const responder = React.useCallback((resposta: Consentimento) => {
    try {
      window.localStorage.setItem(CHAVE_CONSENTIMENTO, resposta)
    } catch {
      // Sem storage a escolha não sobrevive ao recarregamento, mas vale para
      // esta visita: some o banner e o pixel liga (ou não) agora.
    }

    // ## O mesmo valor num cookie, porque o SERVIDOR não lê `localStorage`
    //
    // Enquanto a decisão vivia só no storage, a Conversions API disparava
    // independentemente dela: quem recusava e se cadastrava tinha e-mail,
    // telefone, nome, cidade, estado e CEP enviados à Meta do mesmo jeito.
    // O pixel do navegador sempre respeitou; a CAPI, que é justamente quem
    // manda o dado pessoal, nunca consultou nada.
    //
    // Escrito no MESMO instante e com a MESMA chave versionada, para as duas
    // fontes não divergirem. `SameSite=Lax` porque ele precisa sobreviver à
    // volta do OAuth do Google; sem `httpOnly` porque não é segredo — é a
    // escolha da pessoa, e o cliente também a lê.
    try {
      const seguro = window.location.protocol === 'https:' ? '; Secure' : ''
      document.cookie =
        `${COOKIE_CONSENTIMENTO}=${resposta}; Max-Age=${MAX_AGE_CONSENTIMENTO}` +
        `; Path=/; SameSite=Lax${seguro}`
    } catch {
      // Cookie bloqueado: a CAPI não recebe o sinal e, por desenho, NÃO envia.
      // Falhar para o lado de não rastrear é o comportamento certo.
    }
    window.dispatchEvent(new CustomEvent(EVENTO_CONSENTIMENTO, { detail: resposta }))
    setDecidido(true)
  }, [])

  if (decidido !== false) return null

  return (
    <div
      role="dialog"
      aria-label="Aviso de cookies"
      aria-live="polite"
      // `p-3` no telefone: medido em 390×844, a versão anterior ocupava 206px
      // — 27% da tela — e cobria exatamente o CTA do hero, que começa no mesmo
      // pixel. Quem chega de anúncio via o "Começar grátis" tapado por um aviso
      // de cookie. Banner de consentimento tem que ser inevitável, não
      // volumoso.
      // ## Card no canto, não faixa de largura total
      //
      // Sendo `fixed`, o banner sempre cobre a base da VIEWPORT — e é ali que
      // fica o fim da primeira dobra. Encolher a altura só adia: já cobriu o
      // "Começar grátis" em 23/08 (206px) e, depois de compactado para 122px,
      // voltou a cobrir a linha do preço em 24/08.
      //
      // Reservar espaço com `padding-bottom` no body PROTEGE O FIM DO
      // DOCUMENTO, e este comentário já afirmou que isso "não resolve".
      // Resolve — só não resolve a dobra, que é outro problema. A distinção
      // custou o defeito mais caro que esta página já teve, medido em
      // produção em 02/09, em 390×659 (a viewport VISÍVEL de um iPhone, não
      // os 844 do aparelho):
      //
      //     /cadastro, rolado ate o FIM     scrollY 144 == maxScroll 144
      //     botao "Criar conta"             539..583
      //     elementFromPoint no centro      o <p> DESTE banner
      //
      // Não é "abaixo da dobra": a página é curta, já está no fim da rolagem,
      // e **não havia para onde rolar**. Quem chegava de anúncio pelo telefone
      // não tinha como criar conta, exceto pelo "Continuar com Google", que
      // fica no topo. Com o espaço reservado, a rolagem passa a existir e o
      // botão sai de trás daqui.
      //
      // Por isso a altura agora é publicada em `--altura-do-banner` (ver o
      // topo do arquivo) em vez de cada elemento tentar adivinhá-la.
      //
      // O que resolve é ele deixar de ocupar a largura inteira. Como card de
      // largura limitada num canto, a faixa inferior continua livre do outro
      // lado, e o conteúdo centralizado do hero (título, CTA, preço) deixa de
      // ficar sistematicamente atrás dele. É o padrão que Vercel, Linear e
      // Stripe usam, e não custa nada em conformidade: o aviso segue
      // inevitável, com "Recusar" do mesmo tamanho de "Aceitar".
      //
      // ## E o canto é o DIREITO, não o esquerdo
      //
      // Ancorado à esquerda, este card **engolia o clique em "Criar conta"**.
      // Medido em produção em 27/08/2026, com `elementFromPoint` no centro do
      // botão:
      //
      //     notebook 1280x720   /cadastro   BLOQUEADO   cobre 79%
      //     notebook 1366x768   /cadastro   BLOQUEADO   cobre 74%
      //
      // As duas resoluções de notebook mais comuns do Brasil. Quem chegava de
      // anúncio preenchia o cadastro inteiro, clicava, e nada acontecia — sem
      // erro, sem aviso. Achado pelo `funil-completo.spec.ts`, que morreu ali
      // com "subtree intercepts pointer events".
      //
      // A correção anterior raciocinou sobre conteúdo CENTRALIZADO, e valia
      // para a landing. `/cadastro` e `/login` são tela dividida com o
      // formulário à ESQUERDA — o card caiu em cima dele. No dashboard é pior:
      // o canto inferior esquerdo é o menu do usuário na barra lateral.
      //
      // À direita não há nada clicável em nenhuma das três: na entrada é o
      // `PipelinePreviewCard`, que é `aria-hidden` e decorativo; na landing o
      // conteúdo é centralizado com largura máxima; no dashboard é área de
      // conteúdo. Cobrir enfeite não custa clique nenhum.
      //
      // No TELEFONE não existe canto: `max-w-md` (448px) é maior que a tela,
      // e o card ocupa a largura toda de qualquer jeito — por isso o
      // `left-auto` só entra a partir de `sm`. Ali o que resta é comprimir.
      // Decomposto em 390×844: 121px totais = 48 de padding + 32 de texto +
      // 28 de botão + gaps. O padding externo caiu para `p-2` e o gap interno
      // para `gap-2`; o texto encurtou. O piso é o alvo de toque de 44px dos
      // botões, que não se mexe.
      className="fixed right-0 bottom-0 left-0 z-50 w-full max-w-md p-2 sm:left-auto sm:p-4"
      ref={caixa}
    >
      <div className="bg-card border-border flex flex-col gap-2 rounded-xl border p-3 shadow-lg">
        {/* O texto encurtou pelo mesmo motivo da altura: três linhas de
            explicação no telefone empurram os botões para fora do polegar.
            Diz o que é feito, com o link para quem quiser o detalhe. */}
        <p className="text-muted-foreground flex-1 text-xs sm:text-sm">
          Cookies para medir de onde vêm as visitas.{' '}
          <Link
            href="/privacidade"
            className="text-foreground underline underline-offset-4 hover:no-underline"
          >
            Política de Privacidade
          </Link>
          .
        </p>

        {/* Ordem e tamanho iguais de propósito — ver o cabeçalho do arquivo. */}
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="min-h-11 flex-1 md:min-h-9"
            onClick={() => responder('recusado')}
          >
            Recusar
          </Button>
          <Button
            size="sm"
            className="min-h-11 flex-1 md:min-h-9"
            onClick={() => responder('aceito')}
          >
            Aceitar
          </Button>
        </div>
      </div>
    </div>
  )
}
