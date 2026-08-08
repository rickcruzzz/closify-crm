import Link from 'next/link'
import { ChevronDown } from 'lucide-react'

import { RevealOnScroll } from '@/components/landing/reveal-on-scroll'
import { FREE_LEAD_LIMIT, FREE_MEMBER_LIMIT, PRO_PLAN_PRICE } from '@/lib/plans'

// Respostas honestas sobre o produto COMO ELE É HOJE. Nada aqui promete
// funcionalidade que não existe — a pergunta sobre importar planilha responde
// "cadastro manual", porque importador de CSV ainda não foi construído.
const faqs = [
  {
    q: 'O plano grátis é grátis mesmo?',
    a: `É. Sem cartão de crédito, sem prazo para expirar. O plano Free cobre até ${FREE_MEMBER_LIMIT} colaboradores e ${FREE_LEAD_LIMIT} leads. Se a sua equipe passar disso, aí sim faz sentido o Pro.`,
  },
  {
    q: 'Preciso instalar alguma coisa?',
    a: 'Não. O Closify roda inteiro no navegador, no computador ou no celular. Você cria a conta e já começa a usar.',
  },
  {
    q: 'Consigo trazer os leads da minha planilha?',
    a: 'Hoje o cadastro é manual, um lead por vez. A importação de planilha ainda não existe. Para quem está começando com algumas dezenas de contatos, dá para montar o funil em poucos minutos.',
  },
  {
    q: 'Meus dados ficam separados dos de outras empresas?',
    a: 'Ficam. O isolamento é feito no próprio banco de dados, com Row Level Security por workspace: uma consulta de uma empresa não alcança a linha de outra, nem por engano nem de propósito.',
  },
  {
    q: 'Quais são as formas de pagamento?',
    a: `Pix, boleto e cartão de crédito, com cobrança recorrente processada pelo Asaas. O plano Pro custa R$ ${PRO_PLAN_PRICE} por mês, por workspace.`,
  },
  {
    q: 'Posso cancelar quando quiser?',
    a: 'Pode, sem multa e sem falar com ninguém. Ao cancelar, o workspace volta para o plano Free e seus dados continuam lá.',
  },
]

export function FaqSection() {
  return (
    <section id="faq" className="px-4 py-20 md:px-6 md:py-28">
      <div className="mx-auto max-w-3xl">
        <RevealOnScroll className="mx-auto mb-12 flex max-w-2xl flex-col items-center gap-3 text-center">
          <span className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
            Dúvidas frequentes
          </span>
          <h2 className="text-3xl font-semibold tracking-[-0.02em] md:text-4xl">
            Perguntas frequentes
          </h2>
          <p className="text-muted-foreground text-lg text-balance">
            O que as pessoas costumam querer saber antes de criar a conta.
          </p>
        </RevealOnScroll>

        {/* `<details>` nativo em vez de accordion de biblioteca: zero
            JavaScript, zero custo de hidratação, e o navegador já entrega
            teclado, leitor de tela e busca com Ctrl+F dentro do conteúdo
            fechado. Numa página cujo problema era lentidão, é a escolha certa.
            A seta anima só `transform` — animar altura causaria reflow por
            frame. */}
        <RevealOnScroll delay={90}>
          <div className="bg-border ring-border grid gap-px overflow-hidden rounded-xl ring-1">
            {faqs.map((faq) => (
              <details key={faq.q} name="faq" className="bg-card group">
                <summary className="focus-visible:ring-ring pointer:hover:bg-accent/40 flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
                  {faq.q}
                  <ChevronDown
                    aria-hidden
                    className="text-muted-foreground size-4 shrink-0 transition-transform duration-200 group-open:rotate-180"
                  />
                </summary>
                <p className="text-muted-foreground px-5 pb-4 text-sm leading-relaxed">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </RevealOnScroll>

        <p className="text-muted-foreground mt-8 text-center text-sm">
          Ficou outra dúvida?{' '}
          <Link
            href="/cadastro"
            className="text-foreground -my-2 inline-block py-2 underline underline-offset-4"
          >
            Crie uma conta grátis
          </Link>{' '}
          e teste sem compromisso.
        </p>
      </div>
    </section>
  )
}
