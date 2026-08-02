import { PublicNavbar } from '@/components/layout/public-navbar'
import { HeroSection } from '@/components/landing/hero-section'
import { StatsSection } from '@/components/landing/stats-section'
import { FeaturesSection } from '@/components/landing/features-section'
import { PricingSection } from '@/components/landing/pricing-section'
import { CtaSection } from '@/components/landing/cta-section'
import { PublicFooter } from '@/components/landing/public-footer'

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicNavbar />
      <main className="flex-1">
        <HeroSection />
        <StatsSection />
        <FeaturesSection />
        <PricingSection />
        <CtaSection />
      </main>
      <PublicFooter />
    </div>
  )
}
