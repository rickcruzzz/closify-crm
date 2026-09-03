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
 *
 * ## `animate-entrada` no lugar de `animate-in`
 *
 * O quadro `enter` do tw-animate-css anima `filter` mesmo quando o desfoque é
 * zero, e isso basta para o Chrome recusar compor — a animação cai na thread
 * principal. `animate-entrada` (`app/globals.css`) é o mesmo quadro sem essa
 * linha, e lê as mesmas variáveis, então `fade-in` e `slide-in-from-bottom-2`
 * continuam valendo sem mudança nenhuma.
 *
 * Este arquivo é `.ts`, e foi por isso que ele quase ficou de fora: a varredura
 * que trocou os outros nove arquivos usava `--include=*.tsx`. O que o pegou foi
 * `document.getAnimations()` no navegador, contra o build de produção — quatro
 * animações de `/cadastro` ainda apareciam com o nome `enter`. Buscar no código
 * teria dado a resposta errada com aparência de completa.
 */
const BASE = 'animate-entrada fade-in fill-mode-both ease-entrada duration-entrada'
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
