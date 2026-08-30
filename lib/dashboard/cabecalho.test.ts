import { describe, expect, it } from 'vitest'

import { CABECALHO_DOS_RESULTADOS } from './cabecalho'

/**
 * O que estes casos travam é o defeito literal que motivou o arquivo: o
 * esqueleto de carregamento da tela escrevia "Dashboard / Métricas do seu
 * funil de vendas" enquanto a página escrevia "Resultados / Quanto entrou…",
 * e a divergência sobreviveu dez dias porque nenhum portão compara um
 * `loading.tsx` com o `page.tsx` irmão.
 */
describe('cabeçalho da tela de Resultados', () => {
  it('não usa nenhum termo que o PRD de copy baniu', () => {
    // A lista vem de `docs/prd-copy-sem-jargao.md`. "Dashboard" é o que de
    // fato aparecia na tela; os outros entram porque a mesma renomeação os
    // tirou do produto e a mesma classe de defeito os traria de volta.
    const banidos = ['dashboard', 'pipeline', 'workspace', 'timeline', 'lead']
    const texto = `${CABECALHO_DOS_RESULTADOS.titulo} ${CABECALHO_DOS_RESULTADOS.descricao}`.toLowerCase()

    for (const termo of banidos) {
      expect(texto, `"${termo}" voltou ao cabeçalho da tela`).not.toContain(termo)
    }
  })

  it('a descrição responde uma pergunta em vez de definir a tela', () => {
    // "Métricas do seu funil de vendas" descreve o que a tela É. A regra de
    // 22/08 é que ela diga o que a tela RESPONDE — e quem abre o sistema
    // pergunta por dinheiro, não por métrica.
    expect(CABECALHO_DOS_RESULTADOS.descricao).not.toMatch(/^Métricas/i)
    expect(CABECALHO_DOS_RESULTADOS.descricao.toLowerCase()).toContain('venda')
  })

  it('tem título e descrição não vazios', () => {
    // Um cabeçalho vazio passaria calado nos dois casos acima.
    expect(CABECALHO_DOS_RESULTADOS.titulo.trim().length).toBeGreaterThan(0)
    expect(CABECALHO_DOS_RESULTADOS.descricao.trim().length).toBeGreaterThan(0)
  })
})
