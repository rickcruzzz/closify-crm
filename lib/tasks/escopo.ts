/**
 * De quem são as tarefas que `/hoje` mostra: só as minhas, ou as da equipe.
 *
 * ## O defeito que este arquivo fecha
 *
 * O escopo vivia SÓ no `?escopo=` da URL, e o item "Hoje" da barra lateral
 * aponta para `/hoje` fixo. Consequência medida em produção, 26/08/2026:
 *
 *     escolheu "Da equipe"        Da equipe   /hoje?escopo=equipe
 *     foi para o Funil
 *     voltou para Hoje pelo menu  Minhas      /hoje          <- perdeu
 *
 * Quem escolhe "Da equipe", trabalha um pouco e volta encontra a tela de novo
 * em "Minhas", sem nada ter sido clicado. O dono reportou como "seleciono,
 * passa um tempo e sai".
 *
 * Filtro que se desfaz sozinho é pior que filtro que não existe: a pessoa não
 * confia mais no que está vendo, e passa a reconferir a cada vez.
 *
 * ## Por que cookie, e não estado no banco
 *
 * É preferência de visualização, não dado de negócio: não vale uma migration,
 * uma tabela nem uma escrita a cada clique. E precisa ser legível no SERVIDOR,
 * porque `/hoje` decide o escopo antes de renderizar — `localStorage` chegaria
 * tarde demais e a tela piscaria com a lista errada antes de se corrigir.
 */

/** Os dois escopos possíveis. */
export type EscopoDeTarefas = 'minhas' | 'equipe'

/**
 * Nome do cookie que guarda a última escolha.
 *
 * Sem `httpOnly` de propósito: quem escreve é o próprio seletor, no
 * navegador, e o valor não protege nada — é "minhas" ou "equipe". Tratá-lo
 * como segredo exigiria uma Server Action e uma ida à rede a cada clique num
 * filtro.
 */
export const COOKIE_ESCOPO = 'velofunil_hoje_escopo'

/** Um ano. Preferência de filtro não tem por que expirar antes disso. */
export const MAX_AGE_ESCOPO = 60 * 60 * 24 * 365

/**
 * Decide o escopo a partir da URL e da última escolha guardada.
 *
 * A URL vence sempre: link compartilhado ou botão "voltar" precisam mostrar
 * exatamente o que dizem, mesmo contrariando a preferência salva.
 *
 * "minhas" é o piso, e continua sendo. A tela responde "o que EU faço agora";
 * quem abre e vê quarenta tarefas de outras pessoas não tem o que fazer com
 * elas. O cookie só muda esse piso depois de a pessoa ter escolhido uma vez.
 */
export function resolverEscopo(
  daUrl: string | null | undefined,
  doCookie: string | null | undefined,
): EscopoDeTarefas {
  if (daUrl === 'equipe') return 'equipe'
  if (daUrl === 'minhas') return 'minhas'

  // Valor fora dos dois conhecidos é ignorado, tanto na URL quanto no cookie:
  // os dois são digitáveis por quem quiser.
  if (!daUrl && doCookie === 'equipe') return 'equipe'

  return 'minhas'
}
