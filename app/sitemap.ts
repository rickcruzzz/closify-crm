import type { MetadataRoute } from 'next'

import { appUrl } from '@/lib/app-url'

// Só rotas públicas. Tudo atrás de login fica de fora, o crawler seria
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
    // ## Conteúdo, e por que a prioridade é alta
    //
    // Estas páginas existem para ser encontradas por quem NÃO conhece o
    // produto — é o único caminho para as 114 impressões em três meses
    // medidas em 03/09, quase todas pelo nome próprio, virarem outra coisa.
    //
    // Prioridade 0.9, logo abaixo da home: para o objetivo de descoberta elas
    // valem mais que `/cadastro`, que só é útil para quem já decidiu.
    {
      url: `${base}/quanto-custa-um-crm`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    // Menos volume que a de preço e MUITO mais intenção: quem digita "crm que
    // não cobra por usuário" já fez a conta, já se incomodou com ela, e está
    // procurando quem resolva. É o mesmo desenho de cauda longa que
    // `docs/google-ads.md` concluiu ser o único viável com orçamento pequeno —
    // aqui sem custo por clique.
    {
      url: `${base}/crm-que-nao-cobra-por-usuario`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    // Documentos legais entram no sitemap porque a LGPD (art. 9º) exige acesso
    // facilitado à informação sobre o tratamento, e porque são a página que
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
