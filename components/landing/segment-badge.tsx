'use client'

import * as React from 'react'
import { useSearchParams } from 'next/navigation'

const TEXTO_PADRAO = 'Feito para prestadores de serviço'

/**
 * Mesmos valores de `SEGMENTOS` em lib/validations/onboarding.ts, reaproveita
 * a taxonomia que o produto já usa, em vez de inventar uma nova pro anúncio.
 */
const ROTULOS_POR_SEGMENTO: Record<string, string> = {
  clinica: 'Feito para clínicas',
  imobiliaria: 'Feito para imobiliárias',
  agencia: 'Feito para agências',
  consultoria: 'Feito para consultorias',
  academia: 'Feito para academias',
  restaurante: 'Feito para restaurantes',
}

/**
 * ## Por que é um `span` e não um `Badge`
 *
 * Era `<Badge variant="secondary">`, que desenha uma pílula cinza. Medido em
 * 29/08/2026 contra oito landings de referência, procurando o elemento entre
 * a navegação e o `h1`:
 *
 *     Linear, Pipedrive, Vercel, Notion, Clay   SEM eyebrow: o h1 abre
 *     Attio, Stripe, Resend                     so texto, sem pilula
 *
 * **Nenhuma das oito usa pílula** — incluindo as duas que o `CLAUDE.md`
 * nomeia como alvo de identidade. E a pílula repetia a linguagem que já
 * existia ao lado: ela era uma superfície cinza sobre quase-preto, e o mock
 * do produto à direita é outra. Dois retângulos disputando na mesma faixa.
 *
 * No telefone era pior: 266px numa tela de 390 não lê como chip, lê como
 * barra atravessando a tela, mais pesada que a própria manchete.
 *
 * O mono maiúsculo FICA, e a distinção importa: a barra da janela do mock diz
 * `funil de vendas · Acme Corp` em mono. A letra rima com a página; a caixa é
 * que não rimava.
 *
 * E o argumento óbvio contra remover era falso — dentro da pílula o contraste
 * era 14,5:1; direto no fundo é 18,97:1. Sem a caixa ela fica mais legível.
 *
 * O componente deixou de impor aparência: quem estiliza é quem usa, pela
 * `className` que já estava na assinatura.
 *
 * ## Message match
 *
 * Quem clica num anúncio segmentado por nicho ("CRM pra clínica", "CRM pra
 * imobiliária") espera ver essa palavra confirmada na primeira dobra. `?segmento=` na URL do anúncio troca o badge sem mudar mais
 * nada na página, sem parâmetro reconhecido, cai no texto genérico de hoje.
 *
 * Client component + Suspense própria, mesmo padrão de
 * components/landing/utm-capture.tsx: mantém a rota estática (SSG), o texto
 * só troca depois da hidratação.
 */
function BadgeInterno({ className }: { className?: string }) {
  const searchParams = useSearchParams()
  const segmento = searchParams.get('segmento')
  const texto = (segmento && ROTULOS_POR_SEGMENTO[segmento]) || TEXTO_PADRAO

  return <span className={className}>{texto}</span>
}

export function SegmentBadge({ className }: { className?: string }) {
  return (
    <React.Suspense
      fallback={<span className={className}>{TEXTO_PADRAO}</span>}
    >
      <BadgeInterno className={className} />
    </React.Suspense>
  )
}
