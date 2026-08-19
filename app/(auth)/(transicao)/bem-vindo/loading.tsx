import { AuthCarregando } from '@/components/auth/auth-carregando'

// `bem-vindo/page.tsx` é Server Component com até 3 idas ao banco (usuário,
// convite pendente, estado do onboarding) antes de renderizar qualquer coisa.
// Sem este fallback, chegar aqui ficava sem nenhum sinal visual até essas
// consultas terminarem.
//
// A casca (logo, centralização) vem do layout do grupo `(transicao)`: o
// fallback de Suspense é renderizado dentro dele, então este cartão não
// aparece mais solto no canto da tela.
export default function BemVindoLoading() {
  return <AuthCarregando />
}
