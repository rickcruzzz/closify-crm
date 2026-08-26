/**
 * Segura na tela a tarefa que acabou de ser concluída, até o tempo de desfazer
 * acabar.
 *
 * ## O defeito que isto fecha
 *
 * `/hoje` marca a tarefa como concluída sem tirá-la da lista: ela fica riscada
 * no lugar por alguns segundos, com um "Desfazer" ao lado, e só então some.
 *
 * Isso nunca funcionou em produção. `concluirTarefa` chama
 * `revalidatePath('/hoje')`, o servidor devolve a lista já SEM a tarefa
 * concluída, e o efeito que sincroniza props com estado
 * (`hoje-client.tsx`) substituía a lista inteira — apagando a linha poucos
 * milissegundos depois do clique.
 *
 * O dono viu e reportou: "quando clico aqui some instantaneamente".
 *
 * ## Por que uma função pura, e não mais um `useState`
 *
 * O estado antigo tentava ser duas coisas: espelho do servidor e rascunho do
 * que está saindo. As duas brigam a cada revalidação, e o servidor sempre
 * ganha.
 *
 * Separando, cada um faz uma coisa só: `tasks` espelha o servidor e pode ser
 * sobrescrito à vontade; `saindo` guarda quem está na janela. A lista da tela
 * vira derivada — e derivada não tem corrida.
 */

/** Uma tarefa segurada na tela, com a posição que ela ocupava. */
export type EmSaida<T> = {
  task: T
  /**
   * Onde ela estava quando foi concluída.
   *
   * Não é enfeite. Sem a posição, a linha riscada reapareceria no fim da
   * lista: o olho a perde, e o "Desfazer" fica impossível de acertar
   * justamente quando a pessoa percebe que errou.
   */
  indice: number
}

/**
 * A lista que a tela mostra: o que o servidor mandou, mais quem ainda está
 * saindo, cada um de volta ao lugar de onde saiu.
 *
 * Não muta nenhuma das entradas.
 */
export function mesclarSaindo<T extends { id: string }>(
  doServidor: readonly T[],
  saindo: ReadonlyMap<string, EmSaida<T>>,
): T[] {
  if (saindo.size === 0) return [...doServidor]

  const jaEstao = new Set(doServidor.map((t) => t.id))

  // Ordem crescente de índice: inserir de trás para frente empurraria as
  // posições seguintes e o segundo item cairia no lugar errado.
  const paraInserir = Array.from(saindo.values())
    .filter((s) => !jaEstao.has(s.task.id))
    .sort((a, b) => a.indice - b.indice)

  const resultado = [...doServidor]

  for (const { task, indice } of paraInserir) {
    // Índice fora do intervalo acontece quando o servidor devolve uma lista
    // menor — por exemplo, alguém em outra aba concluiu três tarefas enquanto
    // esta janela corria. Prender ao fim é melhor que `splice` silenciosamente
    // ignorar e a linha sumir do jeito que este arquivo existe para evitar.
    const posicao = Math.max(0, Math.min(indice, resultado.length))
    resultado.splice(posicao, 0, task)
  }

  return resultado
}
