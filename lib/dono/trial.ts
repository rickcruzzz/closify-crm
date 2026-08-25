/**
 * Quem está decidindo agora — as empresas dentro da janela de trial.
 *
 * ## Por que esta tela existe
 *
 * A Central sabia operar (alertas, dinheiro, consertar assinatura) e sabia
 * medir (funil de ativação agregado). Não sabia responder a única pergunta que
 * gera receita: **quem está decidindo neste momento, e como falo com essa
 * pessoa?**
 *
 * O trial é uma janela de sete dias. Depois dela a empresa cai para o Free e a
 * conversa muda de "aproveite o que já está usando" para "volte a pagar por
 * algo que você perdeu" — que é uma venda muito mais difícil. Sem ver quem
 * está dentro da janela, as sete dias passam por omissão.
 *
 * Medido em 25/08: **5 empresas em trial ao mesmo tempo**, nenhuma visível em
 * qualquer tela da Central.
 *
 * ## O que a classificação decide
 *
 * Não basta listar. Uma empresa que criou conta e nunca voltou e outra que
 * cadastrou trinta contatos ontem estão na mesma janela e merecem ações
 * opostas — e é o CONTATO que custa caro, não a informação. Ligar para quem
 * não usou queima a única chance de falar com a pessoa.
 */

export type SituacaoNoTrial =
  /** Usou o produto e continua voltando. É quem tem mais chance de assinar. */
  | 'engajado'
  /** Chegou a usar e parou. Vale entender o que travou. */
  | 'esfriou'
  /** Criou a conta e nunca fez nada. Falar aqui é vender para quem não viu. */
  | 'nunca_usou'

export type EmpresaNoTrial = {
  workspaceId: string
  nome: string
  emailDoDono: string | null
  whatsapp: string | null
  /** Quanto falta, em dias, com uma casa decimal. Pode ser negativo se venceu. */
  diasRestantes: number
  contatos: number
  negocios: number
  /**
   * ISO da última vez que ALGUÉM da empresa mexeu no produto.
   *
   * ## Por que não é `last_sign_in_at`
   *
   * O campo do Supabase Auth só muda em autenticação NOVA — renovar o token
   * de uma sessão viva não o toca. Quem abre o CRM todo dia sem fazer logout
   * mantém `last_sign_in_at` parado no dia em que entrou pela primeira vez.
   *
   * Isso apareceu na primeira leitura real desta tela, em 25/08: uma empresa
   * criada há um dia exibia "entrou há 4 dias" — os dois números não podiam
   * ser verdade ao mesmo tempo. Classificar por esse campo marcaria como
   * "esfriou" justamente o cliente mais ativo, que é o erro mais caro que
   * este painel poderia cometer.
   *
   * Aqui entra o mais recente entre o login e a última escrita no produto
   * (contato, negócio ou atividade). Escrita no banco não mente sobre uso.
   */
  ultimaAtividade: string | null
  /** ISO de quando o DONO DA PLATAFORMA falou com esta empresa, se falou. */
  faladoEm: string | null
}

export type EmpresaClassificada = EmpresaNoTrial & {
  situacao: SituacaoNoTrial
  /** Quanto maior, mais cedo falar. Ver `prioridade`. */
  prioridade: number
  /** O que fazer, em uma frase. */
  acao: string
}

/** Dias sem entrar a partir dos quais consideramos que a pessoa esfriou. */
const DIAS_PARA_ESFRIAR = 2

/**
 * Por quantos dias um contato recente rebaixa a empresa na fila.
 *
 * Não é para esconder: dentro de um trial de sete dias, o segundo toque perto
 * do fim é justamente o que fecha. É para não cobrar duas vezes no mesmo dia a
 * pessoa com quem você acabou de falar — e para deixar subir de volta sozinha
 * quando o silêncio já durou o bastante para um follow-up fazer sentido.
 */
const DIAS_DE_DESCANSO_APOS_FALAR = 2

export function classificar(
  empresa: EmpresaNoTrial,
  agora: Date = new Date(),
): SituacaoNoTrial {
  const usou = empresa.contatos > 0 || empresa.negocios > 0
  if (!usou) return 'nunca_usou'

  if (!empresa.ultimaAtividade) return 'esfriou'

  const diasParado =
    (agora.getTime() - new Date(empresa.ultimaAtividade).getTime()) / 86_400_000

  return diasParado <= DIAS_PARA_ESFRIAR ? 'engajado' : 'esfriou'
}

/**
 * Ordena por quem merece o contato primeiro.
 *
 * A conta combina duas coisas, e a ordem entre elas importa: **usou** pesa mais
 * que **está acabando**. Uma empresa engajada com cinco dias pela frente vale
 * mais que uma que nunca abriu o produto e vence amanhã — a segunda não tem o
 * que decidir, porque não viu nada para decidir.
 *
 * A urgência entra como desempate e cresce conforme o prazo encurta, então
 * dentro do mesmo grupo quem está mais perto do fim aparece antes.
 */
export function prioridade(
  empresa: EmpresaNoTrial,
  situacao: SituacaoNoTrial,
  agora: Date = new Date(),
): number {
  const peso: Record<SituacaoNoTrial, number> = {
    engajado: 100,
    esfriou: 50,
    nunca_usou: 10,
  }

  // 7 dias restantes → 0; 0 dias → 7. Prazo vencido conta como o máximo.
  const urgencia = Math.max(0, 7 - Math.max(0, empresa.diasRestantes))

  return peso[situacao] + urgencia - descontoPorContatoRecente(empresa, agora)
}

/**
 * Quanto tira da prioridade por já ter falado há pouco.
 *
 * O valor (60) é maior que a distância entre dois grupos vizinhos (100 − 50),
 * então quem acabou de ser contatado cai um degrau inteiro: um engajado com
 * quem já se falou fica abaixo de um "esfriou" com quem ainda não se falou.
 *
 * **Não cai abaixo de todo mundo, e isso é deliberado.** Um engajado que vence
 * amanhã continua acima de um cadastro frio com seis dias pela frente, mesmo
 * tendo sido contatado ontem — porque continua sendo a venda mais provável da
 * lista. Zerar a prioridade de quem foi contatado transformaria "já falei" em
 * "esqueci", que é o oposto do que esta marcação existe para fazer.
 */
function descontoPorContatoRecente(empresa: EmpresaNoTrial, agora: Date): number {
  if (!empresa.faladoEm) return 0

  const dias = (agora.getTime() - new Date(empresa.faladoEm).getTime()) / 86_400_000
  return dias <= DIAS_DE_DESCANSO_APOS_FALAR ? 60 : 0
}

/**
 * O que fazer com esta empresa, em uma frase.
 *
 * Texto no imperativo e específico: um painel que diz "engajado" transfere
 * para quem lê o trabalho de decidir o que isso significa às 23h de um
 * domingo. O objetivo é a pessoa abrir a tela e já saber o próximo passo.
 */
export function acaoRecomendada(
  empresa: EmpresaNoTrial,
  situacao: SituacaoNoTrial,
  agora: Date = new Date(),
): string {
  const dias = Math.max(0, Math.round(empresa.diasRestantes))

  // Reconhecer o contato anterior antes de qualquer outra coisa: um painel que
  // manda "fale hoje" com a pessoa que você contatou ontem ensina a ignorá-lo.
  if (empresa.faladoEm && descontoPorContatoRecente(empresa, agora) > 0) {
    return dias <= 2
      ? 'Você já falou. O prazo acaba agora — vale um último toque.'
      : 'Você já falou. Espere a resposta antes de cobrar de novo.'
  }

  if (situacao === 'engajado') {
    return dias <= 2
      ? `Está usando e o trial acaba em ${dias === 0 ? 'menos de 1 dia' : `${dias} dia${dias > 1 ? 's' : ''}`}. Fale hoje.`
      : 'Está usando de verdade. Pergunte o que faltaria para assinar.'
  }

  if (situacao === 'esfriou') {
    return empresa.contatos > 0
      ? `Cadastrou ${empresa.contatos} contato${empresa.contatos > 1 ? 's' : ''} e parou. Pergunte o que travou.`
      : 'Começou e parou. Pergunte o que travou.'
  }

  return 'Criou a conta e não usou. Ofereça ajuda para o primeiro contato.'
}

/** Classifica e ordena a lista inteira, do mais urgente ao menos. */
export function ordenarPorPrioridade(
  empresas: EmpresaNoTrial[],
  agora: Date = new Date(),
): EmpresaClassificada[] {
  return empresas
    .map((e) => {
      const situacao = classificar(e, agora)
      return {
        ...e,
        situacao,
        prioridade: prioridade(e, situacao, agora),
        acao: acaoRecomendada(e, situacao, agora),
      }
    })
    .sort((a, b) => b.prioridade - a.prioridade)
}

/**
 * Link de WhatsApp com a mensagem já escrita.
 *
 * Reusa a mesma normalização de telefone do produto (`lib/leads/whatsapp.ts`)
 * pelo mesmo motivo que ela existe lá: prefixar `55` num número de 11 dígitos
 * transforma telefone dos EUA em brasileiro, e o `wa.me` abriria uma tela de
 * erro do WhatsApp que parece defeito nosso.
 *
 * A mensagem vem pronta porque o atrito de escrever é o que faz o contato não
 * acontecer — e um texto padrão que a pessoa edita antes de enviar é melhor
 * que uma janela em branco às 23h.
 */
export function linkDeWhatsapp(
  numeroNormalizado: string | null,
  nomeDaEmpresa: string,
): string | null {
  if (!numeroNormalizado) return null

  const texto = encodeURIComponent(
    `Oi! Aqui é do Velo Funil. Vi que a ${nomeDaEmpresa} está testando o sistema — ` +
      'posso ajudar com alguma coisa?',
  )
  return `https://wa.me/${numeroNormalizado}?text=${texto}`
}
