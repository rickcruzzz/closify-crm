/**
 * A decisão de consentimento, isolada do React.
 *
 * Vive separada do componente por dois motivos. O primeiro é o de sempre neste
 * projeto: regra que dá para testar sem montar árvore de componente é regra que
 * fica testada. O segundo é específico daqui — o pixel precisa consultar essa
 * decisão antes de existir, e um hook não serve para isso.
 *
 * ## Por que isto passou a existir
 *
 * O Meta Pixel grava cookie de terceiro (`_fbp`) e é rastreamento de marketing
 * sob a LGPD. A ANPD, no guia orientativo de cookies, trata cookie não
 * estritamente necessário como dependente de consentimento — e recomenda
 * explicitamente que recusar seja tão fácil quanto aceitar, com o disparo
 * bloqueado até a escolha. O produto rodava sem nada disso, registrado como
 * risco em aberto no próprio `meta-pixel.tsx` e em `docs/estado-atual.md`.
 *
 * Fechar isso deixou de ser opcional no momento em que o tráfego pago entrou no
 * plano: anunciar é justamente o que transforma um risco de conformidade
 * adormecido em exposição real, com volume.
 */

export type Consentimento = 'aceito' | 'recusado'

/**
 * Chave versionada de propósito.
 *
 * Se um dia a finalidade do rastreamento mudar (outro provedor, outro escopo),
 * o consentimento antigo deixa de valer para a finalidade nova — a LGPD pede
 * consentimento específico. Subir o número aqui refaz a pergunta a todo mundo,
 * em vez de herdar um "sim" que foi dado para outra coisa.
 */
export const CHAVE_CONSENTIMENTO = 'vf_consentimento_v1'

/**
 * Interpreta o que está guardado.
 *
 * Devolve `null` para "ainda não decidiu", que é diferente de "recusou": só o
 * primeiro faz o banner aparecer. Qualquer valor estranho (lixo, chave de outra
 * versão, alguém editando o storage à mão) também vira `null` — na dúvida,
 * perguntar de novo é o comportamento seguro, e nunca assumir aceite.
 */
export function interpretarConsentimento(valor: string | null): Consentimento | null {
  if (valor === 'aceito' || valor === 'recusado') return valor
  return null
}

/** Só carrega o pixel quem disse sim explicitamente. */
export function podeRastrear(valor: string | null): boolean {
  return interpretarConsentimento(valor) === 'aceito'
}

/**
 * O mesmo consentimento, num cookie que o SERVIDOR consegue ler.
 *
 * ## O buraco que isto fecha
 *
 * A decisão vive em `localStorage`, e o servidor não lê `localStorage`. O
 * resultado, medido no código: **os seis eventos da Conversions API disparavam
 * independentemente do banner**. Quem clicava "Recusar" e se cadastrava tinha
 * e-mail, telefone, nome, cidade, estado, CEP e `external_id` enviados à Meta
 * do mesmo jeito — hasheados, mas enviados.
 *
 * O pixel do navegador sempre respeitou, com duas cercas. A CAPI nunca
 * consultou nada, e é ela que manda o dado pessoal.
 *
 * ## Por que um cookie espelho, e não trocar o `localStorage`
 *
 * Trocar significaria reescrever as duas cercas do pixel, que funcionam e
 * foram provadas com controle negativo em 30/08. O cookie ANDA JUNTO: mesma
 * chave versionada, mesmo valor, escrito no mesmo instante.
 *
 * `httpOnly: false` de propósito — não é segredo, é a escolha da pessoa, e o
 * cliente precisa lê-lo para manter as duas fontes em sincronia.
 */
export const COOKIE_CONSENTIMENTO = CHAVE_CONSENTIMENTO

/** Um ano: o mesmo prazo que a LGPD considera razoável para renovar a pergunta. */
export const MAX_AGE_CONSENTIMENTO = 365 * 24 * 60 * 60

/**
 * Lê o consentimento de uma string de cookies (`document.cookie` ou o header).
 *
 * Recebe a string em vez de ir buscá-la para continuar sendo função pura:
 * roda igual no servidor, no cliente e no teste, sem mock.
 */
export function lerConsentimentoDoCookie(cookies: string | null | undefined): Consentimento | null {
  if (!cookies) return null
  for (const parte of cookies.split(';')) {
    const [nome, ...resto] = parte.trim().split('=')
    if (nome === COOKIE_CONSENTIMENTO) {
      return interpretarConsentimento(decodeURIComponent(resto.join('=')))
    }
  }
  return null
}
