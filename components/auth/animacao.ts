/**
 * As classes de entrada das telas de autenticação, num lugar só.
 *
 * Sem isto, a mesma sequência de sete utilitários apareceria copiada em oito
 * telas, e é assim que ritmos diferentes nascem: alguém ajusta a duração de
 * uma tela e as outras sete ficam para trás sem ninguém notar.
 *
 * O Tailwind 4 varre o texto bruto dos arquivos, sem análise de AST, então
 * classes declaradas como constante aqui são detectadas normalmente — o que
 * NÃO funcionaria é montar o nome por concatenação (`` `delay-passo-${n}` ``).
 * Por isso os cinco passos estão escritos por extenso.
 *
 * `fill-mode-both` acompanha todo `delay-*`: sem ele o elemento fica visível
 * durante a espera e some no instante em que a animação começa — um piscar
 * invertido, pior do que não animar.
 *
 * Uma distância só (`slide-in-from-bottom-2`, 8px) para a sequência inteira. O
 * que escalona é o atraso, não o percurso: percursos diferentes leem como
 * elementos brigando, não como uma tela entrando.
 */
const BASE = 'animate-in fade-in fill-mode-both ease-entrada duration-entrada'
const SOBE = `${BASE} slide-in-from-bottom-2`

/** Logo. Abre a sequência. */
export const passo1 = `${SOBE} delay-passo-1`
/** Título (e o ícone de estado, quando existe). */
export const passo2 = `${SOBE} delay-passo-2`
/** Descrição, entrada por provedor externo, arte do painel lateral. */
export const passo3 = `${SOBE} delay-passo-3`
/**
 * Os campos, como bloco único.
 *
 * Escalonar campo a campo empurraria o formulário para além de 500ms antes de
 * estar utilizável, e criaria uma camada de composição por campo para ganho
 * nenhum: ninguém lê um formulário linha a linha, lê o bloco.
 */
export const passo4 = `${SOBE} delay-passo-4`
/** Ação principal e o rodapé de troca de tela. */
export const passo5 = `${SOBE} delay-passo-5`
