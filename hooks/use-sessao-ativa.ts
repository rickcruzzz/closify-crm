'use client'

import * as React from 'react'

import { createClient } from '@/lib/supabase/client'

/**
 * Se existe sessão, para a landing saber o que o botão deve dizer.
 *
 * ## Por que no navegador, e não no servidor
 *
 * Ler a sessão num Server Component tornaria `/` **dinâmica**. A landing é o
 * LCP da página que recebe tráfego pago, e trocar a entrega estática do CDN
 * por uma função por visita é caro justamente onde mais dói — a correção de
 * região de 22/08 existiu para derrubar esse tipo de custo, não para
 * reintroduzi-lo.
 *
 * ## O padrão é "deslogado", e isso evita o pisca
 *
 * Começa em `null` (não sei) e a navbar mostra "Entrar", que é o caso da
 * quase totalidade de quem chega na landing. Quando a resposta vem, só quem
 * TEM sessão vê o rótulo mudar — e essa pessoa já conhece o produto, então a
 * troca não a confunde.
 *
 * O inverso (assumir logado) faria todo visitante ver o texto trocar,
 * incluindo quem chegou de anúncio e nunca ouviu falar daqui.
 */
export function useSessaoAtiva(): boolean | null {
  const [logado, setLogado] = React.useState<boolean | null>(null)

  React.useEffect(() => {
    let vivo = true
    const supabase = createClient()

    // `getSession` e não `getUser`: aqui basta saber SE há sessão, e
    // `getSession` lê o cookie local sem ida à rede. `getUser` valida contra o
    // servidor, o que é indispensável para autorizar e desnecessário para
    // escolher o texto de um botão.
    supabase.auth.getSession().then(({ data }) => {
      if (vivo) setLogado(Boolean(data.session))
    })

    return () => {
      vivo = false
    }
  }, [])

  return logado
}
