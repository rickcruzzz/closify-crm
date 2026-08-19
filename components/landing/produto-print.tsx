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
    // A moldura tem no máximo ~1160px (o teto do container da landing), então
    // pedir a imagem inteira em telas pequenas seria desperdício de banda.
    sizes: '(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1160px',
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

      <Image
        src={`/produto/${nome}-light.png`}
        alt={alt}
        {...comum}
        className={cn(comum.className, 'dark:hidden')}
      />
      <Image
        src={`/produto/${nome}-dark.png`}
        alt={alt}
        {...comum}
        className={cn(comum.className, 'hidden dark:block')}
      />
    </div>
  )
}
