/**
 * Quem PAGA, quem só tem acesso, e a diferença entre as duas coisas.
 *
 * ## O defeito que este arquivo existe para corrigir
 *
 * Até 30/08 a Central calculava a receita assim:
 *
 *     entraPorMes: (empresas com pro_vigente()) * PRO_PLAN_PRICE
 *
 * `pro_vigente()` responde **"esta empresa pode usar o Pro?"** — e ela é
 * `assinatura viva OU trial válido`. Está correta no que faz. Usá-la para
 * medir DINHEIRO transforma três coisas diferentes numa só:
 *
 *     quem paga             receita de verdade
 *     quem esta em trial    acesso gratis, receita ZERO
 *     quem ganhou cortesia  acesso de brinde, receita ZERO
 *
 * Medido em 30/08 contra o banco e o Asaas: a Central dizia **R$ 490,00/mês
 * com 10 clientes pagando**. A verdade era **R$ 0,00 de receita externa
 * recorrente** — 10 empresas estavam em trial, e o único pagamento do Asaas
 * (R$ 49, em 13/08) foi o dono provando o próprio checkout.
 *
 * O card ao lado já dizia "Já recebido R$ 49,00 · 1 pagamento". Os dois
 * números vinham de fontes diferentes e ninguém os confrontou.
 *
 * ## A regra, e por que é esta
 *
 * `dinheiro.ts` já registra a doutrina: *"o banco sabe o que o webhook
 * conseguiu gravar; o Asaas sabe o que de fato aconteceu com o dinheiro"*.
 * Receita passa a sair do gateway, não do banco.
 *
 * E dentro do gateway, a linha é **pagamento confirmado**, não assinatura
 * ativa. Assinatura ACTIVE sem nenhum pagamento é intenção, não receita — o
 * caso real da empresa "rththn", ACTIVE no Asaas e com zero pagamento até
 * hoje. Contá-la seria repetir o mesmo erro num nível abaixo.
 */

/** O estado de acesso de uma empresa. Só o primeiro é dinheiro. */
export type EstadoDoAcesso =
  /** Assinatura viva no Asaas COM pagamento confirmado. */
  | 'pagante'
  /** Assinatura no gateway, mas nada pago ainda. Intenção, não receita. */
  | 'assinou_sem_pagar'
  /** Trial gratuito dentro do prazo. */
  | 'trial'
  /** Pro liberado à mão pela Central, ou por assinatura sem lastro no Asaas. */
  | 'cortesia'
  /** Conta do dono, de demonstração ou de domínio descartável. */
  | 'interna'
  /** Sem Pro. */
  | 'sem_pro'

export type SinaisDaEmpresa = {
  /** `ehContaDeTeste` do e-mail de quem criou — a função OFICIAL. */
  interna: boolean
  /** `pro_vigente()` no banco. */
  temProVigente: boolean
  /** `workspaces.trial_ate` no futuro. */
  emTrial: boolean
  /** Id da assinatura no Asaas, se o banco conhece uma. */
  assinaturaNoAsaas: string | null
  /** A assinatura está ACTIVE e não deletada NO GATEWAY. */
  assinaturaVivaNoGateway: boolean
  /** Existe pelo menos um pagamento RECEIVED ou CONFIRMED nela. */
  temPagamentoConfirmado: boolean
}

/**
 * Classifica o acesso de uma empresa.
 *
 * A ordem dos testes é a regra inteira, e cada degrau exclui o seguinte:
 *
 * 1. **Interna primeiro.** Conta do dono com Pro não é cliente, seja qual for
 *    a origem do Pro. Classificá-la depois faria a conta de demonstração
 *    aparecer como pagante — que é metade do defeito de 30/08.
 * 2. **Pagante** exige as três coisas: assinatura conhecida, viva no gateway,
 *    e com dinheiro que entrou.
 * 3. **Assinou sem pagar** é estado PRÓPRIO, não "cortesia". A diferença
 *    importa para agir: cortesia é decisão sua, isto é uma venda travada.
 * 4. **Trial antes de cortesia**: quem está em trial e também recebeu cortesia
 *    conta como trial, porque o trial é o que explica o acesso hoje.
 */
export function classificarAcesso(sinais: SinaisDaEmpresa): EstadoDoAcesso {
  if (sinais.interna) return 'interna'
  if (!sinais.temProVigente) return 'sem_pro'

  if (sinais.assinaturaNoAsaas && sinais.assinaturaVivaNoGateway) {
    return sinais.temPagamentoConfirmado ? 'pagante' : 'assinou_sem_pagar'
  }

  if (sinais.emTrial) return 'trial'

  // Sobra: tem Pro vigente, não é trial, e não tem assinatura viva no
  // gateway. É cortesia da Central, ou uma assinatura marcada `active` no
  // banco sem lastro no Asaas — o caso da "Empresa de Teste", que tinha
  // `status: active` e nenhuma assinatura no gateway.
  return 'cortesia'
}

export type QuadroDeReceita = {
  /** MRR de verdade: só quem paga. */
  entraPorMes: number
  pagantes: number
  /** Os outros estados, para a tela mostrar em vez de esconder. */
  assinaramSemPagar: number
  emTrial: number
  cortesias: number
  internas: number
}

/**
 * O quadro inteiro, a partir dos estados já classificados.
 *
 * Devolve TODOS os grupos, não só o que dá dinheiro. Mostrar apenas o MRR
 * esconderia que 10 empresas estão em trial — e é justamente isso que decide
 * quanto pode virar receita nos próximos dias.
 */
export function montarQuadroDeReceita(
  estados: EstadoDoAcesso[],
  precoMensal: number,
): QuadroDeReceita {
  const contar = (alvo: EstadoDoAcesso) => estados.filter((e) => e === alvo).length
  const pagantes = contar('pagante')

  return {
    entraPorMes: pagantes * precoMensal,
    pagantes,
    assinaramSemPagar: contar('assinou_sem_pagar'),
    emTrial: contar('trial'),
    cortesias: contar('cortesia'),
    internas: contar('interna'),
  }
}
