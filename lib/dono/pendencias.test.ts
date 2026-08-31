import { describe, expect, it } from 'vitest'

import { agruparPendencias, montarPendencias } from './pendencias'
import type { EmpresaComEstado } from './tipos'

/**
 * Os casos abaixo não são inventados: são o estado real da produção em
 * 20/08/2026, que foi o que motivou esta tela existir. Nenhum deles gerava
 * erro em lugar nenhum — do ponto de vista do sistema, estava tudo certo.
 */

function empresa(sobrescrever: Partial<EmpresaComEstado> = {}): EmpresaComEstado {
  return {
    id: 'w1',
    nome: 'Empresa Teste',
    dono: 'Fulano',
    email: 'fulano@empresa.com.br',
    telefone: null,
    pagando: false,
    emTrial: false,
    interna: false,
    // O estado de dinheiro não é decidido por `montarPendencias`, e por isso
    // o padrão aqui é `sem_pro`: os casos que precisam de outro o declaram.
    estadoDoAcesso: 'sem_pro',
    statusAssinatura: null,
    proVenceEm: null,
    criadoEm: '2026-08-01T00:00:00Z',
    ultimoAcesso: null,
    quantidadeDeMembros: 1,
    quantidadeDeContatos: 0,
    quantidadeDeNegocios: 0,
    utmCampaign: null,
    veioDeCliqueDeAnuncio: false,
    ...sobrescrever,
  }
}

const semAsaas = { ok: false as const, erro: 'fora do ar' }
const semEmails = { ok: false as const, erro: 'fora do ar' }
const semContas = new Set<string>()

const base = {
  empresas: [],
  assinaturasNoBanco: [],
  assinaturasNoAsaas: semAsaas,
  emails: semEmails,
  errosRecentes: 0,
  emailsDeContasReais: semContas,
  agora: new Date('2026-08-20T00:00:00Z'),
}

describe('montarPendencias', () => {
  it('não inventa pendência quando está tudo certo', () => {
    expect(
      montarPendencias({
        ...base,
        // `estadoDoAcesso: 'pagante'` e não só `pagando`: desde 30/08 é ele
        // que decide, porque `pagando` é `pro_vigente()` e inclui trial.
        empresas: [
          empresa({ pagando: true, estadoDoAcesso: 'pagante', statusAssinatura: 'active' }),
        ],
        assinaturasNoBanco: [
          {
            workspace_id: 'w1',
            status: 'active',
            current_period_end: '2026-09-13T00:00:00Z',
            asaas_subscription_id: 'sub_real',
          },
        ],
        assinaturasNoAsaas: {
          ok: true,
          dados: [{ id: 'sub_real', status: 'ACTIVE', deleted: false }],
        },
        emails: { ok: true, dados: [] },
      }),
    ).toEqual([])
  })

  // Caso real: `sub_dbs8pblwj2irujc2` e `sub_3qwh8ygjnpon66ae`, ativas no
  // Asaas, `past_due` no banco com vencimento nulo. Pessoas pagando sem receber.
  it('acusa assinatura ativa no Asaas que não virou Pro', () => {
    const r = montarPendencias({
      ...base,
      empresas: [empresa({ nome: 'Cliente Pagante', statusAssinatura: 'past_due' })],
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
    })

    expect(r).toHaveLength(1)
    expect(r[0].gravidade).toBe('dinheiro')
    expect(r[0].detalhe).toContain('sem data de vencimento')
    expect(r[0].acao?.alvo).toBe('sub_dbs8pblwj2irujc2')
  })

  // Caso real: `sub_epjbmoerbqoz7c76`, ativa no Asaas e inexistente no banco.
  it('acusa assinatura ativa que o banco não conhece', () => {
    const r = montarPendencias({
      ...base,
      assinaturasNoAsaas: {
        ok: true,
        dados: [{ id: 'sub_epjbmoerbqoz7c76', status: 'ACTIVE', deleted: false }],
      },
    })

    expect(r).toHaveLength(1)
    expect(r[0].tipo).toBe('assinatura-orfa')
    expect(r[0].gravidade).toBe('dinheiro')
  })

  it('acusa assinatura de teste dando Pro de graça', () => {
    const r = montarPendencias({
      ...base,
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
    })

    expect(r).toHaveLength(1)
    expect(r[0].tipo).toBe('assinatura-de-teste')
  })

  // Sem a lista do Asaas não dá para afirmar que há divergência. Acusar aqui
  // mandaria o dono "consertar" o que talvez esteja certo.
  it('não acusa divergência quando o Asaas está fora do ar', () => {
    expect(
      montarPendencias({
        ...base,
        empresas: [empresa({ statusAssinatura: 'past_due' })],
        assinaturasNoBanco: [
          {
            workspace_id: 'w1',
            status: 'past_due',
            current_period_end: null,
            asaas_subscription_id: 'sub_real',
          },
        ],
      }),
    ).toEqual([])
  })

  it('avisa de Pro vencendo dentro de sete dias, e ignora o que vence depois', () => {
    const perto = montarPendencias({
      ...base,
      empresas: [empresa({ pagando: true, proVenceEm: '2026-08-24T00:00:00Z' })],
    })
    expect(perto).toHaveLength(1)
    expect(perto[0].tipo).toBe('pro-vencendo')

    const longe = montarPendencias({
      ...base,
      empresas: [empresa({ pagando: true, proVenceEm: '2026-09-30T00:00:00Z' })],
    })
    expect(longe).toEqual([])
  })

  describe('filtro de ruído nos e-mails', () => {
    const bounced = (para: string, id: string) => ({
      id,
      para,
      assunto: 'Confirm your email address',
      enviadoEm: '2026-08-20T00:00:00Z',
      ultimoEvento: 'bounced',
      chegou: false,
    })

    // O problema real: 8 dos 11 alertas da primeira execução eram endereços
    // inventados por scripts meus, que nunca viraram usuário.
    it('ignora falha para endereço que não tem conta no banco', () => {
      expect(
        montarPendencias({
          ...base,
          emails: {
            ok: true,
            dados: [
              bounced('repeticao-3-1787128795231@gmail.com', 'e1'),
              bounced('medicao-signup-1787128527957@gmail.com', 'e2'),
            ],
          },
          emailsDeContasReais: semContas,
        }),
      ).toEqual([])
    })

    it('acusa falha para endereço de cliente de verdade', () => {
      const r = montarPendencias({
        ...base,
        emails: { ok: true, dados: [bounced('cliente@empresa.com.br', 'e1')] },
        emailsDeContasReais: new Set(['cliente@empresa.com.br']),
      })

      expect(r).toHaveLength(1)
      expect(r[0].tipo).toBe('email-nao-chegou')
    })

    // `sent` é "saiu daqui, ainda sem confirmação" — normal por segundos.
    it('não acusa e-mail ainda em trânsito, mesmo de conta real', () => {
      expect(
        montarPendencias({
          ...base,
          emails: {
            ok: true,
            dados: [{ ...bounced('cliente@empresa.com.br', 'e1'), ultimoEvento: 'sent' }],
          },
          emailsDeContasReais: new Set(['cliente@empresa.com.br']),
        }),
      ).toEqual([])
    })
  })

  // Caso real em produção: dona da "Agência Nova Era" com `gmaa2il.com`.
  it('acusa e-mail cadastrado com erro de digitação, e oferece o telefone', () => {
    const r = montarPendencias({
      ...base,
      empresas: [
        empresa({
          nome: 'Agência Nova Era',
          email: 'testei122@gmaa2il.com',
          telefone: '11999998888',
        }),
      ],
    })

    expect(r).toHaveLength(1)
    expect(r[0].tipo).toBe('email-com-erro-de-digitacao')
    expect(r[0].detalhe).toContain('gmail.com')
    expect(r[0].detalhe).toContain('11999998888')
  })

  it('não acusa erro de digitação em domínio próprio de empresa', () => {
    expect(
      montarPendencias({ ...base, empresas: [empresa({ email: 'contato@minhaagencia.com.br' })] }),
    ).toEqual([])
  })

  describe('cliente sumido', () => {
    it('acusa quem usou e parou de acessar', () => {
      const r = montarPendencias({
        ...base,
        empresas: [
          empresa({
            nome: 'Sumiu',
            quantidadeDeContatos: 5,
            ultimoAcesso: '2026-08-01T00:00:00Z',
          }),
        ],
      })

      expect(r).toHaveLength(1)
      expect(r[0].tipo).toBe('cliente-sumido')
      expect(r[0].detalhe).toContain('19 dias')
    })

    it('avisa mais forte quando quem sumiu está pagando', () => {
      const r = montarPendencias({
        ...base,
        empresas: [
          empresa({
            pagando: true,
            // `estadoDoAcesso`, não `pagando`: é ele que decide o texto desde
            // 30/08. Ver o caso logo abaixo, que é o motivo da mudança.
            estadoDoAcesso: 'pagante',
            quantidadeDeContatos: 5,
            ultimoAcesso: '2026-08-01T00:00:00Z',
          }),
        ],
      })

      expect(r[0].titulo).toBe('Cliente pagante sumido')
      expect(r[0].detalhe).toContain('caminho mais curto para o cancelamento')
    })

    /**
     * O defeito que a correção de 30/08 fechou, e ele é sobre DINHEIRO.
     *
     * `pagando` é `pro_vigente()`, que é `assinatura viva OU trial válido`.
     * Alguém em trial gratuito que sumia virava "Cliente PAGANTE sumido", com
     * o texto "está pagando e não está usando" — uma frase factualmente falsa
     * sobre dinheiro, na tela que existe justamente para não errar sobre
     * dinheiro.
     */
    it('NÃO chama de pagante quem só está em trial', () => {
      const r = montarPendencias({
        ...base,
        empresas: [
          empresa({
            pagando: true,
            emTrial: true,
            estadoDoAcesso: 'trial',
            quantidadeDeContatos: 5,
            ultimoAcesso: '2026-08-01T00:00:00Z',
          }),
        ],
      })

      expect(r[0].titulo).toBe('Cliente sumido')
      expect(r[0].detalhe).not.toContain('Está pagando')
    })

    /**
     * Medido em 30/08: **3 de 3** alertas de "cliente sumido" eram conta de
     * teste do próprio dono, uma delas chamada "agencia de marketig teste".
     * Repetição exata do defeito de 20/08, quando 8 de 11 alertas da primeira
     * execução eram e-mails inventados por script.
     *
     * Uma fila com 100% de ruído ensina a ignorar a fila inteira.
     */
    it('não avisa sobre conta de teste que sumiu', () => {
      const r = montarPendencias({
        ...base,
        empresas: [
          empresa({
            interna: true,
            quantidadeDeContatos: 8,
            ultimoAcesso: '2026-08-01T00:00:00Z',
          }),
        ],
      })

      expect(r.filter((p) => p.tipo === 'cliente-sumido')).toHaveLength(0)
    })

    // Quem nunca cadastrou contato não abandonou o produto: nunca chegou a
    // usá-lo. É problema de ativação, que é outra conversa.
    it('não acusa quem nunca chegou a usar', () => {
      expect(
        montarPendencias({
          ...base,
          empresas: [empresa({ quantidadeDeContatos: 0, ultimoAcesso: '2026-08-01T00:00:00Z' })],
        }),
      ).toEqual([])
    })

    it('não acusa quem acessou esta semana', () => {
      expect(
        montarPendencias({
          ...base,
          empresas: [empresa({ quantidadeDeContatos: 5, ultimoAcesso: '2026-08-19T00:00:00Z' })],
        }),
      ).toEqual([])
    })
  })

  it('dinheiro vem antes de atenção na fila', () => {
    const r = montarPendencias({
      ...base,
      empresas: [empresa()],
      assinaturasNoBanco: [
        {
          workspace_id: 'w1',
          status: 'past_due',
          current_period_end: null,
          asaas_subscription_id: 'sub_real',
        },
      ],
      assinaturasNoAsaas: {
        ok: true,
        dados: [{ id: 'sub_real', status: 'ACTIVE', deleted: false }],
      },
      errosRecentes: 3,
    })

    expect(r.map((p) => p.gravidade)).toEqual(['dinheiro', 'atencao'])
  })

  it('assinatura cancelada no Asaas (deleted) não conta como ativa', () => {
    expect(
      montarPendencias({
        ...base,
        assinaturasNoAsaas: {
          ok: true,
          dados: [{ id: 'sub_morta', status: 'ACTIVE', deleted: true }],
        },
      }),
    ).toEqual([])
  })
})

describe('agruparPendencias', () => {
  const item = (id: string, tipo: 'email-nao-chegou' | 'assinatura-orfa') => ({
    id,
    tipo,
    gravidade: (tipo === 'assinatura-orfa' ? 'dinheiro' : 'atencao') as 'dinheiro' | 'atencao',
    titulo: tipo === 'assinatura-orfa' ? 'Assinatura órfã' : 'E-mail que não chegou',
    detalhe: '',
  })

  it('junta itens do mesmo tipo e conta no título', () => {
    const grupos = agruparPendencias([
      item('a', 'email-nao-chegou'),
      item('b', 'email-nao-chegou'),
      item('c', 'email-nao-chegou'),
    ])

    expect(grupos).toHaveLength(1)
    expect(grupos[0].titulo).toBe('3 × E-mail que não chegou')
    expect(grupos[0].itens).toHaveLength(3)
  })

  // Um item só não vira grupo com contagem: "1 ×" é ruído.
  it('mantém o título original quando o tipo tem um item só', () => {
    expect(agruparPendencias([item('a', 'assinatura-orfa')])[0].titulo).toBe('Assinatura órfã')
  })

  it('separa tipos diferentes e herda a gravidade mais grave', () => {
    const grupos = agruparPendencias([
      item('a', 'email-nao-chegou'),
      item('b', 'assinatura-orfa'),
    ])

    expect(grupos).toHaveLength(2)
    expect(grupos.find((g) => g.tipo === 'assinatura-orfa')?.gravidade).toBe('dinheiro')
  })
})

describe('o alerta de erros carrega o carimbo do erro mais recente', () => {
  /**
   * O defeito medido em 31/08: este era o ÚNICO dos nove alertas com id fixo
   * (`'erros'`). Os outros oito são `sumido:${empresa.id}`,
   * `orfa:${assinatura.id}` e afins — silenciar afeta aquele item e nada mais.
   *
   * Com id fixo, clicar em "Silenciar" apagava a categoria inteira para
   * sempre, inclusive erro que surgisse depois. O dono ficava entre ver os
   * mesmos 4 erros de 7 e 11 dias atrás indefinidamente, ou nunca mais ver
   * erro nenhum.
   */
  it('o id muda quando aparece erro novo, então o alerta silenciado reaparece', () => {
    const antes = montarPendencias({ ...base, errosRecentes: 4, idDoErroMaisRecente: 'err-a' })
    const depois = montarPendencias({ ...base, errosRecentes: 5, idDoErroMaisRecente: 'err-b' })

    const idAntes = antes.find((p) => p.tipo === 'erros-no-produto')?.id
    const idDepois = depois.find((p) => p.tipo === 'erros-no-produto')?.id

    expect(idAntes).toBe('erros:err-a')
    expect(idDepois).toBe('erros:err-b')
    expect(idAntes).not.toBe(idDepois)
  })

  // O espelho: sem erro novo, o id é estável — senão silenciar não duraria
  // nem até a próxima carga da página, e o botão seria decorativo.
  it('sem erro novo o id não muda, e o silêncio dura', () => {
    const a = montarPendencias({ ...base, errosRecentes: 4, idDoErroMaisRecente: 'err-a' })
    const b = montarPendencias({ ...base, errosRecentes: 4, idDoErroMaisRecente: 'err-a' })

    expect(a.find((p) => p.tipo === 'erros-no-produto')?.id).toBe(
      b.find((p) => p.tipo === 'erros-no-produto')?.id,
    )
  })

  // A tabela pode estar vazia, ou a leitura do id pode falhar sem a contagem
  // falhar junto. O alerta não pode sumir por causa disso.
  it('sem id disponível, cai no identificador antigo em vez de sumir', () => {
    const r = montarPendencias({ ...base, errosRecentes: 2, idDoErroMaisRecente: null })
    expect(r.find((p) => p.tipo === 'erros-no-produto')?.id).toBe('erros')
  })
})
