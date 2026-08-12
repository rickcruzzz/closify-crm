/**
 * Eventos de ativação — preparados, não instalados.
 *
 * O projeto tem `@vercel/analytics`, que mede PAGEVIEW. Nenhuma das perguntas
 * que importam aqui é responder quantas visitas a tela teve: o que interessa é
 * quantos que criam conta chegam ao primeiro lead. Isso é evento de produto, e
 * hoje não existe ferramenta para isso — o CLAUDE.md chegou a afirmar um
 * PostHog que não está no `package.json`.
 *
 * Em vez de instalar uma plataforma externa só por causa desta entrega, os
 * eventos são emitidos por uma função só. Quando houver ferramenta, troca-se o
 * corpo de `registrar` e nada mais no produto muda.
 */

export type EventoDeAtivacao =
  | 'onboarding_started'
  | 'onboarding_company_completed'
  | 'onboarding_segment_selected'
  | 'onboarding_skipped'
  | 'onboarding_completed'
  | 'tour_started'
  | 'tour_skipped'
  | 'tour_completed'
  | 'first_lead_created'
  | 'first_deal_created'
  | 'first_task_created'

/**
 * Nunca recebe dado pessoal.
 *
 * Nome de lead, e-mail e telefone não entram aqui: no dia em que estes eventos
 * forem para uma ferramenta de terceiro, o que já estiver sendo passado vai
 * junto — e revisar isso depois, com os pontos de chamada espalhados, é como
 * a informação vaza. Só id de workspace e escolhas do próprio onboarding.
 */
export type PropriedadesDoEvento = {
  workspaceId?: string
  segmento?: string
  modeloVenda?: string
  tamanhoEquipe?: string
  etapa?: string
}

export function registrar(evento: EventoDeAtivacao, props: PropriedadesDoEvento = {}): void {
  // Falhar aqui não pode derrubar o que a pessoa estava fazendo: telemetria
  // que quebra o cadastro é pior que telemetria nenhuma.
  try {
    console.info('[ativacao]', evento, JSON.stringify(props))
  } catch {
    // Silêncio de propósito.
  }
}
