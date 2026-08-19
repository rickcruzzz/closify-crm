/**
 * O layout de auth carrega apenas o `<main>`.
 *
 * Layouts do App Router aninham, não substituem: não existe forma de este
 * arquivo desenhar uma casca para seis filhos e outra para dois. Então o
 * chrome desceu um nível, para os `layout.tsx` dos grupos `(entrada)` e
 * `(transicao)`, e o que sobra aqui é o que precisa existir uma vez só.
 *
 * `id="conteudo"` é o alvo do "pular para o conteúdo" do layout raiz, e
 * duplicá-lo em dois shells quebraria o link em silêncio.
 *
 * `tabIndex={-1}` porque só o `id` não basta: sem um alvo focável, parte dos
 * navegadores apenas define de onde o próximo Tab começa, sem mover o foco de
 * fato — a pessoa clica no atalho e nada acontece de perceptível.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="conteudo" tabIndex={-1} className="bg-background outline-none">
      {children}
    </main>
  )
}
