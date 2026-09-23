import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { ehLimiteDePlano } from '@/lib/plans'

/**
 * Toda mensagem de limite que o BANCO levanta chega ao botão de upgrade.
 *
 * ## O defeito que motivou isto, e ele era de 5 em 8
 *
 * Medido em 23/09: das oito frases de limite de plano que as triggers
 * levantam, **cinco não eram reconhecidas** por `ehLimiteDePlano`. Quem batia
 * nelas via o erro cru, sem oferta nenhuma:
 *
 *     "Workspace atingiu o limite de % membros do plano Free."       0053
 *     "O WhatsApp dentro do CRM e do plano Max. Assine para..."      0090
 *     "O plano Pro inclui 5 empresas. Assine o Max para..."          0094
 *
 * E a primeira delas é o caminho mais comum dos três: convidar colaborador.
 *
 * ## Por que ler a MIGRATION e não repetir as frases aqui
 *
 * `lib/plans.test.ts` já lista as frases como literais, e é a mesma classe de
 * defeito que ele existe para pegar: um literal no teste protege contra o
 * TypeScript mudar, **não** contra o TypeScript e o SQL discordarem. Foi
 * exatamente assim que `leads` continuou no TS depois de a 0052 trocar para
 * `contatos`, com o teste verde o tempo todo.
 *
 * Lendo as migrations, uma trigger nova com frase nova reprova aqui até
 * alguém decidir o que fazer com ela.
 *
 * ## O TETO não é oferta, e ele fica de fora de propósito
 *
 *     "O plano Max inclui 10 empresas. Fale com a gente para ter mais."
 *
 * Acima do Max não existe plano. Oferecer upgrade ali manda a pessoa para uma
 * tela que não resolve o problema dela.
 */

const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations')

/** O `%` do `raise exception` vira número, que é o que a pessoa lê na tela. */
function comoChegaNaTela(bruta: string): string {
  return bruta.replace(/%/g, '5')
}

/**
 * Toda string de `raise exception` das migrations que fala de plano.
 *
 * A varredura é ampla de propósito: ela pega inclusive as frases de migrations
 * já substituídas por outras mais novas. Isso é correto para o que se quer
 * aqui — a frase velha continua no disco, e o dia em que alguém reviver aquela
 * função a mensagem volta junto.
 */
function mensagensDeLimite(): string[] {
  const achadas = new Set<string>()
  for (const nome of readdirSync(MIGRATIONS)) {
    if (!nome.endsWith('.sql')) continue
    const sql = readFileSync(join(MIGRATIONS, nome), 'utf-8')
    for (const achado of Array.from(sql.matchAll(/raise exception '([^']+)'/g))) {
      const frase = achado[1]
      if (/plano (free|pro|max)/i.test(frase)) achadas.add(comoChegaNaTela(frase))
    }
  }
  return Array.from(achadas).sort()
}

describe('mensagem de limite do banco chega ao botão de upgrade', () => {
  const mensagens = mensagensDeLimite()

  it('achou mensagens nas migrations', () => {
    // Se a varredura parar de achar, ela para de proteger, e o silêncio seria
    // indistinguível de "está tudo certo".
    expect(mensagens.length).toBeGreaterThanOrEqual(6)
  })

  const comUpgrade = mensagens.filter((m) => !/[Ff]ale com a gente/.test(m))
  const teto = mensagens.filter((m) => /[Ff]ale com a gente/.test(m))

  it.each(comUpgrade)('oferece upgrade: "%s"', (mensagem) => {
    expect(ehLimiteDePlano(mensagem)).toBe(true)
  })

  it.each(teto)('NÃO oferece upgrade no teto: "%s"', (mensagem) => {
    expect(ehLimiteDePlano(mensagem)).toBe(false)
  })

  /**
   * O controle. Sem ele, uma expressão que devolvesse `true` para qualquer
   * coisa passaria em todos os casos acima e o teste diria que está tudo bem.
   */
  it('CONTROLE: erro comum continua sem oferecer upgrade', () => {
    expect(ehLimiteDePlano('Não foi possível salvar. Tente de novo.')).toBe(false)
    expect(ehLimiteDePlano('A planilha não tem nenhuma linha além do cabeçalho.')).toBe(false)
  })
})
