/**
 * Quando um sinal de "estou processando" deixa de valer.
 *
 * ## O defeito que motivou o arquivo
 *
 * `deal-detail-sheet.tsx` guardava `concluindo: boolean` e, no caminho de
 * sucesso, **não** o desligava. O comentário explicava o motivo, e ele era
 * bom: entre a Server Action resolver e o RSC revalidado chegar existe uma
 * janela real em que um segundo clique dispara a ação de novo — medido com
 * clique duplo de verdade. Deixar travado até a revalidação chegar fechava
 * essa janela.
 *
 * A aposta era que a revalidação **esconderia** o botão. Ela quebra quando o
 * negócio tem outra tarefa aberta: essa vira a próxima ação, o botão continua
 * renderizado, e o sinal fica ligado para sempre — só fechar e reabrir o
 * painel destrava. Foi o que apareceu no print do dono: "Concluir" apagado,
 * com spinner, ao lado de uma próxima ação viva.
 *
 * ## Por que a correção é de desenho, e não um `setState(false)` a mais
 *
 * Um booleano só sabe que **algo** está em voo. Ele não tem como saber que o
 * algo mudou, então nada pode invalidá-lo — nem o próprio dado que ele
 * descrevia. Guardar o **alvo** em vez do fato resolve por construção: quando
 * a tarefa em voo deixa de ser a tarefa da tela, o sinal para de valer
 * sozinho, sem ninguém precisar lembrar de desligá-lo.
 *
 * A proteção contra clique duplo continua inteira: enquanto o alvo for o
 * mesmo, o sinal continua ligado e o segundo clique continua barrado.
 *
 * Isto vive fora do React de propósito. É a única forma de travar a regra em
 * teste neste projeto — componente não se testa aqui, e a regra é justamente
 * o que ninguém enxerga lendo o componente.
 */
export function processando<T>(emVoo: T | null | undefined, alvoNaTela: T | null | undefined): boolean {
  // Nada em voo: nada processando. Simples, e precisa ser dito — `undefined
  // === undefined` seria `true` e travaria a tela sem nenhum clique.
  if (emVoo === null || emVoo === undefined) return false

  // O alvo sumiu da tela (a tarefa foi concluída e não há outra). O sinal não
  // tem mais o que descrever: quem o desenhava não existe.
  if (alvoNaTela === null || alvoNaTela === undefined) return false

  // Só continua valendo enquanto for a MESMA coisa. Outra tarefa assumindo
  // significa que a anterior terminou.
  return emVoo === alvoNaTela
}
