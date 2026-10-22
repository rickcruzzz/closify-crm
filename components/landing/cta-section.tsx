import { ArrowRight } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { linkDoContatoComercial } from '@/lib/marketing/contato-comercial'
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
          {/* ## O fecho tem que falar com a MESMA pessoa do hero

              Esta linha já errou nos dois sentidos, e o registro das duas
              vezes é o que impede a terceira.

              Até 31/08 dizia "Pronto para largar a planilha?" enquanto o hero
              falava de WhatsApp: a pessoa lia sobre WhatsApp na tela 0,1, rolava
              doze telas e era convidada a resolver um problema que não tinha.
              Corrigido para WhatsApp, acompanhando o hero.

              Em 02/09 o hero voltou para a planilha, porque o WhatsApp saiu
              da tese — `FASE_DO_WHATSAPP = 'migrando'`, e o produto entrega
              só o link `wa.me`. Se este fecho ficasse falando de WhatsApp,
              seria o mesmo descasamento na direção inversa.

              **A regra que sobra: hero e fecho mudam JUNTOS.** Eles são a
              primeira e a última coisa que a pessoa lê, e quando discordam é
              sempre a última que decide, contra o que a trouxe até aqui.

              Em 22/10 os dois mudaram juntos de novo: Radar + CRM no hero,
              e aqui o mesmo convite para falar com a equipe. */}
          <h2 className="text-titulo-md md:text-titulo-lg">
            As próximas oportunidades da sua empresa já estão por aí.
          </h2>
          <p className="text-muted-foreground max-w-xl text-lg">
            Conte para a equipe quem você quer alcançar. A gente mostra como o Radar e o
            CRM trabalham juntos na sua operação.
          </p>
          <a
            id="final-cta"
            href={linkDoContatoComercial('equipe')}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ size: 'lg' }),
              'pointer:hover:scale-105 min-h-11 gap-2 transition-transform duration-300',
            )}
          >
            Falar com a equipe
            <ArrowRight className="size-4" />
          </a>
        </div>
      </RevealOnScroll>
    </section>
  )
}
