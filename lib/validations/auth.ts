import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().min(1, 'Informe seu e-mail.').pipe(z.email('E-mail inválido.')),
  password: z.string().min(1, 'Informe sua senha.'),
})

export type LoginValues = z.infer<typeof loginSchema>

export const signUpSchema = z.object({
  name: z.string().min(2, 'Informe seu nome completo.'),
  email: z.string().min(1, 'Informe seu e-mail.').pipe(z.email('E-mail inválido.')),
  password: z.string().min(8, 'A senha precisa ter no mínimo 8 caracteres.'),
  terms: z.literal(true, {
    error: 'Você precisa aceitar os termos para continuar.',
  }),
})

export type SignUpValues = z.infer<typeof signUpSchema>

export const onboardingSchema = z.object({
  workspaceName: z.string().min(2, 'Informe o nome da sua empresa.'),
})

export type OnboardingValues = z.infer<typeof onboardingSchema>

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'Informe seu e-mail.').pipe(z.email('E-mail inválido.')),
})

export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>

export const resetPasswordSchema = z.object({
  password: z.string().min(8, 'A senha precisa ter no mínimo 8 caracteres.'),
})

export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>
