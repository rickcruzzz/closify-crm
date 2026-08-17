import Link from 'next/link'
import { ChevronDown } from 'lucide-react'

import { RevealOnScroll } from '@/components/landing/reveal-on-scroll'
import { FREE_LEAD_LIMIT, FREE_MEMBER_LIMIT, PRO_PLAN_PRICE } from '@/lib/plans'

// Respostas honestas sobre o produto COMO ELE É HOJE. Nada aqui promete
// funcionalidade que não existe. A resposta sobre planilha ficou desatualizada
// quando a importação por CSV foi construída, negar um recurso que existe é
// tão danoso quanto prometer um que não existe.
const faqs = [
  {
    q: 'O plano grátis é grátis mesmo?',
    a: `É. Sem cartão de crédito, sem prazo para expirar. O plano Free cobre 1 empresa, com até ${FREE_MEMBER_LIMIT} colaboradores e ${FREE_LEAD_LIMIT} contatos. Se a sua equipe crescer ou você precisar separar mais de uma empresa, aí sim faz sentido o Pro.`,
  },
  {
    q: 'Preciso instalar alguma coisa?',
    a: 'Não. O Velo Funil roda inteiro no navegador, no computador ou no celular. Você cria a conta e já começa a usar.',
  },
  {
    q: 'Consigo trazer os contatos da minha planilha?',
    a: 'Sim. Exporte sua planilha como .csv com as colunas Nome, Telefone, E-mail e Valor e importe direto na tela de Leads. Contatos repetidos são ignorados automaticamente, e você também pode cadastrar um por um, se preferir.',
  },
  {
    q: 'Meus dados ficam separados dos de outras empresas?',
    a: 'Ficam. Cada empresa só enxerga os próprios dados, é uma regra de segurança configurada no banco, não uma tela que a gente esquece de checar. Nem por engano, nem por querer, os dados de uma empresa aparecem para outra.',
  },
  {
    q: 'Quais são as formas de pagamento?',
    a: `Pix, boleto e cartão de crédito, com cobrança recorrente processada pelo Asaas. O plano Pro custa R$ ${PRO_PLAN_PRICE} por mês, por empresa.`,
  },
  {
    q: 'Posso cancelar quando quiser?',
    a: 'Pode, sem multa e sem falar com ninguém. Ao cancelar, a conta da sua empresa volta para o plano Free e seus dados continuam lá.',
  },
]

export function FaqSection() {
  return (
    <section id="faq" className="px-4 py-20 md:px-6 md:py-28">
      <div className="mx-auto max-w-3xl">
        <RevealOnScroll className="mx-auto mb-12 flex max-w-2xl flex-col items-center gap-3 text-center">
          <span className="text-muted-foreground inline-flex items-center gap-2 font-mono text-xs tracking-wide uppercase">
            <span aria-hidden className="bg-primary h-px w-4" />
            Dúvidas frequentes
            <span aria-hidden className="bg-primary h-px w-4" />
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
            A seta anima só `transform`, animar altura causaria reflow por
            frame. */}
        <div className="bg-border ring-border grid gap-px overflow-hidden rounded-xl ring-1">
          {faqs.map((faq, i) => (
            <RevealOnScroll key={faq.q} delay={i * 100}>
              <details name="faq" className="bg-card group">
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
            </RevealOnScroll>
          ))}
        </div>

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
