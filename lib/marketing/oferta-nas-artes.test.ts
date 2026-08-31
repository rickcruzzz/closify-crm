import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { FREE_LEAD_LIMIT, PRO_PLAN_PRICE } from '@/lib/plans'

/**
 * ## Os geradores de arte, travados contra a oferta vigente
 *
 * Este arquivo existe por causa de um defeito que quase foi publicado para
 * 10 mil pessoas.
 *
 * Em 31/08, `scripts/marketing/gerar-stories.py` ainda anunciava **"7 dias
 * com o Pro completo"** em quatro lugares — o reverse trial que a migration
 * 0057 removeu em 29/08. Uma das artes, `planos-1-teste.png`, ia além e
 * prometia "Contatos e colaboradores ILIMITADOS", que é exatamente a promessa
 * falsa que a landing removeu em 23/08: o Free tem teto de 50.
 *
 * As artes estavam prontas no disco, esperando publicação. Nada quebrou,
 * porque **imagem não compila** — e é justamente isso que torna esta classe
 * perigosa.
 *
 * É a terceira aparição dela neste projeto:
 *
 *   bio do Instagram    "gratis ate 300 contatos", meses depois do Free virar 50
 *   prints da landing   o vocabulario que a propria pagina tinha banido
 *   Stories             o trial aposentado dois dias antes
 *
 * ## Por que testar o GERADOR e não a imagem
 *
 * Nenhum `tsc`, `lint` ou `test` olha dentro de um PNG. O gerador é o último
 * ponto do caminho onde o texto ainda é texto — travá-lo aqui é o mais perto
 * que dá para chegar da arte sem OCR.
 *
 * ## Por que proibir palavra em vez de conferir número
 *
 * `perfil-instagram.ts` foi criado em 25/08 exatamente para impedir bio
 * desatualizada, derivando de `DIAS_DE_TRIAL` e `PRO_PLAN_PRICE`. Falhou
 * assim mesmo, porque derivar de constante protege contra mudança de
 * **valor**, não de **oferta**: quando o conceito inteiro some, a
 * interpolação continua compilando e vira mentira em silêncio.
 *
 * Por isso os dois tipos de teste convivem aqui — um exige que o número
 * venha da constante, o outro proíbe a palavra do que foi aposentado.
 */

const PASTA = join(process.cwd(), 'scripts', 'marketing')

/** Só os geradores de arte. `.mjs` são publicação e token, não desenham nada. */
const GERADORES = readdirSync(PASTA).filter((n) => n.endsWith('.py'))

/**
 * Comentário de Python, para separar o que a arte DIZ do que o código
 * explica. Os comentários registram o defeito de propósito — apagá-los para
 * o teste passar destruiria a memória de por que ele existe.
 */
function semComentarios(fonte: string): string {
  return fonte
    .split('\n')
    .filter((linha) => !linha.trim().startsWith('#'))
    .join('\n')
}

describe('geradores de arte não anunciam oferta aposentada', () => {
  it('existem geradores para conferir', () => {
    expect(GERADORES.length).toBeGreaterThanOrEqual(3)
  })

  /**
   * O reverse trial saiu na 0057 (29/08). Empresa nova nasce no Free, sem
   * `trial_ate`, com o teto de 50 valendo desde o primeiro instante.
   */
  it.each(GERADORES)('%s não promete trial', (nome) => {
    const codigo = semComentarios(readFileSync(join(PASTA, nome), 'utf-8'))
    expect(codigo).not.toMatch(/\d+\s*dias?\s+(com|de|gr[áa]tis|para testar)/i)
    expect(codigo).not.toMatch(/\btrial\b/i)
    expect(codigo).not.toMatch(/per[íi]odo de teste/i)
  })

  /**
   * "Ilimitado" é verdade para o Pro e mentira para o Free. O teste não
   * proíbe a palavra — proíbe ela ao lado de "grátis", que é a combinação
   * exata que a landing removeu em 23/08.
   */
  it.each(GERADORES)('%s não promete ilimitado no plano grátis', (nome) => {
    const codigo = semComentarios(readFileSync(join(PASTA, nome), 'utf-8'))
    const blocos = codigo.match(/[^\n]*gr[áa]tis[^\n]*/gi) ?? []
    for (const bloco of blocos) {
      expect(bloco.toLowerCase()).not.toContain('ilimitad')
    }
  })
})

describe('geradores de arte derivam a oferta do código', () => {
  /**
   * O preço escrito à mão bate hoje por manutenção, não por construção. Foi
   * assim que a bio anunciou "300 contatos" por meses.
   *
   * `gerar-feed.py` e `gerar-capa-facebook.py` importam `gerar-stories.py`
   * como `g`, então basta um deles ler `lib/plans.ts` — os outros herdam.
   */
  it('gerar-stories.py lê lib/plans.ts em vez de repetir os números', () => {
    const codigo = readFileSync(join(PASTA, 'gerar-stories.py'), 'utf-8')
    expect(codigo).toContain('lib" / "plans.ts')
    expect(codigo).toContain('FREE_LEAD_LIMIT')
    expect(codigo).toContain('PRO_PLAN_PRICE')
  })

  it.each(GERADORES)('%s não escreve preço em real à mão', (nome) => {
    const codigo = semComentarios(readFileSync(join(PASTA, nome), 'utf-8'))
    // `R$ {expressao}` é derivado e passa; `R$ 49` é literal e reprova.
    const literais = codigo.match(/R\$\s*\d+/g) ?? []
    expect(literais).toEqual([])
  })

  /**
   * A constante existe e é lida — mas se `lib/plans.ts` mudasse de forma, o
   * regex do gerador acharia outra coisa em silêncio. Este teste amarra as
   * duas pontas: o valor que o TypeScript exporta é o que a arte vai imprimir.
   */
  it('os valores vigentes são os que a arte vai usar', () => {
    expect(FREE_LEAD_LIMIT).toBe(50)
    expect(PRO_PLAN_PRICE).toBe(49)
  })
})

describe('geradores de arte publicam o domínio canônico', () => {
  /**
   * Sem `www` custa 980ms contra 255ms, medido em 25/08 — um redirecionamento
   * a mais para quem digita o que leu na arte. E arte não tem link clicável:
   * o que está escrito é literalmente o que a pessoa digita.
   */
  it.each(GERADORES)('%s não escreve o domínio sem www', (nome) => {
    const codigo = semComentarios(readFileSync(join(PASTA, nome), 'utf-8'))
    expect(codigo).not.toMatch(/["']velofunil\.com\.br["']/)
  })
})
