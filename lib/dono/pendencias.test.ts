import { describe, expect, it } from 'vitest'

import { montarPendencias } from './pendencias'
import type { EmpresaNaCentral } from './tipos'

/**
 * Os casos abaixo não são inventados: são o estado real da produção em
 * 20/08/2026, que foi o que motivou esta tela existir. Nenhum deles gerava
 * erro em lugar nenhum — do ponto de vista do sistema, estava tudo certo.
 */

function empresa(sobrescrever: Partial<EmpresaNaCentral> = {}): EmpresaNaCentral {
  return {
    id: 'w1',
    nome: 'Empresa Teste',
    dono: 'Fulano',
    email: 'fulano@exemplo.com',
    telefone: null,
    pagando: false,
    statusAssinatura: null,
    proVenceEm: null,
    criadoEm: '2026-08-01T00:00:00Z',
    ultimoAcesso: null,
    quantidadeDeMembros: 1,
    quantidadeDeContatos: 0,
    quantidadeDeNegocios: 0,
    ...sobrescrever,
  }
}

const semAsaas = { ok: false as const, erro: 'fora do ar' }
const semEmails = { ok: false as const, erro: 'fora do ar' }

describe('montarPendencias', () => {
  it('não inventa pendência quando está tudo certo', () => {
    const resultado = montarPendencias({
      empresas: [empresa({ pagando: true, statusAssinatura: 'active' })],
      assinaturasNoBanco: [
        {
          workspace_id: 'w1',
          status: 'active',
          current_period_end: '2026-09-13T00:00:00Z',
          asaas_subscription_id: 'sub_real',
        },
      ],
      assinaturasNoAsaas: { ok: true, dados: [{ id: 'sub_real', status: 'ACTIVE', deleted: false }] },
      emails: { ok: true, dados: [] },
      errosRecentes: 0,
      agora: new Date('2026-08-20T00:00:00Z'),
    })

    expect(resultado).toEqual([])
  })

  // Caso real: `sub_dbs8pblwj2irujc2` e `sub_3qwh8ygjnpon66ae`, ativas no
  // Asaas, `past_due` no banco com vencimento nulo. Duas pessoas pagando sem
  // receber o Pro.
  it('acusa assinatura ativa no Asaas que não virou Pro', () => {
    const resultado = montarPendencias({
      empresas: [empresa({ nome: 'Cliente Pagante', pagando: false, statusAssinatura: 'past_due' })],
      assinaturasNoBanco: [
        {
          workspace_id: 'w1',
          status: 'past_due',
          current_period_end: null,
          asaas_subscription_id: 'sub_dbs8pblwj2irujc2',
        },
      ],
      assinaturasNoAsaas: {
        ok: true,
        dados: [{ id: 'sub_dbs8pblwj2irujc2', status: 'ACTIVE', deleted: false }],
      },
      emails: semEmails,
      errosRecentes: 0,
    })

    expect(resultado).toHaveLength(1)
    expect(resultado[0].gravidade).toBe('dinheiro')
    expect(resultado[0].titulo).toBe('Assinatura ativa que não virou Pro')
    expect(resultado[0].detalhe).toContain('Cliente Pagante')
    expect(resultado[0].detalhe).toContain('sem data de vencimento')
    expect(resultado[0].acao?.alvo).toBe('sub_dbs8pblwj2irujc2')
  })

  // Caso real: `sub_epjbmoerbqoz7c76`, ativa no Asaas e inexistente no banco.
  it('acusa assinatura ativa que o banco não conhece', () => {
    const resultado = montarPendencias({
      empresas: [],
      assinaturasNoBanco: [],
      assinaturasNoAsaas: {
        ok: true,
        dados: [{ id: 'sub_epjbmoerbqoz7c76', status: 'ACTIVE', deleted: false }],
      },
      emails: semEmails,
      errosRecentes: 0,
    })

    expect(resultado).toHaveLength(1)
    expect(resultado[0].gravidade).toBe('dinheiro')
    expect(resultado[0].titulo).toBe('Assinatura ativa que o sistema não conhece')
  })

  // Caso real: `sub_teste_local_1786896365194`, dando Pro até 15/09 sem
  // ninguém ter pago.
  it('acusa assinatura de teste dando Pro de graça', () => {
    const resultado = montarPendencias({
      empresas: [empresa({ nome: 'Ganhou sem pagar', pagando: true })],
      assinaturasNoBanco: [
        {
          workspace_id: 'w1',
          status: 'active',
          current_period_end: '2026-09-15T00:00:00Z',
          asaas_subscription_id: 'sub_teste_local_1786896365194',
        },
      ],
      assinaturasNoAsaas: { ok: true, dados: [] },
      emails: semEmails,
      errosRecentes: 0,
      agora: new Date('2026-08-20T00:00:00Z'),
    })

    expect(resultado).toHaveLength(1)
    expect(resultado[0].titulo).toBe('Assinatura de teste dando Pro de graça')
    expect(resultado[0].detalhe).toContain('Ganhou sem pagar')
  })

  // Sem a lista do Asaas não dá para afirmar que há divergência. Acusar aqui
  // seria pior que calar: mandaria o dono "consertar" o que talvez esteja certo.
  it('não acusa divergência quando o Asaas está fora do ar', () => {
    const resultado = montarPendencias({
      empresas: [empresa({ pagando: false, statusAssinatura: 'past_due' })],
      assinaturasNoBanco: [
        {
          workspace_id: 'w1',
          status: 'past_due',
          current_period_end: null,
          asaas_subscription_id: 'sub_real',
        },
      ],
      assinaturasNoAsaas: semAsaas,
      emails: semEmails,
      errosRecentes: 0,
    })

    expect(resultado).toEqual([])
  })

  it('avisa de Pro vencendo dentro de sete dias, e ignora o que vence depois', () => {
    const base = {
      assinaturasNoBanco: [],
      assinaturasNoAsaas: semAsaas,
      emails: semEmails,
      errosRecentes: 0,
      agora: new Date('2026-08-20T00:00:00Z'),
    }

    const perto = montarPendencias({
      ...base,
      empresas: [empresa({ pagando: true, proVenceEm: '2026-08-24T00:00:00Z' })],
    })
    expect(perto).toHaveLength(1)
    expect(perto[0].titulo).toBe('Pro vencendo esta semana')

    const longe = montarPendencias({
      ...base,
      empresas: [empresa({ pagando: true, proVenceEm: '2026-09-30T00:00:00Z' })],
    })
    expect(longe).toEqual([])
  })

  // `sent` significa "saiu daqui, ainda sem confirmação" — normal por alguns
  // segundos. Tratar como falha encheria a fila de ruído a cada envio.
  it('acusa e-mail que falhou, mas não o que ainda está em trânsito', () => {
    const resultado = montarPendencias({
      empresas: [],
      assinaturasNoBanco: [],
      assinaturasNoAsaas: semAsaas,
      emails: {
        ok: true,
        dados: [
          {
            id: 'e1',
            para: 'quem@exemplo.com',
            assunto: 'Redefinição de senha',
            enviadoEm: '2026-08-20T00:00:00Z',
            ultimoEvento: 'bounced',
            chegou: false,
          },
          {
            id: 'e2',
            para: 'outro@exemplo.com',
            assunto: 'Confirmação',
            enviadoEm: '2026-08-20T00:00:00Z',
            ultimoEvento: 'sent',
            chegou: false,
          },
        ],
      },
      errosRecentes: 0,
    })

    expect(resultado).toHaveLength(1)
    expect(resultado[0].detalhe).toContain('bounced')
  })

  it('dinheiro vem antes de atenção na fila', () => {
    const resultado = montarPendencias({
      empresas: [empresa({ pagando: false })],
      assinaturasNoBanco: [
        {
          workspace_id: 'w1',
          status: 'past_due',
          current_period_end: null,
          asaas_subscription_id: 'sub_real',
        },
      ],
      assinaturasNoAsaas: { ok: true, dados: [{ id: 'sub_real', status: 'ACTIVE', deleted: false }] },
      emails: semEmails,
      errosRecentes: 3,
    })

    expect(resultado.map((p) => p.gravidade)).toEqual(['dinheiro', 'atencao'])
  })

  it('assinatura cancelada no Asaas (deleted) não conta como ativa', () => {
    const resultado = montarPendencias({
      empresas: [],
      assinaturasNoBanco: [],
      assinaturasNoAsaas: {
        ok: true,
        dados: [{ id: 'sub_morta', status: 'ACTIVE', deleted: true }],
      },
      emails: semEmails,
      errosRecentes: 0,
    })

    expect(resultado).toEqual([])
  })
})
