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

/**
 * Empresas que o Pro cobre, todas com os recursos Pro.
 *
 * ## O que este número conserta (09/09)
 *
 * O plano era do WORKSPACE: quem pagava criava a segunda empresa e ela nascia
 * Free, com teto de 50 contatos — dentro de um plano já comprado. E a tela
 * dizia "Empresas ilimitadas" em três lugares.
 *
 * Cinco saiu da base, não de gosto. Contados os admins em 09/09: 41 pessoas
 * com uma empresa, 3 com duas, 1 com três, ninguém com quatro. Cinco cobre com
 * folga o caso brasileiro comum — o dono da marcenaria que também tem a loja —
 * e barra a agência com vinte clientes, que levaria vinte CRMs por R$ 49.
 *
 * O teto é aplicado na CRIAÇÃO (migration 0078), num lugar só. `pro_vigente()`
 * não conta empresas de propósito: duas regras contando a mesma coisa acabam
 * discordando, e é assim que um limite vira decorativo.
 */
export const PRO_WORKSPACE_LIMIT = 5
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

/**
 * ## O plano anual, e por que o preço é DERIVADO
 *
 * A oferta é "paga 10, leva 12". O preço é consequência dela, nunca o
 * contrário — e é isso que impede a copy de mentir: "dois meses grátis" sai de
 * `PRO_ANUAL_MESES - PRO_ANUAL_MESES_COBRADOS`, exato por construção. Escrever
 * `= 490` literal deixaria os dois livres para divergir no dia em que alguém
 * mexesse num e não no outro, e a frase continuaria na tela.
 *
 * É a mesma disciplina de `lib/marketing/oferta-nas-artes.test.ts`: derivar de
 * constante protege contra mudança de VALOR; derivar da OFERTA protege contra
 * mudança de oferta, que é o erro mais caro dos dois.
 *
 * ## Por que ele existe
 *
 * Venda presencial. Uma visita custa cerca de uma hora entre deslocamento,
 * demonstração e retorno, e fecha em 10% a 20% — cinco a dez horas por cliente.
 * A R$ 49 isso não se paga; a R$ 490 à vista, sim. E trava 12 meses de
 * retenção, que é o número que este produto nunca teve.
 *
 * `PRO_PLAN_PRICE` continua sendo o preço MENSAL e não muda de forma: os 18
 * arquivos que o importam significam exatamente isso, e
 * `scripts/marketing/gerar-stories.py` o lê por regex de `export const NOME = <int>`.
 */
export const PRO_ANUAL_MESES = 12
export const PRO_ANUAL_MESES_COBRADOS = 10

/** R$ 490. Doze meses pelo preço de dez. */
export const PRO_ANUAL_PRICE = PRO_PLAN_PRICE * PRO_ANUAL_MESES_COBRADOS

/** Dois. O que a peça de venda promete, calculado e não escrito. */
export const PRO_ANUAL_MESES_GRATIS = PRO_ANUAL_MESES - PRO_ANUAL_MESES_COBRADOS

/** R$ 98. Quanto a pessoa deixa de gastar ao pagar o ano de uma vez. */
export const PRO_ANUAL_ECONOMIA = PRO_PLAN_PRICE * PRO_ANUAL_MESES_GRATIS

/**
 * Os ciclos de cobrança, **no vocabulário do Asaas**.
 *
 * Maiúsculas e em inglês de propósito, mesmo num projeto que nomeia tudo em
 * português: é o valor que vai no corpo do `POST /subscriptions`, o que volta
 * em `GET /subscriptions/{id}.cycle`, e o que a coluna `subscriptions.ciclo`
 * guarda. Um vocabulário só, do botão ao gateway à coluna.
 *
 * Traduzir em qualquer ponto exigiria uma tabela de correspondência — e tabela
 * de correspondência é exatamente onde um bug de ciclo se esconderia, porque
 * ela erra em silêncio e o `tsc` não vê. Com o mesmo termo dos dois lados, a
 * reconciliação contra o Asaas vira igualdade de string crua.
 *
 * Precedente direto: `subscriptions.ultimo_billing_type` (migration 0044)
 * guarda `CREDIT_CARD`/`PIX`/`BOLETO` verbatim, pelo mesmo motivo.
 */
export const CICLOS = {
  MONTHLY: {
    valor: PRO_PLAN_PRICE,
    /** O substantivo, para texto corrido: "assinatura mensal". */
    periodo: 'mensal',
    /** O sufixo de tela, colado ao preço: "R$ 49/mês". */
    sufixo: '/mês',
    /** A forma solta, para frase corrida: "R$ 49 por mês". */
    porPeriodo: 'por mês',
  },
  YEARLY: {
    valor: PRO_ANUAL_PRICE,
    periodo: 'anual',
    sufixo: '/ano',
    porPeriodo: 'por ano',
  },
} as const

export type CicloDeCobranca = keyof typeof CICLOS

/** O que se cobra por um ciclo, em reais. */
export function valorDoCiclo(ciclo: CicloDeCobranca): number {
  return CICLOS[ciclo].valor
}
