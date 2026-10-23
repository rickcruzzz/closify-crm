import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { MetricCards } from '@/components/dashboard/metric-cards'
const vazio = {
  totalLeads: 0,
  openDeals: 0,
  pipelineValue: 0,
  closedDeals: 0,
  wonDeals: 0,
}
describe('indicadores compactos acima do Kanban', () => {
  it('mostra os quatro indicadores mesmo no primeiro acesso, sem esconder o quadro', () => {
    const html = renderToStaticMarkup(
      createElement(MetricCards, { metrics: vazio, compacto: true }),
    )
    for (const rotulo of [
      'Contatos',
      'Negócios abertos',
      'Valor no funil',
      'Viraram venda',
    ])
      expect(html).toContain(rotulo)
    expect(html).toContain('grid-cols-2')
    expect(html).not.toContain('Seu funil está pronto')
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('100%')
  })
  it('preserva a experiência vazia de Resultados', () => {
    expect(
      renderToStaticMarkup(createElement(MetricCards, { metrics: vazio })),
    ).toContain('Seu funil está pronto')
  })
  it('usa os números reais e os destinos existentes', () => {
    const html = renderToStaticMarkup(
      createElement(MetricCards, {
        compacto: true,
        metrics: {
          totalLeads: 19,
          openDeals: 2,
          pipelineValue: 5500,
          closedDeals: 1,
          wonDeals: 1,
        },
      }),
    )
    expect(html).toContain('19')
    expect(html).toContain('100%')
    expect(html).toContain('href="/leads"')
    expect(html).toContain('href="/kanban')
  })
})
