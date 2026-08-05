import { z } from 'zod'

export const inviteMemberSchema = z.object({
  email: z.string().min(1, 'Informe o e-mail.').pipe(z.email('E-mail inválido.')),
  role: z.enum(['admin', 'membro']),
})

export type InviteMemberValues = z.infer<typeof inviteMemberSchema>

export const updateWorkspaceNameSchema = z.object({
  name: z.string().min(2, 'Informe o nome da empresa.'),
})

export type UpdateWorkspaceNameValues = z.infer<typeof updateWorkspaceNameSchema>
