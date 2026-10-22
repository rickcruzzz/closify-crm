import { ChevronDown } from 'lucide-react'

import { RevealOnScroll } from '@/components/landing/reveal-on-scroll'
import { linkDoContatoComercial } from '@/lib/marketing/contato-comercial'

// Respostas honestas sobre o produto COMO ELE É HOJE. Nada aqui promete
// funcionalidade que não existe. A resposta sobre planilha ficou desatualizada
// quando a importação por CSV foi construída, negar um recurso que existe é
// tão danoso quanto prometer um que não existe.
//
// ## Reescrita em 22/10, com o reposicionamento
//
// "O plano grátis é grátis mesmo?" saiu junto com os planos da vitrine. As
// duas primeiras perguntas agora são as que o Radar levanta, e a segunda
// existe para dizer NÃO a uma pergunta que a página inteira convida a fazer.
//
// Esta lista vira o JSON-LD `FAQPage` em `app/page.tsx`. O Google só aceita a
// marcação onde as perguntas aparecem no HTML, então pergunta nova entra aqui
// e em nenhum outro lugar.
export const faqs = [
  {
    q: 'O que o Radar de Prospecção faz?',
    a: 'Ele pesquisa fontes públicas conforme os critérios que a sua empresa define (segmento, região e os sinais que importam para a venda) e organiza cada oportunidade com a fonte, o contato quando disponível e o motivo da prioridade. A IA prepara a abordagem, sua equipe revisa, e a oportunidade aprovada entra no CRM.',
  },
  {
    q: 'O Radar garante uma quantidade de leads?',
    a: 'Não. O volume depende das fontes disponíveis para o seu segmento e a sua região, e é avaliado antes da proposta. Preferimos dizer isso aqui a prometer um número que o seu mercado não tem.',
  },
  {
    q: 'Preciso instalar alguma coisa?',
    a: 'Não. O Velo Funil roda inteiro no navegador, no computador ou no celular. Sua equipe entra com e-mail e senha e já começa a trabalhar.',
  },
  {
    q: 'Consigo trazer os contatos da minha planilha?',
    a: 'Sim. Exporte sua planilha como .csv com as colunas Nome, Telefone, E-mail e Valor e importe direto na tela de Contatos. Contatos repetidos são ignorados automaticamente, e você também pode cadastrar um por um, se preferir.',
  },
  {
    q: 'Meus dados ficam separados dos de outras empresas?',
    a: 'Ficam. Cada empresa só enxerga os próprios dados, é uma regra de segurança configurada no banco, não uma tela que a gente esquece de checar. Nem por engano, nem por querer, os dados de uma empresa aparecem para outra.',
  },
  {
    q: 'Como funciona a contratação?',
    a: 'Começa por uma conversa com a equipe, pelo WhatsApp. Entendemos a sua operação, desenhamos o escopo e enviamos a proposta. O pagamento é por Pix, boleto ou cartão de crédito, processado pelo Asaas.',
  },
  {
    // "Sem multa" e "exporta em CSV" são as duas metades que continuam
    // verdade para o CRM. As condições do Radar são de projeto, e a resposta
    // diz isso em vez de estender a promessa do CRM a ele.
    q: 'Posso cancelar quando quiser?',
    a: 'O CRM não tem fidelidade nem multa de cancelamento, e seus contatos podem ser exportados em CSV a qualquer momento. As condições do Radar são definidas na proposta de cada projeto.',
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
            Antes de conversar com a equipe
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
        <div className="bg-border ring-border superficie-elevada grid gap-px overflow-hidden rounded-xl ring-1">
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
          <a
            href={linkDoContatoComercial('equipe')}
            target="_blank"
            rel="noopener noreferrer"
            // `py-3`, não `py-2`: com a linha de 20px o alvo dava 36px, e o
            // mínimo de toque é 44. A margem negativa cancela o efeito no
            // layout, a frase continua com a mesma altura.
            className="text-foreground -my-3 inline-block py-3 underline underline-offset-4"
          >
            Fale com a equipe pelo WhatsApp
          </a>
          .
        </p>
      </div>
    </section>
  )
}
