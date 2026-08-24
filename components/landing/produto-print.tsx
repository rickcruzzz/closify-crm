import Image from 'next/image'

import { cn } from '@/lib/utils'

/**
 * Um print real do produto, na moldura de janela que a landing já usa.
 *
 * **Por que print e não mais um mock em HTML.** O mock do hero
 * (`PipelinePreviewCard`) fica onde está e segue útil: é leve, acompanha o
 * tema e nunca desatualiza — e ali o peso de uma imagem disputaria com o LCP.
 * Mas mock é uma *representação* do produto, e quem chega de anúncio quer ver
 * a tela de verdade. O print entra abaixo da dobra, onde o peso não custa a
 * métrica.
 *
 * O `KanbanPreview`, que desenhava o quadro à mão em "Como funciona", foi
 * removido junto com esta troca: manter dois caminhos para a mesma ilustração
 * significaria manter os dois em dia, e ele já carregava um defeito silencioso
 * (a borda colorida por etapa nunca pintou, porque `stageAccent[stage]` é um
 * objeto e o `clsx` transformava as chaves em nomes de classe).
 *
 * **Dois arquivos, trocados por CSS.** A landing tem alternador de tema, e um
 * print claro sobre fundo escuro (ou o contrário) destrói a ilusão de que
 * aquilo é a sua tela. `dark:hidden` / `hidden dark:block` resolve sem
 * JavaScript: decidir isso no cliente causaria descasamento de hidratação e
 * um piscar do tema errado no primeiro quadro.
 *
 * **`width`/`height` explícitos** com as dimensões reais do arquivo (2880x1800
 * = 1440x900 capturado em 2x). Sem eles o navegador não reserva o espaço, o
 * conteúdo abaixo salta quando a imagem carrega, e salto de layout é a falha
 * de severidade alta que o guia de UX do projeto lista primeiro.
 *
 * As imagens vivem em `public/produto/`, capturadas de um workspace de
 * demonstração descartável — nunca de conta de cliente. O roteiro de recaptura
 * está em `docs/estado-atual.md`, porque print desatualiza e essa é a única
 * desvantagem real desta escolha.
 */
/**
 * Vale para as duas imagens (clara e escura). Se os valores divergissem, o
 * print saltaria de enquadramento ao trocar de tema — defeito que só aparece
 * para quem usa o alternador, ou seja, quase ninguém em teste.
 *
 * `max-w-none` é obrigatório: a folha de base do Tailwind aplica
 * `max-width:100%` em `img`, e sem anular isso o `w-[300%]` não faria nada.
 */
const RECORTE_NO_MOBILE =
  'w-[300%] max-w-none -translate-x-[19%] -translate-y-[7%] sm:w-full sm:translate-x-0 sm:translate-y-0'

export function ProdutoPrint({
  nome,
  alt,
  prioridade = false,
  className,
}: {
  /** Base do arquivo em `public/produto/`, sem o sufixo de tema. */
  nome: 'kanban' | 'dashboard' | 'hoje'
  alt: string
  prioridade?: boolean
  className?: string
}) {
  // `alt` fica FORA deste objeto e é passado explicitamente em cada `<Image>`:
  // dentro do spread a regra `jsx-a11y/alt-text` não enxerga o atributo e
  // acusa falta de texto alternativo. O aviso estaria errado, mas silenciá-lo
  // com um disable treinaria o próximo a ignorar a regra de verdade.
  const comum = {
    width: 2880,
    height: 1800,
    priority: prioridade,
    // Abaixo da dobra em todos os usos atuais: não disputa banda com o LCP.
    loading: prioridade ? undefined : ('lazy' as const),
    /**
     * ## Por que 92 e não o padrão 75
     *
     * O padrão do Next serve bem foto: ruído fotográfico esconde artefato de
     * compressão. Print de interface é o caso oposto — texto pequeno sobre
     * fundo chapado é o pior caso possível para compressão com perda, e a 75 o
     * artefato aparece como sujeira em volta de cada letra.
     *
     * Medido em 24/08 na variante de 2048px: 75 dá 75 KB, 92 dá ~115 KB. São
     * 40 KB por imagem, abaixo da dobra e com `loading="lazy"`, para o print
     * parar de parecer JPEG de 2009.
     */
    quality: 92,
    /**
     * ## O `sizes` é o que decide a nitidez, e o anterior estava apertado
     *
     * Ele terminava em `1160px`, a largura exata da moldura. Consequência
     * medida: em monitor comum (DPR 1) o navegador baixava a variante de
     * 1200px para exibir 1160 — **1,03 pixel de arquivo por pixel de tela**.
     * Zoom de 110% já não tinha pixel sobrando e a imagem borrava, que foi
     * exatamente o relato.
     *
     * Pedindo 2048 o navegador guarda 1,77x de folga: zoom até ~175% continua
     * lendo pixel real. Acima disso borra de novo, e isso é limite do arquivo
     * (2880px nativo), não da configuração.
     *
     * **No telefone o número é grande porque a imagem é MAIOR que a tela.** O
     * recorte abaixo renderiza o print a 300% da largura do container; pedir
     * `100vw` ali entregaria a variante de 640px para desenhar ~1100px de
     * imagem, e o recorte ficaria pior do que o problema que ele resolve.
     */
    sizes: '(max-width: 639px) 300vw, (max-width: 1200px) 180vw, 2048px',
    className: 'h-auto w-full',
  }

  return (
    <div
      className={cn(
        // Mesma moldura de "janela do app" dos mocks: o print entra como parte
        // da linguagem visual da página, não como captura colada por cima.
        'border-border/50 bg-card overflow-hidden rounded-2xl border shadow-2xl',
        className,
      )}
    >
      <div className="border-border/50 flex items-center gap-2 border-b px-4 py-3">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-red-500/70" />
          <span className="size-2.5 rounded-full bg-amber-500/70" />
          <span className="size-2.5 rounded-full bg-emerald-500/70" />
        </div>
        <span className="text-muted-foreground font-mono text-xs">{alt}</span>
      </div>

      {/* ## O recorte que existe só no telefone
   
          Medido em 390px: a moldura dá 307px de largura para uma tela
          desenhada em 1440. São **21% do tamanho original** — o texto de 14px
          da interface chega a 3 pixels. Não é um print pequeno, é uma mancha
          cinza: ninguém lê "Proposta Enviada", ninguém vê um valor, e o espaço
          é gasto provando que o produto existe sem mostrar o que ele faz.

          A saída não é técnica de imagem, é de enquadramento. Abaixo de `sm` o
          print é renderizado a 300% da largura do container e deslocado nos
          dois eixos; o `overflow-hidden` da moldura corta o resto. A escala sobe
          de 0,21 para ~0,7 — o texto volta a ser texto —, e o pedaço que
          aparece é o que interessa: o fim da barra lateral e as primeiras
          colunas, não o vazio da direita.

          Os dois valores foram calibrados contra o print real no telefone, e
          cada um corrige um defeito da versão anterior:

          - **19% na horizontal.** Com 17% passava uma lasca da barra lateral, e
            o marcador do item ativo entrava como um risco verde cortado na
            borda. Com 20% o título saía partido ("unil"). A janela entre os
            dois erros é estreita porque a distância entre o fim da barra e o
            começo do título é só o respiro do layout.
          - **7% na vertical.** Sem ele, a faixa do topo do app entrava no
            recorte, e o conteúdo dela (alternador de tema e avatar) mora no
            canto direito, fora do enquadramento. Sobrava uma tira vazia entre a
            moldura e o título, que lê como imagem quebrada.

          `max-h` no mobile porque largura de 300% também triplica a altura: sem
          teto, um print ocuparia três telas de rolagem.

          A partir de `sm` tudo isso é desfeito e a tela inteira volta, que é o
          certo quando há largura para ela caber legível. */}
      <div className="max-h-[22rem] overflow-hidden sm:max-h-none">
        <Image
          src={`/produto/${nome}-light.png`}
          alt={alt}
          {...comum}
          className={cn(comum.className, 'dark:hidden', RECORTE_NO_MOBILE)}
        />
        <Image
          src={`/produto/${nome}-dark.png`}
          alt={alt}
          {...comum}
          className={cn(comum.className, 'hidden dark:block', RECORTE_NO_MOBILE)}
        />
      </div>
    </div>
  )
}
