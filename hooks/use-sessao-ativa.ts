'use client'

import * as React from 'react'

/**
 * O prefixo do cookie de sessão do `@supabase/ssr`, derivado da URL pública.
 *
 * O formato é `sb-<ref-do-projeto>-auth-token`, e o `<ref>` é o subdomínio da
 * `NEXT_PUBLIC_SUPABASE_URL`. Derivar em vez de escrever à mão é a mesma lição
 * da CSP de 31/08: o valor escrito literalmente sobrevive até a próxima troca
 * de projeto e quebra em silêncio — o que já aconteceu, na migração para São
 * Paulo em 12/08.
 *
 * O cookie é FATIADO quando o token passa do limite de tamanho (`...auth-token.0`,
 * `.1`), então a checagem é por prefixo e não por nome exato.
 */
function prefixoDoCookieDeSessao(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return null
  try {
    const ref = new URL(url).hostname.split('.')[0]
    return ref ? `sb-${ref}-auth-token` : null
  } catch {
    return null
  }
}

/**
 * Se existe sessão, para a landing saber o que o botão deve dizer.
 *
 * ## Por que lê o COOKIE, e não o cliente do Supabase
 *
 * A versão anterior chamava `supabase.auth.getSession()`, e o comentário dela
 * afirmava que isso "lê o cookie local sem ida à rede". **Era falso**, e as
 * duas metades custaram caro, medidas em produção em 02/09:
 *
 *     chunk 9086   193 KB descomprimido, com GoTrueClient dentro
 *     console      400 em /auth/v1/token?grant_type=refresh_token
 *
 * O primeiro: importar `createClient` arrastava o `@supabase/supabase-js` +
 * `@supabase/ssr` inteiros para o bundle da landing — o segundo maior pedaço
 * de JavaScript da página que recebe o tráfego pago, para escolher o rótulo de
 * um botão.
 *
 * O segundo: com o access token expirado, `getSession()` **renova**, o que é
 * uma ida à rede. Todo visitante de volta com sessão velha pagava um
 * round-trip que ainda devolvia 400 no console.
 *
 * Ler o cookie é o que o comentário sempre disse fazer, custa zero e não
 * importa nada. A resposta é mais fraca — a presença do cookie não prova que o
 * token é válido —, e isso está certo para esta pergunta: o destino do botão é
 * decidido pelo `middleware.ts`, que valida de verdade. Se o cookie estiver
 * morto, a pessoa é mandada ao login pelo caminho normal.
 *
 * ## O padrão é "deslogado", e isso evita o pisca
 *
 * Começa em `null` (não sei) e a navbar mostra "Entrar", que é o caso da quase
 * totalidade de quem chega na landing. Quando a resposta vem, só quem TEM
 * sessão vê o rótulo mudar — e essa pessoa já conhece o produto.
 *
 * O inverso (assumir logado) faria todo visitante ver o texto trocar,
 * incluindo quem chegou de anúncio e nunca ouviu falar daqui.
 */
export function useSessaoAtiva(): boolean | null {
  const [logado, setLogado] = React.useState<boolean | null>(null)

  React.useEffect(() => {
    const prefixo = prefixoDoCookieDeSessao()
    if (!prefixo) {
      setLogado(false)
      return
    }

    try {
      const tem = document.cookie
        .split('; ')
        .some((c) => c.startsWith(prefixo) && c.split('=')[1])
      setLogado(tem)
    } catch {
      // Cookie bloqueado por política do navegador: cai no padrão, que é o
      // caso da maioria e leva ao login de qualquer forma.
      setLogado(false)
    }
  }, [])

  return logado
}
