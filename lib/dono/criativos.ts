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

/**
 * Anúncio e orgânico vivem em pastas separadas.
 *
 * Não é organização por gosto: são materiais com critérios diferentes. Peça de
 * anúncio precisa caber num posicionamento pago e passa pela conferência de
 * qualidade; conteúdo orgânico tem outra régua e outro ciclo de vida. Numa
 * pasta só, a galeria do anúncio encheria de material que nunca vai virar
 * campanha, e achar a peça certa na hora de subir viraria trabalho.
 */
export type Destino = 'anuncio' | 'organico'

const EXTENSOES = ['.png', '.jpg', '.jpeg', '.webp', '.mp4', '.mov']
const EXTENSOES_DE_VIDEO = ['.mp4', '.mov']

export type Criativo = {
  arquivo: string
  destino: Destino
  /** Vídeo não é medido no servidor — ver `medir-no-navegador.ts`. */
  ehVideo: boolean
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
export function medirImagemNoServidor(bytes: Buffer): { largura: number; altura: number } {
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

/**
 * Lista as peças de um destino, medidas e classificadas.
 *
 * ## Por que vídeo entra sem medida
 *
 * A dimensão de um MP4 vive nos átomos do contêiner, e lê-la aqui exigiria
 * interpretar o formato à mão ou instalar ffmpeg — peso desproporcional para
 * uma tela local. O vídeo já foi medido no navegador **antes de subir**
 * (`medir-no-navegador.ts`), e a rota de upload recusa o que não passa. Então
 * o que está na pasta já foi aprovado: medir de novo aqui seria refazer um
 * trabalho cujo resultado não muda.
 */
export async function listarCriativos(destino: Destino): Promise<Criativo[]> {
  await exigirAmbienteLocal()

  const raiz = join(PASTA, destino)

  let arquivos: string[]
  try {
    arquivos = await readdir(raiz)
  } catch {
    // A pasta ainda não existe — é o estado do primeiro uso, não um erro.
    return []
  }

  const notas = await lerNotas()
  const pecas = arquivos.filter((a) => EXTENSOES.includes(extname(a).toLowerCase()))

  const criativos = await Promise.all(
    pecas.map(async (arquivo): Promise<Criativo | null> => {
      try {
        const caminho = join(raiz, arquivo)
        const ehVideo = EXTENSOES_DE_VIDEO.includes(extname(arquivo).toLowerCase())
        const info = await stat(caminho)

        // Só imagem é lida byte a byte: ver o bloco acima sobre vídeo.
        const { largura, altura } = ehVideo
          ? { largura: 0, altura: 0 }
          : medirImagemNoServidor(await readFile(caminho))

        return {
          arquivo,
          destino,
          ehVideo,
          peso: info.size,
          largura,
          altura,
          classificacao: classificar(largura, altura),
          modificadoEm: info.mtime.toISOString(),
          nota: notas[`${destino}/${arquivo}`] ?? '',
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

/**
 * Grava a anotação de uma peça.
 *
 * A chave carrega o destino (`anuncio/arte.png`) porque o mesmo nome de arquivo
 * pode existir nas duas pastas, e a anotação de uma não é a da outra.
 */
export async function anotarCriativo(
  destino: Destino,
  arquivo: string,
  nota: string,
): Promise<void> {
  await exigirAmbienteLocal()

  const chave = `${destino}/${arquivo}`
  const notas = await lerNotas()
  if (nota.trim()) notas[chave] = nota.trim()
  else delete notas[chave]

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
export async function caminhoSeguroDoCriativo(
  destino: string,
  arquivo: string,
): Promise<string | null> {
  // O destino vem da URL como qualquer outra parte dela: só os dois valores
  // conhecidos passam, nunca o que o chamador mandar.
  if (destino !== 'anuncio' && destino !== 'organico') return null
  if (arquivo.includes('/') || arquivo.includes('\\') || arquivo.includes('..')) return null
  if (!EXTENSOES.includes(extname(arquivo).toLowerCase())) return null

  const caminho = join(PASTA, destino, arquivo)
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
