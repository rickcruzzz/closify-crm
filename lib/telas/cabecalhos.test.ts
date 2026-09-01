import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { CABECALHOS, type NomeDeTela } from './cabecalhos'

/**
 * O defeito literal que estes casos travam: o esqueleto de carregamento da
 * tela de Resultados escrevia `Dashboard / Métricas do seu funil de vendas`
 * enquanto a página escrevia `Resultados / Quanto entrou…`, e a divergência
 * sobreviveu **dez dias** porque nenhum portão compara um `loading.tsx` com o
 * `page.tsx` irmão.
 *
 * Aquele caso ganhou uma constante em 31/08. As **outras sete telas
 * continuaram expostas** até 01/09, cada uma com o texto repetido à mão nos
 * dois arquivos. Estes testes valem para todas.
 */
const telas = Object.keys(CABECALHOS) as NomeDeTela[]

describe('cabeçalhos das telas', () => {
  /**
   * A lista vem de `docs/prd-copy-sem-jargao.md`. "Dashboard" é o que de fato
   * aparecia na tela; os outros entram porque a mesma renomeação de 19/08 os
   * tirou de 38 lugares e a mesma classe de defeito os traria de volta.
   */
  const BANIDOS = ['dashboard', 'pipeline', 'workspace', 'timeline', 'lead']

  it.each(telas)('%s não usa termo que o PRD de copy baniu', (tela) => {
    const { title, description } = CABECALHOS[tela]
    const texto = `${title} ${description}`.toLowerCase()
    for (const termo of BANIDOS) {
      expect(texto, `"${termo}" voltou ao cabeçalho de ${tela}`).not.toContain(termo)
    }
  })

  it.each(telas)('%s tem título e descrição não vazios', (tela) => {
    // Um cabeçalho vazio passaria calado em todos os outros casos.
    expect(CABECALHOS[tela].title.trim().length).toBeGreaterThan(0)
    expect(CABECALHOS[tela].description.trim().length).toBeGreaterThan(0)
  })

  /**
   * A regra de 22/08: a descrição diz o que a tela RESPONDE, não o que ela é.
   *
   * Não dá para testar "responde uma pergunta" — isso é leitura humana. Dá
   * para proibir as aberturas que denunciam a definição, que são as que o
   * produto de fato usava: `Métricas do seu funil`, `Busque, filtre e
   * acompanhe`, `Cada negócio, do primeiro contato ao`.
   *
   * O teste é de forma, e a decisão continua sendo de quem escreve. Ele pega
   * a recaída, não substitui o julgamento.
   */
  it.each(telas)('%s não abre definindo a tela', (tela) => {
    const d = CABECALHOS[tela].description
    expect(d, 'descrição que começa listando verbos de interface').not.toMatch(
      /^(Métricas|Busque|Filtre|Gerencie|Visualize|Acompanhe|Veja|Lista de)\b/i,
    )
  })

  /**
   * O sentido inverso do anterior: as telas de trabalho precisam devolver
   * alguma consequência, não só um substantivo.
   *
   * `perfil` fica de fora de propósito — ninguém abre o próprio perfil
   * esperando vender mais, e forçar uma promessa ali soaria falso. A regra
   * orienta; não é fórmula.
   */
  const DE_TRABALHO: NomeDeTela[] = ['dashboard', 'kanban', 'leads', 'hoje', 'conversas']

  it.each(DE_TRABALHO)('%s diz uma consequência, não só o conteúdo', (tela) => {
    const d = CABECALHOS[tela].description.toLowerCase()
    const consequencia =
      /venda|vender|dinheiro|esperando|espera|parou|travado|perder|celular|fechar|jogo/
    expect(d, `"${d}" descreve o conteúdo sem dizer o que está em jogo`).toMatch(consequencia)
  })
})

/**
 * ## A metade que os testes acima não cobrem
 *
 * Travar a constante não impede o defeito original: ele foi um `loading.tsx`
 * escrevendo texto PRÓPRIO, sem importar constante nenhuma. Um teste que só
 * lê `CABECALHOS` passaria com os oito esqueletos ainda desalinhados.
 *
 * Por isso este bloco lê os arquivos e exige que quem desenha cabeçalho leia
 * daqui. É a mesma forma do teste que exige `ocultarChecklist(false)` existir:
 * às vezes o que precisa ser travado é a ausência.
 */
describe('nenhum esqueleto de carregamento escreve o próprio cabeçalho', () => {
  const ROTAS = ['dashboard', 'kanban', 'leads', 'hoje', 'conversas', 'calendario', 'perfil']

  it.each(ROTAS)('%s/loading.tsx lê os cabeçalhos em vez de repetir o texto', (rota) => {
    const fonte = readFileSync(
      join(process.cwd(), 'app', '(dashboard)', rota, 'loading.tsx'),
      'utf-8',
    )
    // Um `title="..."` literal aqui é exatamente o defeito de dez dias.
    expect(fonte, 'título escrito à mão no esqueleto').not.toMatch(/title="[^"]+"/)
    expect(fonte, 'descrição escrita à mão no esqueleto').not.toMatch(/description="[^"]+"/)
    expect(fonte).toContain('CABECALHOS')
  })
})

/**
 * ## O cabeçalho da TELA não serve de texto para estado vazio
 *
 * Este caso existe por um erro cometido ao ligar as telas à constante: a
 * substituição automática trocou `title`/`description` em todo `PageHeader`
 * **e também nos dois `EmptyState` de `/hoje`**, que tinham texto próprio.
 * Aberta a tela no navegador, `/hoje` mostrava "Com quem falar hoje, para
 * nenhuma venda morrer esperando" duas vezes — uma no cabeçalho e outra no
 * lugar de "Comece cadastrando um contato".
 *
 * As duas respondem perguntas diferentes. O cabeçalho diz para que a tela
 * serve; o estado vazio diz o que fazer AGORA, e é a única instrução que
 * alguém sem dado nenhum tem. Trocar um pelo outro apaga a instrução e
 * duplica a legenda.
 *
 * Nenhum `tsc` ou `lint` vê isso: `EmptyState` e `PageHeader` aceitam as
 * mesmas props, então o código compila perfeito e a tela fica errada.
 */
describe('o cabeçalho da tela não vaza para dentro de estado vazio', () => {
  const TELAS = [
    'components/tasks/hoje-client.tsx',
    'components/leads/leads-page-client.tsx',
    'components/conversas/conversas-client.tsx',
  ]

  /**
   * A primeira versão deste caso recortava o bloco `<EmptyState …>` por regex
   * e procurava `CABECALHOS` dentro dele. **O controle negativo reprovou o
   * teste, não o código:** reintroduzido o vazamento, os 36 casos passaram.
   *
   * O recorte tinha teto de 400 caracteres, e os comentários que explicam
   * cada estado vazio passam disso — o bloco defeituoso ficava fora da janela.
   * Um teste que depende de casar tag de JSX quebra assim que alguém comenta
   * o código.
   *
   * A contagem não tem esse problema: numa tela, o cabeçalho é usado UMA vez,
   * no `PageHeader`. Qualquer segunda ocorrência é o texto da tela ocupando o
   * lugar de outra coisa.
   */
  it.each(TELAS)('%s usa o cabeçalho uma vez só', (rel) => {
    const fonte = readFileSync(join(process.cwd(), rel), 'utf-8')
    const usos = fonte.match(/\{\.\.\.CABECALHOS\.\w+\}/g) ?? []
    expect(
      usos.length,
      `${usos.length} usos do cabeçalho: o segundo está ocupando o lugar de outro texto`,
    ).toBeLessThanOrEqual(1)
  })
})
