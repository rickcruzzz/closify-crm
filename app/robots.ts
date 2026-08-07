import type { MetadataRoute } from 'next'

import { appUrl } from '@/lib/app-url'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Área logada, webhooks e links de convite não têm por que ser
      // rastreados — e o link de convite carrega um token na URL.
      disallow: [
        '/dashboard',
        '/kanban',
        '/leads',
        '/settings',
        '/onboarding',
        '/convite/',
        '/api/',
        '/auth/',
        '/redefinir-senha',
        '/verifique-email',
      ],
    },
    sitemap: `${appUrl()}/sitemap.xml`,
  }
}
