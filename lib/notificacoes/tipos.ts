/**
 * Os tipos de notificação que o produto sabe dar, e o texto de cada um.
 *
 * ## Por que a lista é fechada
 *
 * A tabela (0066) tem `check` no `tipo`, então acrescentar um exige migration.
 * É deliberado: a lição de 20/08 é que fila com item sem valor dentro ensina a
 * pessoa a ignorar a fila inteira — e quando isso acontece, junto com o item
 * chato vai embora o alerta de dinheiro.
 *
 * O critério de entrada, então, é único: **só vira notificação o que já
 * provou valer um e-mail.** Cada tipo abaixo tem um `lib/emails/*.ts`
 * correspondente, ou um erro gravado em `last_error` que hoje ninguém vê.
 *
 * O que NÃO entra, e é a metade mais importante da regra: nada do que a
 * própria pessoa acabou de fazer. "Você criou um contato" é a forma mais
 * rápida de treinar alguém a nunca mais abrir o sino.
 *
 * Dois candidatos óbvios foram recusados por essa regra, e vale registrar
 * quais para ninguém "completar a lista" depois:
 *
 *     whatsapp_caiu     a integracao esta em FASE_DO_WHATSAPP = 'migrando' e o
 *                       e-mail que avisava disso nao existe mais. Tipo sem
 *                       chamador e codigo morto com aparencia de recurso.
 *     limite_do_plano   `lib/leads/actions.ts` ja trata o 42501 e devolve a
 *                       mensagem NA TELA, no mesmo segundo. Repetir no sino
 *                       seria avisar sobre o que a pessoa acabou de fazer.
 */
export const TIPOS_DE_NOTIFICACAO = [
  'pagamento_confirmado',
  'pagamento_atrasado',
  'plano_vencendo',
  'trial_terminando',
  /**
   * O único tipo que não é dinheiro nem prazo.
   *
   * Entrou a pedido do dono, contra a regra escrita em `sino.tsx` ("só entra o
   * que já provou valer um e-mail"). A ressalva inteira está na migration 0081,
   * que é também onde o `check` do banco passou a aceitar este valor.
   *
   * **As duas listas precisam concordar, e já divergiram.** Em 08/09 este
   * arquivo trazia `sinal_de_mercado` e o banco não: compilava, e dava 400 em
   * produção. É o caso logo abaixo.
   */
  'convite_instagram',
  // `sinal_de_mercado` esteve aqui entre 07 e 08/09, e saiu junto com a
  // pesquisa de mercado do lado do cliente (0075). Fica registrado para
  // ninguém recolocar sem o recurso: tipo sem chamador é código morto com
  // aparência de recurso, a mesma razão que já recusou `whatsapp_caiu`.
] as const

export type TipoDeNotificacao = (typeof TIPOS_DE_NOTIFICACAO)[number]

export type Notificacao = {
  id: string
  tipo: TipoDeNotificacao
  titulo: string
  corpo: string | null
  href: string | null
  criadaEm: string
  lidaEm: string | null
}

/**
 * A gravidade decide a cor do ponto, e ela é sobre DINHEIRO, não sobre
 * urgência genérica.
 *
 * `alta` é o que custa acesso ou receita se ninguém agir. `media` é o que a
 * pessoa precisa saber mas não trava nada. Não existe `baixa`: aviso que não
 * merece uma das duas não merecia notificação nenhuma.
 */
export type Gravidade = 'alta' | 'media'

export function gravidadeDe(tipo: TipoDeNotificacao): Gravidade {
  switch (tipo) {
    case 'pagamento_atrasado':
    case 'plano_vencendo':
    case 'trial_terminando':
      return 'alta'
    // `media`, e isso é decisão: gravidade aqui é sobre DINHEIRO que se perde
    // se ninguém agir. Tudo que a pessoa precisa saber mas que não trava nada
    // fica aqui — pintar de vermelho o que não custa dissolveria a distinção
    // que faz o ponto vermelho significar alguma coisa.
    default:
      return 'media'
  }
}

/**
 * Quanto tempo faz, em português e sem biblioteca.
 *
 * Arredonda para baixo de propósito: "há 2 horas" para 2h59 é mais honesto que
 * "há 3 horas", porque a pessoa compara com o relógio dela.
 */
export function tempoRelativo(iso: string, agora = new Date()): string {
  const minutos = Math.floor((agora.getTime() - new Date(iso).getTime()) / 60_000)

  if (minutos < 1) return 'agora'
  if (minutos < 60) return `há ${minutos} min`

  const horas = Math.floor(minutos / 60)
  if (horas < 24) return horas === 1 ? 'há 1 hora' : `há ${horas} horas`

  const dias = Math.floor(horas / 24)
  if (dias < 7) return dias === 1 ? 'ontem' : `há ${dias} dias`

  const semanas = Math.floor(dias / 7)
  if (semanas < 5) return semanas === 1 ? 'há 1 semana' : `há ${semanas} semanas`

  const meses = Math.floor(dias / 30)
  return meses <= 1 ? 'há 1 mês' : `há ${meses} meses`
}
