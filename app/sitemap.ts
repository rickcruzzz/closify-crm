import type { MetadataRoute } from 'next'

import { appUrl } from '@/lib/app-url'

// Só rotas públicas. Tudo atrás de login fica de fora — o crawler seria
// redirecionado para /login de qualquer forma.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = appUrl()
  const lastModified = new Date()

  return [
    { url: base, lastModified, changeFrequency: 'weekly', priority: 1 },
    {
      url: `${base}/cadastro`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${base}/login`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    // Documentos legais entram no sitemap porque a LGPD (art. 9º) exige acesso
    // facilitado à informação sobre o tratamento — e porque são a página que
    // um titular ou a própria ANPD procura primeiro.
    {
      url: `${base}/privacidade`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${base}/termos`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]
}
