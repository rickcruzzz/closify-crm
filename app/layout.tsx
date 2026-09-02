import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import { appUrl } from '@/lib/app-url'
import { cn } from '@/lib/utils'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { Analytics } from '@/components/analytics'
import { MetaPixel } from '@/components/analytics/meta-pixel'
import { IsolarAnalytics } from '@/components/analytics/isolar-analytics'
import { BannerConsentimento } from '@/components/analytics/banner-consentimento'
import { UtmCapture } from '@/components/landing/utm-capture'
import { NavigationProgress } from '@/components/layout/navigation-progress'

/**
 * ## `.woff2`, e por que os `.woff` continuam no repositório
 *
 * `next/font/local` faz `preload` por padrão, então as duas fontes são
 * baixadas em TODA visita, antes de qualquer outra coisa. Medido em produção
 * em 02/09, na landing que recebe o tráfego pago: 66.268 + 67.864 bytes.
 * Convertidas para `.woff2` (Brotli, contra o deflate do `.woff`): 55.516 +
 * 56.828, **17% menos cada**, ~22 KB no total, sem tocar em desenho de letra.
 *
 * Os `.woff` **ficam no disco de propósito**: `scripts/marketing/gerar-stories.py`,
 * `gerar-feed.py` e `marketing/claude-designer/velofunil_criativos.py` os
 * carregam pelo Pillow, que não lê `.woff2`. Um deles tem teste amarrado
 * (`lib/marketing/oferta-nas-artes.test.ts`). Apagá-los pareceria limpeza e
 * quebraria o gerador de criativos — que é o que alimenta o próprio anúncio
 * cuja página estas fontes servem.
 *
 * Mesma razão para `InstrumentSerif-Italic.ttf` continuar aqui sem nenhum
 * `import`: ele é a serifa dos números das artes, não uma sobra.
 */
const geistSans = localFont({
  src: './fonts/GeistVF.woff2',
  variable: '--font-sans',
  weight: '100 900',
})
const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff2',
  variable: '--font-geist-mono',
  weight: '100 900',
})

const APP_NAME = 'Velo Funil'
// Alimenta `og:description` e `twitter:description` de TODAS as páginas menos a
// home (que tem os seus próprios). Ficou parada no vocabulário anterior ao
// docs/prd-copy-sem-jargao.md — "pipeline", "Kanban" e "PMEs" são jargão para
// quem tem agência, clínica ou imobiliária pequena, e a segunda frase era a
// headline que o PRD substituiu.
const APP_DESCRIPTION =
  'CRM para pequenos negócios organizarem clientes e vendas num quadro visual, sem planilha. Plano gratuito para começar.'

export const metadata: Metadata = {
  // metadataBase resolve URLs relativas de OG/Twitter para absolutas, sem
  // ele o Next avisa em build e os previews de link quebram.
  metadataBase: new URL(appUrl()),
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: '/',
    siteName: APP_NAME,
    title: APP_NAME,
    description: APP_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: APP_NAME,
    description: APP_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="pt-BR"
      className={cn('scroll-smooth font-sans', geistSans.variable)}
      suppressHydrationWarning
    >
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <a
          href="#conteudo"
          className="bg-background text-foreground focus:ring-ring sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:px-4 focus:py-2 focus:ring-2"
        >
          Pular para o conteúdo
        </a>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {/* Fica no layout raiz, fora do `app/(dashboard)/layout.tsx`, de
              propósito: aquele layout faz `await` de várias consultas antes
              de renderizar, e a barra precisa aparecer no clique mesmo
              enquanto isso ainda está resolvendo. */}
          <NavigationProgress />
          {/* O TooltipProvider vive em app/(dashboard)/layout.tsx: só a área
              logada tem tooltip, e mantê-lo aqui punha JS de provider no
              bundle da landing sem nenhum consumidor. */}
          {children}
          <Toaster />
          {/* Vercel Analytics: pageview e Web Vitals, sem cookie e sem
              identificar visitante. O wrapper local higieniza a URL antes do
              envio, o pacote manda o caminho REAL junto do padrão da rota, e
              `/convite/<token>` carrega uma credencial de acesso. */}
          {/* Os três vivem no layout RAIZ, então um erro em qualquer um deles
              sobe até `app/global-error.tsx` e o visitante recebe uma tela
              preta. Foi o que aconteceu em 24/08 com uma quebra de linha no
              ID do pixel. A cerca garante que medição quebrada custe o DADO,
              nunca a visita — ver `isolar-analytics.tsx`. */}
          <IsolarAnalytics nome="Vercel Analytics">
            <Analytics />
          </IsolarAnalytics>
          <IsolarAnalytics nome="Meta Pixel">
            <MetaPixel />
          </IsolarAnalytics>
          <IsolarAnalytics nome="Captura de UTM">
            <UtmCapture />
          </IsolarAnalytics>
          {/* Depois do pixel na ordem do JSX, mas o pixel só liga com o "aceito"
              que sai daqui — ver o cabeçalho de banner-consentimento.tsx. */}
          <BannerConsentimento />
        </ThemeProvider>
      </body>
    </html>
  )
}
