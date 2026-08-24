import {
  BarChart3,
  MessageCircle,
  KanbanSquare,
  ListChecks,
  Building2,
  Bell,
  FileSpreadsheet,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { ProdutoPrint } from '@/components/landing/produto-print'
import { Card, CardContent } from '@/components/ui/card'
import { RevealOnScroll } from '@/components/landing/reveal-on-scroll'

type Feature = {
  title: string
  description: string
  icon: LucideIcon
  accent: { text: string; bg: string; hover: string }
  /** Stagger em milissegundos, aplicado pelo RevealOnScroll. */
  delay: number
}

const features: Feature[] = [
  {
    title: 'Funil visual, arrasta e solta',
    description:
      'Veja cada cliente em potencial numa etapa da venda e arraste o card conforme a conversa avança, sem montar tabela, sem fórmula.',
    icon: KanbanSquare,
    accent: {
      text: 'text-blue-500 dark:text-blue-400',
      bg: 'bg-blue-500/10 dark:bg-blue-400/10',
      hover: 'pointer:hover:bg-blue-500/[0.04] dark:pointer:hover:bg-blue-400/[0.04]',
    },
    delay: 0,
  },
  {
    title: 'O histórico fica com a empresa',
    description:
      'Cada ligação, e-mail e conversa fica registrada no contato. Quando um vendedor sai, o relacionamento continua aqui — não no celular dele.',
    icon: ListChecks,
    accent: {
      text: 'text-violet-500 dark:text-violet-400',
      bg: 'bg-violet-500/10 dark:bg-violet-400/10',
      hover: 'pointer:hover:bg-violet-500/[0.04] dark:pointer:hover:bg-violet-400/[0.04]',
    },
    delay: 130,
  },
  {
    // A importação existia desde antes e não aparecia na landing, é a
    // resposta para "vou ter que digitar tudo de novo?", a objeção que mais
    // trava a troca da planilha.
    title: 'Importação de planilha',
    description:
      'Traga seus contatos de uma vez com um arquivo .csv, sem redigitar nada. Duplicados são ignorados sozinhos.',
    icon: FileSpreadsheet,
    accent: {
      text: 'text-cyan-500 dark:text-cyan-400',
      bg: 'bg-cyan-500/10 dark:bg-cyan-400/10',
      hover: 'pointer:hover:bg-cyan-500/[0.04] dark:pointer:hover:bg-cyan-400/[0.04]',
    },
    delay: 260,
  },
  {
    title: 'Quanto você tem para fechar este mês',
    description:
      'O valor que está em jogo, o que já virou venda e o que travou no caminho. Sem montar fórmula, sem esperar alguém consolidar planilha.',
    icon: BarChart3,
    accent: {
      text: 'text-emerald-500 dark:text-emerald-400',
      bg: 'bg-emerald-500/10 dark:bg-emerald-400/10',
      hover:
        'pointer:hover:bg-emerald-500/[0.04] dark:pointer:hover:bg-emerald-400/[0.04]',
    },
    delay: 0,
  },
  {
    title: 'Várias empresas, um login só',
    description:
      'Gerencie mais de uma empresa com a mesma conta e troque entre elas sem perder nada de vista.',
    icon: Building2,
    accent: {
      text: 'text-orange-500 dark:text-orange-400',
      bg: 'bg-orange-500/10 dark:bg-orange-400/10',
      hover: 'pointer:hover:bg-orange-500/[0.04] dark:pointer:hover:bg-orange-400/[0.04]',
    },
    delay: 130,
  },
  {
    title: 'A tela que diz o que fazer hoje',
    description:
      'Abriu o sistema, já sabe com quem falar: o que venceu, o que é de hoje e o que vem nos próximos dias, em ordem de urgência.',
    icon: Bell,
    accent: {
      text: 'text-amber-500 dark:text-amber-400',
      bg: 'bg-amber-500/10 dark:bg-amber-400/10',
      hover: 'pointer:hover:bg-amber-500/[0.04] dark:pointer:hover:bg-amber-400/[0.04]',
    },
    delay: 260,
  },
  {
    // O canal onde a PME brasileira realmente vende não aparecia em lugar
    // nenhum desta página. É a feature mais reconhecível do produto para
    // quem chega de anúncio, e estava invisível.
    title: 'Fala com o cliente pelo WhatsApp',
    description:
      'Abra a conversa direto do contato, sem procurar o número na agenda. Conectando o WhatsApp da empresa, a mensagem que chega vira contato e tarefa sozinha.',
    icon: MessageCircle,
    accent: {
      text: 'text-emerald-500 dark:text-emerald-400',
      bg: 'bg-emerald-500/10 dark:bg-emerald-400/10',
      hover: 'pointer:hover:bg-emerald-500/[0.04] dark:pointer:hover:bg-emerald-400/[0.04]',
    },
    delay: 0,
  },
  {
    title: 'Cada um vê o que precisa ver',
    description:
      'Dono acompanha a operação inteira; colaborador trabalha na parte dele. Sem planilha compartilhada onde qualquer um apaga a linha errada.',
    icon: ShieldCheck,
    accent: {
      text: 'text-red-500 dark:text-red-400',
      bg: 'bg-red-500/10 dark:bg-red-400/10',
      hover: 'pointer:hover:bg-red-500/[0.04] dark:pointer:hover:bg-red-400/[0.04]',
    },
    delay: 0,
  },
]

export function FeaturesSection() {
  return (
    <section id="funcionalidades" className="px-4 py-20 md:px-6 md:py-28">
      <div className="mx-auto max-w-5xl">
        <RevealOnScroll className="mx-auto mb-12 flex max-w-2xl flex-col items-center gap-3 text-center">
          <span className="text-muted-foreground inline-flex items-center gap-2 font-mono text-xs tracking-wide uppercase">
            <span aria-hidden className="bg-primary h-px w-4" />
            Funcionalidades
            <span aria-hidden className="bg-primary h-px w-4" />
          </span>
          <h2 className="text-titulo-md md:text-titulo-lg">
            O que você para de fazer na mão
          </h2>
          <p className="text-muted-foreground text-lg text-balance">
            Cada recurso aqui existe porque alguém estava resolvendo aquilo com
            planilha, post-it ou memória — e perdendo venda no caminho.
          </p>
        </RevealOnScroll>

        {/* `gap-px` sobre um fundo de borda: as divisórias viram linhas de 1px
            perfeitas, sem borda dupla entre células nem canto quebrado. É o
            truque que dá o acabamento de grade contínua. */}
        <div className="bg-border ring-border grid grid-cols-1 gap-px overflow-hidden rounded-xl ring-1 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => {
            // Célula vazia no fim do grid pinta a cor do fundo (o truque de
            // `bg-border`+`gap-px` logo acima) e vira um retângulo escuro sem
            // nada dentro. O último card estica para cobrir o que sobrar — e
            // quanto sobra depende de quantos cards existem, então a conta é
            // feita, não fixada.
            //
            // Com 8 cards: em 2 colunas fecha exato (nada a esticar); em 3
            // colunas sobra uma célula, e o último ocupa duas. Se a lista
            // mudar de tamanho de novo, isto continua certo sozinho.
            const ultimo = i === features.length - 1
            const sobramEm2 = features.length % 2
            const sobramEm3 = features.length % 3
            const spanUltimo = ultimo
              ? cn(
                  sobramEm2 === 1 && 'sm:col-span-2',
                  sobramEm3 === 1 && 'lg:col-span-3',
                  sobramEm3 === 2 && 'lg:col-span-2',
                )
              : undefined
            // O card só vira faixa horizontal quando de fato atravessa a
            // linha inteira; esticado por uma coluna, o layout de coluna
            // continua sendo o certo.
            const viraFaixa = ultimo && sobramEm2 === 1

            return (
              <RevealOnScroll
                key={feature.title}
                delay={feature.delay}
                className={spanUltimo}
              >
                <Card
                  className={cn(
                    'bg-card h-full rounded-none border-0 shadow-none ring-0',
                    'transition-colors duration-200',
                    feature.accent.hover,
                  )}
                >
                  <CardContent
                    className={cn(
                      'flex flex-col gap-3',
                      viraFaixa && 'sm:flex-row sm:items-center sm:justify-center sm:gap-4',
                    )}
                  >
                    {/* Sem o `01`–`07` que ficava ao lado do ícone.
                        Numeração é um device estrutural: comunica que a ORDEM
                        carrega informação. Em "Como funciona" isso é verdade
                        (traga a planilha → arraste → veja o dinheiro é uma
                        sequência real, e lá os números ficam). Aqui não: são
                        sete recursos independentes, e numerar sugere um passo
                        a passo que não existe — além de dividir a atenção com
                        o ícone, que é o que de fato identifica cada um. */}
                    <div
                      className={cn(
                        'flex size-10 shrink-0 items-center justify-center rounded-lg',
                        feature.accent.bg,
                      )}
                    >
                      <feature.icon className={cn('size-5', feature.accent.text)} />
                    </div>
                    <div className={cn(ultimo && 'sm:flex sm:max-w-md sm:flex-col sm:gap-1')}>
                      <h3 className="text-base font-semibold">{feature.title}</h3>
                      <p className="text-muted-foreground text-sm">{feature.description}</p>
                    </div>
                  </CardContent>
                </Card>
              </RevealOnScroll>
            )
          })}
        </div>

        {/* O "Painel de resultados" é a feature que mais depende de ver para
            entender: a lista consegue dizer que existem gráficos, não como
            eles se parecem nem que são simples de ler. Um print do painel real
            responde a pergunta que a grade acima deixa aberta.

            Fica DEPOIS da grade, e não no meio: interromper sete cards para
            enfiar uma imagem quebraria a leitura em varredura, que é como
            grade de features é lida. */}
        <RevealOnScroll delay={520} className="mt-12">
          <ProdutoPrint nome="dashboard" alt="painel de resultados · Acme Corp" />
        </RevealOnScroll>
      </div>
    </section>
  )
}
