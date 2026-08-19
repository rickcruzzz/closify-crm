import { AuthShell } from '@/components/auth/auth-shell'

/**
 * As seis telas de estado curto do fluxo, centradas.
 *
 * A casca aqui, e não importada por cada página, é o que faz os `loading.tsx`
 * de bem-vindo e onboarding herdarem logo e centralização: o fallback de
 * `<Suspense>` é renderizado dentro do layout do segmento, então o cartão de
 * "Preparando…" deixa de aparecer solto no canto da tela.
 */
export default function TransicaoLayout({ children }: { children: React.ReactNode }) {
  return <AuthShell>{children}</AuthShell>
}
