import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * ## Toda ação que esconde alguma coisa precisa de porta de volta
 *
 * Este arquivo existe por um defeito que ficou em produção sem ninguém ver.
 *
 * `ocultarChecklist` aceita `true` e `false` desde que foi escrita. Até
 * 01/09/2026, **nenhum lugar do produto a chamava com `false`**: fechar o
 * checklist de ativação era definitivo, o estado ia para o banco (então nem
 * trocar de navegador desfazia), e o checklist é o único ponto do sistema que
 * diz o que fazer em seguida.
 *
 * Medido no dia: **9 das 49 contas já haviam fechado**, e nenhuma tinha como
 * reabrir.
 *
 * É a terceira aparição da mesma classe neste projeto:
 *
 *   /dono/alertas    "silenciar" nasceu sem "reexibir" e ganhou depois
 *   /dono/suporte    a fila de relatos internos existia sem nenhuma porta
 *   checklist        fechar sem retomar
 *
 * ## Por que testar a EXISTÊNCIA da chamada, e não o comportamento
 *
 * O comportamento é de UI: um clique, uma Server Action, um `router.refresh`.
 * Cobri-lo exigiria montar a árvore de componentes e simular a sessão, e
 * ainda assim não pegaria o defeito real — que não era uma chamada errada, e
 * sim uma chamada **ausente**.
 *
 * Um teste que lê o código e exige que a metade de volta exista é o mais
 * perto que dá para chegar do defeito original. É a mesma forma do teste que
 * proíbe a palavra da oferta aposentada nos geradores de arte: às vezes o que
 * precisa ser travado é a ausência, não o valor.
 */
describe('esconder o checklist tem volta', () => {
  const card = readFileSync(
    join(process.cwd(), 'components', 'onboarding', 'checklist-card.tsx'),
    'utf-8',
  )
  const pagina = readFileSync(
    join(process.cwd(), 'app', '(dashboard)', 'dashboard', 'page.tsx'),
    'utf-8',
  )

  it('alguém chama ocultarChecklist(false), e não só (true)', () => {
    expect(card).toContain('ocultarChecklist(true)')
    expect(card).toContain('ocultarChecklist(false)')
  })

  it('a retomada é renderizada pela página, não fica órfã', () => {
    // O defeito seria escrever o componente e esquecer de ligá-lo: ele
    // existiria no repositório, o teste acima passaria, e a pessoa continuaria
    // sem porta. É o mesmo caso de `iniciarOnboarding`, Server Action viva
    // cujo comentário cita um botão que nunca existiu.
    expect(card).toContain('export function RetomarChecklist')
    expect(pagina).toContain('RetomarChecklist')
    expect(pagina).toMatch(/podeRetomar\s*&&\s*<RetomarChecklist/)
  })

  it('a retomada só aparece para quem fechou e ainda tem passo aberto', () => {
    // Mostrá-la a quem concluiu tudo seria oferecer voltar para um lugar que
    // não existe mais; mostrá-la junto do card aberto seria duplicar a mesma
    // coisa na mesma tela.
    expect(pagina).toMatch(/podeRetomar\s*=\s*aindaFalta\s*&&\s*estado\.checklistOculto/)
  })
})

/**
 * A tela de Resultados vazia é a primeira que qualquer pessoa abre: o login
 * cai em `/dashboard`, medido em produção em 01/09.
 *
 * Naquele dia, com conta nova e empresa vazia, o botão "Adicionar primeiro
 * contato" ficava a **984px** do topo num viewport de **812px** — abaixo da
 * dobra do telefone. O que o empurrava para lá eram "Exportar relatório" e
 * dez botões de período, ambos calculados sobre zero linha.
 *
 * O número que dá peso a isso: **25 das 42 empresas do banco nunca criaram um
 * contato**, enquanto 88% concluem o assistente de onboarding. O vão não está
 * no onboarding, está aqui.
 */
describe('o dashboard vazio não mostra relatório de nada', () => {
  const pagina = readFileSync(
    join(process.cwd(), 'app', '(dashboard)', 'dashboard', 'page.tsx'),
    'utf-8',
  )

  it('exportar e filtro de período dependem de haver dado', () => {
    expect(pagina).toMatch(/temAlgoParaRelatar\s*=\s*sinais\.leads\s*>\s*0/)
    expect(pagina).toMatch(/temAlgoParaRelatar\s*\?\s*\(\s*<ExportReportButton/)
    expect(pagina).toMatch(/\{temAlgoParaRelatar\s*&&\s*\(\s*<PeriodFilter/)
  })

  it('a condição é DERIVADA dos sinais, não uma preferência gravada', () => {
    // Gravar um booleano faria a tela mentir depois: quem cria o primeiro
    // contato e apaga voltaria a ver o relatório de nada, e quem cria um
    // contato continuaria sem o filtro até alguém regravar. É o mesmo motivo
    // pelo qual o checklist é derivado em `montarChecklist`.
    expect(pagina).not.toMatch(/relatorio_oculto|mostrarRelatorio\s*=\s*(true|false)/)
  })
})
