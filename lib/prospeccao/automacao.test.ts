import { describe, expect, it } from 'vitest'

import {
  SEGUNDOS_HUMANAMENTE_IMPOSSIVEL,
  ehRespostaAutomatica,
  segundosDepoisDoEnvio,
} from '@/lib/prospeccao/automacao'

/**
 * Os casos são REAIS: chegaram no disparo de 12/09, nas primeiras 47
 * mensagens, e produziram uma taxa de resposta falsa de 38%.
 */
const REAIS = [
  'Olá! 😊 Sou o Colibri, assistente virtual da Detecta Controle de Pragas.',
  'Olá me chamo *Helena*, sua assistente virtual.',
  'Agradecemos sua mensagem. Não estamos disponíveis no momento, mas responderemos assim que possível',
  'Olá, tudo bem? Estamos fora do horário de atendimento. Seg-Sex: 9h-11h / 14h-17h',
  'Já conectei você à nossa equipe. Alguém atenderá você em breve.',
  'Muito obrigado pelo seu contato!\nNosso atendimento é de segunda a sexta-feira das 07:00 às',
  '*[acorpeventos]*\nBem Vindo ao atendimento da Acorp. Escolha uma opção',
]

describe('o TEMPO é a prova, não o texto', () => {
  /**
   * Medido: 25 das 27 chegaram em até 60s, média de 15s, e ZERO depois de 5
   * min. Ninguém lê uma mensagem fria e responde em quinze segundos — e muito
   * menos 25 pessoas diferentes.
   */
  it('resposta em segundos é robô, mesmo com texto de gente', () => {
    const r = ehRespostaAutomatica('Oi Orlando, achei interessante, me conta mais', 12)
    expect(r.automatica).toBe(true)
    expect(r.motivo).toContain('12s')
  })

  it('o corte é 300s, e ele é exclusivo', () => {
    expect(ehRespostaAutomatica('oi', SEGUNDOS_HUMANAMENTE_IMPOSSIVEL - 1).automatica).toBe(true)
    expect(ehRespostaAutomatica('oi', SEGUNDOS_HUMANAMENTE_IMPOSSIVEL).automatica).toBe(false)
  })

  /**
   * O caso que importa mais: resposta de PESSOA, depois de horas. Ela não
   * pode ser barrada por nada — é o único dado que o funil existe para medir.
   */
  it('resposta humana depois de horas PASSA', () => {
    expect(ehRespostaAutomatica('quanto custa?', 7200).automatica).toBe(false)
    expect(ehRespostaAutomatica('me manda mais informação', 600).automatica).toBe(false)
  })

  /**
   * O caso que fez o corte subir de 60 para 300, e ele é o mais instrutivo.
   *
   * A Elevato respondeu em ~70s com um agente de IA que LEU a mensagem:
   * "Você está buscando uma solução para organizar e acompanhar os retornos de
   * orçamentos?". Nenhuma frase da lista o pega — ele não fala como robô, fala
   * como vendedor. Só o tempo o entrega.
   */
  it('o agente de IA da Elevato, que passou pelo corte de 60s', () => {
    const texto =
      'Você está buscando uma solução para organizar e acompanhar os retornos de orçamentos/projetos, ou quer falar de algum produto específico da Elevato?'
    expect(ehRespostaAutomatica(texto, 70).automatica).toBe(true)
    // E sem o tempo ele REALMENTE passa — a lista de frases não o alcança, e
    // isso fica travado para ninguém achar que o texto resolve.
    expect(ehRespostaAutomatica(texto, null).automatica).toBe(false)
  })
})

describe('o texto é reforço', () => {
  it.each(REAIS)('reconhece "%s"', (texto) => {
    // Sem tempo, só o texto: o caminho mais fraco, e ainda assim pega os reais.
    expect(ehRespostaAutomatica(texto, null).automatica).toBe(true)
  })

  it('não barra pessoa que escreve parecido', () => {
    // "agradecemos o contato" sozinho é frase de gente educada. Só vira robô
    // com o tempo, ou com uma frase que só bot usa.
    expect(ehRespostaAutomatica('obrigado pelo contato, vou olhar', null).automatica).toBe(false)
    expect(ehRespostaAutomatica('bom dia, quanto custa?', null).automatica).toBe(false)
  })

  it('acento não muda a decisão', () => {
    expect(ehRespostaAutomatica('sou o assistente virtual', null).automatica).toBe(true)
    expect(ehRespostaAutomatica('estamos fora do horario', null).automatica).toBe(true)
    expect(ehRespostaAutomatica('estamos fora do horário', null).automatica).toBe(true)
  })

  it('vazio não é robô', () => {
    expect(ehRespostaAutomatica('', null).automatica).toBe(false)
    expect(ehRespostaAutomatica(null, null).automatica).toBe(false)
  })
})

describe('segundos depois do envio', () => {
  it('calcula a diferença', () => {
    expect(
      segundosDepoisDoEnvio('2026-09-12T10:00:00Z', '2026-09-12T10:00:15Z'),
    ).toBe(15)
  })

  it('sem uma das datas devolve null, e aí só o texto decide', () => {
    expect(segundosDepoisDoEnvio(null, '2026-09-12T10:00:00Z')).toBeNull()
    expect(segundosDepoisDoEnvio('2026-09-12T10:00:00Z', null)).toBeNull()
  })
})
