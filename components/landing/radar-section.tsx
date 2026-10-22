import { ArrowRight, Check, FileSearch, KanbanSquare, Radar, Target } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { RevealOnScroll } from '@/components/landing/reveal-on-scroll'
import { linkDoContatoComercial } from '@/lib/marketing/contato-comercial'
import { cn } from '@/lib/utils'

/**
 * O Radar de Prospecção, explicado com o caminho de uma oportunidade.
 *
 * ## Cada passo é o que o código faz hoje
 *
 *     perfil       definido com a equipe na implantação — não há tela de
 *                  autosserviço, e por isso o texto diz "com a nossa equipe"
 *     pesquisa     fontes públicas, registradas em cada oportunidade
 *                  (`enterprise_eventos.fonte_url` e a lista de fontes)
 *     prioridade   `avaliarEvento` em `lib/enterprise/eventos.ts`: soma de
 *                  sinais com o motivo escrito, nunca probabilidade de fechar
 *     funil        `aprovarMensagemDoEvento` cria o contato no CRM depois que
 *                  a equipe revisa a abordagem
 *
 * ## Sem nicho, de propósito
 *
 * O Radar nasceu para eventos e mídia outdoor, mas a página fala de forma
 * geral (decisão do dono em 22/10). O cartão de exemplo à direita mostra os
 * CAMPOS de uma oportunidade, não uma empresa inventada: um exemplo de nicho
 * estreitaria o público, e um exemplo fictício seria prova que não existe.
 */
const passos = [
  {
    titulo: 'Você define o perfil',
    descricao:
      'Segmento, região e os sinais que importam para a sua venda. Os critérios são desenhados com a nossa equipe.',
    icone: Target,
  },
  {
    titulo: 'O Radar pesquisa',
    descricao:
      'Fontes públicas são consultadas conforme esses critérios, e o que não se encaixa fica de fora.',
    icone: Radar,
  },
  {
    titulo: 'Cada oportunidade vem explicada',
    descricao:
      'Fonte, contato quando disponível e o motivo da prioridade, em sinais que dá para conferir.',
    icone: FileSearch,
  },
  {
    titulo: 'Ela entra no seu funil',
    descricao:
      'A IA prepara a abordagem, sua equipe revisa e aprova, e a oportunidade vira contato no CRM.',
    icone: KanbanSquare,
  },
]

const motivos = [
  'Está na região que você definiu',
  'Tem canal de contato público',
  'Combina com os critérios do segmento',
]

export function RadarSection() {
  return (
    <section id="radar" className="relative overflow-x-clip px-4 py-20 md:px-6 md:py-28">
      <div
        aria-hidden
        className="glow-radial pointer-events-none absolute top-1/4 left-1/2 -z-10 h-72 w-[36rem] -translate-x-1/2"
      />
      <div className="mx-auto max-w-6xl">
        <RevealOnScroll className="mx-auto mb-12 flex max-w-2xl flex-col items-center gap-3 text-center">
          <span className="text-muted-foreground inline-flex items-center gap-2 font-mono text-xs tracking-wide uppercase">
            <span aria-hidden className="bg-primary h-px w-4" />
            Radar de Prospecção
            <span aria-hidden className="bg-primary h-px w-4" />
          </span>
          <h2 className="text-titulo-md md:text-titulo-lg">
            Você define quem quer alcançar. O Radar traz as oportunidades.
          </h2>
          <p className="text-muted-foreground text-lg text-balance">
            Sem lista comprada e sem número inventado: cada oportunidade chega com a fonte
            de onde veio e o motivo de combinar com o seu perfil.
          </p>
        </RevealOnScroll>

        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12">
          <ol className="flex flex-col gap-4">
            {passos.map((passo, i) => (
              <RevealOnScroll
                key={passo.titulo}
                delay={i * 130}
                as="li"
                className="ring-border bg-card superficie-elevada flex gap-4 rounded-xl p-5 ring-1"
              >
                <span className="bg-primary/10 flex size-10 shrink-0 items-center justify-center rounded-lg">
                  <passo.icone aria-hidden className="text-primary size-5" />
                </span>
                <div className="flex flex-col gap-1">
                  <h3 className="font-semibold">
                    <span className="text-muted-foreground mr-2 font-mono text-xs tracking-wide">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    {passo.titulo}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {passo.descricao}
                  </p>
                </div>
              </RevealOnScroll>
            ))}
          </ol>

          {/* Mesma moldura do `PipelinePreviewCard` do hero (barra de janela,
              `superficie-elevada`), para o Radar e o funil lerem como telas do
              mesmo produto. As barras cinzas são o lugar do dado, não dado
              inventado — ver o cabeçalho deste arquivo. */}
          <RevealOnScroll delay={200}>
            <div
              aria-hidden
              className="border-border bg-card superficie-elevada overflow-hidden rounded-2xl border"
            >
              <div className="border-border flex items-center gap-2 border-b px-4 py-3">
                <div className="flex gap-1.5">
                  <span className="size-2.5 rounded-full bg-red-500/70" />
                  <span className="size-2.5 rounded-full bg-amber-500/70" />
                  <span className="size-2.5 rounded-full bg-emerald-500/70" />
                </div>
                <span className="text-muted-foreground font-mono text-xs">
                  radar de prospecção · Acme Corp
                </span>
              </div>

              <div className="flex flex-col gap-5 p-5 md:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-1 flex-col gap-2">
                    <span className="text-muted-foreground font-mono text-xs uppercase">
                      oportunidade encontrada
                    </span>
                    <span className="bg-muted h-3 w-3/4 rounded-full" />
                    <span className="bg-muted h-3 w-1/2 rounded-full" />
                  </div>
                  {/* Nota de 0 a 100, como o painel do produto mostra
                      (`painel-de-eventos.tsx`). "Prioridade alta" seria um
                      rótulo que a tela real não tem. */}
                  <span className="bg-primary/10 text-primary ring-primary/20 flex shrink-0 flex-col items-center rounded-md px-3 py-1.5 ring-1">
                    <strong className="text-lg leading-none">80</strong>
                    <span className="text-[11px]">prioridade / 100</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {['fonte pública', 'contato'].map((rotulo) => (
                    <div key={rotulo} className="flex flex-col gap-2">
                      <span className="text-muted-foreground font-mono text-xs uppercase">
                        {rotulo}
                      </span>
                      <span className="bg-muted h-2.5 w-full rounded-full" />
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-2.5">
                  <span className="text-muted-foreground font-mono text-xs uppercase">
                    por que combina com o seu perfil
                  </span>
                  {motivos.map((motivo) => (
                    <span key={motivo} className="flex items-center gap-2.5 text-sm">
                      <Check className="text-primary size-4 shrink-0" />
                      {motivo}
                    </span>
                  ))}
                </div>
              </div>

              <div className="border-border flex items-center justify-between border-t px-5 py-4 md:px-6">
                <span className="text-muted-foreground font-mono text-xs">enviada para o funil</span>
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  A contatar
                  <ArrowRight className="text-primary size-4" />
                </span>
              </div>
            </div>
          </RevealOnScroll>
        </div>

        {/* A ressalva fica NA seção, e não só na FAQ: é aqui que a pessoa
            imagina quantos leads vai receber. Prometer volume antes de olhar
            as fontes do segmento dela seria o "contatos ilimitados" de novo. */}
        <RevealOnScroll
          delay={300}
          className="mt-12 flex flex-col items-center gap-4 text-center"
        >
          <p className="text-muted-foreground max-w-2xl text-sm text-balance">
            O que o Radar consulta, com que frequência e em que volume é definido no projeto
            de cada empresa. Não prometemos quantidade fixa de leads antes de conhecer o seu
            mercado.
          </p>
          <a
            href={linkDoContatoComercial('radar')}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'min-h-11 gap-2')}
          >
            Falar sobre o Radar
            <ArrowRight className="size-4" />
          </a>
        </RevealOnScroll>
      </div>
    </section>
  )
}
