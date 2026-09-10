import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * ## O preço na TELA vem da constante, nunca escrito à mão
 *
 * Companheiro de `oferta-nas-artes.test.ts`, que faz o mesmo pelos geradores
 * de imagem em Python. Este cobre a metade que faltava: o site.
 *
 * ## O defeito que o motivou, achado em 10/09
 *
 * `pricing-section.tsx` tinha `price: 'R$49'` escrito à mão no cartão do Pro,
 * e **na linha 571 do mesmo arquivo** a frase de comparação já lia
 * `PRO_PLAN_PRICE`. Os dois mostravam o mesmo número por coincidência, não
 * por construção — e sobreviveram assim a duas auditorias de copy, porque um
 * literal que está certo é invisível.
 *
 * Na troca de R$ 49 para R$ 97 eles teriam discordado DENTRO DA MESMA SEÇÃO:
 * o cartão anunciando 49 e a frase logo abaixo comparando 97 com a mediana do
 * mercado. O `hero-section.tsx` tinha o mesmo literal, na dobra.
 *
 * Nada quebraria. `tsc` aprova uma string, `lint` aprova, e todo teste
 * continuaria verde — é a mesma família do trial aposentado que ficou nas
 * artes e da bio do Instagram que anunciava 300 contatos.
 *
 * ## A primeira versão deste teste era fraca, e produção provou isso
 *
 * Ela proibia só o preço VIGENTE escrito à mão — `R$ 97`. Passou verde, e o
 * site foi para produção com **R$ 49 em três lugares**: a `description`, o
 * `openGraph` (que é o que o WhatsApp mostra, antes do clique, no link que a
 * prospecção manda) e a barra de números da landing, logo acima de um cartão
 * de plano que já dizia 97.
 *
 * O erro era de direção. Proibir o número novo protege contra alguém digitar
 * o preço de hoje; o perigo real é o preço de ONTEM já digitado. A regra certa
 * não tem valor nenhum dentro dela — **nenhum preço em real literal** — e por
 * isso não precisa ser atualizada quando o preço muda, que é exatamente a
 * propriedade que faltava.
 *
 * ## Por que proibir o LITERAL e não conferir o valor
 *
 * Conferir "a tela mostra 97" exigiria renderizar, e passaria a falhar em toda
 * troca de preço legítima — vira ruído e alguém desliga. Proibir o literal
 * falha só quando alguém escreve número à mão, que é exatamente o ato errado.
 *
 * ## O que continua permitido, de propósito
 *
 * Preço de CONCORRENTE é literal e deve ser: `R$ 53 POR USUÁRIO` do Agendor
 * não é derivável de constante nossa, e a data de conferência
 * (`PRECOS_CONFERIDOS_EM`) é a trava dele.
 *
 * Como a regra não olha o valor, ela não consegue distinguir o nosso preço do
 * deles — então a exceção é por ARQUIVO, em `COM_PRECO_DE_CONCORRENTE`, com o
 * motivo escrito em cada entrada. É mais chato e é a troca certa: uma lista de
 * três arquivos que alguém precisa justificar para crescer, contra uma regra
 * esperta que erra em silêncio.
 */
const RAIZES = ['components/landing', 'components/settings', 'app']

/**
 * Arquivos que publicam preço de CONCORRENTE, e por isso podem conter
 * qualquer número em real — inclusive, por coincidência, o nosso.
 *
 * A lista é curta e cada entrada precisa do motivo escrito, pela mesma regra
 * de `REMOVIDOS_COM_REGISTRO` em `conferir-documentos.mjs`: exceção sem o
 * porquê é o alarme sendo calado em vez de respondido.
 *
 *     alternativa-ao-crm-...   tabela de 6 concorrentes com preco publico e a
 *                              data em que foi lido. O Nexxou cobra R$ 97, que
 *                              e exatamente o nosso preco desde 10/09 — a
 *                              coincidencia e do mercado, nao do codigo
 *
 * A coincidência não é inofensiva e está tratada na própria página: a
 * resposta que dizia "o Velo Funil é o mais barato" virou falsa no dia em que
 * os dois preços se encontraram, e foi reescrita para o que continua
 * conferível — somos o único da faixa sem teto de pessoas.
 */
const COM_PRECO_DE_CONCORRENTE = [
  'alternativa-ao-crm-que-cobra-por-usuario',
  // As duas paginas de conteudo de 03/09. Existem para responder "quanto custa
  // um CRM" a quem ainda nao conhece o produto, entao a faixa do mercado
  // (R$ 50 a R$ 75 por usuario) e o assunto delas, nao um detalhe.
  //
  // `PRECO_MEDIANA_POR_USUARIO` cobre a mediana, nao a faixa — e faixa com
  // minimo e maximo derivados de uma constante so nao existe. A trava destes
  // numeros e a mesma de sempre: `PRECOS_CONFERIDOS_EM`, na tela, com a data em
  // que a tabela publica deles foi lida.
  'crm-que-nao-cobra-por-usuario',
  'quanto-custa-um-crm',
]

function arquivosTsx(dir: string, achados: string[] = []): string[] {
  let entradas: string[]
  try {
    entradas = readdirSync(dir)
  } catch {
    return achados
  }
  for (const nome of entradas) {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) {
      if (nome === 'node_modules' || nome === '.next') continue
      arquivosTsx(caminho, achados)
    } else if (nome.endsWith('.tsx') || nome.endsWith('.ts')) {
      if (nome.endsWith('.test.ts') || nome.endsWith('.test.tsx')) continue
      achados.push(caminho)
    }
  }
  return achados
}

/**
 * Tira comentário de bloco, de linha e JSX.
 *
 * É a peça que decide se o teste serve: metade das ocorrências de "R$ 49"
 * nesta base está em comentário contando POR QUE alguma coisa foi feita — a
 * Central que declarou R$ 490/mês, o Pix de R$ 1, a nota sobre o checkout.
 * Recusar essas apagaria a memória do projeto para calar um alarme.
 */
function semComentarios(fonte: string): string {
  return fonte
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
    .split('\n')
    .filter((linha) => !linha.trim().startsWith('//'))
    .join('\n')
}

describe('o preço do Pro na tela vem de lib/plans.ts', () => {
  const arquivos = RAIZES.flatMap((r) => arquivosTsx(r))

  it('a varredura enxerga a landing e as configurações', () => {
    expect(arquivos.length).toBeGreaterThan(50)
    expect(arquivos.some((a) => a.includes('pricing-section'))).toBe(true)
  })

  it.each(arquivos)('%s não escreve o nosso preço à mão', (caminho) => {
    if (COM_PRECO_DE_CONCORRENTE.some((f) => caminho.includes(f))) return
    const codigo = semComentarios(readFileSync(caminho, 'utf-8'))
    // Nenhum preço em real literal. Sem valor dentro da regra de propósito:
    // ver a seção sobre a primeira versão, acima.
    expect(codigo.match(/R\$\s*(?:&nbsp;)?\d/g) ?? []).toEqual([])
  })
})
