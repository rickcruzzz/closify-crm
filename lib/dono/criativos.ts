import 'server-only'

import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'

import { classificar, type Classificacao } from './formatos-do-meta'
import { exigirAmbienteLocal } from './somente-local'

/**
 * A pasta onde as artes de anúncio ficam.
 *
 * ## Por que aqui, e não em `public/`
 *
 * O que está em `public/` entra no build e vai para o ar: as artes ficariam
 * acessíveis por URL pública, subiriam a cada deploy e pesariam em todo build.
 * Arte de anúncio não é conteúdo do site — é material de trabalho, e material
 * de trabalho não se publica junto com o produto.
 *
 * Fora do Git também, pelo mesmo motivo de peso e porque criativo é iteração:
 * dez variações de um anúncio não são dez versões de código.
 */
const PASTA = join(process.cwd(), 'criativos')
const NOTAS = join(PASTA, '.notas.json')

const EXTENSOES = ['.png', '.jpg', '.jpeg', '.webp']

export type Criativo = {
  arquivo: string
  /** Tamanho em bytes. */
  peso: number
  largura: number
  altura: number
  classificacao: Classificacao
  modificadoEm: string
  /** O que o dono anotou sobre esta arte. */
  nota: string
}

/**
 * Lê largura e altura direto dos bytes do arquivo.
 *
 * ## Por que não usar uma biblioteca
 *
 * Adicionar uma dependência de processamento de imagem ao `package.json` do
 * produto, para uma tela que só roda na máquina do dono, é peso que todo build
 * de produção passaria a carregar. O cabeçalho de PNG, JPEG e WebP tem a
 * dimensão nos primeiros bytes e o formato está documentado há décadas — ler
 * na mão custa esta função e nada mais.
 */
function medir(bytes: Buffer): { largura: number; altura: number } {
  // PNG: assinatura de 8 bytes, depois o chunk IHDR com largura e altura em
  // big-endian nas posições 16 e 20.
  if (bytes.length > 24 && bytes.toString('hex', 0, 4) === '89504e47') {
    return { largura: bytes.readUInt32BE(16), altura: bytes.readUInt32BE(20) }
  }

  // WebP: "RIFF" + tamanho + "WEBP". Só o formato VP8L simples é lido aqui; os
  // outros caem no retorno zerado, que a tela mostra como "não consegui ler".
  if (bytes.length > 30 && bytes.toString('ascii', 0, 4) === 'RIFF') {
    const formato = bytes.toString('ascii', 12, 16)
    if (formato === 'VP8 ') {
      return { largura: bytes.readUInt16LE(26) & 0x3fff, altura: bytes.readUInt16LE(28) & 0x3fff }
    }
    if (formato === 'VP8L') {
      const bits = bytes.readUInt32LE(21)
      return { largura: (bits & 0x3fff) + 1, altura: ((bits >> 14) & 0x3fff) + 1 }
    }
  }

  // JPEG: percorre os marcadores até achar um SOF (Start of Frame), que é onde
  // a dimensão vive. Os marcadores têm tamanho variável, então não há posição
  // fixa como no PNG.
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2
    while (i < bytes.length - 9) {
      if (bytes[i] !== 0xff) {
        i++
        continue
      }
      const marcador = bytes[i + 1]
      // SOF0..SOF15, pulando SOF4 (DHT), SOF8 (JPG) e SOF12 (DAC), que não
      // carregam dimensão.
      const ehSof =
        marcador >= 0xc0 && marcador <= 0xcf && marcador !== 0xc4 && marcador !== 0xc8 && marcador !== 0xcc
      if (ehSof) {
        return { altura: bytes.readUInt16BE(i + 5), largura: bytes.readUInt16BE(i + 7) }
      }
      i += 2 + bytes.readUInt16BE(i + 2)
    }
  }

  return { largura: 0, altura: 0 }
}

async function lerNotas(): Promise<Record<string, string>> {
  try {
    return JSON.parse(await readFile(NOTAS, 'utf8')) as Record<string, string>
  } catch {
    // Sem arquivo de notas ainda, ou arquivo corrompido: nenhuma nota é um
    // estado perfeitamente válido e não pode derrubar a galeria.
    return {}
  }
}

/** Lista as artes disponíveis, medidas e classificadas. */
export async function listarCriativos(): Promise<Criativo[]> {
  await exigirAmbienteLocal()

  let arquivos: string[]
  try {
    arquivos = await readdir(PASTA)
  } catch {
    // A pasta ainda não existe — é o estado do primeiro uso, não um erro.
    return []
  }

  const notas = await lerNotas()
  const imagens = arquivos.filter((a) => EXTENSOES.includes(extname(a).toLowerCase()))

  const criativos = await Promise.all(
    imagens.map(async (arquivo): Promise<Criativo | null> => {
      try {
        const caminho = join(PASTA, arquivo)
        const [info, bytes] = await Promise.all([stat(caminho), readFile(caminho)])
        const { largura, altura } = medir(bytes)

        return {
          arquivo,
          peso: info.size,
          largura,
          altura,
          classificacao: classificar(largura, altura),
          modificadoEm: info.mtime.toISOString(),
          nota: notas[arquivo] ?? '',
        }
      } catch {
        // Um arquivo ilegível não pode esconder os outros da galeria.
        return null
      }
    }),
  )

  return criativos
    .filter((c): c is Criativo => c !== null)
    .sort((a, b) => b.modificadoEm.localeCompare(a.modificadoEm))
}

/** Grava a anotação de uma arte. */
export async function anotarCriativo(arquivo: string, nota: string): Promise<void> {
  await exigirAmbienteLocal()

  const notas = await lerNotas()
  if (nota.trim()) notas[arquivo] = nota.trim()
  else delete notas[arquivo]

  await writeFile(NOTAS, JSON.stringify(notas, null, 2), 'utf8')
}

/**
 * Devolve o caminho absoluto de uma arte, recusando qualquer coisa que tente
 * sair da pasta.
 *
 * `../../.env.local` num nome de arquivo é a travessia de diretório clássica.
 * A rota que serve as imagens roda com a permissão do processo do Next e leria
 * qualquer arquivo da máquina se confiasse no que vem da URL — mesmo sendo uma
 * rota local, um `<img src>` numa página maliciosa aberta no mesmo navegador
 * poderia tentar.
 */
export async function caminhoSeguroDoCriativo(arquivo: string): Promise<string | null> {
  if (arquivo.includes('/') || arquivo.includes('\\') || arquivo.includes('..')) return null
  if (!EXTENSOES.includes(extname(arquivo).toLowerCase())) return null

  const caminho = join(PASTA, arquivo)
  // Cinto e suspensório: mesmo com as checagens acima, confirma que o caminho
  // resolvido continua dentro da pasta.
  if (!caminho.startsWith(PASTA)) return null

  try {
    await stat(caminho)
    return caminho
  } catch {
    return null
  }
}
