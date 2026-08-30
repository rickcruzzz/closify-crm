/**
 * O título e a descrição da tela de Resultados, num lugar só.
 *
 * ## O defeito que isto fecha
 *
 * `loading.tsx` e `page.tsx` desenham o MESMO cabeçalho e cada um tinha a sua
 * cópia da string. A renomeação de 19/08 tirou "Dashboard" do produto e a de
 * 22/08 trocou a descrição — mas só na página. O esqueleto de carregamento
 * ficou para trás e seguiu escrevendo, por dez dias:
 *
 *     Dashboard
 *     Métricas do seu funil de vendas.
 *
 * Ou seja: **toda visita à tela mostrava o jargão banido primeiro**, e ele só
 * virava "Resultados / Quanto entrou…" quando os dados chegavam. Quem abre a
 * tela lê o nome errado antes do certo, sempre — e num aparelho lento, por
 * mais tempo. Foi assim que apareceu numa gravação de tela do dono.
 *
 * Nenhum `tsc`, `lint` ou `test` compara um `loading.tsx` com o `page.tsx`
 * irmão: para as duas ferramentas, duas strings diferentes em dois arquivos
 * diferentes são apenas duas strings.
 *
 * Corrigir só o texto deixaria a causa de pé — a próxima renomeação
 * recriaria a divergência do mesmo jeito. Com uma constante, mudar o nome da
 * tela muda os dois ao mesmo tempo, por construção.
 */
export const CABECALHO_DOS_RESULTADOS = {
  /**
   * "Resultados", nunca "Dashboard": anglicismo que o PRD de copy bane
   * (`docs/prd-copy-sem-jargao.md`) e que a renomeação de 19/08 removeu do
   * produto inteiro.
   */
  titulo: 'Resultados',
  /**
   * O que a tela RESPONDE, não o que ela É. "Métricas do seu funil de vendas"
   * define a tela para quem já sabe o que é um funil; esta frase entrega a
   * resposta para quem abriu o sistema querendo saber quanto tem a receber.
   */
  descricao: 'Quanto entrou, quanto está em jogo e o que virou venda.',
} as const
