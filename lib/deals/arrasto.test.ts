import { describe, expect, it, vi } from 'vitest'

import { deveAplicarPreview, escolherColisao } from './arrasto'

describe('escolherColisao', () => {
  it('usa o resultado do ponteiro quando ele existe', () => {
    expect(escolherColisao(['negociacao'], () => ['proposta'])).toEqual(['negociacao'])
  })

  it('cai para o canto mais próximo quando o ponteiro não devolve nada', () => {
    // O caso do arrasto por TECLADO: não há cursor, `pointerWithin` devolve
    // vazio, e sem este caminho o `KeyboardSensor` deixaria de funcionar.
    expect(escolherColisao([], () => ['proposta'])).toEqual(['proposta'])
  })

  it('não calcula o canto mais próximo quando o ponteiro já respondeu', () => {
    // `dragOver` dispara a cada movimento do cursor, e o cálculo do canto
    // percorre todo droppable registrado. Calcular para descartar seria pagar
    // a varredura à toa no caminho mais quente do board.
    const canto = vi.fn(() => ['proposta'])
    escolherColisao(['negociacao'], canto)
    expect(canto).not.toHaveBeenCalled()
  })
})

describe('deveAplicarPreview', () => {
  it('move quando o cursor entra numa coluna diferente pela primeira vez', () => {
    expect(
      deveAplicarPreview({
        etapaPrevista: null,
        etapaAtual: 'proposta',
        etapaAlvo: 'negociacao',
      }),
    ).toBe(true)
  })

  it('não move de novo para a coluna que já recebeu a pré-visualização', () => {
    // O defeito: a guarda antiga comparava com o ESTADO `deals`, que dentro do
    // mesmo lote do React ainda é o valor anterior. Vários `dragOver` no mesmo
    // lote passavam e disparavam `setDeals` cada um.
    expect(
      deveAplicarPreview({
        etapaPrevista: 'negociacao',
        etapaAtual: 'proposta',
        etapaAlvo: 'negociacao',
      }),
    ).toBe(false)
  })

  it('barra a alternância A -> B -> A, que é a forma do laço', () => {
    // React #185 em `/kanban`, quatro ocorrências entre 20/08 e 05/09: o card
    // muda de coluna, as colunas mudam de altura, a detecção por retângulo
    // devolve a coluna anterior, e o ciclo se fecha. A guarda antiga só barrava
    // o alvo IGUAL ao atual, então esta alternância passava.
    const primeiraVolta = deveAplicarPreview({
      etapaPrevista: 'negociacao',
      etapaAtual: 'negociacao',
      etapaAlvo: 'proposta',
    })
    expect(primeiraVolta).toBe(true)

    // ...e o `dragOver` seguinte, no mesmo lote, tentando voltar:
    expect(
      deveAplicarPreview({
        etapaPrevista: 'proposta',
        etapaAtual: 'negociacao',
        etapaAlvo: 'proposta',
      }),
    ).toBe(false)
  })

  it('não move quando o cursor está sobre a própria coluna do card', () => {
    expect(
      deveAplicarPreview({
        etapaPrevista: null,
        etapaAtual: 'proposta',
        etapaAlvo: 'proposta',
      }),
    ).toBe(false)
  })

  it('não move quando alguma das duas etapas não foi resolvida', () => {
    // `stageOf` devolve `undefined` para id que não é etapa nem negócio
    // conhecido — soltar sobre algo que saiu da tela, por exemplo.
    expect(
      deveAplicarPreview({
        etapaPrevista: null,
        etapaAtual: undefined,
        etapaAlvo: 'proposta',
      }),
    ).toBe(false)
    expect(
      deveAplicarPreview({
        etapaPrevista: null,
        etapaAtual: 'proposta',
        etapaAlvo: undefined,
      }),
    ).toBe(false)
  })
})
