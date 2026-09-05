import type { Metadata } from 'next'
import Link from 'next/link'

import { CtaNoMeio } from '@/components/landing/cta-no-meio'
import { LinkComOrigem } from '@/components/landing/link-com-origem'

import { buttonVariants } from '@/components/ui/button'
import {
  LegalList,
  LegalP,
  LegalSection,
  LegalTitle,
  LegalUpdatedAt,
} from '@/components/legal/legal-prose'
import { paraScript } from '@/lib/seo/dados-estruturados'
import { cn } from '@/lib/utils'
import {
  FREE_LEAD_LIMIT,
  FREE_MEMBER_LIMIT,
  PRECOS_CONFERIDOS_EM,
  PRECO_MEDIANA_POR_USUARIO,
  PRO_PLAN_PRICE,
} from '@/lib/plans'

/**
 * A busca literal do diferencial deste produto.
 *
 * ## Por que ela é diferente da página de preço
 *
 * `/quanto-custa-um-crm` responde a pergunta de quem ainda está entendendo a
 * categoria — volume maior, concorrência maior, intenção mais fria.
 *
 * Esta atende quem **já sabe o que quer**: alguém que digita "crm que não
 * cobra por usuário" já passou pela conta, já se incomodou com ela, e está
 * procurando quem resolva. É pouco volume e altíssima intenção — exatamente o
 * desenho que `docs/google-ads.md` concluiu ser o único que cabe em orçamento
 * pequeno, e aqui sai de graça.
 *
 * ## O risco desta página, e como ele é tratado
 *
 * Ela fala do próprio produto por construção, e isso a aproxima de página de
 * vendas — que ranqueia mal e não é citada por IA. O que a salva é responder a
 * pergunta INTEIRA antes de se oferecer: por que a cobrança por assento
 * domina, o que procurar num preço fixo, e quais armadilhas existem em
 * "ilimitado".
 *
 * Se alguém ler e escolher outro produto, a página cumpriu o trabalho. O que
 * não pode é enganar para converter.
 */

const TIME = 5
const custoPorAssento = PRECO_MEDIANA_POR_USUARIO * TIME

export const metadata: Metadata = {
  title: 'CRM que não cobra por usuário: como funciona',
  // 154 caracteres.
  description:
    `A maioria dos CRMs cobra por pessoa: cinco custam R$ ${custoPorAssento}/mês. ` +
    `Veja como funciona o preço fixo por empresa e o que conferir antes de assinar.`,
  alternates: { canonical: '/crm-que-nao-cobra-por-usuario' },
  openGraph: {
    title: 'CRM que não cobra por usuário: como funciona',
    description:
      'Preço por empresa em vez de por assento: como funciona, quando compensa ' +
      'e o que conferir antes de assinar.',
    type: 'article',
  },
}

const PERGUNTAS = [
  {
    q: 'Existe CRM que não cobra por usuário?',
    a:
      `Existe, mas é minoria. A maioria dos CRMs cobra por assento — entre ` +
      `R$ 50 e R$ 75 por pessoa por mês no Brasil. No modelo de preço fixo, a ` +
      `empresa paga um valor único independentemente de quantas pessoas usam. ` +
      `O Velo Funil cobra R$ ${PRO_PLAN_PRICE} por mês pela empresa inteira.`,
  },
  {
    q: 'Por que a maioria dos CRMs cobra por usuário?',
    a:
      `Porque a receita cresce junto com o cliente: equipe maior significa ` +
      `fatura maior, sem precisar vender nada novo. É um modelo previsível para ` +
      `o fornecedor, e por isso virou padrão na categoria.`,
  },
  {
    q: 'Preço fixo tem limite de usuários escondido?',
    a:
      `Depende do produto, e é a primeira coisa a conferir. Alguns anunciam ` +
      `preço fixo mas limitam o número de pessoas no plano de entrada, ou cobram ` +
      `por "usuário ativo". Procure a palavra "por usuário" na página de preços ` +
      `e leia o que acontece quando a equipe cresce.`,
  },
  {
    q: 'Vale a pena trocar de CRM só pelo preço?',
    a:
      `Só se a ferramenta atual não estiver sendo usada. Migrar custa tempo e ` +
      `atenção da equipe, e um CRM que já virou hábito vale o que custa. A troca ` +
      `costuma compensar quando a equipe cresceu e a fatura acompanhou, ou ` +
      `quando assentos estão sendo economizados — com gente de fora do sistema.`,
  },
]

export default function CrmQueNaoCobraPorUsuario() {
  const dados = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: PERGUNTAS.map((p) => ({
      '@type': 'Question',
      name: p.q,
      acceptedAnswer: { '@type': 'Answer', text: p.a },
    })),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: paraScript(dados) }}
      />

      <LegalTitle>CRM que não cobra por usuário: como funciona</LegalTitle>
      <LegalUpdatedAt>Preços conferidos em {PRECOS_CONFERIDOS_EM}</LegalUpdatedAt>

      <LegalP className="text-foreground text-lg">
        Existe, mas é minoria. A maioria dos CRMs cobra <strong>por assento</strong>{' '}
        — entre R$ 50 e R$ 75 por pessoa por mês no Brasil. No modelo de{' '}
        <strong>preço fixo</strong>, a empresa paga um valor único e coloca quantas
        pessoas quiser, sem a fatura mudar.
      </LegalP>

      <LegalSection titulo="O que muda na prática">
        <LegalP>
          A diferença não aparece no primeiro mês. Aparece quando a equipe cresce
          — e é aí que ela muda o comportamento de quem usa.
        </LegalP>
        <LegalP>
          Numa cobrança por assento, cada pessoa nova tem um custo visível. O
          efeito é conhecido: o vendedor recém-contratado fica algumas semanas de
          fora, o estagiário usa o login de outra pessoa, e o sócio &quot;só
          consulta&quot; pelo WhatsApp de alguém. O histórico do cliente volta a se
          espalhar, que é exatamente o problema que o CRM foi contratado para
          resolver.
        </LegalP>
        <LegalP>
          No preço fixo, colocar mais alguém não tem custo. A pergunta &quot;vale a
          pena dar acesso?&quot; deixa de existir, e o sistema volta a ter o que
          precisa ter: todo mundo que fala com cliente, registrando.
        </LegalP>

        {/* Mesmo vao da pagina irma, e mesma correcao: o argumento fecha aqui, e
            o proximo botao ficava no rodape. Ver `cta-no-meio.tsx`. */}
        <CtaNoMeio chamada="Coloque a equipe inteira sem a fatura mudar." />
      </LegalSection>

      <LegalSection titulo="Por que a cobrança por assento virou padrão">
        <LegalP>
          Não é ganância, é modelo de negócio. Cobrar por usuário faz a receita
          crescer junto com o cliente, sem precisar vender nada novo: a empresa
          contrata, a fatura sobe sozinha. Para o fornecedor é previsível, e
          financia suporte e desenvolvimento contínuo.
        </LegalP>
        <LegalP>
          O modelo também faz sentido quando o produto é complexo o bastante para
          que cada usuário tenha configuração própria — permissão por papel,
          territórios de venda, metas individuais. Aí o assento representa
          trabalho real do fornecedor.
        </LegalP>
        <LegalP>
          Para uma equipe pequena que precisa de funil, histórico e lembrete de
          retorno, esse trabalho todo não existe — e o preço por assento cobra
          por ele mesmo assim.
        </LegalP>
      </LegalSection>

      <LegalSection titulo="O que conferir antes de assinar um preço fixo">
        <LegalP>
          &quot;Preço fixo&quot; e &quot;ilimitado&quot; são palavras de marketing
          antes de serem cláusulas. Vale conferir quatro coisas:
        </LegalP>
        <LegalList>
          <li>
            <strong>Se o limite de pessoas existe em algum plano.</strong> Alguns
            produtos anunciam preço por empresa e limitam usuários no plano de
            entrada, empurrando para um plano por assento depois.
          </li>
          <li>
            <strong>O que é contado além de usuários.</strong> Contatos, negócios,
            e-mails enviados, armazenamento. O teto pode estar em outro lugar.
          </li>
          <li>
            <strong>O que acontece ao atingir um limite.</strong> Deixar de
            cadastrar novos é uma coisa; perder acesso ao que já está lá é outra
            bem diferente.
          </li>
          <li>
            <strong>Como se cancela.</strong> Se exige contato com vendedor,
            considere isso parte do preço.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection titulo="Quando NÃO vale trocar">
        <LegalP>
          Migrar de CRM custa tempo e atenção da equipe, e ferramenta que já virou
          hábito vale o que custa. Não vale trocar só pelo preço quando:
        </LegalP>
        <LegalList>
          <li>
            <strong>A equipe já usa de verdade.</strong> Adoção é a parte cara, e
            recomeçar a construir isso costuma custar mais do que a diferença de
            mensalidade.
          </li>
          <li>
            <strong>Você depende de automação que o produto novo não tem.</strong>{' '}
            Fluxo de aprovação, geração de proposta, previsão de vendas.
          </li>
          <li>
            <strong>A equipe é de uma pessoa.</strong> Nesse caso a diferença é
            pequena, e planos por assento costumam ter nível gratuito generoso.
          </li>
        </LegalList>
        <LegalP>
          A troca costuma compensar no caso oposto: a equipe cresceu, a fatura
          acompanhou, e há gente falando com cliente fora do sistema para
          economizar assento.
        </LegalP>
      </LegalSection>

      <LegalSection titulo="Perguntas frequentes">
        {PERGUNTAS.map((p) => (
          <div key={p.q} className="flex flex-col gap-1">
            <h3 className="text-foreground font-medium">{p.q}</h3>
            <LegalP>{p.a}</LegalP>
          </div>
        ))}
      </LegalSection>

      <section className="border-border/50 mt-12 flex flex-col gap-4 border-t pt-8">
        <h2 className="text-xl font-semibold tracking-tight">
          O Velo Funil cobra por empresa, não por pessoa
        </h2>
        <LegalP>
          R$ {PRO_PLAN_PRICE} por mês, com uma pessoa ou com vinte. O plano
          gratuito vai até {FREE_LEAD_LIMIT} contatos e {FREE_MEMBER_LIMIT}{' '}
          pessoas, não expira e não pede cartão — ao atingir o limite você
          continua com tudo que já cadastrou, só não adiciona novos até assinar.
        </LegalP>
        <div className="flex flex-wrap gap-3">
          <LinkComOrigem
            href="/cadastro"
            className={cn(buttonVariants({ size: 'lg' }), 'min-h-11')}
          >
            Começar grátis
          </LinkComOrigem>
          <Link
            href="/quanto-custa-um-crm"
            className={cn(
              buttonVariants({ variant: 'outline', size: 'lg' }),
              'min-h-11',
            )}
          >
            Ver a conta completa
          </Link>
        </div>
      </section>
    </>
  )
}
