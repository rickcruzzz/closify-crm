import { z } from 'zod'

export const memberRoleSchema = z.enum(['admin', 'membro'])

export const inviteMemberSchema = z.object({
  // `trim` e `toLowerCase` antes da validação: o índice único de convites
  // pendentes é `(workspace_id, email)` sobre o texto cru, então `ana@x.com` e
  // `Ana@X.com` criavam DOIS convites para a mesma pessoa — e cada um consome
  // uma vaga do limite de membros do plano, porque `canAddMember` soma
  // convites pendentes aos membros ativos.
  //
  // Também alinha a escrita com a leitura: `accept_workspace_invite` já
  // compara os e-mails com `lower()` dos dois lados.
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Informe o e-mail.')
    .pipe(z.email('E-mail inválido.')),
  role: memberRoleSchema,
})

// Tokens e ids que chegam por Server Action vêm da rede: validar como uuid
// evita mandar lixo pro Postgres e receber erro de cast cru de volta.
export const uuidSchema = z.string().uuid('Identificador inválido.')

export type InviteMemberValues = z.infer<typeof inviteMemberSchema>

export const updateWorkspaceNameSchema = z.object({
  name: z.string().min(2, 'Informe o nome da empresa.'),
})

export type UpdateWorkspaceNameValues = z.infer<typeof updateWorkspaceNameSchema>
