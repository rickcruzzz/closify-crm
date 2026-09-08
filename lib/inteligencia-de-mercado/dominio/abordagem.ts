/**
 * A primeira mensagem, montada a partir do que o site do prospect DIZ.
 *
 * Uma lista de mil contatos não vale nada sem a primeira frase, e a primeira
 * frase é onde a prospecção fria morre: mensagem genérica é ignorada, e
 * mensagem que finge conhecer a empresa é pior — ela mente na primeira linha e
 * a pessoa percebe.
 *
 * ## As quatro regras, e cada uma existe para não queimar o número
 *
 * **Nunca afirmar dor que não foi medida.** "Vi que você está perdendo vendas"
 * é invenção: nós lemos o site, não a carteira. Vira PERGUNTA, que é honesta e
 * converte melhor porque obriga resposta.
 *
 * **Sempre dizer de onde veio o contato.** Exigência prática da LGPD para
 * interesse legítimo (Art. 7º, IX) e, antes disso, o que separa abordagem de
 * spam: quem não diz de onde tirou o número está escondendo alguma coisa.
 *
 * **Sempre oferecer a saída, na primeira mensagem.** Uma linha de descarte
 * custa nada e é a diferença entre "não tenho interesse" e uma denúncia de
 * spam — que no WhatsApp é o que derruba o número.
 *
 * **Nada de número inventado.** Preço e limite saem de `lib/plans.ts`. Prova
 * social não entra: este produto não tem cliente externo, e a decisão travada
 * do projeto é não inventar nenhum.
 *
 * ## Por que curta
 *
 * A mensagem é lida no WhatsApp, na tela do celular, por alguém no meio do
 * expediente. Acima de ~500 caracteres ela vira bloco de texto e é descartada
 * sem leitura. `TETO` trava isso, e tem teste.
 */

/** Acima disto o WhatsApp mostra "Ler mais" e a mensagem morre ali. */
export const TETO = 560

export type DadosDaAbordagem = {
  /** O domínio, que é como a pessoa reconhece a própria empresa. */
  dominio: string
  /** O nome do negócio, quando o título da página o revela. */
  nome?: string | null
  /** O nicho, que decide o gancho. */
  vertical: string
  /** Os motivos que a pontuação encontrou — só os que a mensagem pode citar. */
  motivos: string[]
  /** Preço e limite vêm de `lib/plans.ts`, nunca escritos à mão aqui. */
  precoMensal: number
  limiteGratis: number
  /**
   * O primeiro nome de quem decide, quando `dominio/decisor.ts` conseguiu casar
   * o perfil com ESTA empresa. `null` é o caso comum e é seguro.
   *
   * Chamar pelo nome atravessa a recepção. Chamar pelo nome ERRADO queima a
   * abordagem na primeira palavra — por isso o extrator devolve `null` em vez
   * de arriscar, e por isso aqui a saudação simplesmente volta a ser genérica.
   */
  decisor?: string | null
}

/**
 * O gancho por nicho, escrito na linguagem de quem vende ali.
 *
 * Cada um nomeia o momento em que o dinheiro escapa naquele negócio — e todos
 * são formulados como PERGUNTA, porque afirmar seria inventar.
 */
const GANCHO: Record<string, string> = {
  dedetizacao:
    'Quando você manda um orçamento e o cliente não responde, quem lembra de cobrar de volta?',
  'comunicacao-visual':
    'Quando você manda um orçamento e o cliente some, o retorno fica na memória de quem?',
  marcenaria:
    'Projeto de planejados demora semanas para fechar. Como você acompanha quem ainda está decidindo?',
  'locacao-equipamentos':
    'Quando uma locação está terminando, quem lembra de oferecer a renovação?',
  'eventos-corporativos':
    'Depois que a proposta do evento sai, quem acompanha o cliente até a assinatura?',
}

const GANCHO_PADRAO =
  'Quando você manda um orçamento e o cliente não responde, quem lembra de cobrar de volta?'

/**
 * As duas linhas que NUNCA podem ser cortadas, e o defeito que provou isso.
 *
 * A primeira versão montava a mensagem inteira e cortava no fim. Rodando contra
 * 90 prospects reais, a saída terminava assim:
 *
 *     "Se não fizer sentido, me avisa que…"
 *
 * O corte comeu exatamente a linha de descarte — a que transforma "não tenho
 * interesse" em resposta em vez de denúncia de spam, e que no WhatsApp é o que
 * separa um número vivo de um número banido. O teste passava, porque ele
 * conferia o TAMANHO e não o que sobrou.
 *
 * Agora o excesso sai do que é opcional (a linha da equipe), nunca do fim.
 */

/**
 * O nome que a pessoa reconhece. Título de página vem com cauda de SEO
 * ("Gráfica Quatrocor | Impressão em São Paulo"), e chamar a empresa pelo
 * título inteiro denuncia que a mensagem foi montada por máquina.
 */
export function nomeCurto(nome: string | null | undefined, dominio: string): string {
  if (!nome) return dominio
  const limpo = nome.split(/[|—–\-:•]/)[0].replace(/\s+/g, ' ').trim()
  if (limpo.length < 3 || limpo.length > 40) return dominio
  return limpo
}

/**
 * A mensagem de primeiro contato, pronta para colar no WhatsApp.
 *
 * Devolve texto puro: **este módulo não envia nada**, e isso é decisão. Envio
 * automatizado em volume é exatamente o que faz o WhatsApp banir um número, e
 * o número aqui é o do dono. Quem aperta enviar é uma pessoa.
 */
export function montarAbordagem(d: DadosDaAbordagem): string {
  const nome = nomeCurto(d.nome, d.dominio)
  const gancho = GANCHO[d.vertical] ?? GANCHO_PADRAO

  // Só cita equipe quando o próprio site disse que ela existe. Sem isso, a
  // frase vira suposição sobre o negócio de outra pessoa.
  const temEquipe = d.motivos.includes('tem equipe de vendas')
  const linhaEquipe = temEquipe
    ? ' Como vocês são mais de um no atendimento, entra todo mundo pelo mesmo preço.'
    : ''

  const montar = (equipe: string) =>
    [
      d.decisor
        ? `Oi, ${d.decisor}! Achei a ${nome} procurando empresas do setor no Google.`
        : `Oi! Achei a ${nome} procurando empresas do setor no Google.`,
      gancho,
      `Montei um CRM pra isso: cada orçamento vira um card, com a data do retorno. ` +
        `R$ ${d.precoMensal} pela empresa toda, sem cobrar por usuário.${equipe}`,
      `Dá pra testar de graça até ${d.limiteGratis} contatos, sem cartão. Sem fidelidade: ` +
        `cancela pela própria tela e leva seus dados em CSV.`,
      `Se não fizer sentido, me avisa que não te procuro de novo.`,
    ].join('\n\n')

  const completa = montar(linhaEquipe)
  // O que sai quando não cabe é o OPCIONAL. O fim é intocável.
  return completa.length <= TETO ? completa : montar('')
}
