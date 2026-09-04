'use client'

import * as React from 'react'
import { useSearchParams } from 'next/navigation'

import { capturarUtm } from '@/lib/auth/utm-actions'

/** `fb.<subdomain_index>.<criado_em_ms>.<fbclid>`, formato exigido pela Meta. */
function montarFbc(fbclid: string): string {
  return `fb.1.${Date.now()}.${fbclid}`
}

function lerCookie(nome: string): string | undefined {
  const linha = document.cookie.split('; ').find((c) => c.startsWith(`${nome}=`))
  return linha?.split('=')[1]
}

/**
 * Sem UI, só olha a URL do primeiro carregamento atrás de `utm_*`/`fbclid`
 * e manda pro cookie de atribuição (lib/auth/intencao.ts), que persiste pra
 * dentro do workspace quando a conta é criada. Cookie próprio, primeira
 * parte (first-party), sem rede pra terceiro, não é o mesmo tipo de
 * rastreamento do Meta Pixel, é o produto lembrando de onde a própria
 * visita veio.
 *
 * `_fbp` é lido com um pequeno atraso de propósito: o Pixel
 * (components/analytics/meta-pixel.tsx) carrega com `strategy="afterInteractive"`
 * e escreve esse cookie sozinho, na primeira visita da sessão inteira, ele
 * pode ainda não ter tido tempo de rodar no exato instante deste efeito.
 * Não é garantia (best-effort, documentado como tal), só reduz a chance de
 * perder a âncora mais forte de match por pura corrida.
 */
function CapturaInterna() {
  const searchParams = useSearchParams()
  const jaEnviou = React.useRef(false)

  React.useEffect(() => {
    if (jaEnviou.current) return

    const source = searchParams.get('utm_source')
    const medium = searchParams.get('utm_medium')
    const campaign = searchParams.get('utm_campaign')
    // ## `utm_content` diz qual PECA trouxe, e nao so qual campanha
    //
    // A campanha do Meta e um teste de seis angulos: os seis anuncios apontam
    // para o mesmo `/cadastro` e so se distinguem por este parametro. Sem ele,
    // o teste roda e nao conclui nada — sabe-se que veio do Meta, nao qual
    // argumento convenceu.
    //
    // O relatorio da Meta mostra qual anuncio teve mais cadastro, mas nao sabe
    // quem PAGOU: a assinatura acontece dias depois, no Asaas. O cruzamento
    // "qual peca trouxe quem virou Pro" so existe deste lado.
    const content = searchParams.get('utm_content')
    const fbclid = searchParams.get('fbclid')
    // ## `gclid` e o que ele responde que nenhum outro campo responde
    //
    // A marcacao automatica do Google Ads acrescenta este parametro a toda URL
    // de destino, e ele e o UNICO dado que a importacao de conversao offline
    // aceita para dizer ao Google "este clique virou assinatura paga".
    //
    // O relatorio do Google sabe quem clicou e quem se cadastrou; quem PAGOU
    // acontece dias depois no Asaas, fora do alcance de qualquer tag. Guardar
    // hoje e o que torna essa reconciliacao possivel amanha — histórico nao se
    // cria depois. Ver a migration 0071.
    const gclid = searchParams.get('gclid')

    if (!source && !medium && !campaign && !content && !fbclid && !gclid) return

    jaEnviou.current = true

    const enviar = () => {
      void capturarUtm({
        source: source ?? undefined,
        medium: medium ?? undefined,
        campaign: campaign ?? undefined,
        content: content ?? undefined,
        fbc: fbclid ? montarFbc(fbclid) : undefined,
        fbp: lerCookie('_fbp'),
        // Cru, sem transformar: a Meta exige `fb.1.<ms>.<fbclid>`, o Google
        // quer o valor exatamente como chegou.
        gclid: gclid ?? undefined,
      })
    }

    const temporizador = setTimeout(enviar, 300)
    return () => clearTimeout(temporizador)
  }, [searchParams])

  return null
}

export function UtmCapture() {
  // `useSearchParams` exige fronteira de Suspense própria em página estática
  //, sem isso o build reclama que a rota inteira precisaria virar dinâmica.
  return (
    <React.Suspense fallback={null}>
      <CapturaInterna />
    </React.Suspense>
  )
}
