export const ENTERPRISE_COLABORADORES = 5
export const ENTERPRISE_MEMBER_LIMIT = ENTERPRISE_COLABORADORES + 1

/** O proprietário não consome vaga; outros administradores também são colaboradores. */
export function ocupacaoDeColaboradoresEnterprise(
  members: readonly { user_id: string }[],
  invites: readonly { expires_at: string }[],
  ownerId?: string | null,
  agora: Date = new Date(),
): number {
  const colaboradores = members.filter((member) => member.user_id !== ownerId).length
  const reservas = invites.filter((invite) => new Date(invite.expires_at) > agora).length
  return colaboradores + reservas
}
