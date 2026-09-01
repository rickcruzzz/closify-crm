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

/**
 * ## O travessão, banido do conteúdo em 31/08
 *
 * A landing, as telas de erro, os e-mails transacionais e as páginas legais
 * perderam o travessão em 26/08: ele é um dos sinais mais reconhecíveis de
 * texto gerado por máquina, e cada ocorrência foi reescrita pela pontuação que
 * o caso pedia (ponto final, dois-pontos, vírgula), nunca trocada por hífen.
 *
 * **Os criativos ficaram de fora daquela limpeza** e chegaram a 31/08 com 11
 * travessões no texto que vai para a arte. Publicar assim entrega a 11 mil
 * pessoas exatamente a assinatura que o resto do produto passou uma sessão
 * inteira removendo.
 *
 * O teste lê o texto por AST, não por regex: docstring e comentário registram
 * decisões e usam travessão à vontade, e um regex sobre o arquivo inteiro
 * reprovaria a memória do projeto junto com o defeito.
 */
describe('geradores de arte não usam travessão', () => {
  it.each(GERADORES)('%s não tem travessão no texto das artes', (nome) => {
    const codigo = semComentarios(readFileSync(join(PASTA, nome), 'utf-8'))
    // Fora de comentário, o que resta com travessão são strings e docstrings.
    // Docstring aqui é sempre triple-quoted, então basta ignorá-las.
    const semDocstrings = codigo.replace(/"""[\s\S]*?"""/g, '')
    const linhas = semDocstrings.split('\n').filter((l) => /[—–]/.test(l))
    expect(linhas).toEqual([])
  })
})

/**
 * As legendas são o outro lado do post: a arte carrega a ideia, elas carregam
 * o contexto. Mesma regra, mesmo motivo.
 */
describe('as legendas publicadas não usam travessão', () => {
  it.each(['legendas.md', 'calendario.md'])('%s', (nome) => {
    const texto = readFileSync(
      join(process.cwd(), 'marketing', 'instagram', nome),
      'utf-8',
    )
    expect(texto).not.toMatch(/[—–]/)
  })
})

/**
 * ## O contraste do registro claro
 *
 * As peças claras usam os tokens do modo claro do produto, e o teal MUDA de
 * valor entre os registros: o `#00BFC0` que funciona sobre o fundo escuro dá
 * ~1,9:1 sobre off-white — ilegível.
 *
 * O modo claro do produto já tinha resolvido isso baixando a luminosidade
 * para 0.5, e a arte herda a solução em vez de repetir o erro que a landing
 * pagou em 26/08, quando cartão branco sobre página branca dava 1,10:1.
 *
 * Contraste de arte não some com aviso. Some com alguém não conseguindo ler
 * no sol, e ninguém reporta isso: a pessoa passa o dedo.
 */
describe('o registro claro das artes tem contraste legível', () => {
  const luminancia = ([r, g, b]: number[]) => {
    const c = (v: number) => {
      const x = v / 255
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b)
  }
  const razao = (a: number[], b: number[]) => {
    const [alto, baixo] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
    return (alto + 0.05) / (baixo + 0.05)
  }

  /** Os mesmos valores de `gerar-stories.py`, convertidos de globals.css. */
  const FUNDO = [246, 248, 249]
  const casos: [string, number[], number][] = [
    ['título', [10, 10, 10], 7],
    ['corpo', [94, 101, 101], 4.5],
    ['teal do claro', [0, 120, 122], 4.5],
    ['linha de fonte', [104, 112, 112], 4.5],
  ]

  it.each(casos)('%s sobre o fundo claro', (_nome, cor, piso) => {
    expect(razao(cor, FUNDO)).toBeGreaterThanOrEqual(piso)
  })

  /**
   * O controle negativo: prova que o teste mede alguma coisa. O teal do
   * registro escuro precisa REPROVAR sobre o fundo claro — se ele passasse,
   * o piso estaria baixo demais para servir de trava.
   */
  it('o teal do registro escuro reprovaria sobre o claro', () => {
    expect(razao([0, 191, 192], FUNDO)).toBeLessThan(4.5)
  })

  /** Os valores estão no gerador, não só neste teste. */
  it('o gerador declara os tokens do modo claro', () => {
    const codigo = readFileSync(join(PASTA, 'gerar-stories.py'), 'utf-8')
    for (const nome of ['FUNDO_CLARO', 'TEXTO_CLARO', 'TEAL_NO_CLARO', 'CORPO_NO_CLARO']) {
      expect(codigo).toContain(nome)
    }
  })
})

/**
 * ## Cada dado aparece numa peça só
 *
 * Em 31/08 o feed tinha 21 peças e **seis delas repetiam um card de
 * carrossel**: 42h, 82%, 3,4h, 55%, R$ 265 e a dor da carteira apareciam duas
 * vezes cada. Publicadas, o perfil mostrava pares dizendo o mesmo número, e o
 * visitante percebia rolando dois dedos.
 *
 * Repetição não quebra nada e não aparece em métrica nenhuma. Só aparece
 * quando alguém olha o conjunto — e é por isso que um teste faz mais sentido
 * aqui do que uma revisão manual antes de publicar.
 *
 * O teste conta ocorrências no texto que vai para a arte, ignorando
 * comentários: os comentários citam os números o tempo todo ao explicar as
 * decisões.
 */
describe('nenhum dado se repete entre as peças do feed', () => {
  const DADOS: [string, RegExp][] = [
    ['21x', /"21x"/g],
    ['42h', /"42h"/g],
    ['82%', /"82%"/g],
    ['3,4h', /"3,4h"/g],
    ['55%', /"55%"/g],
  ]

  // Docstrings fora, não só comentários: elas citam os números ao explicar
  // por que cada composição existe, e um contador ingênuo leria a explicação
  // como se fosse uma peça a mais. Foi o que aconteceu na primeira versão
  // deste teste, com quatro falsos positivos de uma vez.
  const codigo = semComentarios(
    readFileSync(join(PASTA, 'gerar-feed.py'), 'utf-8'),
  ).replace(/"""[\s\S]*?"""/g, '')

  it.each(DADOS)('%s aparece uma vez só', (_nome, padrao) => {
    expect((codigo.match(padrao) ?? []).length).toBe(1)
  })
})

/**
 * A monoespaçada e a serifa entraram em 31/08 para dar o contraste de VOZ que
 * faltava: até então tudo era Geist bold com Geist regular, contraste de peso
 * e nenhum de família.
 *
 * Este teste não julga estética. Ele trava que as duas continuem sendo usadas
 * — se alguém "simplificar" o gerador de volta para uma família só, as peças
 * voltam a ser indistinguíveis e nada mais avisaria.
 */
describe('as artes usam mais de uma família tipográfica', () => {
  it('a monoespaçada do produto está em uso', () => {
    const comum = readFileSync(join(PASTA, 'gerar-stories.py'), 'utf-8')
    expect(comum).toContain('GeistMonoVF.woff')
    expect(comum).toContain('def mono(')
  })

  it('a serifa itálica carrega o número nas peças sem proporção', () => {
    const feed = readFileSync(join(PASTA, 'gerar-feed.py'), 'utf-8')
    expect(feed).toContain('g.italica(300)')
  })
})
