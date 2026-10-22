import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const mocks = vi.hoisted(() => ({ cliente: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.cliente }))
vi.mock('@/lib/supabase/workspace', () => ({ getCurrentUserAndWorkspace: vi.fn() }))

import { getConversas } from './queries'

type Linha = ReturnType<typeof conversa>
type Pedido = { tabela: string; filtros: Record<string, unknown>; ids: string[]; projecao: string }
const pedidos: Pedido[] = []
let linhas: Linha[]
let destino: Linha | null
let erroDestino: boolean
let erroLista: boolean

function conversa(id: string) {
  return {
    id, lead_id: `lead-${id}`, workspace_id: 'empresa-a', arquivada_em: null,
    ultimo_recebido_em: null, ultimo_enviado_em: null,
    respondida_em: '2026-10-22T12:00:00Z', dono_id: null, assumida_em: null,
    leads: { name: `Organizador ${id}`, phone: '5571999991000', foto_path: null },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  pedidos.length = 0
  linhas = Array.from({ length: 200 }, (_, i) => conversa(`conversa-${i + 1}`))
  destino = conversa('conversa-radar')
  erroDestino = false
  erroLista = false
  mocks.cliente.mockResolvedValue({ from: (tabela: string) => {
    const pedido: Pedido = { tabela, filtros: {}, ids: [], projecao: '' }
    pedidos.push(pedido)
    let limite = Infinity
    const q = {
      select: (projecao: string) => { pedido.projecao = projecao; return q },
      eq: (campo: string, valor: unknown) => { pedido.filtros[campo] = valor; return q },
      is: (campo: string, valor: unknown) => { pedido.filtros[campo] = valor; return q },
      in: (_campo: string, ids: string[]) => { pedido.ids = ids; return q },
      not: () => q,
      order: () => q,
      limit: (n: number) => { limite = n; return q },
      maybeSingle: async () => ({
        data: destino && destino.id === pedido.filtros.id && destino.workspace_id === pedido.filtros.workspace_id
          ? destino : null,
        error: erroDestino ? { message: 'falha ao ler destino' } : null,
      }),
      then: (resolver: (r: { data: unknown[]; error: { message: string } | null }) => unknown) => {
        const data = tabela === 'conversas' ? linhas.slice(0, limite) : []
        return Promise.resolve({ data, error: tabela === 'conversas' && erroLista ? { message: 'falha na lista' } : null }).then(resolver)
      },
    }
    return q
  } })
})

describe('destino explícito do Radar na caixa de conversas', () => {
  it('inclui e enriquece a conversa solicitada fora das primeiras 200, sem exceder o teto', async () => {
    const resultado = await getConversas('empresa-a', 'conversa-radar')
    expect(resultado).toHaveLength(200)
    expect(resultado.find(c => c.id === 'conversa-radar')).toMatchObject({
      leadId: 'lead-conversa-radar', nome: 'Organizador conversa-radar', telefone: '5571999991000',
    })
    expect(resultado.some(c => c.id === 'conversa-200')).toBe(false)
    const consultas = pedidos.filter(p => p.tabela === 'conversas')
    expect(consultas).toHaveLength(2)
    expect(consultas[1]!.filtros).toEqual({ id: 'conversa-radar', workspace_id: 'empresa-a', arquivada_em: null })
    expect(consultas[1]!.projecao).toBe(consultas[0]!.projecao)
    expect(pedidos.find(p => p.tabela === 'deals')!.ids).toContain('lead-conversa-radar')
    expect(pedidos.find(p => p.tabela === 'tasks')!.ids).toContain('lead-conversa-radar')
    expect(pedidos.find(p => p.tabela === 'mensagens')!.ids).toContain('conversa-radar')
  })

  it('não duplica nem consulta novamente um destino já listado', async () => {
    const resultado = await getConversas('empresa-a', 'conversa-42')
    expect(resultado.filter(c => c.id === 'conversa-42')).toHaveLength(1)
    expect(pedidos.filter(p => p.tabela === 'conversas')).toHaveLength(1)
  })

  it('preserva a leitura habitual sem destino explícito', async () => {
    expect(await getConversas('empresa-a')).toHaveLength(200)
    expect(pedidos.filter(p => p.tabela === 'conversas')).toHaveLength(1)
  })

  it.each(['alheia', 'inexistente'])('não inclui destino %s nem seleciona um substituto', async (caso) => {
    if (caso === 'alheia') destino!.workspace_id = 'empresa-b'
    else destino = null
    const resultado = await getConversas('empresa-a', 'conversa-radar')
    expect(resultado).toHaveLength(200)
    expect(resultado.some(c => c.id === 'conversa-radar')).toBe(false)
    expect(resultado.some(c => c.id === 'conversa-200')).toBe(true)
  })

  it('inclui um destino autorizado mesmo quando a lista inicial está vazia', async () => {
    linhas = []
    expect((await getConversas('empresa-a', 'conversa-radar')).map(c => c.id)).toEqual(['conversa-radar'])
  })

  it('preserva a lista e registra falha na consulta adicional sem inserir o destino', async () => {
    erroDestino = true
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const resultado = await getConversas('empresa-a', 'conversa-radar')
      expect(resultado).toHaveLength(200)
      expect(resultado.some(c => c.id === 'conversa-radar')).toBe(false)
      expect(log).toHaveBeenCalled()
    } finally { log.mockRestore() }
  })

  it('não transforma falha da consulta principal em conversa encontrada', async () => {
    erroLista = true
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(await getConversas('empresa-a', 'conversa-radar')).toEqual([])
      expect(pedidos.filter(p => p.tabela === 'conversas')).toHaveLength(1)
    } finally { log.mockRestore() }
  })
})
