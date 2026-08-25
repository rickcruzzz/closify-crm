import { describe, expect, it } from 'vitest'

import {
  acaoRecomendada,
  classificar,
  linkDeWhatsapp,
  ordenarPorPrioridade,
  prioridade,
  type EmpresaNoTrial,
} from './trial'

const AGORA = new Date('2026-08-25T12:00:00Z')

function empresa(over: Partial<EmpresaNoTrial> = {}): EmpresaNoTrial {
  return {
    workspaceId: 'w1',
    nome: 'Acme',
    emailDoDono: 'dono@acme.com',
    whatsapp: null,
    diasRestantes: 5,
    contatos: 0,
    negocios: 0,
    ultimaAtividade: null,
    faladoEm: null,
    ...over,
  }
}

describe('classificar', () => {
  it('quem não cadastrou nada nunca usou, mesmo tendo entrado hoje', () => {
    // Login sem uso é a pessoa que abriu, olhou e fechou. Tratar isso como
    // "engajado" mandaria o dono ligar para quem não tem o que discutir.
    const e = empresa({ ultimaAtividade: '2026-08-25T11:00:00Z' })
    expect(classificar(e, AGORA)).toBe('nunca_usou')
  })

  it('sessão viva sem escrita nova NÃO segura ninguém como engajado', () => {
    // O defeito que trocou o sinal: `last_sign_in_at` só muda em autenticação
    // NOVA. Quem abre o CRM todo dia sem deslogar mantém o campo parado, e
    // classificar por ele marcaria como "esfriou" o cliente mais ativo. Aqui
    // a data é a da última ESCRITA, que não mente sobre uso.
    const e = empresa({ contatos: 3, ultimaAtividade: '2026-08-21T12:00:00Z' })
    expect(classificar(e, AGORA)).toBe('esfriou')
  })

  it('usou e mexeu nos últimos 2 dias está engajado', () => {
    const e = empresa({ contatos: 3, ultimaAtividade: '2026-08-24T12:00:00Z' })
    expect(classificar(e, AGORA)).toBe('engajado')
  })

  it('usou mas sumiu há mais de 2 dias esfriou', () => {
    const e = empresa({ contatos: 3, ultimaAtividade: '2026-08-21T12:00:00Z' })
    expect(classificar(e, AGORA)).toBe('esfriou')
  })

  it('negócio conta como uso, não só contato', () => {
    // Dá para criar negócio sem cadastrar contato antes; exigir `contatos > 0`
    // classificaria como "nunca usou" quem está usando o funil.
    const e = empresa({ negocios: 2, ultimaAtividade: '2026-08-25T10:00:00Z' })
    expect(classificar(e, AGORA)).toBe('engajado')
  })
})

describe('prioridade', () => {
  it('quem usou vem antes de quem não usou, mesmo com mais prazo', () => {
    // A regra que a tela existe para aplicar: engajado com 5 dias vale mais
    // que "nunca usou" vencendo amanhã — o segundo não tem o que decidir,
    // porque não viu nada para decidir.
    const engajado = empresa({ contatos: 5, diasRestantes: 5 })
    const cru = empresa({ diasRestantes: 1 })

    expect(prioridade(engajado, 'engajado', AGORA)).toBeGreaterThan(
      prioridade(cru, 'nunca_usou', AGORA),
    )
  })

  it('dentro do mesmo grupo, quem está acabando vem antes', () => {
    const acabando = empresa({ contatos: 1, diasRestantes: 1 })
    const folgado = empresa({ contatos: 1, diasRestantes: 6 })

    expect(prioridade(acabando, 'engajado', AGORA)).toBeGreaterThan(
      prioridade(folgado, 'engajado', AGORA),
    )
  })

  it('trial vencido não passa do teto de urgência', () => {
    // Prazo negativo não pode gerar prioridade infinita e enterrar quem ainda
    // dá para converter.
    const vencido = empresa({ contatos: 1, diasRestantes: -30 })
    const ultimoDia = empresa({ contatos: 1, diasRestantes: 0 })

    expect(prioridade(vencido, 'engajado', AGORA)).toBe(prioridade(ultimoDia, 'engajado', AGORA))
  })
})

describe('já falei com essa pessoa', () => {
  it('cede a vez a quem ainda não foi contatado e está no mesmo estado', () => {
    // A fila existe para achar a PRÓXIMA conversa, não para reabrir a última.
    // O desconto vale um degrau inteiro: engajado já contatado fica abaixo de
    // quem esfriou e com quem ninguém falou.
    const falado = empresa({ contatos: 9, diasRestantes: 3, faladoEm: '2026-08-25T09:00:00Z' })
    const naoFalado = empresa({ contatos: 2, diasRestantes: 3 })

    expect(prioridade(falado, 'engajado', AGORA)).toBeLessThan(
      prioridade(naoFalado, 'esfriou', AGORA),
    )
  })

  it('mas NÃO cai abaixo de um cadastro frio — a venda provável continua no topo', () => {
    // Zerar a prioridade de quem foi contatado transformaria "já falei" em
    // "esqueci". Um engajado que vence amanhã continua sendo a melhor conversa
    // da lista mesmo tendo sido procurado ontem.
    const faladoEAcabando = empresa({
      contatos: 9,
      diasRestantes: 1,
      faladoEm: '2026-08-25T09:00:00Z',
    })
    const frio = empresa({ diasRestantes: 6 })

    expect(prioridade(faladoEAcabando, 'engajado', AGORA)).toBeGreaterThan(
      prioridade(frio, 'nunca_usou', AGORA),
    )
  })

  it('volta a subir depois que o contato esfria', () => {
    // Follow-up dentro do trial é o que fecha. Rebaixar para sempre seria o
    // mesmo que silenciar, e silenciar aqui perde a venda.
    const antigo = empresa({ contatos: 9, diasRestantes: 1, faladoEm: '2026-08-20T09:00:00Z' })
    const recente = empresa({ contatos: 9, diasRestantes: 1, faladoEm: '2026-08-25T09:00:00Z' })

    expect(prioridade(antigo, 'engajado', AGORA)).toBeGreaterThan(
      prioridade(recente, 'engajado', AGORA),
    )
  })

  it('a ação reconhece o contato em vez de mandar falar de novo', () => {
    // Painel que manda "fale hoje" com quem você contatou ontem ensina a ser
    // ignorado — é a mesma erosão de confiança dos alertas com ruído.
    const e = empresa({ contatos: 4, diasRestantes: 5, faladoEm: '2026-08-25T09:00:00Z' })
    expect(acaoRecomendada(e, 'engajado', AGORA)).toContain('Você já falou')
  })

  it('perto do fim, avisa que ainda vale o último toque', () => {
    const e = empresa({ contatos: 4, diasRestantes: 1, faladoEm: '2026-08-25T09:00:00Z' })
    expect(acaoRecomendada(e, 'engajado', AGORA)).toContain('último toque')
  })
})

describe('acaoRecomendada', () => {
  it('avisa para falar hoje quando engajado e o prazo aperta', () => {
    const e = empresa({ contatos: 4, diasRestantes: 1 })
    expect(acaoRecomendada(e, 'engajado', AGORA)).toContain('Fale hoje')
  })

  it('cita quantos contatos a pessoa cadastrou antes de parar', () => {
    // O número é o que dá assunto para a conversa. "Começou e parou" sozinho
    // não ajuda quem vai ligar.
    const e = empresa({ contatos: 7, diasRestantes: 3 })
    expect(acaoRecomendada(e, 'esfriou', AGORA)).toContain('7 contatos')
  })

  it('concorda o singular quando é um contato só', () => {
    const e = empresa({ contatos: 1 })
    expect(acaoRecomendada(e, 'esfriou', AGORA)).toContain('1 contato e parou')
  })
})

describe('ordenarPorPrioridade', () => {
  it('põe o engajado que está acabando no topo', () => {
    const lista = ordenarPorPrioridade(
      [
        empresa({ workspaceId: 'frio', diasRestantes: 1 }),
        empresa({ workspaceId: 'engajado-folgado', contatos: 2, diasRestantes: 6, ultimaAtividade: '2026-08-25T09:00:00Z' }),
        empresa({ workspaceId: 'engajado-acabando', contatos: 9, diasRestantes: 1, ultimaAtividade: '2026-08-25T08:00:00Z' }),
      ],
      AGORA,
    )

    expect(lista.map((e) => e.workspaceId)).toEqual([
      'engajado-acabando',
      'engajado-folgado',
      'frio',
    ])
  })
})

describe('linkDeWhatsapp', () => {
  it('devolve null sem número, para a tela não desenhar botão morto', () => {
    expect(linkDeWhatsapp(null, 'Acme')).toBeNull()
  })

  it('leva a mensagem pronta, com o nome da empresa', () => {
    // O atrito de escrever é o que faz o contato não acontecer. Texto pronto
    // e editável vale mais que uma janela em branco.
    const link = linkDeWhatsapp('5511988887777', 'Clínica Alva')
    expect(link).toContain('wa.me/5511988887777')
    expect(decodeURIComponent(link!)).toContain('Clínica Alva')
  })
})
