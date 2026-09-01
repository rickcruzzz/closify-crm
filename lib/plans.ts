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

/**
 * A mediana do que os concorrentes cobram POR USUÁRIO, em reais.
 *
 * ## Não é o nosso preço, e por isso vive aqui e não em `CONTROLADOR`
 *
 * É a âncora que faz R$ 49 ser lido como barato. Sem ela o cérebro compara com
 * R$ 0 e qualquer preço perde; com ela, compara com o que a equipe custaria
 * em qualquer outro CRM.
 *
 * ## De onde sai, e por que a data importa
 *
 * Tabela pública, conferida em 31/08/2026:
 *
 *     Agendor       53    por usuario
 *     Moskit        59    por usuario
 *     RD Station   ~60    por usuario
 *     Ploomes      ~75    R$ 225 para 3 usuarios
 *     Pipedrive    ~80    US$ 14,90
 *
 * Mediana: 60. É preço publicado por eles, então pode ser dito — não é prova
 * social inventada, é aritmética sobre número que qualquer um confere no site
 * deles.
 *
 * **Preço de concorrente envelhece**, e esta é a mesma classe de defeito do
 * CNPJ baixado que ficou 17 dias exibido na landing: dado externo que não
 * acompanha mudança de estado, e nenhum `tsc` ou `test` consulta a tabela de
 * ninguém. A data fica no código e na tela, e a conferência é manual.
 */
export const PRECO_MEDIANA_POR_USUARIO = 60

/** Quando os preços acima foram conferidos. Aparece na landing. */
export const PRECOS_CONFERIDOS_EM = '31/08/2026'
export const FREE_PLAN_PRICE = 0
