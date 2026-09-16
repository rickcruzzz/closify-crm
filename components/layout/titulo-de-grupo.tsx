/**
 * O rótulo de uma seção da barra lateral ("PRINCIPAL", "CONFIGURAÇÕES",
 * "SUPORTE").
 *
 * Existe como componente próprio porque ele é usado em DOIS lugares que não se
 * enxergam: os grupos de `navGroups`, dentro de `sidebar-nav.tsx`, e o bloco
 * "Suporte" do rodapé, em `sidebar-content.tsx`. O segundo fica fora de
 * `navGroups` de propósito, porque "Ajuda e sugestões" é um diálogo e não uma
 * rota, e entrar na lista obrigaria o cálculo de item ativo a tratar um item
 * sem `href`.
 *
 * Duas cópias da mesma classe divergem, e a que diverge em silêncio é a que foi
 * escrita depois: um rótulo ficaria com peso ou espaçamento diferente do outro
 * e ninguém veria, porque os dois nunca aparecem lado a lado na mesma medida de
 * tela.
 */
export function TituloDeGrupoDaBarra({
  children,
  id,
}: {
  children: React.ReactNode
  /**
   * Quando informado, o bloco em volta aponta para cá com `aria-labelledby`.
   *
   * Sem isso o rótulo é decoração: quem enxerga lê "PRINCIPAL" e entende que os
   * seis itens abaixo formam um bloco; quem usa leitor de tela ouve onze links
   * seguidos, porque nada liga o texto ao grupo. A separação visual existe e a
   * programática não.
   */
  id?: string
}) {
  return (
    <span
      id={id}
      className="text-muted-foreground px-2.5 text-xs font-semibold tracking-wide uppercase"
    >
      {children}
    </span>
  )
}

/**
 * O mesmo rótulo quando a barra está recolhida: um filete.
 *
 * "CONFIGURAÇÕES" não cabe em 4,5rem, e abreviar rótulo de seção produz sigla
 * que ninguém decifra. O filete preserva o único trabalho que sobra ali:
 * separar um grupo do outro.
 */
export function FileteDeGrupoDaBarra() {
  return <span aria-hidden className="bg-sidebar-border mx-auto my-1 h-px w-6" />
}
