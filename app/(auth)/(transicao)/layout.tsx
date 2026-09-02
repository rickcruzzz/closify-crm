import { AuthShell } from '@/components/auth/auth-shell'
import { CapturaDeComponente } from '@/components/erros/captura-de-componente'

/**
 * As seis telas de estado curto do fluxo, centradas.
 *
 * A casca aqui, e não importada por cada página, é o que faz os `loading.tsx`
 * de bem-vindo e onboarding herdarem logo e centralização: o fallback de
 * `<Suspense>` é renderizado dentro do layout do segmento, então o cartão de
 * "Preparando…" deixa de aparecer solto no canto da tela.
 *
 * ## Por que a captura de componente veio para cá
 *
 * Achado na auditoria de 02/09, lendo `error_logs`: os React #310 deste
 * projeto acontecem em `/onboarding` e `/bem-vindo`, e todos chegam com
 * `origem: 'global'` e `component_stack` VAZIO.
 *
 *     02/09 18:49  /onboarding   interno
 *     24/08 18:28  /bem-vindo    interno
 *     24/08 16:46  /onboarding   EXTERNO
 *
 * `origem: global` significa que o erro subiu até `app/global-error.tsx` — nem
 * o `error.tsx` de rota pegou. E o Next **não passa `componentStack` para o
 * `error.tsx`**: só um boundary de classe recebe `errorInfo.componentStack`,
 * via `componentDidCatch`.
 *
 * A correção de 02/09 de madrugada desceu `CapturaDeComponente` para dentro da
 * página do Kanban, onde os #185 apareciam. Mas os #310 nascem AQUI, noutro
 * route group, e ficaram de fora — a coluna `component_stack` existe desde a
 * 0058 justamente para nomear o componente, e continuava vazia.
 *
 * #310 é "Rendered more hooks than during the previous render": hook chamado
 * condicionalmente. O assistente de onboarding tem quatro passos e estado que
 * muda entre eles, que é exatamente onde esse defeito mora. **Na próxima
 * ocorrência o nome do componente chega**, e a busca vira consulta.
 *
 * O terceiro registro é `interno: false` — alguém de fora bateu nisso.
 */
export default function TransicaoLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthShell>
      <CapturaDeComponente origem="publico">{children}</CapturaDeComponente>
    </AuthShell>
  )
}
