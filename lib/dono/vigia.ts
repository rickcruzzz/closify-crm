/**
 * Decide o que vira alerta, e o que fica em silêncio.
 *
 * ## Por que a decisão mora numa função pura
 *
 * A rota do cron lê o banco e o Asaas; esta camada só olha o resultado e
 * responde uma pergunta: **isto merece acordar alguém?** Separadas, a regra
 * pode ser exercitada sem rede, sem banco e sem gastar uma chamada ao gateway
 * — que é o mesmo motivo pelo qual `lib/dono/ambiente.ts` e
 * `lib/dono/receita.ts` existem como funções puras.
 *
 * ## A regra que governa todas as outras: silêncio é resposta
 *
 * Em 20/08 a fila de alertas da Central tinha **8 de 11 itens de ruído** —
 * e-mails de teste gerados por script. Uma fila com 70% de lixo ensina a
 * ignorar a fila inteira, e junto com o item chato vai embora o alerta de
 * dinheiro.
 *
 * Daí a decisão mais importante deste arquivo: **quando não há nada, não sai
 * e-mail nenhum.** Um "tudo certo" diário parece cuidado e é o contrário: ele
 * treina a pessoa a arquivar sem ler, e no dia em que o assunto for grave o
 * reflexo já está formado.
 */

/** Quanto um alerta importa. A ordem aqui é a ordem do e-mail. */
export type Gravidade = 'dinheiro' | 'cliente' | 'defeito'

export type Alerta = {
  gravidade: Gravidade
  titulo: string
  detalhe: string
  /** Caminho relativo na Central, quando existe uma tela que trata disto. */
  ondeOlhar?: string
}

/**
 * O que o cron mediu. Cada campo é uma leitura independente: uma pode falhar
 * sem derrubar as outras, e `null` significa **não sei**, não "está zerado".
 *
 * A diferença importa e já custou caro neste projeto: em 30/08 a Central
 * declarava R$ 490/mês de receita com R$ 0,00 real, porque "não consegui ler"
 * e "não há nada" tinham virado o mesmo valor.
 */
export type LeituraDoVigia = {
  /** Assinaturas ACTIVE no Asaas cuja empresa não tem Pro vigente no banco. */
  assinaturasSemPro: number | null
  /** Erros novos em `error_logs` na janela. */
  errosNovos: number | null
  /** Empresas cujo trial vence dentro da janela de aviso. */
  trialsVencendo: number | null
  /** Relatos de suporte externos sem resposta há mais de um dia. */
  suporteParado: number | null
  /** Cobranças vencidas e não pagas no Asaas. */
  cobrancasVencidas: number | null
  /**
   * Credenciais externas que pararam de responder.
   *
   * ## Por que isto entrou no vigia, e não numa checagem manual
   *
   * O `META_ADS_TOKEN` ficou **três dias** marcado neste projeto como morto
   * depois de voltar a funcionar, e a pendência dizia "gerar token novo"
   * quando não havia o que fazer. Antes disso, cinco e-mails de autenticação
   * saíram 23 dias com um CNPJ que a Receita desmentia.
   *
   * A classe é sempre a mesma: **fato externo que deixa de ser verdade e
   * nada avisa**, porque nenhum `tsc`, `lint` ou `test` consulta a Graph API
   * ou a Receita. Pedir para alguém conferir de tempos em tempos não funciona
   * — foi exatamente o que não aconteceu nos dois casos.
   */
  credenciaisMortas: string[] | null
}

/**
 * O trial vence em até tantos dias para entrar no aviso.
 *
 * Quatro, o mesmo de `AVISAR_A_PARTIR_DE` nos e-mails de assinatura. Não é
 * coincidência nem cópia: se o cliente é avisado quatro dias antes, o dono
 * precisa saber na mesma janela para poder falar com ele antes do e-mail
 * automático — depois já é cobrança, não conversa.
 */
export const DIAS_DE_ANTECEDENCIA_DO_TRIAL = 4

/** Horas que um relato de suporte pode esperar antes de virar alerta. */
export const HORAS_ATE_SUPORTE_VIRAR_ALERTA = 24

/**
 * Monta a fila, já ordenada, a partir do que foi medido.
 *
 * ## Por que dinheiro vem antes de defeito
 *
 * Um erro em `error_logs` pode ser um navegador antigo de alguém que nunca
 * voltou. Uma assinatura ativa no Asaas sem Pro no banco é alguém que **pagou
 * e não recebeu** — e continua pagando. A ordem da fila é a ordem em que o
 * prejuízo acontece, não a ordem em que o problema é interessante.
 */
export function montarAlertas(leitura: LeituraDoVigia): Alerta[] {
  const alertas: Alerta[] = []

  if (leitura.assinaturasSemPro && leitura.assinaturasSemPro > 0) {
    alertas.push({
      gravidade: 'dinheiro',
      titulo: `${leitura.assinaturasSemPro} assinatura(s) ativa(s) sem Pro liberado`,
      detalhe:
        'O Asaas confirma a assinatura e o banco não liberou o plano. ' +
        'A pessoa está pagando e usando o Free.',
      ondeOlhar: '/dono',
    })
  }

  if (leitura.cobrancasVencidas && leitura.cobrancasVencidas > 0) {
    alertas.push({
      gravidade: 'dinheiro',
      titulo: `${leitura.cobrancasVencidas} cobrança(s) vencida(s)`,
      detalhe: 'Geradas e não pagas. Cada uma tarifa mensageria mesmo sem ninguém pagar.',
      ondeOlhar: '/dono',
    })
  }

  if (leitura.trialsVencendo && leitura.trialsVencendo > 0) {
    alertas.push({
      gravidade: 'cliente',
      titulo: `${leitura.trialsVencendo} empresa(s) com avaliação acabando`,
      detalhe:
        `Vencem em até ${DIAS_DE_ANTECEDENCIA_DO_TRIAL} dias. ` +
        'É a janela em que a conversa ainda é conversa, e não cobrança.',
      ondeOlhar: '/dono/trial',
    })
  }

  if (leitura.suporteParado && leitura.suporteParado > 0) {
    alertas.push({
      gravidade: 'cliente',
      titulo: `${leitura.suporteParado} relato(s) de suporte sem resposta`,
      detalhe: `Esperando há mais de ${HORAS_ATE_SUPORTE_VIRAR_ALERTA} horas.`,
      ondeOlhar: '/dono/suporte',
    })
  }

  if (leitura.credenciaisMortas && leitura.credenciaisMortas.length > 0) {
    alertas.push({
      gravidade: 'defeito',
      titulo: `${leitura.credenciaisMortas.length} credencial(is) fora do ar`,
      detalhe:
        `${leitura.credenciaisMortas.join(', ')}. ` +
        'Enquanto estiver assim, o que depende dela para de funcionar em silêncio.',
      ondeOlhar: '/dono',
    })
  }

  if (leitura.errosNovos && leitura.errosNovos > 0) {
    alertas.push({
      gravidade: 'defeito',
      titulo: `${leitura.errosNovos} erro(s) novo(s) em produção`,
      detalhe: 'Registrados em error_logs nas últimas 24 horas.',
      ondeOlhar: '/dono/alertas',
    })
  }

  return alertas
}

/**
 * As leituras que falharam, para o e-mail poder dizer que não sabe.
 *
 * ## Por que isto sai no e-mail, e não só no log
 *
 * Um vigia que não consegue ler o Asaas e manda um e-mail sem falar de
 * dinheiro passa a mensagem exatamente errada: "conferi e está tudo bem".
 * Dizer "não consegui olhar o Asaas hoje" é a diferença entre um silêncio que
 * informa e um que engana.
 */
export function leiturasQueFalharam(leitura: LeituraDoVigia): string[] {
  const nomes: Record<keyof LeituraDoVigia, string> = {
    assinaturasSemPro: 'assinaturas no Asaas',
    errosNovos: 'erros de produção',
    trialsVencendo: 'avaliações em curso',
    suporteParado: 'fila de suporte',
    cobrancasVencidas: 'cobranças vencidas',
    credenciaisMortas: 'credenciais externas',
  }
  return (Object.keys(nomes) as (keyof LeituraDoVigia)[])
    .filter((chave) => leitura[chave] === null)
    .map((chave) => nomes[chave])
}

/**
 * Decide se o e-mail sai.
 *
 * Sai quando há alerta **ou** quando alguma leitura falhou — o segundo caso
 * porque não saber é, ele próprio, uma informação. Não sai quando tudo foi
 * lido e está limpo: é aí que o silêncio significa "está tudo bem", e só
 * significa isso porque nunca é usado para outra coisa.
 */
export function deveEnviar(leitura: LeituraDoVigia): boolean {
  return montarAlertas(leitura).length > 0 || leiturasQueFalharam(leitura).length > 0
}

/**
 * O assunto do e-mail, que precisa ser legível na notificação do celular.
 *
 * O número vem primeiro porque a lista do Gmail corta em torno de 40
 * caracteres no telefone, e "Velo Funil: 2 alertas" cabe onde "Relatório de
 * monitoramento do sistema Velo Funil" não cabe.
 */
export function assuntoDoVigia(alertas: Alerta[], falhas: string[]): string {
  const temDinheiro = alertas.some((a) => a.gravidade === 'dinheiro')
  if (alertas.length === 0) return 'Velo Funil: não consegui conferir tudo'
  const n = alertas.length
  const plural = n === 1 ? 'alerta' : 'alertas'
  const prefixo = temDinheiro ? 'Velo Funil, dinheiro' : 'Velo Funil'
  return falhas.length > 0
    ? `${prefixo}: ${n} ${plural} (e ${falhas.length} não conferido)`
    : `${prefixo}: ${n} ${plural}`
}

/**
 * O que já foi comunicado, por tipo de alerta.
 *
 * Vem de `vigia_ultimo_aviso` (0062). Chave ausente significa que aquele
 * alerta nunca foi avisado — não que ele estava em zero.
 */
export type MemoriaDoVigia = Record<string, number>

/** A chave de memória de um alerta. Deriva do título, não do texto. */
export function chaveDoAlerta(alerta: Alerta): string {
  return alerta.titulo
    .toLowerCase()
    .replace(/\d+/g, '')
    .replace(/[^a-zà-ú]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

/**
 * Quantos itens o alerta reporta. Sai do próprio título, que já o carrega.
 *
 * Ler o número do texto parece frágil e é a escolha certa aqui: a alternativa
 * seria carregá-lo num campo à parte, que ficaria livre para discordar do
 * título — e aí o e-mail diria "5 erros" enquanto a memória guardaria 2.
 * Uma fonte só não tem como divergir de si mesma.
 */
export function quantidadeDoAlerta(alerta: Alerta): number {
  const achado = alerta.titulo.match(/\d+/)
  return achado ? Number(achado[0]) : 1
}

/**
 * Filtra a fila, deixando só o que a pessoa ainda não sabe.
 *
 * ## As três situações, e por que cada uma decide assim
 *
 *     nunca avisado        MANDA   e novidade
 *     igual ao ultimo      cala    ela ja sabe, e ja esta resolvendo
 *     PIOROU (2 -> 5)      MANDA   mudou de tamanho, e isso e fato novo
 *
 * Melhorar sem zerar (5 -> 2) **não** dispara: quem está resolvendo não
 * precisa ser avisado de que está funcionando. Some da fila quando chega a
 * zero, e volta a avisar se reaparecer — porque aí é problema novo.
 *
 * ## Por que "piorou" importa e "continua" não
 *
 * Um alerta que persiste é o mesmo problema; um que cresce mudou de natureza.
 * Dois erros num dia podem ser um navegador antigo; trinta são um defeito em
 * produção. Sem comparar o número, os dois casos gerariam o mesmo silêncio
 * depois do primeiro aviso.
 */
export function alertasNaoAvisados(
  alertas: Alerta[],
  memoria: MemoriaDoVigia,
): Alerta[] {
  return alertas.filter((a) => {
    const anterior = memoria[chaveDoAlerta(a)]
    if (anterior === undefined) return true
    return quantidadeDoAlerta(a) > anterior
  })
}

/**
 * A memória nova, depois desta varredura.
 *
 * Guarda o estado ATUAL de todo alerta vivo, inclusive dos que não foram
 * comunicados agora — senão um alerta que melhorou de 5 para 2 ficaria
 * registrado como 5, e voltar a 4 não dispararia nada apesar de ter piorado.
 *
 * O que não está mais na fila sai da memória (a rota apaga), e é isso que faz
 * um problema que voltou ser tratado como novo.
 */
export function memoriaAtualizada(alertas: Alerta[]): MemoriaDoVigia {
  const nova: MemoriaDoVigia = {}
  for (const a of alertas) nova[chaveDoAlerta(a)] = quantidadeDoAlerta(a)
  return nova
}
