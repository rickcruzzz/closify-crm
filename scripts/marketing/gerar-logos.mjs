/**
 * Gera os arquivos da marca a partir do MESMO desenho que o produto usa.
 *
 *   node scripts/marketing/gerar-logos.mjs
 *
 * Grava em `marketing/marca/`, e o script copia para `criativos/organico/`
 * para a Central do Dono servir o download.
 *
 * ## Por que um gerador, e não um arquivo desenhado à mão
 *
 * Até 24/08 a marca existia **só** como componente React
 * (`components/branding/logo.tsx`) — não havia SVG nem PNG para baixar. Quem
 * precisasse dela para um post, um contrato ou um perfil de rede social teria
 * que recortar print, e o resultado divergiria do produto no primeiro ajuste.
 *
 * Os três caminhos abaixo são copiados VERBATIM do componente. Se o desenho
 * mudar lá, este arquivo passa a mentir — e é por isso que o teste
 * `logo.test.ts` compara os dois: ele quebra quando divergem, em vez de deixar
 * a marca oficial ficar para trás em silêncio.
 *
 * ## As variantes, e para que serve cada uma
 *
 * `simbolo-*`   o funil sozinho, sem o quadrado. Para favicon, marca-d'água,
 *               carimbo — onde o fundo já é da marca.
 * `selo-*`      o funil dentro do quadrado teal arredondado. É o avatar:
 *               perfil de Instagram, WhatsApp Business, Google Meu Negócio.
 * `completa-*`  selo + "Velo Funil". Para cabeçalho de documento, assinatura
 *               de e-mail, slide.
 *
 * Cada uma sai em duas cores: `teal` para fundo claro e `branco` para fundo
 * escuro. Não existe versão "colorida sobre qualquer fundo" de propósito —
 * marca que se adapta sozinha é marca que fica ilegível em metade dos casos.
 */
import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SAIDA = join(RAIZ, 'marketing', 'marca')
const PAINEL = join(RAIZ, 'criativos', 'organico')

/** Cores do tema, iguais às de `app/globals.css`. */
const TEAL = '#00bfc0'
const SOBRE_TEAL = '#031010' // --primary-foreground
const BRANCO = '#fafafa'
const CINZA = '#8c9c9c' // o "Funil" do wordmark, em peso normal

/**
 * Os três caminhos do símbolo, copiados de `components/branding/logo.tsx`.
 *
 * Três camadas que convergem: lidas juntas formam o funil e a letra V de Velo.
 * As larguras caem 18.8 → 10.2 → 2.2, e cada uma tem a base chanfrada no mesmo
 * ângulo — é o que mantém o V visível a 16px, onde o vão entre as camadas
 * quase some.
 */
export const CAMINHOS_DO_SIMBOLO = [
  'M2.6 4.4h18.8a.9.9 0 0 1 .72 1.44l-2.1 2.8a1.4 1.4 0 0 1-1.12.56H5.1a1.4 1.4 0 0 1-1.12-.56l-2.1-2.8A.9.9 0 0 1 2.6 4.4Z',
  'M6.9 10.6h10.2a.9.9 0 0 1 .72 1.44l-1.72 2.3a1.4 1.4 0 0 1-1.12.56H9.02a1.4 1.4 0 0 1-1.12-.56l-1.72-2.3a.9.9 0 0 1 .72-1.44Z',
  'M10.9 16.6h2.2a.9.9 0 0 1 .72 1.44l-1.1 1.47a.9.9 0 0 1-1.44 0l-1.1-1.47a.9.9 0 0 1 .72-1.44Z',
]

const caminhos = (cor) =>
  CAMINHOS_DO_SIMBOLO.map((d) => `    <path d="${d}" />`).join('\n')

function simbolo(cor) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="256" height="256" role="img" aria-label="Velo Funil">
  <g fill="${cor}">
${caminhos(cor)}
  </g>
</svg>
`
}

/**
 * O selo: símbolo dentro do quadrado arredondado.
 *
 * O símbolo ocupa 56% do lado (proporção de `size-4.5` dentro de `size-8` no
 * componente) e o raio é 22% — os dois medidos do produto, não escolhidos aqui.
 */
function selo(fundo, marca) {
  const LADO = 256
  const raio = LADO * 0.22
  const escala = (LADO * 0.56) / 24
  const desloc = (LADO - LADO * 0.56) / 2

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LADO} ${LADO}" width="${LADO}" height="${LADO}" role="img" aria-label="Velo Funil">
  <rect width="${LADO}" height="${LADO}" rx="${raio}" fill="${fundo}" />
  <g transform="translate(${desloc} ${desloc}) scale(${escala})" fill="${marca}">
${caminhos(marca)}
  </g>
</svg>
`
}

/**
 * A marca completa: selo + "Velo Funil".
 *
 * "Velo" em semibold e "Funil" em peso normal e cor apagada — a hierarquia que
 * separa a MARCA da CATEGORIA. Sem esse contraste o lockup lê como duas
 * palavras soltas.
 *
 * A fonte é declarada como família, não embutida: quem abrir sem Geist vê a
 * fallback, e é melhor do que um arquivo de 60KB por causa de duas palavras.
 * Para uso onde o tipo precisa ser exato, existe a versão `-contorno`, com o
 * texto convertido.
 */
function completa(corTexto, corCategoria, fundoSelo, marcaSelo) {
  const S = 64
  const raio = S * 0.22
  const escala = (S * 0.56) / 24
  const desloc = (S - S * 0.56) / 2

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 64" width="300" height="64" role="img" aria-label="Velo Funil">
  <rect width="${S}" height="${S}" rx="${raio}" fill="${fundoSelo}" />
  <g transform="translate(${desloc} ${desloc}) scale(${escala})" fill="${marcaSelo}">
${caminhos(marcaSelo)}
  </g>
  <text x="84" y="41" font-family="Geist, 'Segoe UI', system-ui, sans-serif" font-size="30" letter-spacing="-0.5">
    <tspan fill="${corTexto}" font-weight="600">Velo </tspan><tspan fill="${corCategoria}" font-weight="400">Funil</tspan>
  </text>
</svg>
`
}

const ARQUIVOS = {
  // Símbolo sozinho
  'simbolo-teal.svg': simbolo(TEAL),
  'simbolo-branco.svg': simbolo(BRANCO),
  'simbolo-preto.svg': simbolo(SOBRE_TEAL),
  // Selo (avatar)
  'selo-teal.svg': selo(TEAL, SOBRE_TEAL),
  'selo-escuro.svg': selo('#0a0a0a', TEAL),
  'selo-branco.svg': selo(BRANCO, TEAL),
  // Marca completa
  'completa-fundo-claro.svg': completa('#0a0a0a', CINZA, TEAL, SOBRE_TEAL),
  'completa-fundo-escuro.svg': completa(BRANCO, CINZA, TEAL, SOBRE_TEAL),
}

mkdirSync(SAIDA, { recursive: true })
mkdirSync(PAINEL, { recursive: true })

for (const [nome, conteudo] of Object.entries(ARQUIVOS)) {
  const destino = join(SAIDA, nome)
  writeFileSync(destino, conteudo, 'utf-8')
  copyFileSync(destino, join(PAINEL, nome))
  console.log(`  ${nome}`)
}

console.log(`\n${Object.keys(ARQUIVOS).length} arquivos em marketing/marca/`)
console.log('copiados para criativos/organico/ — aparecem em /dono/destaques')
