import { PipelinePreviewCard } from '@/components/landing/pipeline-preview-card'

/**
 * O painel que ocupa a metade direita de login e cadastro no desktop.
 *
 * **O que mostra é o produto, não um banco de imagens.** `PipelinePreviewCard`
 * é o mesmo componente do hero da landing: desenhado em HTML sobre os dados de
 * `lib/deals/mock-data.ts`, sem foto, sem depoimento, sem número inventado. A
 * régua do projeto sobre prova social vale aqui inteira — a `StatsSection` já
 * teve métrica falsa copiada de concorrente e removida, e o motivo está
 * escrito no arquivo dela.
 *
 * Sendo Server Component puro, sem props e sem estado, o painel custa **zero
 * JavaScript**: só HTML atravessa. É o que torna barato mantê-lo montado e
 * apenas escondido no mobile, em vez de decidir por `matchMedia` — decidir no
 * cliente produziria descasamento de hidratação e transformaria o layout
 * inteiro em client component.
 *
 * O texto é reaproveitado da landing sem reescrita: a linha do "como funciona"
 * fala exatamente do momento em que a pessoa está (acabou de chegar na tela de
 * criar conta), e prometer coisa nova aqui seria copy nova sem revisão.
 *
 * `glow-radial`, e não `blur-3xl`: a decisão está documentada no `globals.css`
 * — o blur de 64px numa área grande era o item mais caro de GPU da página e
 * re-rasterizava a cada troca de tema. Gradiente radial compõe direto.
 *
 * `aria-hidden` no wrapper inteiro, mesmo critério do `kanban-preview`: um
 * leitor de tela recitando seis etapas e valores fictícios no meio de um login
 * atrapalha quem só quer chegar ao campo de e-mail.
 */
export function AuthArte() {
  return (
    <aside
      aria-hidden
      className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-center lg:gap-6 lg:p-10 xl:p-16"
    >
      <div className="glow-radial pointer-events-none absolute top-1/4 left-1/2 -z-10 h-96 w-[42rem] -translate-x-1/2" />

      {/* Mesmo eyebrow da landing: filete, mono, caixa alta. Repetir o device
          é o que faz a tela de login parecer a mesma marca da página que
          trouxe a pessoa até aqui. */}
      <p className="text-muted-foreground animate-in fade-in fill-mode-both ease-entrada duration-entrada delay-passo-3 inline-flex items-center gap-2 font-mono text-xs tracking-wide uppercase">
        <span aria-hidden className="bg-primary h-px w-4" />
        Como fica na sua tela
        <span aria-hidden className="bg-primary h-px w-4" />
      </p>

      <div className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both ease-entrada duration-entrada delay-passo-3">
        <PipelinePreviewCard />
      </div>

      <p className="text-muted-foreground animate-in fade-in fill-mode-both ease-entrada duration-entrada delay-passo-4 text-sm text-balance">
        Leva menos de dois minutos do cadastro ao primeiro contato.
      </p>
    </aside>
  )
}
