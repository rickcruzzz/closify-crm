import { z } from 'zod'

export const memberRoleSchema = z.enum(['admin', 'membro'])

export const inviteMemberSchema = z.object({
  email: z.string().min(1, 'Informe o e-mail.').pipe(z.email('E-mail inválido.')),
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
