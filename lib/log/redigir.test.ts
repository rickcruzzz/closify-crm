import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { caminhoNoLog, corpoDeErroNoLog, telefoneNoLog } from '@/lib/log/redigir'

describe('telefoneNoLog', () => {
  it('apaga o meio e guarda pais, DDD e os dois ultimos', () => {
    expect(telefoneNoLog('557185040900')).toBe('5571******00')
  })

  it('aceita o numero com mascara, e o TAMANHO e preservado', () => {
    // Treze digitos (com o nono), contra os doze do caso acima: a mascara
    // acompanha. Preservar o tamanho e o que deixa duas linhas do mesmo
    // incidente serem reconhecidas como do mesmo numero.
    expect(telefoneNoLog('+55 (71) 98504-0900')).toBe('5571*******00')
  })

  /**
   * O CONTROLE que importa: o numero inteiro NAO pode sobreviver a passagem.
   * Sem ele, uma expressao quebrada que devolvesse a entrada passaria nos
   * casos acima se eles fossem escritos com menos rigor.
   */
  it('o numero completo nunca aparece no resultado', () => {
    for (const n of ['557185040900', '5511999998888', '+55 71 3333-4444']) {
      const digitos = n.replace(/\D/g, '')
      const saida = telefoneNoLog(n)
      expect(saida).not.toContain(digitos)
      expect(saida).toContain('*')
    }
  })

  it('entrada curta ou ausente nao vira numero falso', () => {
    expect(telefoneNoLog(null)).toBe('(sem telefone)')
    expect(telefoneNoLog(undefined)).toBe('(sem telefone)')
    expect(telefoneNoLog('')).toBe('(sem telefone)')
    expect(telefoneNoLog('1234')).toBe('(sem telefone)')
  })
})

describe('corpoDeErroNoLog', () => {
  it('a mensagem curta do provedor passa inteira', () => {
    expect(corpoDeErroNoLog('{"error":"NOT_FOUND"}')).toBe('{"error":"NOT_FOUND"}')
  })

  /**
   * O ramo 401/403 e exatamente onde um provedor ecoa a requisicao, e era o
   * unico lugar que logava `erro.corpo` sem nada no meio.
   */
  it('apaga o que parece token', () => {
    const corpo = '{"message":"invalid","token":"F3A9B0C1D2E3F4A5B6C7D8E9F0A1B2C3"}'
    const saida = corpoDeErroNoLog(corpo)
    expect(saida).not.toContain('F3A9B0C1D2E3F4A5B6C7D8E9F0A1B2C3')
    expect(saida).toContain('[oculto]')
    // O resto continua legivel, senao o log deixa de servir.
    expect(saida).toContain('invalid')
  })

  it('corta o que for longo demais', () => {
    expect(corpoDeErroNoLog('x'.repeat(5000)).length).toBeLessThanOrEqual(300)
  })

  it('ausencia nao vira string vazia enganosa', () => {
    expect(corpoDeErroNoLog(null)).toBe('(sem corpo)')
    expect(corpoDeErroNoLog('')).toBe('(sem corpo)')
  })
})

/**
 * A varredura que impede a volta.
 *
 * Consertar as seis linhas resolve hoje. O que fecha a classe é isto: qualquer
 * `console.*` novo que interpole um telefone cru reprova aqui.
 */
describe('nenhum log interpola telefone cru', () => {
  const RAIZ = process.cwd()
  const PASTAS = ['lib', 'app']

  function arquivos(dir: string, achados: string[] = []): string[] {
    for (const nome of readdirSync(dir)) {
      if (nome === 'node_modules' || nome.startsWith('.')) continue
      const caminho = join(dir, nome)
      if (statSync(caminho).isDirectory()) arquivos(caminho, achados)
      else if (/\.tsx?$/.test(nome) && !nome.endsWith('.test.ts')) achados.push(caminho)
    }
    return achados
  }

  /**
   * Interpolação cujo nome fala de telefone, dentro de um `console.*`.
   *
   * Nova a cada chamada: `RegExp` com `/g` carrega `lastIndex`, e reusar o
   * mesmo objeto faz a varredura pular texto conforme a ordem. Foi assim que
   * a varredura de acentos nasceu cega em 18/09.
   */
  const cruNoLog = () =>
    /console\.(error|warn|log|info)[\s\S]{0,300}?\$\{[^}]*\b(telefone|phone|whatsapp)\b[^}]*\}/gi

  /** Já passou pelo redator, então não é cru. */
  const REDIGIDO = /telefoneNoLog\s*\(/

  it('varre e não acha', () => {
    const soltos: string[] = []
    for (const caminho of PASTAS.flatMap((p) => arquivos(join(RAIZ, p)))) {
      const codigo = readFileSync(caminho, 'utf-8')
      for (const achado of Array.from(codigo.matchAll(cruNoLog()))) {
        if (!REDIGIDO.test(achado[0])) {
          soltos.push(`${caminho.slice(RAIZ.length + 1)}: ${achado[0].slice(0, 90)}`)
        }
      }
    }
    expect(soltos).toEqual([])
  })

  /** O controle, sem o qual um regex quebrado aprova tudo para sempre. */
  it('CONTROLE: a varredura PEGA o telefone cru quando ele existe', () => {
    const ruim = 'console.error(`webhook: mensagem de +${mensagem.telefone} falhou`)'
    expect(Array.from(ruim.matchAll(cruNoLog())).length).toBeGreaterThan(0)
  })

  it('CONTROLE: a varredura NÃO acusa o já redigido', () => {
    const bom = 'console.error(`webhook: mensagem de ${telefoneNoLog(mensagem.telefone)} falhou`)'
    const achados = Array.from(bom.matchAll(cruNoLog()))
    expect(achados.every((a) => REDIGIDO.test(a[0]))).toBe(true)
  })
})

/**
 * O caminho da Z-API É a credencial, e ele ia cru para o log.
 *
 * `comInstancia` monta `/instances/{id}/token/{token}/{endpoint}`, e
 * `remetente-zapi.ts` logava `erro.caminho` na linha imediatamente abaixo do
 * `erro.corpo` que já passava pelo redator. Achado revisando o próprio
 * conserto, em 24/09.
 */
describe('caminhoNoLog', () => {
  const REAL = '/instances/3F95055E59F461E9B0CCB6C91C51ECC2/token/A1b2C3d4E5f6G7h8/send-text'

  it('o TOKEN some', () => {
    expect(caminhoNoLog(REAL)).not.toContain('A1b2C3d4E5f6G7h8')
  })

  it('o instanceId sobra só no começo, o bastante para distinguir empresas', () => {
    const saida = caminhoNoLog(REAL)
    expect(saida).toContain('3F95055E')
    expect(saida).not.toContain('3F95055E59F461E9B0CCB6C91C51ECC2')
  })

  it('o endpoint fica, que é o que diz qual chamada falhou', () => {
    expect(caminhoNoLog(REAL)).toContain('send-text')
    expect(caminhoNoLog('/instances/ABC/token/XYZ/status')).toContain('status')
  })

  it('caminho sem credencial passa inteiro', () => {
    expect(caminhoNoLog('/partner/instances')).toBe('/partner/instances')
  })

  it('ausência não vira caminho falso', () => {
    expect(caminhoNoLog(null)).toBe('(sem caminho)')
    expect(caminhoNoLog('')).toBe('(sem caminho)')
  })
})

/**
 * O base64 com `+`, `/` e `=` saía PICADO: o trecho longo era ocultado e o
 * pedaço depois do `+` sobrava legível. Segredo em pedaços é segredo vazado,
 * só que mais difícil de perceber.
 */
describe('corpoDeErroNoLog cobre os formatos reais de token', () => {
  it.each([
    ['JWT', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVP-mB92K27uhbUJU1p1r'],
    ['base64 com + / =', 'aGVsbG8rd29ybGQvdGhpcytpcytiYXNlNjQ=aGVsbG8rd29ybGQ='],
    ['basic auth', 'dXNlcm5hbWU6cGFzc3dvcmQxMjM0NTY3ODkw'],
    ['hex longo', 'F3A9B0C1D2E3F4A5B6C7D8E9F0A1B2C3'],
  ])('%s não sobrevive, nem em pedaços', (_nome, segredo) => {
    const saida = corpoDeErroNoLog(`{"erro":"recusado","t":"${segredo}"}`)
    // Nenhum trecho de 12+ caracteres do segredo pode sobreviver: é assim que
    // se pega o vazamento PARCIAL, que o teste anterior deixava passar.
    for (let i = 0; i + 12 <= segredo.length; i += 4) {
      expect(saida).not.toContain(segredo.slice(i, i + 12))
    }
  })

  it('CONTROLE: a mensagem do provedor continua legível', () => {
    expect(corpoDeErroNoLog('{"error":"NOT_FOUND"}')).toContain('NOT_FOUND')
    expect(corpoDeErroNoLog('{"message":"invalid phone"}')).toContain('invalid phone')
  })
})
