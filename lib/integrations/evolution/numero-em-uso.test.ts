import { describe, expect, it } from 'vitest'

import { conflitoDeNumero, numeroDoJid } from './numero-em-uso'

/**
 * O caso real que motivou tudo isto, medido em 25/08.
 *
 * O número `557185040900` estava pareado em DUAS instâncias ao mesmo tempo,
 * uma como aparelho `:92` e outra como `:93`. As duas disputavam os mesmos
 * eventos da conta, e nenhuma mensagem chegou a lugar nenhum.
 */
const AURORA = '557185040900:92@s.whatsapp.net'
const TESTE = '557185040900:93@s.whatsapp.net'

describe('numeroDoJid', () => {
  it('trata o mesmo número em aparelhos diferentes como o mesmo número', () => {
    // Comparar o jid cru diria que `:92` e `:93` são distintos — foi
    // exatamente por isso que os dois pareamentos passaram.
    expect(numeroDoJid(AURORA)).toBe('557185040900')
    expect(numeroDoJid(TESTE)).toBe('557185040900')
    expect(numeroDoJid(AURORA)).toBe(numeroDoJid(TESTE))
  })

  it('funciona sem sufixo de aparelho', () => {
    expect(numeroDoJid('557185040900@s.whatsapp.net')).toBe('557185040900')
  })

  it('devolve null para instância que ainda não pareou', () => {
    // Instância sem número não conflita com ninguém, e tratar '' como número
    // faria toda instância nova brigar com toda outra instância nova.
    for (const vazio of [null, undefined, '', '@s.whatsapp.net', ':92@s.whatsapp.net']) {
      expect(numeroDoJid(vazio), String(vazio)).toBeNull()
    }
  })
})

describe('conflitoDeNumero', () => {
  const conhecidas = [
    { id: 'aurora', jid: AURORA },
    { id: 'teste', jid: TESTE },
    { id: 'nunca-pareou', jid: '' },
  ]

  it('acha a outra instância que já usa o número', () => {
    const c = conflitoDeNumero({ instanciaId: 'teste', jid: TESTE, conhecidas })
    expect(c?.id).toBe('aurora')
  })

  it('não conflita consigo mesma', () => {
    // Reconectar a MESMA instância com o MESMO número é o caminho normal
    // depois de uma queda. Recusar isso deixaria a empresa sem WhatsApp.
    const c = conflitoDeNumero({
      instanciaId: 'aurora',
      jid: AURORA,
      conhecidas: [{ id: 'aurora', jid: AURORA }],
    })
    expect(c).toBeNull()
  })

  it('número diferente não conflita', () => {
    const c = conflitoDeNumero({
      instanciaId: 'nova',
      jid: '5511999998888:1@s.whatsapp.net',
      conhecidas,
    })
    expect(c).toBeNull()
  })

  it('instância sem jid nunca conflita', () => {
    const c = conflitoDeNumero({ instanciaId: 'nova', jid: '', conhecidas })
    expect(c).toBeNull()
  })

  it('não confunde instância sem jid com outra sem jid', () => {
    // Duas instâncias esperando o QR não podem ser tratadas como "mesmo
    // número", senão ninguém consegue conectar enquanto houver outra na fila.
    const c = conflitoDeNumero({
      instanciaId: 'a',
      jid: null,
      conhecidas: [
        { id: 'a', jid: null },
        { id: 'b', jid: '' },
        { id: 'c', jid: undefined },
      ],
    })
    expect(c).toBeNull()
  })

  it('lista vazia não estoura', () => {
    expect(conflitoDeNumero({ instanciaId: 'x', jid: TESTE, conhecidas: [] })).toBeNull()
  })
})
