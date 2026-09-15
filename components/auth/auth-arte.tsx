import { LembretePreviewCard } from '@/components/auth/lembrete-preview-card'

/**
 * O painel que ocupa a metade direita de login e cadastro no desktop.
 *
 * **O que mostra é o produto, não um banco de imagens.** A régua do projeto
 * sobre prova social vale aqui inteira: sem foto de banco de imagem, sem
 * depoimento, sem número inventado. A `StatsSection` já teve métrica falsa
 * copiada de concorrente e removida, e o motivo está escrito no arquivo dela.
 *
 * ## Até 15/09 este painel repetia o hero da landing, e o dono viu
 *
 * Ele renderizava `PipelinePreviewCard`, o MESMO componente do hero de
 * `velofunil.com.br`, sem props e portanto sem como variar nem o texto. Quem
 * chegava pelo site clicava em "Começar grátis" e via a mesma figura duas
 * telas seguidas — o que faz a segunda parecer que não carregou nada novo.
 *
 * O comentário antigo aqui afirmava que repetir o componente era proposital,
 * "para a tela de login parecer a mesma marca". A intenção estava certa e o
 * meio estava errado: continuidade de marca vem do device, da tipografia e da
 * cor, que continuam idênticos logo abaixo. Repetir a ILUSTRAÇÃO inteira não é
 * continuidade, é a mesma imagem duas vezes.
 *
 * ## E em 15/09 o print tambem saiu, medido
 *
 * A primeira correcao trocou o funil por `ProdutoPrint nome="hoje"`, a captura
 * real da tela. A repeticao sumiu e **a legibilidade foi junto**: a coluna e
 * `minmax(32rem,1fr)` menos `p-10`, ou seja ~640px numa tela de 1440, e o print
 * mostra 1440px de interface. Da **0,44x**, e texto de 14px vira 6,2px.
 *
 * Este projeto ja registrou em 09/09 que print abaixo de **0,80x falha a
 * geracao**, depois de o criativo do Instagram sair a 0,60x e ser recusado.
 * Estava em metade do proprio minimo.
 *
 * **A causa e a mesma dos dois lados: captura de tela inteira nao sobrevive a
 * caixa estreita.** O card do funil era legivel justamente por ser HTML em
 * tamanho real. O erro nao foi trocar o funil; foi trocar HTML por bitmap.
 *
 * `LembretePreviewCard` desenha UM card grande em HTML, e resolve os dois de
 * uma vez: nao repete o hero e nao depende de escala nenhuma. O porque de cada
 * decisao de conteudo esta no arquivo dele.
 *
 * Sendo Server Component puro, sem props e sem estado, o painel volta a custar
 * **zero JavaScript**: so HTML atravessa. E o que torna barato mante-lo montado
 * e apenas escondido no mobile, em vez de decidir por `matchMedia` — decidir no
 * cliente produziria descasamento de hidratacao e transformaria o layout
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
 * `aria-hidden` no wrapper inteiro: um leitor de tela recitando seis etapas e
 * valores fictícios no meio de um login atrapalha quem só quer chegar ao campo
 * de e-mail. A ilustração é reforço visual, não conteúdo.
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
      <p className="text-muted-foreground animate-entrada fade-in fill-mode-both ease-entrada duration-entrada delay-passo-3 inline-flex items-center gap-2 font-mono text-xs tracking-wide uppercase">
        <span aria-hidden className="bg-primary h-px w-4" />
        Como fica na sua tela
        <span aria-hidden className="bg-primary h-px w-4" />
      </p>

      <div className="animate-entrada fade-in slide-in-from-bottom-3 fill-mode-both ease-entrada duration-entrada delay-passo-3">
        <LembretePreviewCard />
      </div>

      {/* TERCEIRA cópia da mesma promessa, achada só ao ler o DOM da tela de
          login durante a prova — as outras duas (`stats-section.tsx` e
          `how-it-works-section.tsx`) já tinham sido corrigidas e esta passou.
          Prometia "do cadastro ao primeiro contato", e o caminho real sai do
          site para abrir a caixa de entrada antes de qualquer tela do produto.
          Aqui dói mais que na landing: a pessoa está no formulário, e a frase
          descreve o que vai acontecer nos próximos segundos. */}
      <p className="text-muted-foreground animate-entrada fade-in fill-mode-both ease-entrada duration-entrada delay-passo-4 text-sm text-balance">
        Leva menos de dois minutos para criar a conta e entrar.
      </p>
    </aside>
  )
}
