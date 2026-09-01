import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { RevealOnScroll } from '@/components/landing/reveal-on-scroll'

export function CtaSection() {
  return (
    <section className="px-4 py-20 md:px-6 md:py-28">
      <RevealOnScroll>
        <div className="bg-card ring-foreground/10 superficie-elevada relative mx-auto flex max-w-4xl flex-col items-center gap-6 overflow-hidden rounded-2xl p-10 text-center ring-1 md:p-16">
          <div
            aria-hidden
            className="glow-radial pointer-events-none absolute -top-24 left-1/2 -z-10 h-64 w-[32rem] -translate-x-1/2"
          />
          {/* ## O fecho vendia o inimigo que a página abandonou

              Até 31/08 esta headline era "Pronto para largar a planilha?" — o
              inimigo que a repositionagem de 24/08 trocou, com base no Sebrae:
              82% da PME brasileira vende pelo WhatsApp, e **quem vende por lá
              não tem planilha para largar**.

              O hero mudou naquele dia; o fecho não acompanhou. Medido no
              navegador: a pessoa lê sobre WhatsApp na tela 0,1, rola doze
              telas e é convidada a resolver um problema que não tem. A última
              coisa que ela vê antes de decidir falava com outra pessoa.

              A planilha **não some da página** — importar `.csv` é recurso
              real e quem tem planilha precisa saber que dá. Ela muda de papel:
              deixa de ser o inimigo e vira um dos caminhos para trazer o que
              já é seu. */}
          <h2 className="text-titulo-md md:text-titulo-lg">
            Seus clientes já estão no WhatsApp. Faltam num lugar só.
          </h2>
          <p className="text-muted-foreground max-w-xl text-lg">
            Crie a conta da sua empresa, de graça, em menos de um minuto, e veja com
            quem você precisa falar hoje.
          </p>
          <Link
            id="final-cta"
            href="/cadastro"
            className={cn(
              buttonVariants({ size: 'lg' }),
              'pointer:hover:scale-105 min-h-11 gap-2 transition-transform duration-300',
            )}
          >
            Começar grátis
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </RevealOnScroll>
    </section>
  )
}
