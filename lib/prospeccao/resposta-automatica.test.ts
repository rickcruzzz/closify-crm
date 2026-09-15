import { describe, expect, it } from 'vitest'

import {
  TEXTO_RECEBIDO,
  TEXTO_SAIDA,
  decidirResposta,
  type ContextoDaResposta,
} from './resposta-automatica'

/**
 * O caso feliz, do qual cada teste desvia UM campo.
 *
 * Escrito assim porque o defeito que estes testes travam é sempre uma porta
 * que deixou de fechar, e comparar contra um caso que responde é o que torna
 * a porta visível.
 */
const BASE: ContextoDaResposta = {
  ligado: true,
  ehProspect: true,
  ehRobo: false,
  pediuSair: false,
  humanoAssumiu: false,
  jaAvisouNestaConversa: false,
  enviadasHoje: 0,
  tetoDiario: 50,
}

describe('decidirResposta', () => {
  it('responde o prospect que acabou de escrever', () => {
    const d = decidirResposta(BASE)
    expect(d).toEqual({ responder: true, texto: TEXTO_RECEBIDO, categoria: 'recebido' })
  })

  it('cala com o interruptor desligado', () => {
    // A primeira porta. Desligado, nenhuma outra regra precisa estar certa.
    expect(decidirResposta({ ...BASE, ligado: false })).toEqual({
      responder: false,
      motivo: 'desligado',
    })
  })

  it('confirma a saida MESMO com o interruptor desligado', () => {
    // A primeira mensagem promete por escrito que não voltamos a procurar.
    // Calar aqui parece que o pedido se perdeu, e pedido perdido vira
    // denúncia. Promessa não tem interruptor.
    const d = decidirResposta({ ...BASE, ligado: false, pediuSair: true })
    expect(d).toEqual({ responder: true, texto: TEXTO_SAIDA, categoria: 'saida' })
  })

  it('confirma a saida mesmo com o teto diario estourado', () => {
    const d = decidirResposta({ ...BASE, pediuSair: true, enviadasHoje: 999, tetoDiario: 50 })
    expect(d).toEqual({ responder: true, texto: TEXTO_SAIDA, categoria: 'saida' })
  })

  it('NAO responde quem nao veio da fila', () => {
    // O webhook captura toda mensagem recebida no número, não só resposta de
    // prospect. Quem escreve para o dono por outro motivo não pode receber
    // resposta de campanha.
    expect(decidirResposta({ ...BASE, ehProspect: false })).toEqual({
      responder: false,
      motivo: 'fora da fila',
    })
  })

  it('NAO responde robo, e este e o caso que derruba numero', () => {
    // Medido em 12/09: 18 das 47 responderam em 15 segundos de média, e
    // nenhuma era pessoa. Responder põe dois robôs em laço.
    expect(decidirResposta({ ...BASE, ehRobo: true })).toEqual({
      responder: false,
      motivo: 'resposta automatica do outro lado',
    })
  })

  it('NAO confirma saida para robo, mesmo que o texto peca para sair', () => {
    // Menu de chatbot contém "digite 0 para sair". Responder isso seria
    // conversar com a máquina do outro lado, que é o laço de novo.
    expect(decidirResposta({ ...BASE, ehRobo: true, pediuSair: true })).toEqual({
      responder: false,
      motivo: 'resposta automatica do outro lado',
    })
  })

  it('cala depois que o dono assume a conversa', () => {
    expect(decidirResposta({ ...BASE, humanoAssumiu: true })).toEqual({
      responder: false,
      motivo: 'humano assumiu',
    })
  })

  it('avisa uma vez so por conversa', () => {
    // Repetir "ja te respondo" a cada mensagem é o que faz a pessoa perceber
    // que está falando com máquina.
    expect(decidirResposta({ ...BASE, jaAvisouNestaConversa: true })).toEqual({
      responder: false,
      motivo: 'ja avisou',
    })
  })

  it('para NO teto, nao depois dele', () => {
    // `>=` e não `>`: com o teto em 50, a 51ª não pode sair.
    expect(decidirResposta({ ...BASE, enviadasHoje: 50, tetoDiario: 50 })).toEqual({
      responder: false,
      motivo: 'teto diario',
    })
    expect(decidirResposta({ ...BASE, enviadasHoje: 49, tetoDiario: 50 }).responder).toBe(true)
  })

  it('teto zero NAO deixa nada sair', () => {
    // O jeito de desligar só a Camada 1 sem mexer no opt-out.
    expect(decidirResposta({ ...BASE, enviadasHoje: 0, tetoDiario: 0 })).toEqual({
      responder: false,
      motivo: 'teto diario',
    })
  })

  it('o texto do aviso nao promete nada que o produto nao faz', () => {
    // A classe de defeito que esta camada existe para evitar. O produto NÃO
    // manda o follow-up sozinho: ele cria a tarefa. Qualquer verbo de envio
    // aqui seria mentira para um estranho.
    const proibidos = [/envia/i, /cobra/i, /automatic/i, /garant/i, /gratis/i, /R\$/]
    for (const texto of [TEXTO_RECEBIDO, TEXTO_SAIDA]) {
      for (const p of proibidos) expect(texto).not.toMatch(p)
    }
  })

  it('nenhum texto tem travessao', () => {
    // Banido em 31/08 nos criativos e estendido a tudo em 15/09: ninguém
    // digita travessão no WhatsApp, e ele denuncia texto de máquina
    // justamente no canal onde a mensagem precisa parecer uma pessoa.
    for (const texto of [TEXTO_RECEBIDO, TEXTO_SAIDA]) {
      expect(texto).not.toMatch(/[–—]/)
    }
  })
})
