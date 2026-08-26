import { describe, expect, it } from 'vitest'

import { CONTATOS, FUNIL, hrefDaEtapa, hrefDoNegocio } from './destinos'
import { dealStages } from '@/lib/deals/types'

describe('destinos do dashboard', () => {
  // As rotas não foram renomeadas junto com o vocabulário do produto (19/08):
  // a tela se chama "Funil" e "Contatos", os endereços continuam `/kanban` e
  // `/leads`. Trocá-los quebraria link salvo por uma palavra que ninguém
  // digita, e este teste existe para a renomeação não voltar sem querer.
  it('as rotas continuam sendo as antigas, de propósito', () => {
    expect(FUNIL).toBe('/kanban')
    expect(CONTATOS).toBe('/leads')
  })

  it('cada etapa vira um endereço próprio', () => {
    expect(hrefDaEtapa('proposta_enviada')).toBe('/kanban?etapa=proposta_enviada')
    expect(hrefDaEtapa('fechado_ganho')).toBe('/kanban?etapa=fechado_ganho')
  })

  // Se uma etapa nova entrar no enum e o destino não souber montá-la, o clique
  // na barra dela cairia no board sem foco nenhum — de volta ao beco que este
  // trabalho fechou.
  it('as seis etapas do enum geram destino válido', () => {
    for (const stage of dealStages) {
      expect(hrefDaEtapa(stage)).toBe(`/kanban?etapa=${stage}`)
    }
    expect(dealStages).toHaveLength(6)
  })

  it('o negócio abre pelo id', () => {
    expect(hrefDoNegocio('abc-123')).toBe('/kanban?negocio=abc-123')
  })

  // O id vem do banco e é UUID, mas a função é pública e o dia em que alguém
  // passar um valor com caractere de query, a URL não pode partir ao meio.
  it('id com caractere de URL é escapado, não parte a query', () => {
    expect(hrefDoNegocio('a&etapa=novo')).toBe('/kanban?negocio=a%26etapa%3Dnovo')
  })
})
