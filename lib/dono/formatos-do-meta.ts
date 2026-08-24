/**
 * Os formatos de imagem que o Meta aceita bem, e como classificar uma arte.
 *
 * ## Por que isto existe
 *
 * Descobrir que a arte está fora de medida só na hora de subir no Gerenciador
 * é o tipo de atrito que faz a pessoa desistir de testar criativo novo — e
 * testar criativo é a alavanca mais barata que existe em tráfego pago. Saber
 * na galeria, antes de subir, custa nada.
 *
 * Sem `server-only`: função pura, sem I/O, testável.
 */

export type FormatoDoMeta = {
  nome: string
  onde: string
  largura: number
  altura: number
}

/**
 * As três medidas que cobrem quase tudo no Meta hoje.
 *
 * Não é a lista completa que a Meta aceita — é a lista do que vale a pena
 * produzir. Quadrado para o feed, retrato alto para Stories e Reels, e o 4:5
 * que ocupa mais tela vertical no feed do celular sem virar Stories.
 */
export const FORMATOS: FormatoDoMeta[] = [
  { nome: 'Feed quadrado', onde: 'Feed do Facebook e Instagram', largura: 1080, altura: 1080 },
  { nome: 'Feed retrato', onde: 'Feed no celular, ocupa mais tela', largura: 1080, altura: 1350 },
  { nome: 'Stories e Reels', onde: 'Tela cheia vertical', largura: 1080, altura: 1920 },
]

/** Tolerância de proporção. */
const TOLERANCIA = 0.02

export type Classificacao =
  | { serve: true; formato: FormatoDoMeta; exato: boolean; observacao?: string }
  | { serve: false; motivo: string; sugestao: FormatoDoMeta }

/**
 * Diz em que formato do Meta uma imagem se encaixa.
 *
 * ## Por que a proporção decide, e não o tamanho exato
 *
 * O Meta redimensiona a imagem; o que ele não conserta é proporção errada —
 * uma arte 1:1 num espaço 9:16 aparece cortada ou com barras. Então uma imagem
 * 2160×2160 (o dobro do Feed quadrado) **serve perfeitamente**, e recusá-la por
 * não bater o número exato seria pedir retrabalho por nada.
 *
 * O que ainda vale avisar é resolução baixa demais: abaixo da medida
 * recomendada a imagem sobe, mas aparece borrada no celular — e imagem borrada
 * é dinheiro gasto para parecer amador.
 */
export function classificar(largura: number, altura: number): Classificacao {
  if (largura <= 0 || altura <= 0) {
    return { serve: false, motivo: 'Não consegui ler o tamanho da imagem.', sugestao: FORMATOS[0] }
  }

  const proporcao = largura / altura

  for (const formato of FORMATOS) {
    const alvo = formato.largura / formato.altura
    if (Math.abs(proporcao - alvo) > TOLERANCIA) continue

    const exato = largura === formato.largura && altura === formato.altura
    const pequena = largura < formato.largura

    return {
      serve: true,
      formato,
      exato,
      observacao: pequena
        ? `${largura}×${altura} é menor que o recomendado (${formato.largura}×${formato.altura}), pode aparecer borrada no celular.`
        : exato
          ? undefined
          : `${largura}×${altura}, proporção certa. O Meta redimensiona sozinho.`,
    }
  }

  // Fora de qualquer proporção: sugere a mais próxima, porque "está errado" sem
  // dizer o que fazer é só reclamação.
  const maisProxima = FORMATOS.reduce((melhor, f) => {
    const dMelhor = Math.abs(proporcao - melhor.largura / melhor.altura)
    const dEsta = Math.abs(proporcao - f.largura / f.altura)
    return dEsta < dMelhor ? f : melhor
  }, FORMATOS[0])

  return {
    serve: false,
    motivo: `${largura}×${altura} não bate com nenhum formato do Meta. O mais próximo é ${maisProxima.nome} (${maisProxima.largura}×${maisProxima.altura}).`,
    sugestao: maisProxima,
  }
}
