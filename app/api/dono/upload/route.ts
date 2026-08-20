import { mkdir, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'

import { medirImagemNoServidor } from '@/lib/dono/criativos'
import { analisar, type Candidato } from '@/lib/dono/posicionamentos'
import { exigirAmbienteLocal } from '@/lib/dono/somente-local'

/**
 * Recebe uma peça e grava na pasta certa.
 *
 * ## Por que a validação acontece nos DOIS lados
 *
 * O navegador mede antes de enviar para dar resposta imediata: um vídeo de
 * 200 MB em proporção errada é recusado em um segundo, sem subir nada.
 *
 * Mas medição no cliente é **informação**, não autorização — e isso não é
 * teoria: durante a construção, um arquivo de 720×720 declarado como
 * 1080×1080 passou pela conferência e entrou na biblioteca. Por isso a medida
 * de imagem é refeita aqui, dos bytes reais, e o número que o cliente mandou é
 * descartado.
 *
 * Mesma doutrina que este projeto já pagou três vezes em produção: regra que
 * só vive no cliente não é regra.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Sem isso, o Next corta o corpo em 1MB e vídeo nenhum passa. */
export const maxDuration = 300

const EXTENSAO_POR_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
}

const QUATRO_GIGA = 4 * 1024 * 1024 * 1024

/**
 * Transforma o que a pessoa escreveu num nome de arquivo seguro.
 *
 * Nome de arquivo vindo de fora é entrada não confiável: barras, `..` e
 * caracteres de controle são o caminho clássico para escrever fora da pasta.
 * Em vez de tentar limpar o nome original, esta função **constrói um novo** a
 * partir do que sobrou — é mais fácil garantir que algo é seguro quando você
 * mesmo montou.
 */
function nomeSeguro(nomeOriginal: string, mime: string): string {
  const semExtensao = nomeOriginal.replace(/\.[^.]+$/, '')
  const limpo = semExtensao
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 60)

  // Carimbo de tempo evita que reenviar a mesma arte sobrescreva a anterior em
  // silêncio — testar criativo é gerar variação, não substituir.
  const carimbo = new Date().toISOString().slice(0, 16).replace(/[:T-]/g, '')

  return `${limpo || 'peca'}-${carimbo}${EXTENSAO_POR_MIME[mime] ?? extname(nomeOriginal)}`
}

export async function POST(requisicao: Request) {
  await exigirAmbienteLocal()

  const formulario = await requisicao.formData()
  const arquivo = formulario.get('arquivo')
  const destino = formulario.get('destino')

  if (!(arquivo instanceof File)) {
    return Response.json({ erro: 'Nenhum arquivo recebido.' }, { status: 400 })
  }

  // Anúncio e orgânico vivem em pastas separadas: são materiais com critérios
  // e ciclos de vida diferentes, e misturá-los faria a galeria do anúncio
  // encher de conteúdo que nunca vai virar campanha.
  const pasta = destino === 'organico' ? 'organico' : 'anuncio'

  if (arquivo.size > QUATRO_GIGA) {
    return Response.json(
      { erro: 'Arquivo acima do teto de 4 GB do Meta.' },
      { status: 413 },
    )
  }

  if (!EXTENSAO_POR_MIME[arquivo.type]) {
    return Response.json(
      { erro: `${arquivo.type || 'formato desconhecido'} não é aceito. Use PNG, JPG, WebP, MP4 ou MOV.` },
      { status: 415 },
    )
  }

  const bytes = Buffer.from(await arquivo.arrayBuffer())
  const ehVideo = arquivo.type.startsWith('video/')

  // Para IMAGEM, a medida sai dos bytes reais — o que o cliente afirmou é
  // ignorado. Isso não é preciosismo: testado, um arquivo de 720×720 declarado
  // como 1080×1080 passava pela conferência e entrava na biblioteca. Regra que
  // só vive no cliente não é regra, e este projeto já pagou essa lição três
  // vezes em produção (migrations 0019, 0023 e 0024).
  //
  // Para VÍDEO, a dimensão está nos átomos do contêiner e lê-la aqui exigiria
  // interpretar o formato à mão ou instalar ffmpeg — peso desproporcional para
  // uma tela que roda só na máquina do dono. Aqui a medida do navegador é
  // aceita, e a limitação fica registrada em vez de escondida: o risco real é
  // uma peça ruim entrar na biblioteca, não um estranho escrever no disco, já
  // que a rota inteira está atrás do gate de ambiente local.
  const medidaDaImagem = ehVideo ? null : medirImagemNoServidor(bytes)

  const candidato: Candidato = {
    tipo: ehVideo ? 'video' : 'imagem',
    largura: medidaDaImagem?.largura ?? Number(formulario.get('largura')) ?? 0,
    altura: medidaDaImagem?.altura ?? Number(formulario.get('altura')) ?? 0,
    duracao: ehVideo ? Number(formulario.get('duracao')) || undefined : undefined,
    peso: arquivo.size,
    mime: arquivo.type,
  }

  const analise = analisar(candidato)
  if (!analise.aprovado) {
    return Response.json(
      { erro: analise.reprovacoes[0]?.motivo ?? 'Peça reprovada.', reprovacoes: analise.reprovacoes },
      { status: 422 },
    )
  }

  const raiz = join(process.cwd(), 'criativos', pasta)
  await mkdir(raiz, { recursive: true })

  const nome = nomeSeguro(arquivo.name, arquivo.type)
  await writeFile(join(raiz, nome), new Uint8Array(bytes))

  return Response.json({
    ok: true,
    arquivo: nome,
    destino: pasta,
    posicionamentos: analise.posicionamentos.map((p) => p.nome),
    ressalvas: analise.ressalvas,
  })
}

/**
 * Qualquer outro método também responde 404 em produção.
 *
 * Sem este handler, o Next responde `405 Method Not Allowed` a um GET — o que
 * é uma resposta correta e, ao mesmo tempo, confirma que a rota existe. É
 * vazamento pequeno, mas gratuito de fechar: aqui o gate roda primeiro e a
 * rota simplesmente não é, como todas as outras da Central.
 */
export async function GET() {
  await exigirAmbienteLocal()
  return Response.json({ erro: 'Use POST para enviar uma peça.' }, { status: 405 })
}
