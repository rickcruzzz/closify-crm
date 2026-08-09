import type { Metadata } from 'next'

import { PublicNavbar } from '@/components/layout/public-navbar'
import { HeroSection } from '@/components/landing/hero-section'
import { StatsSection } from '@/components/landing/stats-section'
import { FeaturesSection } from '@/components/landing/features-section'
import { PricingSection } from '@/components/landing/pricing-section'
import { FaqSection } from '@/components/landing/faq-section'
import { CtaSection } from '@/components/landing/cta-section'
import { PublicFooter } from '@/components/landing/public-footer'

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
  },
}

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicNavbar />
      <main id="conteudo" className="flex-1">
        <HeroSection />
        <StatsSection />
        <FeaturesSection />
        <PricingSection />
        {/* A FAQ fica entre preço e CTA final de propósito: é onde a objeção
            aparece — a pessoa acabou de ver quanto custa e ainda não decidiu. */}
        <FaqSection />
        <CtaSection />
      </main>
      <PublicFooter />
    </div>
  )
}
