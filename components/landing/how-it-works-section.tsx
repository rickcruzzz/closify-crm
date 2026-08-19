import { ArrowRight, FileSpreadsheet, LayoutGrid, TrendingUp } from 'lucide-react'

import { RevealOnScroll } from '@/components/landing/reveal-on-scroll'
import { ProdutoPrint } from '@/components/landing/produto-print'
import { FREE_LEAD_LIMIT } from '@/lib/plans'

/**
 * Como o produto funciona, em três passos.
 *
 * A landing tinha hero, funcionalidades e preço, mas nenhuma seção explicando
 * o que a pessoa faz depois de criar a conta. "Pipeline visual Kanban" só
 * significa algo para quem já usou CRM; quem controla vendas em planilha
 * precisa ver o caminho: trago meus contatos, arrasto, acompanho.
 *
 * O passo 1 é a importação de CSV. Ela existia desde antes e não aparecia em
 * lugar nenhum da landing, era a resposta para "vou ter que digitar tudo de
 * novo?", a objeção que mais trava a troca da planilha.
 */
const passos = [
  {
    numero: '01',
    titulo: 'Traga sua planilha',
    descricao: `Exporte a planilha como .csv e importe de uma vez. Contatos repetidos são ignorados sozinhos. Se preferir, cadastre um a um. No plano grátis cabem ${FREE_LEAD_LIMIT} contatos.`,
    icone: FileSpreadsheet,
    accent: 'text-blue-500 dark:text-blue-400',
    fundo: 'bg-blue-500/10 dark:bg-blue-400/10',
  },
  {
    numero: '02',
    titulo: 'Arraste pelas etapas',
    descricao:
      'Cada negócio vira um card. Arraste de "Novo Lead" até "Fechado Ganho" conforme a conversa avança, e registre ligações, reuniões e notas no histórico do cliente.',
    icone: LayoutGrid,
    accent: 'text-violet-500 dark:text-violet-400',
    fundo: 'bg-violet-500/10 dark:bg-violet-400/10',
  },
  {
    numero: '03',
    titulo: 'Veja onde está o dinheiro',
    descricao:
      'O painel mostra quanto você tem em negociação, quantos clientes viraram venda e quais negócios estão perto do prazo, sem montar fórmula nenhuma.',
    icone: TrendingUp,
    accent: 'text-emerald-500 dark:text-emerald-400',
    fundo: 'bg-emerald-500/10 dark:bg-emerald-400/10',
  },
]

export function HowItWorksSection() {
  return (
    <section id="como-funciona" className="px-4 py-20 md:px-6 md:py-28">
      <div className="mx-auto max-w-5xl">
        <RevealOnScroll className="mx-auto mb-12 flex max-w-2xl flex-col items-center gap-3 text-center">
          <span className="text-muted-foreground inline-flex items-center gap-2 font-mono text-xs tracking-wide uppercase">
            <span aria-hidden className="bg-primary h-px w-4" />
            Como funciona
            <span aria-hidden className="bg-primary h-px w-4" />
          </span>
          <h2 className="text-3xl font-semibold tracking-[-0.02em] md:text-4xl">
            Da planilha ao funil em três passos
          </h2>
          <p className="text-muted-foreground text-lg text-balance">
            Sem migração complicada e sem treinamento. Você entende o sistema na primeira
            tela.
          </p>
        </RevealOnScroll>

        <ol className="grid gap-4 md:grid-cols-3">
          {passos.map((passo, i) => (
            <RevealOnScroll key={passo.numero} delay={i * 130}>
              <li className="ring-border bg-card flex h-full flex-col gap-3 rounded-xl p-6 ring-1">
                <div className="flex items-center gap-3">
                  <span
                    className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${passo.fundo}`}
                  >
                    <passo.icone aria-hidden className={`size-5 ${passo.accent}`} />
                  </span>
                  <span className="text-muted-foreground font-mono text-xs tracking-wide">
                    {passo.numero}
                  </span>
                </div>
                <h3 className="font-semibold">{passo.titulo}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {passo.descricao}
                </p>
              </li>
            </RevealOnScroll>
          ))}
        </ol>

        {/* A tela de verdade, logo abaixo dos passos. A landing vendia
            "pipeline visual Kanban" sem nunca mostrar um, quem nunca usou CRM
            não tem como imaginar o formato a partir do texto.

            Passou a ser um PRINT do produto, no lugar do mock em HTML que
            estava aqui: os três passos acima acabaram de prometer "cada
            negócio vira um card, arraste até Fechado Ganho", e uma
            representação desenhada à mão não fecha essa promessa do mesmo
            jeito que a tela real. O mock continua no hero, onde o peso de uma
            imagem disputaria com o LCP. */}
        <RevealOnScroll delay={400} className="mt-10">
          <ProdutoPrint nome="kanban" alt="funil de vendas · Acme Corp" />
        </RevealOnScroll>

        <RevealOnScroll delay={490}>
          <p className="text-muted-foreground mt-6 flex items-center justify-center gap-1.5 text-center text-sm">
            Leva menos de dois minutos do cadastro ao primeiro contato
            <ArrowRight aria-hidden className="size-4" />
          </p>
        </RevealOnScroll>
      </div>
    </section>
  )
}
