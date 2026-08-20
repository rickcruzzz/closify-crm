import type { Candidato } from './posicionamentos'

/**
 * Mede um arquivo antes de enviá-lo.
 *
 * ## Por que medir no navegador
 *
 * Ele já sabe fazer isso. Para descobrir a duração de um MP4 no servidor seria
 * preciso interpretar os átomos do contêiner à mão ou instalar ffmpeg — peso
 * desproporcional para uma tela que roda na máquina do dono.
 *
 * E há um ganho maior que a simplicidade: medindo antes, um vídeo de 200 MB em
 * formato errado é recusado **na hora**, sem subir nada. A pessoa descobre o
 * problema em um segundo, não depois de esperar o upload inteiro.
 *
 * A autorização continua sendo do servidor (`app/api/dono/upload/route.ts`):
 * isto aqui é conveniência e velocidade, não a trava.
 */
export async function medirArquivo(arquivo: File): Promise<Candidato> {
  const tipo: 'imagem' | 'video' = arquivo.type.startsWith('video/') ? 'video' : 'imagem'

  const base = {
    tipo,
    peso: arquivo.size,
    mime: arquivo.type,
  } as const

  const url = URL.createObjectURL(arquivo)

  try {
    if (tipo === 'video') {
      const { largura, altura, duracao } = await medirVideo(url)
      return { ...base, largura, altura, duracao }
    }

    const { largura, altura } = await medirImagem(url)
    return { ...base, largura, altura }
  } catch {
    // Arquivo que o navegador não consegue decodificar entra com medida zero e
    // é reprovado pelas regras normais — com a mensagem sobre proporção e
    // resolução, que é mais útil do que "arquivo corrompido".
    return { ...base, largura: 0, altura: 0 }
  } finally {
    // Sem isso, cada arquivo arrastado deixa um blob preso na memória da aba —
    // o que aparece só depois de dezenas de tentativas, quando fica difícil
    // ligar a lentidão à causa.
    URL.revokeObjectURL(url)
  }
}

function medirVideo(url: string): Promise<{ largura: number; altura: number; duracao: number }> {
  return new Promise((resolver, rejeitar) => {
    const video = document.createElement('video')
    video.preload = 'metadata'

    // `loadedmetadata` é o evento certo: dispara assim que dimensão e duração
    // são conhecidas, sem baixar o vídeo inteiro.
    video.onloadedmetadata = () => {
      resolver({
        largura: video.videoWidth,
        altura: video.videoHeight,
        duracao: video.duration,
      })
    }

    video.onerror = () => rejeitar(new Error('não consegui ler o vídeo'))
    video.src = url
  })
}

function medirImagem(url: string): Promise<{ largura: number; altura: number }> {
  return new Promise((resolver, rejeitar) => {
    const imagem = new Image()
    imagem.onload = () => resolver({ largura: imagem.naturalWidth, altura: imagem.naturalHeight })
    imagem.onerror = () => rejeitar(new Error('não consegui ler a imagem'))
    imagem.src = url
  })
}
