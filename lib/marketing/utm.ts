/**
 * A forma canônica de um valor de UTM, usada pelos dois lados do funil.
 *
 * ## Por que não mora em `lib/dono/atribuicao.ts`, onde nasceu
 *
 * Quem lê `utm_content` são duas superfícies com públicos opostos: a Central do
 * Dono, para dizer qual peça trouxe cliente, e a página de cadastro, para
 * continuar a promessa do anúncio que a pessoa acabou de clicar. A segunda é
 * pública e a primeira devolve 404 em produção — importar `lib/dono/` de dentro
 * de uma página de cadastro acoplaria as duas pelo lado errado.
 *
 * Duas cópias divergem, e a que diverge em silêncio é a escrita na hora. Este
 * projeto já pagou isso em 29/08, quando uma expressão regular escrita à mão
 * classificou 23 empresas como externas sendo 6, e o número errado foi repetido
 * em quatro documentos. Uma função, dois consumidores.
 */

/**
 * A faixa Unicode dos acentos que o `NFD` separa da letra (U+0300 a U+036F).
 *
 * Montada por `fromCharCode` de propósito, em vez de escrita direta no regex:
 * são caracteres COMBINANTES, invisíveis no editor, e o formatador do projeto
 * os reescreve para a forma literal em toda gravação. `\p{M}` seria o certo e
 * exige a flag `u`, que o `target` deste projeto não aceita (TS1501).
 */
const MARCAS_COMBINANTES = new RegExp(
  `[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`,
  'g',
)

/**
 * Reduz nome de campanha e valor de UTM à mesma forma comparável.
 *
 * Tudo que não é letra ou número vira separador, o acento sai, e a caixa é
 * baixada. `Velo Funil — aquisicao (cadastro)` e `aquisicao_cadastro` viram
 * `velo-funil-aquisicao-cadastro` e `aquisicao-cadastro`.
 *
 * Quem monta a URL do anúncio digita à mão e não pode escrever espaço,
 * travessão nem parêntese nela — então comparar por igualdade crua faria um
 * cliente pagante desaparecer do relatório, e faria o eco da promessa não
 * aparecer para quem clicou. Ver `casarComCampanha` e `ecoDaPeca`.
 */
export const chaveDeUtm = (valor: string | null | undefined): string =>
  (valor ?? '')
    .normalize('NFD')
    .replace(MARCAS_COMBINANTES, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/**
 * Os parâmetros que dizem de onde a visita veio. Nada além deles atravessa.
 *
 * `utm_term` entra porque é onde o Google Ads escreve a palavra-chave; os
 * outros são os mesmos que `components/landing/utm-capture.tsx` captura.
 */
const PARAMETROS_DE_ORIGEM = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'gclid',
  'fbclid',
]

/**
 * Filtra uma query string, deixando só o que identifica a origem da visita.
 *
 * ## O vazamento que isto fecha
 *
 * O anúncio de busca leva a `/quanto-custa-um-crm`, não direto a `/cadastro` —
 * casar o título da página com o que a pessoa digitou sobe o Índice de
 * Qualidade e derruba o CPC, que é a única alavanca que faz R$ 25/dia caber.
 *
 * O CTA daquela página apontava para `/cadastro` **sem query nenhuma**. A
 * atribuição sobrevive (o `UtmCapture` mora no layout raiz e já gravou o cookie
 * na primeira página), mas `ecoDaPeca` lê a URL — e sem `utm_content` ele cai no
 * texto padrão, tirando o "grátis, sem cartão" justamente diante dos quatro
 * campos, que é o ponto de maior atrito do funil inteiro.
 *
 * ## Por que uma lista, e não repassar a query inteira
 *
 * Repassar tudo carregaria para a página de cadastro qualquer parâmetro que
 * alguém pendurasse na URL — inclusive os que este projeto trata como
 * credencial. `/convite/<token>` já ensinou que caminho de URL vira dado
 * sensível sem avisar, e é por isso que o wrapper do Vercel Analytics higieniza
 * a rota antes de enviar. Lista fechada é a única forma de o comportamento não
 * mudar sozinho quando aparecer um parâmetro novo.
 */
export function parametrosDeOrigem(busca: string | null | undefined): string {
  if (!busca) return ''

  const entrada = new URLSearchParams(busca)
  const saida = new URLSearchParams()

  for (const nome of PARAMETROS_DE_ORIGEM) {
    const valor = entrada.get(nome)
    // Descarta valor vazio: `?utm_content=` na URL não diz de onde a visita
    // veio, e repassá-lo faria `ecoDaPeca` receber string vazia em vez de nada
    // — mesmo resultado, com uma URL mais suja para depurar.
    if (valor) saida.set(nome, valor)
  }

  const texto = saida.toString()
  return texto ? `?${texto}` : ''
}
