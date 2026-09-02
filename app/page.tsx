import type { Metadata } from 'next'

import { PublicNavbar } from '@/components/layout/public-navbar'
import { HeroSection } from '@/components/landing/hero-section'
import { StatsSection } from '@/components/landing/stats-section'
import { HowItWorksSection } from '@/components/landing/how-it-works-section'
import { FeaturesSection } from '@/components/landing/features-section'
import { ConfiancaSection } from '@/components/landing/confianca-section'
import { PricingSection } from '@/components/landing/pricing-section'
import { FaqSection } from '@/components/landing/faq-section'
import { CtaSection } from '@/components/landing/cta-section'
import { PublicFooter } from '@/components/landing/public-footer'
import { MobileStickyCta } from '@/components/landing/mobile-sticky-cta'

// A landing usa o title default (sem o template "| Velo Funil"), já que
// aqui o nome do produto é o próprio título.
//
// ## O WhatsApp saiu da tese em 02/09, e não foi por gosto
//
// O title, o `og:title`, o h1 e o fecho da página eram todos sobre WhatsApp,
// desde a repositionagem de 24/08 que se apoiou nos 82% do Sebrae. O dado
// continua verdadeiro; a promessa é que deixou de ser.
//
// `FASE_DO_WHATSAPP = 'migrando'` (lib/integrations/whatsapp-estado.ts): a
// ponte não oficial saiu de operação e a API da Meta depende de App Review.
// O único WhatsApp que este produto entrega hoje é o link `wa.me`, que abre a
// conversa a partir do contato. Isso é um botão, não uma tese.
//
// Numa página orgânica, um gancho à frente do produto custa decepção. Numa
// página que recebe TRÁFEGO PAGO, custa dinheiro: a decepção acontece depois
// do clique, quando ele já foi cobrado. É a mesma classe dos "contatos
// ilimitados" com o Free em 300 e do CNPJ baixado exibido como prova.
//
// A tese nova é o que o produto de fato faz e o que nenhum concorrente copia
// sem mudar a própria receita: preço fixo pela empresa. Medido em 02/09
// contra a fonte, os quatro CRMs brasileiros de referência cobram por
// usuário (R$ 53 a R$ 75), e três deles têm plano grátis — ou seja, "grátis"
// não diferencia nada, e "não cobra por pessoa" diferencia tudo.
//
// Quando o WhatsApp voltar a entregar, ele volta para cá. Não antes.
export const metadata: Metadata = {
  title: 'Velo Funil: o CRM que não cobra por vendedor',
  description:
    'CRM para pequenos negócios brasileiros. Traga sua planilha e cada cliente vira um contato com prazo para responder. Grátis até 50 contatos, sem cartão. Pro por R$ 49 por mês pela empresa inteira, não por vendedor.',
  alternates: { canonical: '/' },
  // Sem repetir aqui, o preview de link herdaria o openGraph genérico do
  // layout raiz em vez do texto de conversão da landing.
  openGraph: {
    title: 'Velo Funil: o CRM que não cobra por vendedor',
    description:
      'CRM para pequenos negócios brasileiros. Traga sua planilha e cada cliente vira um contato com prazo para responder. Grátis até 50 contatos, sem cartão. Pro por R$ 49 por mês pela empresa inteira, não por vendedor.',
    // Next.js não mescla `openGraph` entre layout e página, definir aqui
    // sobrescreve o do layout raiz por inteiro, e sem `siteName` a home
    // ficava sem `og:site_name`. É provavelmente o que o verificador de
    // marca do Google compara com o nome cadastrado no consent screen
    // ("Velo Funil"), daí o aviso de nome não bater.
    siteName: 'Velo Funil',
  },
}

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicNavbar />
      <main id="conteudo" className="flex-1">
        <HeroSection />
        <StatsSection />
        {/* "Como funciona" vem antes das funcionalidades de propósito: quem
            controla vendas em planilha precisa ver o caminho (trago meus
            contatos → arrasto → acompanho) antes de uma lista de recursos, que
            só significa algo para quem já usou CRM. */}
        <HowItWorksSection />
        <FeaturesSection />
        {/* Confiança vem ANTES do preço, não depois. Quem avalia R$ 49
            desconfiando do site acha caro; quem já sabe onde os dados moram,
            quem responde pelo CNPJ e como se cancela, avalia o número pelo que
            ele é. A objeção que esta seção resolve ("posso entregar minha
            carteira de clientes a esta gente?") também nasce antes da de preço,
            e não depois. */}
        <ConfiancaSection />
        <PricingSection />
        {/* A FAQ fica entre preço e CTA final de propósito: é onde a objeção
            aparece, a pessoa acabou de ver quanto custa e ainda não decidiu. */}
        <FaqSection />
        <CtaSection />
      </main>
      <PublicFooter />
      <MobileStickyCta />
    </div>
  )
}
