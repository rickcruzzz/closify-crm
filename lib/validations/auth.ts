import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().min(1, 'Informe seu e-mail.').pipe(z.email('E-mail inválido.')),
  password: z.string().min(1, 'Informe sua senha.'),
})

export type LoginValues = z.infer<typeof loginSchema>

export const signUpSchema = z
  .object({
    name: z.string().min(2, 'Informe seu nome completo.'),
    email: z.string().min(1, 'Informe seu e-mail.').pipe(z.email('E-mail inválido.')),
    password: z.string().min(8, 'A senha precisa ter no mínimo 8 caracteres.'),
    confirmPassword: z.string().min(1, 'Confirme sua senha.'),
    terms: z.literal(true, {
      error: 'Você precisa aceitar os termos para continuar.',
    }),
    // De onde a pessoa veio. Não são campos do formulário — chegam pela URL
    // (`/cadastro?convite=...` ou `?plano=pro`) e a Server Action os guarda em
    // cookie para sobreviverem à ida ao e-mail de confirmação.
    //
    // Opcionais e tolerantes: link torto não pode impedir alguém de criar
    // conta. Um token inválido simplesmente não encontra convite depois, e a
    // pessoa segue pelo caminho normal.
    convite: z.uuid().optional(),
    plano: z.literal('pro').optional(),
  })
  // O erro precisa apontar para o campo de confirmação, não para o formulário
  // inteiro: senão a mensagem aparece longe do campo que a pessoa tem que
  // corrigir.
  .refine((dados) => dados.password === dados.confirmPassword, {
    message: 'As senhas não coincidem.',
    path: ['confirmPassword'],
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

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, 'A senha precisa ter no mínimo 8 caracteres.'),
    confirmPassword: z.string().min(1, 'Confirme sua senha.'),
  })
  .refine((dados) => dados.password === dados.confirmPassword, {
    message: 'As senhas não coincidem.',
    path: ['confirmPassword'],
  })

export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>

// Quem entra pelo Google não tem senha: a autenticação é o próprio provedor.
// Definir uma aqui é opcional e serve como via reserva, para a pessoa não
// depender da conta Google para sempre. Mesmas regras do cadastro comum.
export const definirSenhaSchema = z
  .object({
    password: z.string().min(8, 'A senha precisa ter no mínimo 8 caracteres.'),
    confirmPassword: z.string().min(1, 'Confirme sua senha.'),
  })
  .refine((dados) => dados.password === dados.confirmPassword, {
    message: 'As senhas não coincidem.',
    path: ['confirmPassword'],
  })

export type DefinirSenhaValues = z.infer<typeof definirSenhaSchema>

// O nome vai para `user_metadata.name`, que é de onde
// `get_workspace_member_names` lê o nome exibido na lista de colaboradores e
// como autor de atividade — por isso o mínimo de 2 caracteres, igual ao
// cadastro: um nome de uma letra deixaria a timeline ilegível.
export const perfilSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome completo.').max(80, 'Nome muito longo.'),
})

export type PerfilValues = z.infer<typeof perfilSchema>
