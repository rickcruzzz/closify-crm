/**
 * As duas decisões do arrasto do Kanban, fora do componente para poderem ser
 * testadas sem navegador.
 *
 * As duas existem por causa do mesmo defeito: `React #185` — *Maximum update
 * depth exceeded* — registrado quatro vezes em `/kanban` entre 20/08 e 05/09,
 * sempre ao arrastar um card.
 */

/**
 * Escolhe entre a colisão por PONTEIRO e a por canto mais próximo.
 *
 * ## O laço que isto abre
 *
 * O padrão do dnd-kit é `rectIntersection`: quem decide a coluna alvo é o
 * RETÂNGULO do card arrastado. Só que mover o card entre colunas durante o
 * arrasto muda a altura das duas colunas — e portanto muda o próprio retângulo
 * que acabou de decidir:
 *
 *     retangulo decide a coluna alvo
 *        -> o card re-renderiza dentro da outra coluna
 *        -> as duas colunas mudam de altura, o retangulo MUDA
 *        -> a deteccao recalcula e devolve a coluna anterior
 *        -> o card volta   ... laco, e React #185
 *
 * O ponteiro não se move quando a lista se re-organiza. Trocando a entrada da
 * detecção do retângulo pelo cursor, a saída deixa de ser consequência da
 * própria escrita, e o ciclo se abre. É por isso que a alternância acontecia
 * justamente na FRONTEIRA entre duas colunas, e por isso nunca reproduzia sob
 * demanda.
 *
 * ## Por que o segundo argumento não é enfeite
 *
 * `pointerWithin` devolve vazio quando não há ponteiro — o que é exatamente o
 * caso do arrasto por TECLADO, e o `KeyboardSensor` está registrado no board.
 * Sem o fallback, arrastar com o teclado deixaria de funcionar por completo.
 *
 * O fallback é uma FUNÇÃO, e não um array, porque `dragOver` dispara a cada
 * movimento do cursor e `closestCorners` percorre todo droppable registrado —
 * as seis colunas mais um por card na tela. Calcular os dois a cada movimento
 * para descartar um seria pagar a varredura à toa no caminho mais quente do
 * board.
 */
export function escolherColisao<T>(
  doPonteiro: T[],
  deCantoMaisProximo: () => T[],
): T[] {
  return doPonteiro.length > 0 ? doPonteiro : deCantoMaisProximo()
}

/**
 * O card deve ser movido para a coluna sob o cursor, agora?
 *
 * ## Por que a guarda não pode ler o estado
 *
 * A versão anterior comparava `etapaAtual === etapaAlvo` lendo o estado
 * `deals`. Falhava por dois motivos independentes:
 *
 * 1. **Estado é velho dentro do lote do React.** Vários `dragOver` no mesmo
 *    lote leem o valor anterior, passam pela guarda e disparam `setDeals` de
 *    novo, cada um criando um array novo e um render novo.
 * 2. **Ela só barra o alvo IGUAL ao atual.** Não barra a alternância
 *    `A -> B -> A -> B`, que é a forma exata do laço.
 *
 * `etapaPrevista` vem de um `ref`, que é síncrono: escrito no mesmo `dragOver`
 * que decidiu mover, é lido já atualizado pelo `dragOver` seguinte do mesmo
 * lote. É a camada que segura mesmo se a detecção por ponteiro oscilar.
 */
export function deveAplicarPreview({
  etapaPrevista,
  etapaAtual,
  etapaAlvo,
}: {
  /** O último alvo já aplicado neste arrasto. `null` no começo de cada um. */
  etapaPrevista: string | null
  /** A etapa em que o card está, segundo o estado. */
  etapaAtual: string | undefined
  /** A etapa sob o cursor. */
  etapaAlvo: string | undefined
}): boolean {
  if (!etapaAtual || !etapaAlvo) return false
  if (etapaPrevista === etapaAlvo) return false
  return etapaAtual !== etapaAlvo
}
