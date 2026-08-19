import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PipelinePreviewCard } from '@/components/landing/pipeline-preview-card'
import { SegmentBadge } from '@/components/landing/segment-badge'
import { ScrollLink } from '@/components/landing/scroll-link'

export function HeroSection() {
  return (
    <section className="relative overflow-hidden px-4 pt-20 pb-24 md:px-6 md:pt-28 md:pb-32">
      <div
        aria-hidden
        className="glow-radial pointer-events-none absolute top-0 left-1/2 -z-10 h-96 w-[42rem] -translate-x-1/2"
      />
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-8">
        <div className="flex flex-col items-center gap-6 text-center lg:items-start lg:text-left">
          {/* Duração CONSTANTE mais atraso crescente, e não duração crescente.
              O hero usava 650/750/800/850/900ms com todos os elementos
              começando em t=0: isso não escalona nada, só deixa os últimos
              mais lentos — a diferença entre "a tela entra em ordem" e "os
              elementos de baixo demoram mais para chegar", que é como estava.
              Os tokens `delay-passo-*` vivem no globals.css e são os mesmos
              das telas de autenticação, para as duas metades do site terem o
              mesmo ritmo em vez de coincidirem por acaso.

              Uma distância só (12px) para a sequência inteira: variar o
              percurso além do atraso faz os elementos parecerem brigar, em vez
              de uma tela entrando junto. */}
          <SegmentBadge className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both ease-entrada duration-entrada delay-passo-1 font-mono text-xs tracking-wide uppercase" />
          {/* Nome e categoria continuam DENTRO do h1, mas só para quem lê por
              texto: leitor de tela e o verificador de marca do Google, que
              compara o nome do app no consent screen com o heading principal
              da home e reprovava sem isso.

              Ficam invisíveis por decisão do dono, o Hero pedia menos ruído
              acima da headline. O que sustenta a verificação continua na tela:
              o parágrafo logo abaixo já diz "O Velo Funil mostra, numa tela
              só...", e title/og:site_name/meta description seguem intactos.

              Sem o `mb-3` que separava as duas linhas: o h1 voltou a ser uma
              linha visível, e o `gap-6` do flex pai governa o ritmo de novo.

              Tracking fica mais negativo quanto maior o texto, é o que separa
              um título "de template" de um desenhado. Ver também o h2 das
              demais seções, em -0.02em. */}
          <h1 className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both ease-entrada duration-entrada delay-passo-2 text-4xl font-semibold tracking-[-0.03em] text-balance md:text-6xl">
            <span className="sr-only">Velo Funil, CRM para pequenos negócios. </span>
            Pare de perder venda por esquecimento.
          </h1>
          <p className="text-muted-foreground animate-in fade-in slide-in-from-bottom-3 fill-mode-both ease-entrada duration-entrada delay-passo-3 max-w-2xl text-lg text-balance">
            Todo cliente que você esquece de responder é um cliente que você perde. O
            Velo Funil mostra, numa tela só, com quem você precisa falar hoje, sem
            post-it, sem aba de planilha escondida, sem depender da sua memória.
          </p>
          {/* `items-stretch` é o padrão do flex, e é por ser padrão que
              ninguém percebe quando some. É ele que dá aos dois botões a mesma
              largura no celular: o container encolhe até o filho mais largo, e
              os dois esticam nele.

              Basta alguém acrescentar `items-center` aqui um dia, para
              centralizar um ícone qualquer, e as larguras se separam sem que a
              mudança pareça ter relação. Escrito, é decisão; implícito, é
              acidente esperando. Acima de `sm` os botões vão lado a lado e o
              alinhamento passa a ser vertical. */}
          {/* `w-full sm:w-auto` no container é o que dá largura de verdade aos
              CTAs no celular. Sem ele o pai (`items-center`) encolhe esta
              linha até o botão mais largo, e os dois ficavam com 148px dentro
              de um container de 343px, medido: 43% da largura disponível, o
              que faz o CTA principal parecer secundário.

              `items-stretch` é o padrão do flex, e é por ser padrão que
              ninguém percebe quando some. É ele que dá aos dois botões a mesma
              largura no celular. Basta alguém acrescentar `items-center` aqui
              um dia, para centralizar um ícone qualquer, e as larguras se
              separam sem que a mudança pareça ter relação. Escrito, é decisão;
              implícito, é acidente esperando. Acima de `sm` os botões voltam a
              ter a largura do próprio conteúdo, lado a lado. */}
          <div className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both ease-entrada duration-entrada delay-passo-4 mt-2 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
            <Link
              id="hero-cta"
              href="/cadastro"
              className={cn(buttonVariants({ size: 'lg' }), 'gap-2')}
            >
              Começar grátis
              <ArrowRight className="size-4" />
            </Link>
            <ScrollLink
              href="#como-funciona"
              className={cn(
                buttonVariants({ variant: 'outline', size: 'lg' }),
                'active:translate-y-0',
              )}
            >
              Ver como funciona
            </ScrollLink>
          </div>
          <p className="text-muted-foreground animate-in fade-in slide-in-from-bottom-3 fill-mode-both ease-entrada duration-entrada delay-passo-4 text-sm text-balance">
            Comece grátis e gerencie contatos ilimitados. Por apenas R$ 49/mês, toda a
            sua equipe trabalha em um só lugar.
          </p>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both ease-entrada duration-entrada delay-passo-5">
          <PipelinePreviewCard />
        </div>
      </div>
    </section>
  )
}
