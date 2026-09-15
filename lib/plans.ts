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
 * Quantos COLABORADORES o Free aceita — e não é o mesmo que `FREE_MEMBER_LIMIT`.
 *
 * ## O off-by-one que duas telas mostravam, achado em 15/09
 *
 * `FREE_MEMBER_LIMIT` conta **pessoas na empresa**, e `verificarLimiteDeMembros`
 * (`lib/limits.ts`) soma `workspace_members` — que inclui o dono — mais os
 * convites pendentes. Com o dono dentro, 2 membros são **o dono e mais um**.
 *
 * `plan-card.tsx` e `plan-comparison-table.tsx` diziam *"até 2
 * colaboradores"*, prometendo TRÊS pessoas. Quem convidasse a terceira tomaria
 * o erro na cara, depois de já ter mandado o convite.
 *
 * Promessa que o banco recusa é pior que limite baixo: o limite baixo a pessoa
 * decide se aceita antes de entrar; a promessa quebrada ela descobre usando.
 *
 * Derivado, nunca escrito à mão: no dia em que o teto virar 3, o texto anda
 * junto.
 */
export const FREE_COLABORADORES = FREE_MEMBER_LIMIT - 1

/**
 * Os papéis que um colaborador pode ter, nos dois planos.
 *
 * São os mesmos valores do enum `workspace_role` no Postgres, e a diferença
 * entre eles é checada em RLS **e** na interface — não é rótulo de tela.
 *
 * Fica aqui, e não escrito na tela, pelo motivo de sempre: `lib/plans.ts` é a
 * fonte única do que cada plano entrega, e um papel novo precisa aparecer nas
 * duas telas de plano sem alguém se lembrar de editar as duas.
 */
export const PAPEIS_DO_COLABORADOR = [
  { papel: 'Administrador', pode: 'convida, remove e mexe no plano' },
  { papel: 'Membro', pode: 'trabalha o funil, sem tocar em cobrança' },
] as const

/**
 * Orçamentos com lembrete que uma empresa Free mantém ativos ao mesmo tempo.
 *
 * ## A parede estava no lugar errado, e isso é medição de conversão
 *
 * Até 10/09 as únicas paredes do Pro eram 50 contatos, 2 colaboradores e o PDF.
 * As três são **limite arbitrário** no sentido técnico do termo, e o efeito é
 * medido:
 *
 *     paywall no momento em que a pessoa SENTE o valor    8-12% convertem
 *     paywall em limite arbitrario                        3-4% convertem
 *
 * O de 50 contatos era o pior dos três: quem importa a planilha chega com 20 e
 * leva meses para encostar nele — ou nunca encosta. **Ninguém nunca
 * experimentava o Pro**, e isso está registrado desde 08/09, quando 8 dos 8
 * workspaces em `plan = 'pro'` eram concessão manual do dono.
 *
 * ## Por que o orçamento é o lugar certo
 *
 * O momento "ahá" deste produto é único e nomeável: *o sistema me lembrou do
 * orçamento e eu fechei a venda*. É o que 88% do mercado chama de automação e
 * o que 0 de 25 geradores de orçamento fazem.
 *
 * Gatear ali põe a parede **3 a 7 dias** dentro do uso ativo, que é onde
 * Calendly (1 agenda), HubSpot (1 assento) e Loom (5 minutos) põem as delas —
 * depois de a pessoa sentir funcionar, não antes.
 *
 * ## Três, e o lembrete NUNCA é o que se corta
 *
 * O Free continua avisando, sempre. Cortar o lembrete deixaria o produto sem o
 * seu único diferencial justamente para quem ainda está decidindo, e venderia
 * uma coisa que o avaliador nunca viu funcionar. O que o Pro compra é
 * **quantidade**, não a existência do aviso.
 *
 * Três porque dois se confunde com amostra e cinco leva de volta ao problema
 * de 50: prestador de serviço manda 3 orçamentos numa semana boa, então o
 * quarto chega enquanto o produto está aberto na tela.
 */
export const FREE_ORCAMENTO_LIMIT = 3

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

/**
 * O preço do Pro, por mês, pela empresa inteira.
 *
 * ## Era 49 até 10/09, e a troca saiu de medição
 *
 * Três números independentes apontaram para o mesmo lugar, e nenhum deles foi
 * procurado querendo este resultado:
 *
 *     Agendor 2025    R$ 18,5 mi / 6.000 pagantes  =  ARPU R$ 257/mes
 *     micro-SaaS      o corte entre viver e morrer esta em US$ 79/mes
 *                     (estudo com 1.000 produtos) — R$ 49 e US$ 9
 *     26 CRMs         entrada de R$ 10 a R$ 597, e o fundo cobra R$ 11
 *
 * O terceiro é o que derruba o argumento antigo. "R$ 49 pela empresa toda" só
 * vira vantagem a partir de 4 ou 5 pessoas; para a marcenaria de duas, o
 * Bitrix24 sai por R$ 22 e nós saíamos por 49. **Na faixa que a prospecção de
 * fato aborda, éramos o mais caro dos baratos** — pagando o preço de barato
 * (comprador B2B lê preço como sinal de qualidade) sem a vantagem dele.
 *
 * ## Por que 97 e não 149
 *
 * 149 cabe melhor na aritmética — abre o Google Ads, que a R$ 97 ainda não
 * fecha. Mas 95 empresas já receberam a mensagem dizendo R$ 49, e o salto de
 * 3x transformaria a próxima conversa numa correção. 97 fica logo abaixo do
 * nexxou (R$ 97 POR USUÁRIO) e mantém a frase inteira: uma equipe de quatro
 * paga R$ 340 no Agendor e R$ 97 aqui.
 *
 * ## O que ele move, e é por isso que é a alavanca mais barata do produto
 *
 *     LTV a 4% de churn      R$ 1.225  ->  R$ 2.425
 *     CAC maximo (regua 3:1) R$   408  ->  R$   808
 *     clientes p/ R$ 10 mil       204  ->       103
 *
 * Nenhuma linha de recurso muda. **Subir o preço move cinco linhas de uma vez;
 * construir recurso novo não move nenhuma.**
 */
export const PRO_PLAN_PRICE = 97

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

/**
 * A partir de quantas pessoas o preço fixo daqui fica mais barato.
 *
 * ## O número que a landing precisava dizer e não dizia
 *
 * A R$ 49 ele era 1: a primeira linha da tabela de comparação já mostrava
 * R$ 60 contra R$ 49, e o argumento vencia de saída. **A R$ 97 ele é 2** — e a
 * mesma tabela, sem ninguém tocá-la, passou a abrir mostrando o concorrente
 * ganhando: R$ 60 por uma pessoa contra R$ 97 aqui.
 *
 * É a segunda vez em dois dias que a troca de preço vira uma afirmação de
 * marketing pelo avesso sem nenhum código mudar — a primeira foi o
 * "Menos de R$ 2 por dia", que virou falso por aritmética.
 *
 * ## Por que ele fica na tela em vez de a linha sumir
 *
 * O reflexo é começar a tabela em duas pessoas e nunca mostrar o caso perdido.
 * Isto aqui não faz isso: `/alternativa-ao-crm-que-cobra-por-usuario` já
 * responde, por escrito, que *"para quem vende sozinho, um plano por usuário
 * sai mais em conta"*, e esconder na landing o que a página de comparação
 * admite seria falar duas línguas para a mesma pessoa.
 *
 * Dizer o ponto de virada é mais forte que escondê-lo: quem tem uma pessoa só
 * descobre sozinho na primeira conta, e aí a descoberta vem junto da suspeita
 * de que o resto também estava maquiado.
 */
export const PESSOAS_PARA_COMPENSAR = Math.ceil(PRO_PLAN_PRICE / PRECO_MEDIANA_POR_USUARIO)

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

/**
 * Para onde mandar quem bateu num limite do Free.
 *
 * `?assinar=1` abre o formulário de CPF de saída — `SubscribeButton` lê esse
 * parâmetro e abre sozinho. Sem ele a pessoa cai na tela de cobrança e precisa
 * procurar o botão de novo, depois de já ter decidido.
 */
export const DESTINO_DO_UPGRADE = '/settings/billing?assinar=1'

/**
 * Esta mensagem de erro é um limite de plano?
 *
 * ## O buraco que isto fecha, medido em 15/09
 *
 * SETE lugares do produto devolvem uma frase mandando fazer upgrade —
 * orçamento, contato, importação, membro, empresa, integração e o PDF. Todas
 * as sete chegam à tela como **texto dentro de um toast**, e nenhuma é
 * clicável.
 *
 * O efeito é o pior possível numa tela de conversão: a pessoa é interrompida
 * no meio do que estava fazendo, é informada de que existe um plano que
 * resolve, e não recebe caminho nenhum até ele. Ela volta para o trabalho e a
 * intenção morre ali.
 *
 * `workspace-switcher.tsx` já registra a mesma lição em comentário — *"dizer
 * 'faça upgrade' sem mostrar onde deixa a pessoa num beco"*.
 *
 * ## Por que reconhecer por TEXTO, e não por código de erro
 *
 * Um código exigiria mudar as sete origens, e três delas devolvem a frase de
 * dentro do Postgres (`raise exception` nas triggers de limite) — onde não há
 * campo para carregar um código próprio.
 *
 * O reconhecimento é frouxo de propósito: errar para o lado de OFERECER o
 * upgrade num erro que não era de plano mostra um botão a mais; errar para o
 * outro lado deixa a pessoa no beco. O primeiro é recuperável.
 */
export function ehLimiteDePlano(mensagem: string | null | undefined): boolean {
  if (!mensagem) return false
  const limpo = mensagem
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  return (
    /faca upgrade|upgrade para o pro|recurso pro|plano free (permite|inclui|acompanha)/.test(limpo)
  )
}
