import 'server-only'

import { cookies } from 'next/headers'

/**
 * O que a pessoa queria quando chegou, guardado entre o cadastro e a volta do
 * e-mail de confirmação.
 *
 * Existe porque o link do e-mail de confirmação **não carrega parâmetro
 * nenhum**: ele é gerado pelo Supabase a partir do template, e o único destino
 * possível é o `emailRedirectTo` fixo. Tudo que a pessoa escolheu antes de
 * abrir a caixa de entrada — o convite que ela clicou, o plano que ela quis —
 * morre ali, a menos que atravesse por fora da URL.
 *
 * Dois defeitos reais vieram dessa travessia perdida:
 *
 * 1. **Convite virando conta separada.** O botão "Criar conta" da tela de
 *    convite apontava para `/cadastro` sem o token. A pessoa cadastrava,
 *    confirmava o e-mail, caía em `/onboarding` e criava a PRÓPRIA empresa. O
 *    convite ficava `pending` para sempre, e quem convidou via "pendente" no
 *    painel sem entender por quê.
 *
 * 2. **Intenção de compra descartada.** "Assinar Pro" e "Começar grátis"
 *    apontavam para o mesmo `/cadastro`. Quem clicou em Pro terminava no
 *    dashboard em Free, tendo que descobrir Configurações → Cobrança sozinho.
 *
 * Cookie e não querystring, de propósito: o e-mail e o token do convite
 * apareceriam no histórico do navegador e no cabeçalho `Referer` de toda
 * requisição a partir daquela página. `httpOnly` porque nenhum script de tela
 * precisa ler isto.
 */

/** Token do convite que trouxe a pessoa até o cadastro. */
const COOKIE_CONVITE = 'vf_convite'
/** Plano que a pessoa escolheu na landing antes de ter conta. */
const COOKIE_PLANO = 'vf_plano'
/** Para onde o e-mail de confirmação foi, exibido em `/verifique-email`. */
const COOKIE_EMAIL = 'vf_email_pendente'

/**
 * Sete dias: é a validade do próprio convite (`lib/workspace/actions.ts`), e
 * não faz sentido lembrar de uma intenção que já não pode ser cumprida.
 */
const VALIDADE_SEGUNDOS = 60 * 60 * 24 * 7

const BASE = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  // `secure` só em produção — em `localhost` o navegador recusaria o cookie e
  // o fluxo inteiro quebraria só no ambiente de desenvolvimento, que é o pior
  // lugar para um bug aparecer.
  secure: process.env.NODE_ENV === 'production',
}

export type PlanoDesejado = 'pro'

export async function guardarIntencao(intencao: {
  convite?: string | null
  plano?: PlanoDesejado | null
  email?: string | null
}) {
  const jar = await cookies()

  if (intencao.convite) {
    jar.set(COOKIE_CONVITE, intencao.convite, { ...BASE, maxAge: VALIDADE_SEGUNDOS })
  }
  if (intencao.plano) {
    jar.set(COOKIE_PLANO, intencao.plano, { ...BASE, maxAge: VALIDADE_SEGUNDOS })
  }
  if (intencao.email) {
    // Vida mais curta: serve só para a tela seguinte dizer para onde o e-mail
    // foi e permitir reenviar. Uma hora cobre quem se distrai no meio.
    jar.set(COOKIE_EMAIL, intencao.email, { ...BASE, maxAge: 60 * 60 })
  }
}

export async function lerConvitePendente(): Promise<string | null> {
  return (await cookies()).get(COOKIE_CONVITE)?.value ?? null
}

export async function lerPlanoDesejado(): Promise<PlanoDesejado | null> {
  return (await cookies()).get(COOKIE_PLANO)?.value === 'pro' ? 'pro' : null
}

export async function lerEmailPendente(): Promise<string | null> {
  return (await cookies()).get(COOKIE_EMAIL)?.value ?? null
}

/**
 * Apaga a intenção depois de cumprida.
 *
 * Deixar para trás faria a próxima navegação repetir o desvio: quem já aceitou
 * o convite seria mandado de volta para a tela de convite, e quem já pagou
 * cairia de novo no checkout.
 */
export async function limparIntencao(quais: ('convite' | 'plano' | 'email')[]) {
  const jar = await cookies()
  const mapa = { convite: COOKIE_CONVITE, plano: COOKIE_PLANO, email: COOKIE_EMAIL }
  for (const qual of quais) {
    jar.delete(mapa[qual])
  }
}
