import { ArrowRight } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { linkDoContatoComercial } from '@/lib/marketing/contato-comercial'
import { cn } from '@/lib/utils'
import { PipelinePreviewCard } from '@/components/landing/pipeline-preview-card'
import { ScrollLink } from '@/components/landing/scroll-link'

/**
 * A primeira tela, desde o reposicionamento de 22/10.
 *
 * ## O que mudou, e por quê
 *
 * Até 21/10 o hero vendia "o CRM que lembra de dar o retorno do orçamento"
 * para pequenos prestadores de serviço, com cadastro grátis como CTA. A
 * comunicação passou a ser **CRM B2B + Radar de Prospecção**, e o Radar vem
 * para a primeira dobra: quem precisa rolar a página para descobrir que existe
 * um robô de prospecção não chega a descobrir.
 *
 * O CTA deixou de ser o cadastro e passou a ser a conversa com a equipe — a
 * contratação agora começa por ela (ver `lib/marketing/contato-comercial.ts`).
 *
 * ## O que a página NÃO promete
 *
 * Nada de "automático", "ilimitado" ou quantidade de leads. Hoje o Radar é um
 * projeto configurado com cada empresa (`lib/enterprise/`), e a frase embaixo
 * dos botões diz exatamente isso. É a mesma régua dos "contatos ilimitados"
 * removidos em 23/08: promessa que o produto não cumpre custa mais caro numa
 * página que recebe tráfego pago.
 */
export function HeroSection() {
  return (
    <section className="relative overflow-hidden px-4 pt-20 pb-24 md:px-6 md:pt-28 md:pb-32">
      <div
        aria-hidden
        className="glow-radial pointer-events-none absolute top-0 left-1/2 -z-10 h-96 w-[42rem] -translate-x-1/2"
      />
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-8">
        <div className="flex flex-col items-center gap-6 text-center lg:items-start lg:text-left">
          {/* Texto em mono e na cor da marca, sem pílula — mesmo tratamento que
              o `SegmentBadge` tinha aqui. A hierarquia vem do tamanho: 12px
              contra o h1, que continua sendo a tese. */}
          <span className="animate-entrada fade-in slide-in-from-bottom-3 fill-mode-both ease-entrada duration-entrada delay-passo-1 text-primary font-mono text-xs tracking-wide uppercase">
            CRM B2B + Radar de Prospecção
          </span>
          {/* Sem `fade-in`: este h1 é o candidato a LCP, e elemento em
              `opacity: 0` não conta como pintado (medido em 02/09, ~670ms
              perdidos). O deslocamento fica, a opacidade não.

              O nome e a categoria continuam dentro do h1 só para leitor de tela
              e para o verificador de marca do Google, que compara o nome do app
              com o heading principal da home. */}
          <h1 className="animate-entrada slide-in-from-bottom-3 fill-mode-both ease-entrada duration-entrada delay-passo-2 text-titulo-md text-balance sm:text-titulo-lg md:text-titulo-xl">
            <span className="sr-only">Velo Funil, CRM B2B com Radar de Prospecção. </span>
            Encontre novas oportunidades. Organize sua prospecção. Avance até a venda.
          </h1>
          <p className="text-muted-foreground animate-entrada fade-in slide-in-from-bottom-3 fill-mode-both ease-entrada duration-entrada delay-passo-3 max-w-xl text-lg text-balance">
            O Velo Funil combina um CRM comercial com um Radar que busca oportunidades de
            acordo com os critérios da sua empresa. Encontre novos leads, centralize as
            informações e acompanhe cada oportunidade em um único lugar.
          </p>
          {/* `w-full sm:w-auto` e `items-stretch` explícito: no celular os dois
              botões ficam com a largura do container (medido em 343px), e não
              encolhidos até o mais largo. Acima de `sm` voltam lado a lado. */}
          <div className="animate-entrada fade-in slide-in-from-bottom-3 fill-mode-both ease-entrada duration-entrada delay-passo-4 mt-2 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
            <a
              id="hero-cta"
              href={linkDoContatoComercial('demonstracao')}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ size: 'lg' }), 'gap-2')}
            >
              Solicitar demonstração
              <ArrowRight className="size-4" />
            </a>
            {/* `ghost`: o segundo caminho é para quem quer entender o Radar
                antes de falar com alguém. Dois botões com contorno na mesma
                dobra dividiriam a atenção em vez de ordená-la. */}
            <ScrollLink
              href="#radar"
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'lg' }),
                'active:translate-y-0',
              )}
            >
              Ver como o Radar funciona
            </ScrollLink>
          </div>
          <p className="text-muted-foreground animate-entrada fade-in slide-in-from-bottom-3 fill-mode-both ease-entrada duration-entrada delay-passo-4 text-sm text-balance">
            Prospecção configurada para o perfil de negócio que{' '}
            <span className="text-primary font-medium">sua empresa deseja alcançar</span>.
          </p>
        </div>

        <div className="animate-entrada fade-in slide-in-from-bottom-3 fill-mode-both ease-entrada duration-entrada delay-passo-5">
          <PipelinePreviewCard />
        </div>
      </div>
    </section>
  )
}
