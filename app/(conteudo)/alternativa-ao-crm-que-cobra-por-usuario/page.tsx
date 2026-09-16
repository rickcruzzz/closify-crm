import type { Metadata } from 'next'

import { CtaNoMeio } from '@/components/landing/cta-no-meio'
import { LinkComOrigem } from '@/components/landing/link-com-origem'

import { buttonVariants } from '@/components/ui/button'
import {
  LegalList,
  LegalP,
  LegalSection,
  LegalTable,
  LegalTitle,
  LegalUpdatedAt,
} from '@/components/legal/legal-prose'
import { paraScript } from '@/lib/seo/dados-estruturados'
import { cn } from '@/lib/utils'
import { FREE_LEAD_LIMIT, PRO_PLAN_PRICE } from '@/lib/plans'

/**
 * A página de quem já decidiu trocar.
 *
 * ## Por que ela existe agora, e não antes
 *
 * Em 06/09 uma varredura mediu o mercado brasileiro de CRM barato e achou
 * **sete produtos que já anunciam "preço fixo, sem cobrar por usuário"** — o
 * diferencial que este projeto declarava como próprio. Um deles escreve o
 * argumento com as nossas palavras.
 *
 * O conceito deixou de diferenciar. O que continua diferenciando é um número, e
 * número só significa alguma coisa ao lado de outros números.
 *
 * ## Uma página, e não sete
 *
 * A tentação é escrever `/alternativa-ao-<cada-concorrente>`. Sete páginas
 * finas competem entre si pela mesma intenção, nenhuma acumula autoridade, e
 * cada uma envelhece sozinha quando o preço do outro muda.
 *
 * ## O que NÃO entra, e é o que faz a página funcionar
 *
 * Nenhum juízo sobre a qualidade dos outros. Só preço público, com a data em
 * que foi lido — e a seção que diz quando **não** trocar. Página que só puxa
 * para o próprio lado não é citada por IA nem ranqueia, e é a mesma regra que
 * governa as outras duas páginas de conteúdo daqui.
 *
 * E nenhuma prova social: este produto não tem cliente externo, e inventar um é
 * a linha que o projeto não cruza.
 */

/**
 * Os preços, lidos das páginas públicas em 06/09/2026.
 *
 * A data anda junto do número de propósito: preço de concorrente é o dado que
 * envelhece mais rápido nesta página, e valor sem data vira afirmação falsa em
 * silêncio no dia em que ele muda.
 *
 * `entrada` é o plano mais barato que existe, não o mais vendido — é o que a
 * pessoa vê primeiro na página de preços deles.
 */
const LIDO_EM = '06/09/2026'

const CONCORRENTES = [
  { nome: 'Nexxou', entrada: 'R$ 97/mês', modelo: 'Fixo, até 3 usuários no plano de entrada' },
  { nome: 'NT Tecnologia', entrada: 'R$ 100/mês', modelo: 'Fixo, 1 usuário; R$ 250 até 15' },
  { nome: 'UnicoCRM', entrada: 'R$ 99/mês', modelo: 'Fixo até 3, depois R$ 9,90 por usuário' },
  { nome: 'Akio CRM', entrada: 'R$ 69/usuário', modelo: 'Por usuário' },
  { nome: 'Agendor', entrada: 'R$ 53/usuário', modelo: 'Por usuário' },
  { nome: 'Pipedrive', entrada: '~R$ 80/usuário', modelo: 'Por usuário' },
] as const

const PERGUNTAS = [
  {
    /**
     * ## Esta resposta dizia "é o mais barato", e deixou de ser verdade em 10/09
     *
     * Com R$ 49 a afirmação era literal e conferível. Com R$ 97 ela é falsa: o
     * Nexxou cobra exatamente R$ 97 e o UnicoCRM R$ 99 — a mesma faixa.
     *
     * O que NÃO mudou, e é conferível na tabela logo acima nesta mesma página:
     * os três concorrentes de preço fixo travam a quantidade de pessoas no
     * plano de entrada (Nexxou 3, UnicoCRM 3, NT Tecnologia **1**). Aqui não há
     * teto de pessoas em nenhum plano pago.
     *
     * Trocar só o número e manter "mais barato" deixaria a frase gramaticalmente
     * intacta e factualmente mentirosa, ao lado de uma tabela que a desmente na
     * mesma tela. É a classe de defeito que esta página inteira existe para não
     * ter — ela se chama honesta porque admite quando o concorrente é melhor, e
     * a pergunta seguinte já concede que por-usuário sai na frente para quem
     * vende sozinho.
     */
    q: 'Qual é a alternativa mais barata a um CRM que cobra por usuário?',
    a:
      `Depende do tamanho da equipe, e vale dizer com números. Entre os CRMs ` +
      `brasileiros de preço fixo lidos em ${LIDO_EM}, o Velo Funil custa ` +
      `R$ ${PRO_PLAN_PRICE} por mês e é o único sem limite de pessoas: os da ` +
      `mesma faixa travam em 3 usuários (Nexxou, R$ 97; UnicoCRM, R$ 99) ou em ` +
      `1 (NT Tecnologia, R$ 100). Para quem vende sozinho, um plano por usuário ` +
      `sai mais em conta. Há também um plano gratuito para até ` +
      `${FREE_LEAD_LIMIT} contatos, sem cartão.`,
  },
  {
    q: 'Preço fixo é sempre mais barato que cobrança por usuário?',
    a:
      `Não. Para quem vende sozinho, um plano por usuário costuma sair mais em ` +
      `conta, a conta só vira quando a equipe cresce. A partir de duas ou três ` +
      `pessoas o fixo passa à frente, e a diferença aumenta a cada contratação.`,
  },
  {
    q: 'Como faço para migrar de CRM sem perder os dados?',
    a:
      `Exporte seus contatos do sistema atual em CSV, todo CRM sério oferece ` +
      `isso, e importe no novo. No Velo Funil a importação lê .csv e .xlsx, ` +
      `reconhece as colunas sozinha e ignora contatos repetidos. Antes de migrar, ` +
      `confira se o sistema atual devolve os dados sem exigir contato com vendedor.`,
  },
  {
    q: 'O que conferir antes de trocar por um CRM mais barato?',
    a:
      `Três coisas, nesta ordem: se o preço fixo tem teto escondido de pessoas ou ` +
      `de contatos; como se cancela, e se dá para fazer isso sozinho pela tela; e ` +
      `se você consegue exportar tudo depois. Um CRM barato do qual não se sai ` +
      `custa mais caro que um caro do qual se sai.`,
  },
] as const

export const metadata: Metadata = {
  title: 'Alternativa ao CRM que cobra por usuário: os preços de 2026',
  // 152 caracteres.
  description:
    'CRMs brasileiros com preço fixo, comparados pelo valor público de entrada. ' +
    'Quando o fixo compensa, quando não compensa, e o que conferir antes de trocar.',
  alternates: { canonical: '/alternativa-ao-crm-que-cobra-por-usuario' },
  openGraph: {
    title: 'Alternativa ao CRM que cobra por usuário',
    description:
      'Os preços públicos dos CRMs brasileiros de preço fixo, com a data em que ' +
      'foram lidos, e quando trocar não compensa.',
    type: 'article',
  },
}

export default function AlternativaAoCrmPorUsuario() {
  const faq = {
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: paraScript(faq) }} />

      <LegalTitle>Alternativa ao CRM que cobra por usuário</LegalTitle>
      <LegalUpdatedAt>Preços públicos lidos em {LIDO_EM}</LegalUpdatedAt>

      <LegalP>
        Quem procura por isto normalmente já fez a conta: a fatura do CRM subiu
        quando a equipe cresceu, e a próxima contratação vai subir de novo. Esta
        página lista o que existe no Brasil com preço por empresa, o valor de
        entrada de cada um, e — o mais importante — quando trocar{' '}
        <strong>não</strong> compensa.
      </LegalP>

      <LegalSection titulo="Os preços de entrada, lado a lado">
        <LegalP>
          Valor público mais barato de cada produto, lido na página de preços
          deles em {LIDO_EM}. É o número que aparece primeiro para quem chega —
          não necessariamente o plano mais vendido, e não um juízo sobre a
          qualidade de nenhum deles.
        </LegalP>

        <LegalTable>
          <thead>
            <tr className="border-border border-b">
              <th className="px-4 py-2 font-medium">Produto</th>
              <th className="px-4 py-2 font-medium">Entrada</th>
              <th className="px-4 py-2 font-medium">Modelo</th>
            </tr>
          </thead>
          <tbody>
            {CONCORRENTES.map((c) => (
              <tr key={c.nome} className="border-border/60 border-b last:border-0">
                <td className="px-4 py-2">{c.nome}</td>
                <td className="px-4 py-2 tabular-nums">{c.entrada}</td>
                <td className="text-muted-foreground px-4 py-2">{c.modelo}</td>
              </tr>
            ))}
            <tr className="bg-muted/40 border-border/60 border-b last:border-0">
              <td className="px-4 py-2 font-medium">Velo Funil</td>
              <td className="px-4 py-2 font-medium tabular-nums">R$ {PRO_PLAN_PRICE}/mês</td>
              <td className="px-4 py-2">Fixo, sem limite de pessoas</td>
            </tr>
          </tbody>
        </LegalTable>

        <LegalP>
          Três desses seis anunciam preço fixo e ainda assim têm teto: o plano de
          entrada cobre um número de pessoas, e passar dele volta a custar por
          cabeça. Vale ler a letra miúda antes de somar.
        </LegalP>
      </LegalSection>

      <CtaNoMeio chamada="Coloque a equipe inteira sem a fatura mudar." />

      <LegalSection titulo="Quando trocar NÃO compensa">
        <LegalP>
          Migrar custa tempo e atenção da equipe, e um CRM que já virou hábito
          vale o que custa. Não troque se:
        </LegalP>
        <LegalList>
          <li>
            <strong>Você vende sozinho.</strong> Com uma pessoa, um plano por
            usuário costuma sair mais barato — a conta só vira a partir de duas
            ou três.
          </li>
          <li>
            <strong>Sua operação depende de automação pesada.</strong> Sequências
            de e-mail, pontuação de lead e integrações profundas são o terreno de
            quem cobra mais, e cobrar mais é o que paga isso.
          </li>
          <li>
            <strong>A equipe já usa o sistema atual todo dia.</strong> Hábito
            formado é o ativo mais caro de um CRM, e a economia raramente paga
            perdê-lo.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection titulo="O que conferir antes de assinar o mais barato">
        <LegalList>
          <li>
            <strong>Teto escondido.</strong> Procure &quot;por usuário&quot; e
            &quot;até N usuários&quot; na página de preços. Preço fixo com teto de
            três pessoas é cobrança por usuário com outro nome.
          </li>
          <li>
            <strong>Como se cancela.</strong> Se exige falar com vendedor,
            considere isso parte do preço. Cancelamento que só acontece por
            telefone é o que aparece nas reclamações públicas contra os CRMs
            grandes.
          </li>
          <li>
            <strong>Se você consegue sair com os dados.</strong> Exportação em
            CSV, sem pedir autorização a ninguém. Um CRM barato do qual não se sai
            custa mais caro que um caro do qual se sai.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection titulo="Perguntas frequentes">
        {PERGUNTAS.map((p) => (
          <div key={p.q} className="mb-6">
            <h3 className="text-foreground mb-2 font-medium">{p.q}</h3>
            <LegalP>{p.a}</LegalP>
          </div>
        ))}
      </LegalSection>

      <LegalSection
        titulo={`O Velo Funil custa R$ ${PRO_PLAN_PRICE} por mês pela empresa inteira`}
      >
        <LegalP>
          Com uma pessoa ou com vinte, a fatura é a mesma. Há um plano gratuito
          para até {FREE_LEAD_LIMIT} contatos, sem cartão — e a saída fica aberta:
          cancela pela própria tela, sem multa, e você leva seus contatos em CSV.
        </LegalP>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <LinkComOrigem
            href="/cadastro"
            className={cn(buttonVariants({ size: 'lg' }), 'min-h-11')}
          >
            Começar grátis
          </LinkComOrigem>
          <LinkComOrigem
            href="/quanto-custa-um-crm"
            className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'min-h-11')}
          >
            Ver a conta completa
          </LinkComOrigem>
        </div>
      </LegalSection>
    </>
  )
}
