import 'server-only'

import { cookies } from 'next/headers'

/**
 * O que a pessoa queria quando chegou, guardado entre o cadastro e a volta do
 * e-mail de confirmação.
 *
 * Existe porque o link do e-mail de confirmação **não carrega parâmetro
 * nenhum**: ele é gerado pelo Supabase a partir do template, e o único destino
 * possível é o `emailRedirectTo` fixo. Tudo que a pessoa escolheu antes de
 * abrir a caixa de entrada, o convite que ela clicou, o plano que ela quis,
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
 * De qual campanha a pessoa veio, se veio de tráfego pago/rastreado.
 *
 * JSON compacto (chaves de 1 letra) num cookie só, em vez de três, porque os
 * três sempre nascem e morrem juntos, não tem caso de usar um sem os outros.
 */
const COOKIE_UTM = 'vf_utm'

/**
 * Sete dias: é a validade do próprio convite (`lib/workspace/actions.ts`), e
 * não faz sentido lembrar de uma intenção que já não pode ser cumprida.
 */
const VALIDADE_SEGUNDOS = 60 * 60 * 24 * 7

const BASE = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  // `secure` só em produção, em `localhost` o navegador recusaria o cookie e
  // o fluxo inteiro quebraria só no ambiente de desenvolvimento, que é o pior
  // lugar para um bug aparecer.
  secure: process.env.NODE_ENV === 'production',
}

export type PlanoDesejado = 'pro'

export type AtribuicaoUtm = {
  source?: string
  medium?: string
  campaign?: string
  /**
   * Qual PEÇA trouxe, e não só qual campanha.
   *
   * A campanha do Meta é um teste de seis ângulos apontando para o mesmo
   * `/cadastro`; só este campo os distingue. Sem ele o teste roda e não
   * conclui nada — e o relatório da Meta não substitui, porque ela sabe quem
   * se cadastrou e não quem PAGOU, que acontece dias depois no Asaas.
   */
  content?: string
  /** Id de clique do Meta, derivado do `fbclid` da URL, âncora de atribuição. */
  fbc?: string
  /** Cookie `_fbp` do próprio Pixel, âncora de identidade do navegador. */
  fbp?: string
  /**
   * Id de clique do Google Ads, vindo cru do `gclid` da URL.
   *
   * Não é transformado como o `fbc` — a Meta exige o formato
   * `fb.1.<ms>.<fbclid>`, o Google quer o valor exatamente como veio.
   *
   * É o único dado que a importação de conversão offline aceita para dizer ao
   * Google "este clique virou assinatura paga cinco dias depois". Sem ele, o
   * relatório sabe quem se cadastrou e nunca quem pagou. Ver 0071.
   */
  gclid?: string
}

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
  } else if (intencao.plano === null) {
    // `signUp` sempre manda `plano: ... ?? null`, nunca omite o campo.
    // Sem este `else if`, uma tentativa de "Assinar Pro" que falhou depois
    // (senha fraca, e-mail já existe) deixava o cookie gravado, e um
    // cadastro Free seguinte no mesmo navegador herdava a intenção Pro e
    // caía no checkout sem ninguém ter pedido isso agora.
    jar.delete(COOKIE_PLANO)
  }
  if (intencao.email) {
    // Vida mais curta: serve só para a tela seguinte dizer para onde o e-mail
    // foi e permitir reenviar. Uma hora cobre quem se distrai no meio.
    jar.set(COOKIE_EMAIL, intencao.email, { ...BASE, maxAge: 60 * 60 })
  }
}

/**
 * Guarda a campanha que trouxe a pessoa, só na PRIMEIRA vez.
 *
 * Atribuição de primeiro toque: se a pessoa vier de um anúncio, saia, e volte
 * três dias depois direto pelo nome do produto, sobrescrever aqui apagaria a
 * campanha que trouxe a visita original, que é a que gastou dinheiro pra
 * trazer ela. `maxAge` de 30 dias é a janela usual de atribuição de campanha
 * (Meta/Google usam o mesmo padrão).
 */
export async function guardarAtribuicaoUtm(utm: AtribuicaoUtm) {
  // `fbc` sozinho é comum: clique em anúncio do Meta que não levou `utm_*`
  // na URL de destino (o link do anúncio nem sempre carrega UTM) ainda
  // carrega `fbclid`, vale capturar mesmo sem os três UTMs.
  //
  // `gclid` sozinho é ainda mais comum: a marcação automática do Google Ads
  // acrescenta o parâmetro a TODA URL de destino, independentemente de alguém
  // ter escrito UTM à mão. Deixá-lo fora desta lista faria o clique de busca
  // sem UTM ser descartado inteiro — exatamente o caso em que só ele existe.
  if (
    !utm.source &&
    !utm.medium &&
    !utm.campaign &&
    !utm.content &&
    !utm.fbc &&
    !utm.fbp &&
    !utm.gclid
  ) {
    return
  }

  const jar = await cookies()
  if (jar.get(COOKIE_UTM)) return

  jar.set(COOKIE_UTM, JSON.stringify(utm), { ...BASE, maxAge: 60 * 60 * 24 * 30 })
}

export async function lerAtribuicaoUtm(): Promise<AtribuicaoUtm | null> {
  const valor = (await cookies()).get(COOKIE_UTM)?.value
  if (!valor) return null

  try {
    return JSON.parse(valor) as AtribuicaoUtm
  } catch {
    return null
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
export async function limparIntencao(quais: ('convite' | 'plano' | 'email' | 'utm')[]) {
  const jar = await cookies()
  const mapa = {
    convite: COOKIE_CONVITE,
    plano: COOKIE_PLANO,
    email: COOKIE_EMAIL,
    utm: COOKIE_UTM,
  }
  for (const qual of quais) {
    jar.delete(mapa[qual])
  }
}
