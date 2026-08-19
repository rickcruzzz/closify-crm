import { AuthCarregando } from '@/components/auth/auth-carregando'

// `onboarding/page.tsx` é Server Component com 3 idas ao banco (usuário,
// estado do onboarding, workspaces) antes de renderizar qualquer coisa, sem
// este fallback o clique em "Começar configuração" ficava sem nenhum sinal
// visual até essas consultas terminarem.
export default function OnboardingLoading() {
  return <AuthCarregando />
}
