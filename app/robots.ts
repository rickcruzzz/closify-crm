import type { MetadataRoute } from 'next'

import { appUrl } from '@/lib/app-url'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Área logada, webhooks e links de convite não têm por que ser
      // rastreados, e o link de convite carrega um token na URL.
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
        // A Central do Dono nunca existe em produção (`lib/dono/somente-local.ts`
        // devolve 404 fora de localhost), então esta linha é redundante por
        // desenho. Fica assim mesmo: se um dia o gate quebrar, o pior cenário
        // é a base de clientes inteira exposta, e defesa em profundidade custa
        // uma linha aqui.
        '/dono',
      ],
    },
    sitemap: `${appUrl()}/sitemap.xml`,
  }
}
