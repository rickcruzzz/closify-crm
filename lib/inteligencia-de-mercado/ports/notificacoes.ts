/**
 * A porta do sino.
 *
 * O módulo NÃO chama `lib/notificacoes/registrar.ts` direto: chama esta
 * interface, e o adapter faz a ponte. Assim o domínio continua testável sem
 * banco, e a regra de "um único ponto de escrita de notificação" continua
 * valendo do outro lado.
 *
 * O tipo `sinal_de_mercado` precisa entrar no `check` da migration 0066 antes
 * de qualquer chamada funcionar — e isso é de propósito: naquele arquivo está
 * escrito que "entrar na lista vira decisão".
 */

export type AvisoDeSinal = {
  workspaceId: string
  leadId: string
  titulo: string
  corpo: string
  href: string
}

export type PortaDeNotificacoes = {
  avisar(aviso: AvisoDeSinal): Promise<void>
}
