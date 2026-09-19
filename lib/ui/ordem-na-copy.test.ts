import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * A copy não pode prometer a ordem que a lista não usa mais.
 *
 * ## O defeito que motivou isto, e ele foi meu
 *
 * Em 18/09 a lista de conversas passou a ordenar pela mensagem mais RECENTE, a
 * pedido do dono. Eu corrigi o cabeçalho da tela e o rodapé, e **passei por
 * cima de três peças de VENDA**:
 *
 *     components/landing/pricing-section.tsx    a landing PUBLICA
 *     components/settings/max-card.tsx          o upsell do plano Max
 *     components/settings/previa-do-whatsapp.tsx   o mock da caixa
 *
 * As três diziam *"quem espera há mais tempo fica no topo, e não quem falou por
 * último"*. Ficaram no ar prometendo o contrário do que o produto faz, e a
 * frase é justamente o argumento que vende o Max por R$ 250.
 *
 * O dono encontrou olhando o print da própria tela, que é o mesmo jeito como o
 * *"até 2 colaboradores"* e o *"grátis até 300 contatos"* foram encontrados.
 *
 * ## Por que teste, e não cuidado
 *
 * Cuidado é o que eu tinha quando errei. Três arquivos, três superfícies
 * diferentes, e a regra de produto mora num quarto lugar
 * (`lib/conversas/ordenar.ts`): nada ligava os quatro.
 *
 * ## Por que a varredura lê o arquivo INTEIRO, e não só os literais
 *
 * Diferente de `sem-travessao.test.ts`, aqui o comentário conta. Um comentário
 * que descreve a ordem antiga é documentação errada no lugar onde a próxima
 * pessoa vai procurar o porquê, e este projeto já pagou por isso: o
 * `CLAUDE.md` afirmou por dias que a ativação não era medida.
 *
 * A exceção é `lib/conversas/ordenar.ts`, onde a frase PRECISA aparecer: é lá
 * que o histórico da decisão está registrado, e apagá-lo de lá deixaria a troca
 * sem explicação.
 */

const RAIZES = ['components', 'app', 'lib']

/**
 * As formas de afirmar a ordem ANTIGA.
 *
 * Função e não constante: uma `RegExp` com `/g` carrega `lastIndex`, e reusar o
 * MESMO objeto em vários arquivos faz a varredura pular texto conforme a ordem
 * em que eles aparecem. Isso já reprovou um teste meu em 18/09, e o controle
 * abaixo é o que pegou.
 */
function padroes(): RegExp[] {
  return [
    /espera\s+h[aá]\s+mais\s+tempo\s+(fica|aparece|vem)/i,
    /quem\s+falou\s+por\s+[uú]ltimo/i,
    /mais\s+antiga\s+(fica\s+)?no\s+topo/i,
  ]
}

function afirmaOrdemAntiga(texto: string): boolean {
  return padroes().some((p) => p.test(texto))
}

/** O único lugar onde a frase deve existir: o registro da própria decisão. */
const ONDE_O_HISTORICO_MORA = join('lib', 'conversas', 'ordenar.ts')

function listar(raiz: string): string[] {
  const achados: string[] = []
  for (const nome of readdirSync(raiz)) {
    const caminho = join(raiz, nome)
    if (nome === 'node_modules' || nome.startsWith('.')) continue
    if (statSync(caminho).isDirectory()) {
      achados.push(...listar(caminho))
      continue
    }
    if (/\.(ts|tsx)$/.test(nome)) achados.push(caminho)
  }
  return achados
}

describe('a copy acompanha a ordem real da lista', () => {
  it('nenhum arquivo promete que a mais antiga fica no topo', () => {
    const culpados: string[] = []
    for (const raiz of RAIZES) {
      for (const arquivo of listar(raiz)) {
        if (arquivo.endsWith('ordem-na-copy.test.ts')) continue
        if (arquivo === ONDE_O_HISTORICO_MORA) continue
        if (arquivo.endsWith('ordenar.test.ts')) continue
        if (afirmaOrdemAntiga(readFileSync(arquivo, 'utf8'))) culpados.push(arquivo)
      }
    }
    expect(culpados).toEqual([])
  })

  /**
   * O controle, e sem ele um erro de digitação na expressão aprova tudo para
   * sempre. É a lição do vigia de acentos de 18/09, que nasceu quebrado de dois
   * jeitos e só foi pego porque tinha controle.
   */
  it('a varredura PEGA as tres formas quando elas existem', () => {
    expect(afirmaOrdemAntiga('Quem espera há mais tempo fica no topo')).toBe(true)
    expect(afirmaOrdemAntiga('e não quem falou por último')).toBe(true)
    expect(afirmaOrdemAntiga('a mais antiga fica no topo da lista')).toBe(true)
    // Sem acento também, que é como eu escrevo comentário.
    expect(afirmaOrdemAntiga('quem espera ha mais tempo aparece primeiro')).toBe(true)
  })

  /** E o controle negativo: a copy NOVA não pode disparar o alarme. */
  it('a frase nova passa limpo', () => {
    expect(afirmaOrdemAntiga('Um relógio mostra há quanto tempo cada cliente espera')).toBe(false)
    expect(afirmaOrdemAntiga('Quem está esperando resposta, com o relógio de quanto tempo faz.')).toBe(
      false,
    )
    expect(afirmaOrdemAntiga('A mais antiga espera há 1h, no fim da lista.')).toBe(false)
  })
})
