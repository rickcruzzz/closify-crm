// Constantes de plano vivem separadas de lib/limits.ts de propósito: limits.ts
// importa o client Supabase de servidor (next/headers), que não pode entrar no
// bundle do client. Componentes de UI importam daqui.
export const FREE_LEAD_LIMIT = 50
export const FREE_MEMBER_LIMIT = 2
export const PRO_PLAN_PRICE = 49
export const FREE_PLAN_PRICE = 0
