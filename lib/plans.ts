// Constantes de plano vivem separadas de lib/limits.ts de propósito: limits.ts
// importa o client Supabase de servidor (next/headers), que não pode entrar no
// bundle do client. Componentes de UI importam daqui.
/**
 * Contatos no plano Free.
 *
 * ## Por que 50, e por que já foi 300
 *
 * Este número nasceu 50 (migration 0023) e a 0040 — de nome
 * `free_menos_apertado` — subiu para 300, sem nenhum dado de conversão para
 * apoiar a mudança, porque não havia nenhum.
 *
 * Com o funil de ativação medindo (`/dono/ativacao`, 23/08), dá para dizer o
 * que 300 significa na prática: **um teto que ninguém alcança.** Uma clínica
 * atende ~20 pacientes novos por mês, uma agência fecha 3 clientes. Levaria
 * anos para esbarrar nele. O Free deixava de ser um degrau para o Pro e virava
 * o produto final — e o resultado apareceu no número: dos cadastros, quase
 * ninguém tinha motivo para pagar.
 *
 * Com 50, o teto chega em ~2 meses de uso real: tempo suficiente para o CRM
 * virar hábito, curto o bastante para a decisão acontecer enquanto o produto
 * ainda está sendo usado todo dia.
 *
 * **Importação não é bloqueada durante o trial**, de propósito: quem tem base
 * grande precisa ver o produto cheio antes de decidir. Barrar a planilha no
 * primeiro dia mataria a avaliação antes de ela começar.
 */
export const FREE_LEAD_LIMIT = 50
export const FREE_MEMBER_LIMIT = 2

/**
 * Empresas (workspaces) que uma conta Free pode criar.
 *
 * Sem este limite, o teto de 2 colaboradores não segurava nada: bastava criar
 * uma empresa nova para cada dupla e ter equipe ilimitada de graça. Um usuário
 * de produção já tinha 4 workspaces quando isto foi detectado.
 *
 * Multi-empresa é o que o PRD posiciona como diferencial do Pro, é o recurso
 * certo para ficar atrás do pagamento.
 */
export const FREE_WORKSPACE_LIMIT = 1
export const PRO_PLAN_PRICE = 49
export const FREE_PLAN_PRICE = 0
