import Link from 'next/link'
import { ChevronDown } from 'lucide-react'

import { RevealOnScroll } from '@/components/landing/reveal-on-scroll'
import { DIAS_DE_TRIAL } from '@/lib/plans/trial'
import { FREE_LEAD_LIMIT, FREE_MEMBER_LIMIT, PRO_PLAN_PRICE } from '@/lib/plans'

// Respostas honestas sobre o produto COMO ELE É HOJE. Nada aqui promete
// funcionalidade que não existe. A resposta sobre planilha ficou desatualizada
// quando a importação por CSV foi construída, negar um recurso que existe é
// tão danoso quanto prometer um que não existe.
const faqs = [
  // Esta resposta dizia "sem prazo para expirar" e descrevia o produto anterior
  // à migration 0051. Hoje a empresa nasce com Pro completo por sete dias, e
  // depois cai para o Free — que continua sem prazo e sem cartão. As duas
  // coisas são verdade ao mesmo tempo, e a ordem importa: quem lê a pergunta
  // "é grátis mesmo?" quer saber se vai ser cobrado de surpresa. A resposta
  // começa por aí.
  {
    q: 'O que acontece depois dos 7 dias de teste?',
    a: `Nada é cobrado sem você escolher: não pedimos cartão para começar. Durante ${DIAS_DE_TRIAL} dias sua empresa usa o Pro inteiro; depois disso, ou você assina, ou a conta passa para o plano grátis, que não expira: 1 empresa, até ${FREE_MEMBER_LIMIT} colaboradores e ${FREE_LEAD_LIMIT} contatos. Seus dados continuam lá nos dois casos.`,
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
          <h2 className="text-titulo-md md:text-titulo-lg">
            Antes de criar a conta
          </h2>
          <p className="text-muted-foreground text-lg text-balance">
            As perguntas que chegam com mais frequência, respondidas sem enrolação.
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
            // `py-3`, não `py-2`: com a linha de 20px o alvo dava 36px, e o
            // mínimo de toque é 44. A margem negativa cancela o efeito no
            // layout, a frase continua com a mesma altura.
            className="text-foreground -my-3 inline-block py-3 underline underline-offset-4"
          >
            Crie uma conta grátis
          </Link>{' '}
          e teste sem compromisso.
        </p>
      </div>
    </section>
  )
}
