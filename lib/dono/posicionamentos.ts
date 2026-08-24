/**
 * Os posicionamentos do Meta e o que cada um exige de um criativo.
 *
 * ## Por que esta lista existe, e por que ela é curta
 *
 * O Meta tem dezenas de posicionamentos, mas eles se resolvem em **três
 * proporções**: 1:1, 4:5 e 9:16. Uma arte serve a um posicionamento quando bate
 * a proporção — o resto (resolução, peso, duração) é qualidade, não encaixe.
 *
 * Tratar cada posicionamento como um formato separado produziria uma tela com
 * dez cartões quase idênticos, que é como a documentação do Meta é organizada e
 * é parte de por que ninguém a lê.
 *
 * ## De onde vêm os números
 *
 * Verificado na documentação do Meta em 20/08/2026, não de memória: mínimo
 * 1080p; H.264 em MP4/MOV; teto de 4GB, com upload mais confiável abaixo de
 * 1GB; Reels aceita até 90s; 15-60s é a faixa de melhor desempenho. A zona
 * segura vertical foi unificada em março de 2026 em torno do Reels, que é o
 * mais restritivo — quem passa nele passa em Stories também.
 *
 * Sem `server-only`: funções puras, testáveis.
 */

export type Proporcao = '1:1' | '4:5' | '9:16'

export type Posicionamento = {
  nome: string
  onde: string
  proporcao: Proporcao
}

/** Os dez lugares onde um anúncio aparece, agrupados pela proporção que pedem. */
export const POSICIONAMENTOS: Posicionamento[] = [
  { nome: 'Feed do Facebook', onde: 'o feed principal', proporcao: '4:5' },
  { nome: 'Feed do Instagram', onde: 'o feed principal', proporcao: '4:5' },
  { nome: 'Stories do Instagram', onde: 'tela cheia vertical', proporcao: '9:16' },
  { nome: 'Stories do Facebook', onde: 'tela cheia vertical', proporcao: '9:16' },
  { nome: 'Reels do Instagram', onde: 'vídeo curto vertical', proporcao: '9:16' },
  { nome: 'Reels do Facebook', onde: 'vídeo curto vertical', proporcao: '9:16' },
  { nome: 'Explorar do Instagram', onde: 'aba de descoberta', proporcao: '1:1' },
  { nome: 'Marketplace', onde: 'listagem de produtos', proporcao: '1:1' },
  { nome: 'Audience Network', onde: 'apps e sites parceiros', proporcao: '9:16' },
  { nome: 'Messenger', onde: 'caixa de entrada e stories', proporcao: '1:1' },
]

/** Tolerância de proporção: 2% cobre arredondamento de editor de vídeo. */
const TOLERANCIA = 0.02

const ALVOS: { proporcao: Proporcao; valor: number }[] = [
  { proporcao: '1:1', valor: 1 },
  { proporcao: '4:5', valor: 4 / 5 },
  { proporcao: '9:16', valor: 9 / 16 },
]

export function proporcaoDe(largura: number, altura: number): Proporcao | null {
  if (largura <= 0 || altura <= 0) return null
  const razao = largura / altura
  return ALVOS.find((a) => Math.abs(razao - a.valor) <= TOLERANCIA)?.proporcao ?? null
}

export function posicionamentosPara(proporcao: Proporcao | null): Posicionamento[] {
  if (!proporcao) return []
  return POSICIONAMENTOS.filter((p) => p.proporcao === proporcao)
}

/** Onde a interface do Meta cobre o vídeo vertical, em fração da altura. */
export const ZONA_SEGURA = { topo: 0.14, rodape: 0.2, lados: 0.06 } as const

export type Reprovacao = { campo: string; motivo: string; comoResolver: string }

export type Analise = {
  aprovado: boolean
  proporcao: Proporcao | null
  posicionamentos: Posicionamento[]
  /** O que impede a peça de entrar. Vazio quando aprovada. */
  reprovacoes: Reprovacao[]
  /** Não impede, mas custa desempenho. */
  ressalvas: string[]
}

export type Candidato = {
  tipo: 'imagem' | 'video'
  largura: number
  altura: number
  /** Bytes. */
  peso: number
  /** Segundos. Só para vídeo. */
  duracao?: number
  /** Tipo MIME que o navegador informou. */
  mime: string
}

const MIMES_ACEITOS: Record<'imagem' | 'video', string[]> = {
  imagem: ['image/png', 'image/jpeg', 'image/webp'],
  video: ['video/mp4', 'video/quicktime'],
}

const UM_GIGA = 1024 * 1024 * 1024

/**
 * Decide se um arquivo entra, e explica o porquê quando não entra.
 *
 * ## A regra que governa esta função
 *
 * O pedido foi que **só entre conteúdo bom**. Então cada reprovação diz três
 * coisas: o que está errado, por que importa, e o que fazer. "Arquivo
 * inválido" transfere para a pessoa o trabalho de adivinhar, e o resultado é
 * ela desistir de testar criativo novo — que é a alavanca mais barata que
 * existe em tráfego pago.
 *
 * ## Reprovação x ressalva
 *
 * Reprova o que **quebra**: proporção que não existe no Meta, resolução abaixo
 * do mínimo, formato recusado pela plataforma, vídeo longo demais para o
 * vertical. Ressalva o que **custa desempenho** mas ainda roda: vídeo de três
 * minutos, arquivo pesado, quadrado onde o vertical rende mais.
 *
 * Bloquear o que apenas rende menos seria decidir pelo dono. Deixar passar o
 * que a plataforma recusa seria fazê-lo descobrir na hora de subir.
 */
export function analisar(candidato: Candidato): Analise {
  const reprovacoes: Reprovacao[] = []
  const ressalvas: string[] = []

  if (!MIMES_ACEITOS[candidato.tipo].includes(candidato.mime)) {
    reprovacoes.push({
      campo: 'formato',
      motivo: `${candidato.mime || 'formato desconhecido'} não é aceito pelo Meta.`,
      comoResolver:
        candidato.tipo === 'video'
          ? 'Exporte em MP4 (H.264) ou MOV, o padrão de qualquer editor.'
          : 'Salve como PNG, JPG ou WebP.',
    })
  }

  const proporcao = proporcaoDe(candidato.largura, candidato.altura)
  if (!proporcao) {
    reprovacoes.push({
      campo: 'proporção',
      motivo: `${candidato.largura}×${candidato.altura} não corresponde a nenhum formato do Meta.`,
      comoResolver:
        'Use 1080×1080 (quadrado), 1080×1350 (feed vertical) ou 1080×1920 (Stories e Reels).',
    })
  }

  // Abaixo de 1080 de largura a peça aparece esticada no celular — e celular é
  // praticamente todo o inventário do Meta.
  if (candidato.largura > 0 && candidato.largura < 1080) {
    reprovacoes.push({
      campo: 'resolução',
      motivo: `${candidato.largura}px de largura é menos que o mínimo de 1080px.`,
      comoResolver:
        'Exporte de novo com 1080px de largura ou mais. Ampliar o arquivo atual não resolve: o Meta precisa de pixels reais, não esticados.',
    })
  }

  if (candidato.peso > 4 * UM_GIGA) {
    reprovacoes.push({
      campo: 'tamanho',
      motivo: `${(candidato.peso / UM_GIGA).toFixed(1)} GB passa do teto de 4 GB do Meta.`,
      comoResolver: 'Exporte em H.264 com bitrate menor, ou corte o vídeo.',
    })
  } else if (candidato.peso > UM_GIGA) {
    ressalvas.push(
      'Acima de 1 GB: sobe e funciona, mas o processamento no Meta fica lento e às vezes falha.',
    )
  }

  if (candidato.tipo === 'video') {
    const duracao = candidato.duracao ?? 0

    if (duracao > 0 && duracao < 1) {
      reprovacoes.push({
        campo: 'duração',
        motivo: 'Vídeo com menos de 1 segundo.',
        comoResolver: 'O Meta exige pelo menos 1 segundo.',
      })
    }

    // Reels é o mais restritivo dos verticais, e desde março de 2026 o Meta
    // trata Stories e Reels sob a mesma régua. Desenhar para o mais apertado é
    // o que garante que a peça sirva aos dois.
    if (proporcao === '9:16' && duracao > 90) {
      reprovacoes.push({
        campo: 'duração',
        motivo: `${Math.round(duracao)}s passa do limite de 90s dos Reels.`,
        comoResolver: 'Corte para até 90 segundos, ou use este vídeo só no feed.',
      })
    }

    if (duracao > 60) {
      ressalvas.push(
        `${Math.round(duracao)}s é mais longo que a faixa de melhor desempenho (15 a 60 segundos).`,
      )
    } else if (duracao > 0 && duracao < 5) {
      ressalvas.push('Menos de 5 segundos costuma ser curto demais para a mensagem chegar.')
    }

    if (proporcao === '9:16') {
      ressalvas.push(
        'Vertical: mantenha texto e rosto fora dos 14% de cima e 20% de baixo: é onde a interface do Meta cobre o vídeo.',
      )
    }

    if (proporcao === '1:1') {
      ressalvas.push('Vídeo quadrado funciona, mas o vertical ocupa mais tela e costuma render mais.')
    }
  }

  return {
    aprovado: reprovacoes.length === 0,
    proporcao,
    posicionamentos: posicionamentosPara(proporcao),
    reprovacoes,
    ressalvas,
  }
}
