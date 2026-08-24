/**
 * O funil de ativação: quantos que criam conta chegam a usar o produto de
 * verdade, e onde eles desistem.
 *
 * ## Por que isto existe, e por que NÃO é PostHog
 *
 * O `CLAUDE.md` registra desde sempre que "não existe nada medindo ativação:
 * quantos que criam conta chegam ao primeiro lead é uma pergunta que hoje
 * ninguém responde". A resposta óbvia seria instalar PostHog. Não é a certa.
 *
 * Cada passo deste funil **já está gravado no banco** como efeito colateral do
 * produto funcionando: a conta existe em `auth.users`, o assistente registra
 * progresso em `onboarding_state`, o primeiro contato é uma linha em `leads`,
 * o primeiro negócio em `deals`, a conexão em `integration_connections` e o
 * pagamento em `subscriptions`. Instalar um rastreador para reobservar de fora
 * o que o banco já sabe seria trocar um dado exato por um aproximado — e ainda
 * traria cookie de terceiro sob a LGPD, que é exatamente o motivo pelo qual o
 * GA4 foi descartado neste projeto.
 *
 * ## O que este arquivo NÃO faz
 *
 * Não mede clique, rolagem nem tempo de tela. Isso é comportamento dentro da
 * página e o banco realmente não sabe. Se um dia essa pergunta aparecer, aí
 * sim vale discutir ferramenta — mas ela é diferente da pergunta que trava a
 * decisão hoje, que é "onde a pessoa para".
 *
 * ## A regra que decide a leitura: contas de teste ficam de fora
 *
 * A auditoria de 22/08 mostrou que 19 das 26 empresas eram teste (do dono ou
 * de e-mail descartável), e que qualquer taxa calculada sobre a base cheia
 * mede o próprio dono usando o produto. Um funil de ativação contaminado assim
 * não erra por pouco: ele inverte a conclusão, porque conta de teste sempre
 * "ativa" (quem cria já sabe o que fazer) e nunca paga.
 */

/** Os degraus, na ordem em que a pessoa os sobe. */
export type EtapaDaAtivacao =
  | 'criou_conta'
  | 'concluiu_onboarding'
  | 'primeiro_contato'
  | 'primeiro_negocio'
  | 'conectou_canal'
  | 'virou_pro'

/** O que se sabe de UMA conta externa, já resolvido a partir do banco. */
export type ContaObservada = {
  /** Quando a conta nasceu. Define a coorte. */
  criadaEm: string
  concluiuOnboarding: boolean
  temContato: boolean
  temNegocio: boolean
  /** WhatsApp, Google Calendar ou Gmail — qualquer canal conectado. */
  conectouCanal: boolean
  /** Pro vigente AGORA, não a coluna `plan`. Ver a doutrina da migration 0027. */
  proVigente: boolean
}

export type DegrauDoFunil = {
  etapa: EtapaDaAtivacao
  rotulo: string
  /** Quantas contas chegaram até aqui. */
  quantas: number
  /** Percentual sobre o total de contas (não sobre o degrau anterior). */
  percentualDoTopo: number
  /**
   * Percentual sobre o degrau ANTERIOR — é este que aponta o vazamento.
   * `null` no primeiro degrau, que não tem anterior.
   */
  percentualDoAnterior: number | null
}

export const ROTULOS: Record<EtapaDaAtivacao, string> = {
  criou_conta: 'Criou a conta',
  concluiu_onboarding: 'Terminou o assistente',
  primeiro_contato: 'Cadastrou o 1º contato',
  primeiro_negocio: 'Criou o 1º negócio',
  virou_pro: 'Assinou o Pro',
  conectou_canal: 'Usou o que o Pro destrava',
}

/**
 * Monta o funil.
 *
 * Os degraus são **cumulativos por construção**: quem tem negócio quase sempre
 * tem contato, mas alguém pode ter pulado o assistente e cadastrado contato
 * mesmo assim. Para o funil não mostrar um degrau MAIOR que o anterior — o que
 * seria absurdo na tela e destruiria a confiança no número —, cada degrau conta
 * quem cumpriu ele **e todos os anteriores**.
 */
export function montarFunilDeAtivacao(contas: ContaObservada[]): DegrauDoFunil[] {
  const total = contas.length

  const cumpriu: Record<EtapaDaAtivacao, (c: ContaObservada) => boolean> = {
    criou_conta: () => true,
    concluiu_onboarding: (c) => c.concluiuOnboarding,
    primeiro_contato: (c) => c.temContato,
    primeiro_negocio: (c) => c.temNegocio,
    conectou_canal: (c) => c.conectouCanal,
    virou_pro: (c) => c.proVigente,
  }

  /**
   * A ordem importa, e a primeira versão desta função errou nela.
   *
   * `conectou_canal` estava ANTES de `virou_pro`, o que fazia o funil dizer que
   * conectar WhatsApp levava ao pagamento. É o contrário: integração é recurso
   * pago (migration 0037 gateia o insert em `integration_connections`), então
   * ninguém consegue conectar sem já ser Pro. O funil apontava "conectou um
   * canal" como o maior vazamento quando aquilo era só o efeito de quase
   * ninguém ter assinado — causa e efeito trocados, no gráfico que existe
   * justamente para decidir onde investir.
   *
   * Conectar fica DEPOIS do Pro porque é isso que ele mede de verdade: de quem
   * pagou, quantos chegaram a usar o que o pagamento destravou. Um Pro que não
   * conecta nada é um cancelamento se preparando.
   */
  const ordem: EtapaDaAtivacao[] = [
    'criou_conta',
    'concluiu_onboarding',
    'primeiro_contato',
    'primeiro_negocio',
    'virou_pro',
    'conectou_canal',
  ]

  let anterior: number | null = null

  return ordem.map((etapa, i) => {
    const ateAqui = ordem.slice(0, i + 1)
    const quantas = contas.filter((c) => ateAqui.every((e) => cumpriu[e](c))).length

    const degrau: DegrauDoFunil = {
      etapa,
      rotulo: ROTULOS[etapa],
      quantas,
      percentualDoTopo: total === 0 ? 0 : Math.round((quantas / total) * 100),
      percentualDoAnterior:
        anterior === null ? null : anterior === 0 ? 0 : Math.round((quantas / anterior) * 100),
    }

    anterior = quantas
    return degrau
  })
}

/**
 * Onde o funil mais vaza.
 *
 * Devolve o degrau com a MAIOR perda absoluta em relação ao anterior — não o
 * de menor percentual. A diferença importa: perder 8 de 10 pessoas no primeiro
 * contato é um problema maior que perder 1 de 2 no pagamento, mesmo o segundo
 * tendo percentual pior. Consertar onde o volume some rende mais.
 *
 * Devolve `null` quando não há dado suficiente para apontar nada — com menos de
 * 5 contas, qualquer "maior vazamento" é ruído, e mostrar um número desses na
 * tela convida a decidir por acaso.
 */
export function maiorVazamento(
  funil: DegrauDoFunil[],
  minimoParaOpinar = 5,
): { degrau: DegrauDoFunil; perdeu: number } | null {
  const topo = funil[0]?.quantas ?? 0
  if (topo < minimoParaOpinar) return null

  let pior: { degrau: DegrauDoFunil; perdeu: number } | null = null

  for (let i = 1; i < funil.length; i += 1) {
    const perdeu = funil[i - 1].quantas - funil[i].quantas
    if (perdeu > 0 && (pior === null || perdeu > pior.perdeu)) {
      pior = { degrau: funil[i], perdeu }
    }
  }

  return pior
}

/**
 * Recorta as contas por janela de tempo.
 *
 * Serve para responder "melhorou?" depois de mexer no produto: comparar quem
 * entrou nos últimos 30 dias com quem entrou antes. Sem esse recorte, uma
 * mudança boa fica escondida atrás de meses de histórico ruim, e a média
 * demora tanto para se mover que ninguém consegue atribuir causa a nada.
 */
export function apenasDosUltimosDias(
  contas: ContaObservada[],
  dias: number,
  agora = new Date(),
): ContaObservada[] {
  const corte = agora.getTime() - dias * 24 * 60 * 60 * 1000
  return contas.filter((c) => new Date(c.criadaEm).getTime() >= corte)
}
