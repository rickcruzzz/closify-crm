// Constantes de plano vivem separadas de lib/limits.ts de propósito: limits.ts
// importa o client Supabase de servidor (next/headers), que não pode entrar no
// bundle do client. Componentes de UI importam daqui.
export const FREE_LEAD_LIMIT = 50
export const FREE_MEMBER_LIMIT = 2

/**
 * Empresas (workspaces) que uma conta Free pode criar.
 *
 * Sem este limite, o teto de 2 colaboradores não segurava nada: bastava criar
 * uma empresa nova para cada dupla e ter equipe ilimitada de graça. Um usuário
 * de produção já tinha 4 workspaces quando isto foi detectado.
 *
 * Multi-empresa é o que o PRD posiciona como diferencial do Pro — é o recurso
 * certo para ficar atrás do pagamento.
 */
export const FREE_WORKSPACE_LIMIT = 1
export const PRO_PLAN_PRICE = 49
export const FREE_PLAN_PRICE = 0
