import { describe, expect, it } from 'vitest'

import {
  MARCA_DE_PASSAGEM,
  fatosDoProduto,
  instrucoesDoAgente,
  limparResposta,
  pediuPassagem,
} from '@/lib/sdr/instrucoes'
import {
  FREE_LEAD_LIMIT,
  FREE_ORCAMENTO_LIMIT,
  PRO_ANUAL_PRICE,
  PRO_PLAN_PRICE,
  PRO_WORKSPACE_LIMIT,
} from '@/lib/plans'

describe('os fatos do produto vêm do código', () => {
  /**
   * A regra mais importante deste módulo. Um modelo que "lembra" o preço diria
   * R$ 49 para sempre — e ele mudou em 10/09. Interpolar na hora faz a troca da
   * constante atualizar o agente sem ninguém reescrever prompt.
   */
  it('o preço no prompt é o preço vigente', () => {
    const f = fatosDoProduto()
    expect(f).toContain(`R$ ${PRO_PLAN_PRICE} por mês`)
    expect(f).toContain(`R$ ${PRO_ANUAL_PRICE}`)
  })

  it('os limites do Free vêm das constantes', () => {
    const f = fatosDoProduto()
    expect(f).toContain(`${FREE_LEAD_LIMIT} contatos`)
    expect(f).toContain(`${FREE_ORCAMENTO_LIMIT} orçamentos`)
    expect(f).toContain(`${PRO_WORKSPACE_LIMIT} empresas`)
  })

  /**
   * O preço antigo não pode aparecer em lugar nenhum do prompt. Se aparecesse,
   * o modelo teria duas âncoras e escolheria uma — provavelmente a errada,
   * porque a antiga é a mais comum no texto do mundo.
   */
  it('o preço antigo não sobrou em canto nenhum', () => {
    expect(instrucoesDoAgente()).not.toMatch(/R\$ ?49\b/)
  })
})

describe('o que o produto NÃO faz está escrito', () => {
  /**
   * A pergunta mais provável de quem vende por WhatsApp é "integra com
   * WhatsApp?", e a resposta é não. Modelo preenche lacuna com o que é
   * plausível, e "CRM integra com WhatsApp" é plausível demais.
   *
   * Este projeto já pagou três vezes pela promessa que o produto não cumpre: a
   * landing com WhatsApp depois de a ponte sair, a arte com trial aposentado, a
   * bio com limite antigo.
   */
  it('nega WhatsApp integrado explicitamente', () => {
    const f = fatosDoProduto()
    expect(f).toMatch(/NÃO tem WhatsApp integrado/)
  })

  it('nega IA, nota fiscal, app e proposta 3D', () => {
    const f = fatosDoProduto()
    for (const ausente of ['inteligência artificial', 'nota fiscal', 'aplicativo de celular', 'proposta 3D']) {
      expect(f).toContain(ausente)
    }
  })

  /** A lista do que não faz é maior que a do que faz, e isso é o desenho. */
  it('a lista de ausências é a mais longa', () => {
    const f = fatosDoProduto()
    const naoFaz = (f.match(/^- NÃO /gm) ?? []).length
    expect(naoFaz).toBeGreaterThanOrEqual(6)
  })
})

describe('comportamento', () => {
  it('manda se identificar como IA na primeira resposta', () => {
    expect(instrucoesDoAgente()).toMatch(/assistente do Velo Funil/)
    expect(instrucoesDoAgente()).toMatch(/PRIMEIRA RESPOSTA/)
  })

  it('proíbe fechar venda e negociar preço', () => {
    const i = instrucoesDoAgente()
    expect(i).toMatch(/Nunca prometa preço, desconto/)
    expect(i).toMatch(/Pedido de desconto/)
  })

  /**
   * Honestidade que fecha mais que insistência: para uma pessoa só, cobrar por
   * usuário é mais barato, e o agente deve dizer. É a mesma posição que a
   * página de comparação já assume por escrito.
   */
  it('manda admitir quando o concorrente é mais barato', () => {
    expect(fatosDoProduto()).toMatch(/Com uma pessoa só, cobrar por usuário costuma sair mais barato/)
  })

  it('leva a empresa e o setor quando existem', () => {
    const i = instrucoesDoAgente({ empresa: 'SolarOn', vertical: 'energia-solar' })
    expect(i).toContain('SolarOn')
    expect(i).toContain('energia-solar')
  })

  it('funciona sem contexto nenhum', () => {
    expect(() => instrucoesDoAgente()).not.toThrow()
    expect(instrucoesDoAgente().length).toBeGreaterThan(500)
  })
})

describe('a marca de passagem', () => {
  it('reconhece o pedido de passagem', () => {
    expect(pediuPassagem(`Vou chamar o Orlando. ${MARCA_DE_PASSAGEM}`)).toBe(true)
    expect(pediuPassagem('Claro, o plano Pro custa isso.')).toBe(false)
  })

  /**
   * Sem esta limpeza, `[[PASSAR]]` chega no WhatsApp do cliente e ele lê o
   * mecanismo interno da conversa. É o tipo de vazamento que nenhum teste de
   * integração pega, porque a resposta continua "certa".
   */
  it('a marca nunca chega ao cliente', () => {
    const limpo = limparResposta(`O Orlando te responde já.\n${MARCA_DE_PASSAGEM}`)
    expect(limpo).not.toContain(MARCA_DE_PASSAGEM)
    expect(limpo).toBe('O Orlando te responde já.')
  })

  it('limpa a marca no meio do texto também', () => {
    expect(limparResposta(`antes ${MARCA_DE_PASSAGEM} depois`)).toBe('antes  depois')
  })

  it('texto sem marca passa intacto', () => {
    expect(limparResposta('  resposta normal  ')).toBe('resposta normal')
  })
})
