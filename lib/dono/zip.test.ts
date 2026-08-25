import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { montarZip } from './zip'

/**
 * Estes testes existem porque ZIP escrito à mão falha de um jeito específico e
 * cruel: o arquivo abre numa ferramenta e é recusado por outra, e quem recusa
 * costuma ser justamente o aparelho de quem recebeu. Conferir só o tamanho do
 * `Uint8Array` aprovaria um arquivo corrompido.
 *
 * Por isso o teste principal manda o PowerShell (que usa o descompactador do
 * próprio Windows) extrair de verdade e compara os bytes que saem.
 */

/**
 * Extrai um zip com o descompactador do sistema, seja qual for.
 *
 * A primeira versão usava só `Expand-Archive` do PowerShell. Passava aqui, no
 * Windows, e derrubava o gate: o runner do CI é Linux e não tem PowerShell.
 *
 * Um teste que só roda numa das duas máquinas não trava nada — ele vira uma
 * falsa sensação de cobertura no lugar onde a cobertura mais importa, que é o
 * CI. Por isso tenta `unzip` primeiro (Linux, macOS, Git Bash) e cai para o
 * PowerShell no Windows.
 */
function extrair(arquivo: string, destino: string): void {
  const tentativas: Array<[string, string[]]> = [
    ['unzip', ['-q', '-o', arquivo, '-d', destino]],
    [
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `Expand-Archive -LiteralPath '${arquivo}' -DestinationPath '${destino}' -Force`,
      ],
    ],
  ]

  for (const [programa, argumentos] of tentativas) {
    try {
      execFileSync(programa, argumentos, { stdio: 'pipe' })
      return
    } catch (erro) {
      // `ENOENT` é "este programa não existe aqui": tenta o próximo. Qualquer
      // outro erro é o zip sendo recusado de verdade, e precisa falhar o teste.
      if ((erro as NodeJS.ErrnoException).code !== 'ENOENT') throw erro
    }
  }

  throw new Error('Nenhum descompactador disponível (tentei unzip e powershell).')
}

function texto(s: string): Uint8Array {
  return new TextEncoder().encode(s)
}

function u32(b: Uint8Array, i: number): number {
  return new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(i, true)
}

describe('montarZip', () => {
  it('começa com a assinatura de cabeçalho local', () => {
    const z = montarZip([{ nome: 'a.txt', conteudo: texto('oi') }])
    expect(u32(z, 0)).toBe(0x04034b50)
  })

  it('termina com o fim do diretório central, com a contagem certa', () => {
    const z = montarZip([
      { nome: 'a.txt', conteudo: texto('um') },
      { nome: 'b.txt', conteudo: texto('dois') },
    ])

    // O fim do diretório são os últimos 22 bytes quando não há comentário.
    const fim = z.length - 22
    expect(u32(z, fim)).toBe(0x06054b50)

    const dv = new DataView(z.buffer, z.byteOffset, z.byteLength)
    expect(dv.getUint16(fim + 8, true)).toBe(2)
    expect(dv.getUint16(fim + 10, true)).toBe(2)
  })

  it('grava o mesmo número nos dois campos de tamanho', () => {
    // Sem compressão os tamanhos são iguais, e divergir aqui é o erro clássico
    // de quem escreve ZIP à mão: alguns descompactadores aceitam, outros
    // recusam o arquivo inteiro — e o que recusa costuma ser o do celular de
    // quem recebeu.
    const conteudo = texto('conteudo de teste com 33 caracteres')
    const z = montarZip([{ nome: 'a.txt', conteudo }])

    expect(u32(z, 18)).toBe(conteudo.length)
    expect(u32(z, 22)).toBe(conteudo.length)
  })

  it('marca o nome como UTF-8', () => {
    // Sem o bit 11, quem extrai assume a página de código local (CP437 no
    // Windows) e nome com acento chega corrompido.
    const z = montarZip([{ nome: 'ação.txt', conteudo: texto('x') }])
    const flags = new DataView(z.buffer, z.byteOffset, z.byteLength).getUint16(6, true)
    expect(flags & 0x0800).toBe(0x0800)
  })

  it('data fora da faixa do MS-DOS não gera lixo no cabeçalho', () => {
    // O formato só representa de 1980 a 2107. Gravar um ano fora disso
    // estouraria o campo e faria descompactador recusar o arquivo.
    const antigo = montarZip([{ nome: 'a', conteudo: texto('x') }], new Date('1970-01-01'))
    const ano = (new DataView(antigo.buffer, antigo.byteOffset, antigo.byteLength).getUint16(12, true) >> 9) + 1980
    expect(ano).toBe(1980)
  })

  it('zip vazio continua sendo um zip válido', () => {
    const z = montarZip([])
    expect(z.length).toBe(22)
    expect(u32(z, 0)).toBe(0x06054b50)
  })

  it('o Windows extrai e os bytes voltam idênticos', () => {
    // A prova que importa: não basta parecer um ZIP, tem que ABRIR no
    // descompactador que a pessoa do outro lado vai usar.
    const pasta = mkdtempSync(join(tmpdir(), 'zip-teste-'))

    try {
      // Bytes que passam de 127, para pegar qualquer conversão indevida para
      // texto no caminho — o defeito silencioso mais provável aqui.
      const binario = new Uint8Array(512)
      for (let i = 0; i < binario.length; i += 1) binario[i] = (i * 7) % 256

      const z = montarZip([
        { nome: 'primeiro.txt', conteudo: texto('linha um\nlinha dois') },
        { nome: 'segundo.bin', conteudo: binario },
      ])

      const arquivo = join(pasta, 'saida.zip')
      writeFileSync(arquivo, z)

      const destino = join(pasta, 'extraido')
      extrair(arquivo, destino)

      expect(readFileSync(join(destino, 'primeiro.txt'), 'utf8')).toBe('linha um\nlinha dois')
      expect(new Uint8Array(readFileSync(join(destino, 'segundo.bin')))).toEqual(binario)
    } finally {
      rmSync(pasta, { recursive: true, force: true })
    }
  })
})
