import { z } from 'zod'

import { senhaDerivadaDoEmail } from '@/lib/password-strength'

/**
 * Mensagem única para a senha derivada do e-mail.
 *
 * Usada pelos três schemas que criam ou trocam senha. Escrita uma vez para não
 * divergirem — o tipo de diferença que faz a mesma recusa aparecer com texto
 * diferente dependendo da tela, e a pessoa achar que são dois problemas.
 *
 * Diz o que fazer, não o que está errado no mundo: quem está tentando entrar
 * quer saber qual é o próximo passo, não uma aula sobre segurança.
 */
const ERRO_SENHA_IGUAL_AO_EMAIL =
  'A senha não pode conter o seu e-mail de login. Escolha outra senha.'

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
  // Aqui o e-mail já está no próprio formulário, então não precisa vir de fora.
  .refine((dados) => !senhaDerivadaDoEmail(dados.password, dados.email), {
    message: ERRO_SENHA_IGUAL_AO_EMAIL,
    path: ['password'],
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

/**
 * O e-mail acompanha o formulário de senha sem aparecer na tela.
 *
 * As telas de redefinir e de definir senha não perguntam o e-mail — a pessoa
 * já está identificada pela sessão. Mas a validação precisa dele para recusar
 * "senha igual ao e-mail", então ele entra como valor inicial escondido, vindo
 * da sessão.
 *
 * Opcional de propósito: se por qualquer motivo a sessão não trouxer o
 * endereço, a validação de tamanho e de confirmação continua valendo. Recusar
 * a troca de senha inteira porque não deu para conferir uma regra seria pior.
 */
const emailDaSessao = z.string().optional()

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, 'A senha precisa ter no mínimo 8 caracteres.'),
    confirmPassword: z.string().min(1, 'Confirme sua senha.'),
    email: emailDaSessao,
  })
  .refine((dados) => dados.password === dados.confirmPassword, {
    message: 'As senhas não coincidem.',
    path: ['confirmPassword'],
  })
  .refine((dados) => !senhaDerivadaDoEmail(dados.password, dados.email), {
    message: ERRO_SENHA_IGUAL_AO_EMAIL,
    path: ['password'],
  })

export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>

// Quem entra pelo Google não tem senha: a autenticação é o próprio provedor.
// Definir uma aqui é opcional e serve como via reserva, para a pessoa não
// depender da conta Google para sempre. Mesmas regras do cadastro comum.
export const definirSenhaSchema = z
  .object({
    password: z.string().min(8, 'A senha precisa ter no mínimo 8 caracteres.'),
    confirmPassword: z.string().min(1, 'Confirme sua senha.'),
    email: emailDaSessao,
  })
  .refine((dados) => dados.password === dados.confirmPassword, {
    message: 'As senhas não coincidem.',
    path: ['confirmPassword'],
  })
  .refine((dados) => !senhaDerivadaDoEmail(dados.password, dados.email), {
    message: ERRO_SENHA_IGUAL_AO_EMAIL,
    path: ['password'],
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
