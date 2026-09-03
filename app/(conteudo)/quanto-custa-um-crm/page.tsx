import type { Metadata } from 'next'
import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  LegalList,
  LegalP,
  LegalSection,
  LegalTable,
  LegalTitle,
  LegalUpdatedAt,
} from '@/components/legal/legal-prose'
import { paraScript } from '@/lib/seo/dados-estruturados'
import {
  FREE_LEAD_LIMIT,
  PRECOS_CONFERIDOS_EM,
  PRECO_MEDIANA_POR_USUARIO,
  PRO_PLAN_PRICE,
} from '@/lib/plans'

/**
 * A primeira página de conteúdo do produto.
 *
 * ## Por que esta pergunta, e não outra
 *
 * Medido no Search Console em 03/09: posição média 1,7, CTR de 33% e **114
 * impressões em três meses**. Ou seja, quem busca acha — e quase ninguém
 * busca, porque as buscas são pelo nome próprio, de quem já conhece.
 *
 * O site tinha 5 páginas indexadas contra centenas dos concorrentes. Sem
 * superfície, não há como aparecer para quem ainda não sabe o nome.
 *
 * "Quanto custa um CRM" é a pergunta em que este produto tem argumento
 * próprio: todo concorrente mapeado cobra por usuário, e é a única brecha
 * estrutural de preço que ele tem. Escrever sobre funcionalidade seria
 * disputar com quem tem dez anos de domínio; escrever sobre preço é falar de
 * onde a diferença existe.
 *
 * ## A seção "quando cobrar por usuário faz sentido" não é concessão
 *
 * Ela existe porque conteúdo que só puxa para o próprio lado não é citado por
 * IA nem ranqueia bem — e, principalmente, porque é verdade. Um CRM por
 * assento com previsão de vendas e automação profunda resolve coisas que este
 * produto não resolve. Dizer isso é o que torna o resto confiável.
 *
 * ## Os números vêm de `lib/plans.ts`, com a data ao lado
 *
 * `PRECO_MEDIANA_POR_USUARIO` carrega `PRECOS_CONFERIDOS_EM`, e a data aparece
 * na tela. Preço de concorrente envelhece — é a mesma classe do CNPJ baixado
 * que ficou exibido na landing por 17 dias, e nenhum `tsc` consulta a tabela
 * de ninguém.
 */

const TIME = 5
const MESES = 12
const custoPorAssento = PRECO_MEDIANA_POR_USUARIO * TIME
const custoFixoAno = PRO_PLAN_PRICE * MESES
const custoAssentoAno = custoPorAssento * MESES

export const metadata: Metadata = {
  title: 'Quanto custa um CRM no Brasil em 2026',
  // 152 caracteres: a busca corta em ~160, e o que importa vem na frente.
  description:
    `A maioria cobra por usuário, de R$ 50 a R$ 75 cada. Cinco pessoas custam ` +
    `R$ ${custoPorAssento}/mês. Veja a conta completa e quando o preço fixo compensa.`,
  alternates: { canonical: '/quanto-custa-um-crm' },
  openGraph: {
    title: 'Quanto custa um CRM no Brasil em 2026',
    description:
      'A maioria dos CRMs cobra por usuário. A conta muda bastante conforme o ' +
      'tamanho da equipe — e quase ninguém faz essa conta antes de assinar.',
    type: 'article',
  },
}

/** As perguntas que a página responde, também marcadas para o Google. */
const PERGUNTAS = [
  {
    q: 'Quanto custa um CRM no Brasil?',
    a:
      `Os CRMs mais usados por pequenas empresas no Brasil cobram entre R$ 50 e ` +
      `R$ 75 por usuário por mês. Como a cobrança é por pessoa, o custo real ` +
      `depende do tamanho da equipe: cinco pessoas ficam em torno de ` +
      `R$ ${custoPorAssento} por mês. Há também CRMs de preço fixo por empresa, ` +
      `como o Velo Funil, que custa R$ ${PRO_PLAN_PRICE} por mês independentemente ` +
      `de quantas pessoas usam.`,
  },
  {
    q: 'Existe CRM que não cobra por usuário?',
    a:
      `Existe, mas é minoria no Brasil. A maioria cobra por assento porque a ` +
      `receita cresce junto com a equipe do cliente. O Velo Funil cobra ` +
      `R$ ${PRO_PLAN_PRICE} por mês pela empresa inteira, com uma pessoa ou com vinte.`,
  },
  {
    q: 'Vale a pena usar um CRM grátis?',
    a:
      `Vale para começar. Quase todos os CRMs têm plano gratuito, e o limite ` +
      `costuma ser o número de contatos ou de usuários. O ponto de atenção é o ` +
      `que acontece ao atingir o limite: em alguns o acesso aos dados é ` +
      `restringido, em outros você apenas não cadastra novos. Confira isso antes ` +
      `de colocar sua base inteira lá dentro.`,
  },
  {
    q: 'Qual o custo real de um CRM além da mensalidade?',
    a:
      `O tempo de implantação e de treinamento costuma custar mais que a ` +
      `mensalidade no primeiro ano, principalmente em ferramentas com muitos ` +
      `campos e etapas configuráveis. Um CRM que a equipe não usa custa 100% do ` +
      `que foi pago, independentemente do preço.`,
  },
]

export default function QuantoCustaUmCrm() {
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

      <LegalTitle>Quanto custa um CRM no Brasil em 2026</LegalTitle>
      <LegalUpdatedAt>Preços conferidos em {PRECOS_CONFERIDOS_EM}</LegalUpdatedAt>

      {/* ## A resposta vem na primeira frase, e isso é decisão
          Quem chega de busca quer a resposta, não a introdução. E é o primeiro
          parágrafo que uma IA lê para montar resposta — enterrar o número
          depois de três parágrafos de contexto é perder as duas coisas. */}
      <LegalP className="text-foreground text-lg">
        Os CRMs mais usados por pequenas empresas brasileiras custam entre{' '}
        <strong>R$ 50 e R$ 75 por usuário por mês</strong>. Como quase todos cobram
        por pessoa, o valor da fatura depende do tamanho da equipe: cinco pessoas
        ficam em torno de <strong>R$ {custoPorAssento} por mês</strong>.
      </LegalP>

      <LegalSection titulo="A conta que quase ninguém faz antes de assinar">
        <LegalP>
          O preço anunciado é sempre por usuário, e a comparação mental costuma
          parar aí. Mas a conta que chega na fatura multiplica esse valor pelo
          número de pessoas — e depois pelos meses do ano.
        </LegalP>

        <LegalTable>
          <thead>
            <tr className="border-border border-b">
              <th className="px-4 py-2 font-medium">Equipe</th>
              <th className="px-4 py-2 font-medium">
                Cobrança por usuário (R$ {PRECO_MEDIANA_POR_USUARIO} cada)
              </th>
              <th className="px-4 py-2 font-medium">Preço fixo por empresa</th>
            </tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[1, 3, 5, 10].map((pessoas) => (
              <tr key={pessoas} className="border-border/50 border-b last:border-0">
                <td className="px-4 py-2">
                  {pessoas} {pessoas === 1 ? 'pessoa' : 'pessoas'}
                </td>
                <td className="px-4 py-2 tabular-nums">
                  R$ {PRECO_MEDIANA_POR_USUARIO * pessoas}/mês
                </td>
                <td className="text-foreground px-4 py-2 tabular-nums">
                  R$ {PRO_PLAN_PRICE}/mês
                </td>
              </tr>
            ))}
          </tbody>
        </LegalTable>

        <LegalP>
          Com uma pessoa, a diferença é pequena e o modelo por usuário até sai na
          frente. A partir de três, a distância abre rápido. Em um ano, uma equipe
          de cinco pessoas paga <strong>R$ {custoAssentoAno.toLocaleString('pt-BR')}</strong>{' '}
          no modelo por assento contra{' '}
          <strong>R$ {custoFixoAno.toLocaleString('pt-BR')}</strong> no preço fixo.
        </LegalP>

        <LegalP>
          Essa diferença não é promoção nem desconto de entrada: é o modelo de
          cobrança. No preço por assento, crescer a equipe aumenta a fatura; no
          preço fixo, não muda nada.
        </LegalP>
      </LegalSection>

      <LegalSection titulo="Por que quase todo CRM cobra por usuário">
        <LegalP>
          Não é arbitrário. A cobrança por assento alinha a receita do fornecedor
          ao crescimento do cliente: quanto maior a equipe, mais a empresa paga, e
          isso financia suporte, integrações e desenvolvimento contínuo.
        </LegalP>
        <LegalP>
          O efeito colateral aparece na ponta. Quem tem equipe pequena e orçamento
          apertado começa a economizar assento — o vendedor novo fica de fora, o
          estagiário usa o login de outra pessoa, e o histórico do cliente volta a
          se espalhar. O CRM foi contratado exatamente para evitar isso.
        </LegalP>
      </LegalSection>

      <LegalSection titulo="Quando cobrar por usuário faz mais sentido">
        <LegalP>
          Preço fixo não é melhor em toda situação, e vale saber quando o modelo
          por assento compensa:
        </LegalP>
        <LegalList>
          <li>
            <strong>Equipe de uma pessoa só.</strong> A diferença é pequena, e
            planos por assento costumam ter um nível gratuito generoso para uso
            individual.
          </li>
          <li>
            <strong>Necessidade de automação profunda.</strong> Fluxos de
            aprovação, previsão de vendas com IA, geração de proposta e contrato:
            isso vive nos planos mais caros das ferramentas por assento, e um CRM
            simples não substitui.
          </li>
          <li>
            <strong>Muitos usuários com papéis diferentes.</strong> Permissão
            granular por função é mais comum em produtos que cobram por assento,
            justamente porque o assento é a unidade de cobrança.
          </li>
        </LegalList>
        <LegalP>
          Para uma equipe pequena que precisa de funil, histórico do cliente e
          lembrete de retorno — sem processo de aprovação e sem relatório
          complexo — o preço fixo entrega o mesmo por bem menos.
        </LegalP>
      </LegalSection>

      <LegalSection titulo="O custo que não aparece na tabela de preços">
        <LegalP>
          A mensalidade é a parte fácil de comparar. O que costuma custar mais no
          primeiro ano é a implantação: configurar campos, treinar a equipe e
          fazer todo mundo de fato registrar o que acontece.
        </LegalP>
        <LegalP>
          Um CRM que a equipe não usa custa 100% do que foi pago. Por isso vale
          testar com a sua base real antes de decidir — e não com o cenário de
          demonstração do fornecedor.
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

      {/* Fecho comercial no fim, e não no meio: quem rolou até aqui leu a
          comparação inteira, inclusive a parte que diz quando o concorrente é
          melhor. Interromper o texto com CTA no meio gastaria a confiança que
          o texto está construindo. */}
      <section className="border-border/50 mt-12 flex flex-col gap-4 border-t pt-8">
        <h2 className="text-xl font-semibold tracking-tight">
          O Velo Funil cobra R$ {PRO_PLAN_PRICE} por mês pela empresa inteira
        </h2>
        <LegalP>
          Com uma pessoa ou com vinte, o preço é o mesmo. Você começa de graça,
          com até {FREE_LEAD_LIMIT} contatos e sem cartão, e importa sua planilha
          direto — as colunas são reconhecidas sozinhas.
        </LegalP>
        {/* `buttonVariants` + `Link`, e não `<Button asChild>`: o Button deste
            projeto não tem `asChild`, e é o mesmo padrão que a `cta-section`
            da landing já usa. `min-h-11` mantém o alvo de toque de 44px. */}
        <div className="flex flex-wrap gap-3">
          <Link
            href="/cadastro"
            className={cn(buttonVariants({ size: 'lg' }), 'min-h-11')}
          >
            Começar grátis
          </Link>
          <Link
            href="/"
            className={cn(
              buttonVariants({ variant: 'outline', size: 'lg' }),
              'min-h-11',
            )}
          >
            Ver como funciona
          </Link>
        </div>
      </section>
    </>
  )
}
