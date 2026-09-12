/**
 * Em qual empresa a prospecção grava, e de quais ela lê.
 *
 * ## Por que isto virou módulo próprio
 *
 * O mesmo nome estava escrito em dois lugares com valores DIFERENTES:
 * `prateleira-actions.ts` grava em `'Prospeccao'` e `prateleira-queries.ts` lê
 * de `['Prospeccao', 'Orne']`. As duas listas estão certas — são perguntas
 * diferentes —, e enquanto viviam em arquivos separados nada dizia isso.
 *
 * O webhook da Evolution precisa das DUAS: procurar o contato em qualquer uma
 * das empresas onde a prospecção já gravou, e criar na única onde ela grava
 * hoje. Deixar uma terceira cópia nascer no webhook era a armadilha que este
 * projeto já registra em letras grandes — *"duas cópias divergem, e a que
 * diverge em silêncio é a que você escreveu"*.
 *
 * ## O filtro por NOME é uma trava de segurança, não conveniência
 *
 * `prateleira-queries.ts` deixa o motivo escrito: a Central lê com
 * `createAdminClient()`, que ignora RLS. Sem restringir por nome, os contatos
 * de um cliente real entrariam na fila de prospecção e receberiam mensagem
 * fria — e o erro seria silencioso, porque a linha pareceria só mais um
 * prospect.
 *
 * O webhook herda a mesma trava pelo mesmo motivo, e uma razão a mais: ele
 * resolve a empresa **pelo nome, no servidor**, nunca a partir do payload. A
 * rota antiga (`/api/webhooks/evolution/[workspaceId]/[segredo]`, removida em
 * `c52a718`) aceitava o UUID de quem chamasse, e por isso quem conhecesse o
 * segredo injetava mensagem falsa no funil de qualquer empresa. Aqui não há
 * UUID na requisição — não existe o que forjar.
 */

/** Onde a prospecção CRIA contato. Uma só, e é a nova. */
export const EMPRESA_DA_PROSPECCAO = 'Prospeccao'

/**
 * Onde a prospecção PROCURA contato.
 *
 * `Orne` é herança das rodadas de 06 e 07/09, que gravaram 257 leads lá antes
 * de a empresa dedicada existir. Tirá-la da lista faria esses contatos
 * sumirem da fila e voltarem a receber abordagem — a segunda vez.
 */
export const EMPRESAS_DE_PROSPECCAO = ['Prospeccao', 'Orne'] as const
