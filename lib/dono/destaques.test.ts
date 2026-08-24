import { describe, expect, it } from 'vitest'

import { enderecoDaTela, lerManifesto } from './destaques'

/**
 * O manifesto é escrito por `scripts/marketing/gerar-stories.py`, ou seja, por
 * fora do TypeScript: nenhum tipo daqui alcança o outro lado. Estes casos
 * travam o que acontece quando os dois discordam — e a resposta certa nunca é
 * "confiar e quebrar na renderização".
 */
describe('lerManifesto', () => {
  const TELA = {
    ordem: 1,
    arquivo: 'demo-1-gancho.png',
    arquivo4k: 'demo-1-gancho@4k.png',
    titulo: 'O cliente pediu orçamento e sumiu no WhatsApp.',
    layout: 'produto',
  }

  it('lê o formato que o gerador grava', () => {
    const manifesto = JSON.stringify({
      destaques: [{ id: 'demo', nome: 'Como funciona', resumo: 'A dor.', telas: [TELA] }],
    })

    const lido = lerManifesto(manifesto)

    expect(lido).toHaveLength(1)
    expect(lido[0].telas[0].arquivo).toBe('demo-1-gancho.png')
  })

  it('devolve vazio em JSON inválido, em vez de estourar', () => {
    // Acontece de verdade: o script interrompido no meio da escrita deixa o
    // arquivo truncado, e a tela precisa continuar abrindo.
    expect(lerManifesto('{"destaques": [')).toEqual([])
  })

  it('devolve vazio quando falta a chave `destaques`', () => {
    expect(lerManifesto('{"telas": []}')).toEqual([])
  })

  it('devolve vazio quando o JSON é válido mas não é objeto', () => {
    expect(lerManifesto('42')).toEqual([])
    expect(lerManifesto('null')).toEqual([])
    expect(lerManifesto('"texto"')).toEqual([])
  })

  it('descarta o destaque malformado e mantém os outros', () => {
    // O caso que motivou a validação: um campo renomeado no script derrubaria
    // a tela inteira se um item ruim contaminasse a lista. Perder um bloco e
    // manter os demais é degradação; tela em branco é falha.
    const manifesto = JSON.stringify({
      destaques: [
        { id: 'demo', nome: 'Como funciona', resumo: 'A dor.', telas: [TELA] },
        { id: 'planos', nome: 'Planos' },
      ],
    })

    const lido = lerManifesto(manifesto)

    expect(lido).toHaveLength(1)
    expect(lido[0].id).toBe('demo')
  })

  it('descarta destaque cuja tela não tem os campos esperados', () => {
    const manifesto = JSON.stringify({
      destaques: [{ id: 'demo', nome: 'X', resumo: 'Y', telas: [{ arquivo: 'a.png' }] }],
    })

    expect(lerManifesto(manifesto)).toEqual([])
  })
})

describe('enderecoDaTela', () => {
  it('aponta para a rota que já serve as artes da Central', () => {
    expect(enderecoDaTela('demo-1-gancho.png')).toBe(
      '/api/dono/criativo/organico/demo-1-gancho.png',
    )
  })

  it('codifica o nome do arquivo', () => {
    // `@` é o caso real: toda tela tem uma versão `nome@4k.png`. Sem codificar,
    // o navegador não erra hoje, mas qualquer nome com `#` ou `?` cortaria a
    // URL em silêncio — e o gerador não promete nunca usar um.
    expect(enderecoDaTela('demo-1-gancho@4k.png')).toBe(
      '/api/dono/criativo/organico/demo-1-gancho%404k.png',
    )
  })
})
