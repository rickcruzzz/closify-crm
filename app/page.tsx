import type { Metadata } from 'next'

import { PublicNavbar } from '@/components/layout/public-navbar'
import { HeroSection } from '@/components/landing/hero-section'
import { StatsSection } from '@/components/landing/stats-section'
import { HowItWorksSection } from '@/components/landing/how-it-works-section'
import { FeaturesSection } from '@/components/landing/features-section'
import { PricingSection } from '@/components/landing/pricing-section'
import { FaqSection } from '@/components/landing/faq-section'
import { CtaSection } from '@/components/landing/cta-section'
import { PublicFooter } from '@/components/landing/public-footer'
import { MobileStickyCta } from '@/components/landing/mobile-sticky-cta'

// A landing usa o title default (sem o template "| Velo Funil"), já que
// aqui o nome do produto é o próprio título.
export const metadata: Metadata = {
  title: 'Velo Funil: pipeline de vendas em Kanban para PMEs',
  description:
    'Organize leads e negócios num funil visual, acompanhe métricas e substitua a planilha em um dia. Plano gratuito para começar.',
  alternates: { canonical: '/' },
  // Sem repetir aqui, o preview de link herdaria o openGraph genérico do
  // layout raiz em vez do texto de conversão da landing.
  openGraph: {
    title: 'Velo Funil: pipeline de vendas em Kanban para PMEs',
    description:
      'Organize leads e negócios num funil visual, acompanhe métricas e substitua a planilha em um dia. Plano gratuito para começar.',
    // Next.js não mescla `openGraph` entre layout e página — definir aqui
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
        <PricingSection />
        {/* A FAQ fica entre preço e CTA final de propósito: é onde a objeção
            aparece — a pessoa acabou de ver quanto custa e ainda não decidiu. */}
        <FaqSection />
        <CtaSection />
      </main>
      <PublicFooter />
      <MobileStickyCta />
    </div>
  )
}
