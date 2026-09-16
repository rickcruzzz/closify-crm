import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Nenhum travessão no texto que chega ao usuário.
 *
 * ## Por que isto é teste e não combinado
 *
 * A regra já existia, e pela metade: `oferta-nas-artes.test.ts` proíbe
 * travessão nos criativos desde 31/08, e o `briefing-criativos.md` o lista em
 * "Proibido, sem exceção". Mesmo assim ele continuava em 91 lugares do produto,
 * porque nada verificava fora das artes.
 *
 * O dono pediu a remoção definitiva em 16/09, depois de encontrar um numa tela.
 * "Definitivo" é o que este arquivo entrega: combinado depende de alguém
 * lembrar, teste falha sozinho.
 *
 * ## Por que o travessão sai
 *
 * Quase ninguém digita um. Ele é pontuação de texto editado, e num produto
 * inteiro escrito na voz de quem fala com o cliente ele denuncia texto de
 * máquina. Na mensagem de prospecção o custo é direto: ela precisa parecer uma
 * pessoa escrevendo, e o travessão é a assinatura de que não é.
 *
 * ## O que a varredura NÃO olha, e por quê
 *
 * **Comentário.** Ele é interno, o usuário nunca lê, e a documentação deste
 * projeto vive neles: proibir ali seria custo puro. Por isso a varredura lê
 * literal de string, não o arquivo inteiro.
 *
 * O hífen comum continua valendo em palavra composta e em intervalo numérico.
 */

const RAIZES = ['components', 'app', 'lib']
/**
 * O travessao (`—`) e sempre proibido.
 *
 * A meia risca (`–`) so passa entre NUMEROS, que e o uso tipografico
 * correto dela: `1-160 de 385`, intervalo de datas. Ali ela nao e prosa e
 * ninguem a le como texto de maquina. Fora de intervalo, cai na mesma regra.
 *
 * Funcao e nao expressao unica: a regra tem duas metades, e a versao com
 * lookbehind ficou ilegivel na primeira tentativa.
 */
function temTravessao(texto: string): boolean {
  if (texto.includes('—')) return true
  return /–/.test(texto.replace(/[\d}]\s?–\s?[\d$]/g, ''))
}

/** Arquivos de código, sem entrar em `node_modules` nem em build. */
function listar(raiz: string): string[] {
  const achados: string[] = []
  for (const nome of readdirSync(raiz)) {
    const caminho = join(raiz, nome)
    if (nome === 'node_modules' || nome.startsWith('.')) continue
    if (statSync(caminho).isDirectory()) {
      achados.push(...listar(caminho))
    } else if (/\.tsx?$/.test(nome)) {
      achados.push(caminho)
    }
  }
  return achados
}

/**
 * Os literais de string do arquivo, pulando comentário.
 *
 * Varredura caractere a caractere em vez de expressão regular: a prosa dos
 * comentários daqui é longa e cheia de aspas, e qualquer regex de string
 * acabava casando por cima dela.
 */
function literais(src: string): string[] {
  const achados: string[] = []
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (c === '/' && src[i + 1] === '/') {
      const fim = src.indexOf('\n', i)
      i = fim === -1 ? src.length : fim
      continue
    }
    if (c === '/' && src[i + 1] === '*') {
      const fim = src.indexOf('*/', i + 2)
      i = fim === -1 ? src.length : fim + 2
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1
      while (j < src.length) {
        if (src[j] === String.fromCharCode(92)) {
          j += 2
          continue
        }
        if (src[j] === c) break
        if (c !== '`' && src[j] === '\n') break
        j += 1
      }
      achados.push(src.slice(i, j + 1))
      i = j + 1
      continue
    }
    i += 1
  }
  return achados
}

describe('nenhum travessão no texto do produto', () => {
  it('não existe em literal de string sob components, app e lib', () => {
    const culpados: string[] = []
    for (const raiz of RAIZES) {
      for (const arquivo of listar(raiz)) {
        if (arquivo.endsWith('sem-travessao.test.ts')) continue
        const src = readFileSync(arquivo, 'utf8')
        if (!temTravessao(src)) continue
        for (const literal of literais(src)) {
          if (temTravessao(literal)) culpados.push(`${arquivo}: ${literal.slice(0, 80)}`)
        }
      }
    }
    expect(culpados).toEqual([])
  })

  it('CONTROLE: a varredura acha um travessão quando ele existe', () => {
    // Sem isto, um erro na leitura dos literais faria o teste passar sempre e
    // a regra viraria enfeite. É o defeito do `conferir-documentos.mjs` em
    // 04/09: o carimbo não podia conter `>`, nenhum era lido, e o script
    // imprimia "documentos batem".
    expect(literais(`const x = 'a \u2014 b'`).some((l) => temTravessao(l))).toBe(true)
  })

  it('CONTROLE: comentário NÃO é varrido', () => {
    expect(literais(`// isto \u2014 é comentário\nconst x = 'ok'`)).toEqual([`'ok'`])
    expect(literais(`/* bloco \u2014 aqui */\nconst y = 'ok'`)).toEqual([`'ok'`])
  })

  it('CONTROLE: hífen comum continua permitido', () => {
    expect(temTravessao('segunda-feira, 10-20 contatos')).toBe(false)
  })

  it('CONTROLE: meia risca passa em INTERVALO e cai em prosa', () => {
    // O uso legítimo, que os cinco casos do produto usam.
    expect(temTravessao('1–160 de 385')).toBe(false)
    expect(temTravessao('12/09 – 15/09')).toBe(false)
    // O uso que ela não pode ter: separando frase, como travessão disfarçado.
    expect(temTravessao('o sistema avisa – e voce decide')).toBe(true)
  })
})
