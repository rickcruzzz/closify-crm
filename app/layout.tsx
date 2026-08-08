import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import { appUrl } from '@/lib/app-url'
import { cn } from '@/lib/utils'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { Analytics } from '@vercel/analytics/next'

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-sans',
  weight: '100 900',
})
const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
})

const APP_NAME = 'Closify CRM'
const APP_DESCRIPTION =
  'CRM com pipeline de vendas em Kanban para PMEs de serviço no Brasil. Simples como planilha, premium como software líder.'

export const metadata: Metadata = {
  // metadataBase resolve URLs relativas de OG/Twitter para absolutas — sem
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
      className={cn('font-sans', geistSans.variable)}
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
          {/* O TooltipProvider vive em app/(dashboard)/layout.tsx: só a área
              logada tem tooltip, e mantê-lo aqui punha JS de provider no
              bundle da landing sem nenhum consumidor. */}
          {children}
          <Toaster />
          {/* Vercel Analytics: mede pageview e Web Vitals sem cookie e sem
              identificar visitante, entao nao muda a exigencia de consentimento
              da pagina. Fora da Vercel o script simplesmente nao carrega. */}
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  )
}
