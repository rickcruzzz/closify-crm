import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const m = vi.hoisted(() => ({ cliente: vi.fn(), sessao: vi.fn() }))
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('sem acesso') } }))
vi.mock('@/components/enterprise/painel-de-eventos', () => ({ PainelDeEventos: () => null }))
vi.mock('@/lib/supabase/server', () => ({ createClient: m.cliente }))
vi.mock('@/lib/supabase/workspace', () => ({ getCurrentUserAndWorkspace: m.sessao }))
import Page from '@/app/(dashboard)/enterprise/eventos/page'

let linhas: { id: string; nome: string; workspace_id: string; contato_email: string | null; contato_telefone: string | null; foto_path: null }[]
let autorizado: boolean
beforeEach(() => {
  autorizado = true
  linhas = []
  m.sessao.mockResolvedValue({ workspaceId: 'empresa-a' })
  m.cliente.mockResolvedValue({ rpc: async () => ({ data: autorizado }), from: () => {
    let resultado = linhas.slice()
    const q = {
      select: () => q,
      eq: (coluna: keyof (typeof linhas)[number], valor: string) => { resultado = resultado.filter(r => r[coluna] === valor); return q },
      not: (coluna: keyof (typeof linhas)[number]) => { resultado = resultado.filter(r => r[coluna] !== null); return q },
      neq: (coluna: keyof (typeof linhas)[number], valor: string) => { resultado = resultado.filter(r => r[coluna] !== valor); return q },
      order: () => q,
      limit: (n: number) => { resultado = resultado.slice(0, n); return q },
      then: (resolver: (r: { data: typeof linhas; error: null }) => unknown) => Promise.resolve({ data: resultado, error: null }).then(resolver),
    }
    return q
  } })
})
const completa = { id: 'completa', nome: 'Oportunidade com contato completo', workspace_id: 'empresa-a', contato_email: 'comercial@evento.com.br', contato_telefone: '(71) 99999-1234', foto_path: null }
describe('lista do Radar exige contato completo', () => {
  it('registros antigos sem contato não ocupam as cem vagas da consulta', async () => {
    linhas = [...Array.from({ length: 100 }, (_, i) => ({ ...completa, id: `incompleto-${i}`, contato_email: null, contato_telefone: null })), completa]
    const pagina = await Page()
    expect(pagina.props.eventos).toEqual([expect.objectContaining({ id: 'completa' })])
    expect(linhas).toHaveLength(101)
  })
  it('não exibe dados em branco, telefone inválido ou evento de outra empresa', async () => {
    linhas = [completa, { ...completa, id: 'sem-email', contato_email: '' },
      { ...completa, id: 'numero-invalido', contato_telefone: '1000000000' },
      { ...completa, id: 'outra-empresa', workspace_id: 'empresa-b' }]
    expect((await Page()).props.eventos).toEqual([expect.objectContaining({ id: 'completa' })])
  })
  it('exige autorização Enterprise', async () => {
    autorizado = false
    await expect(Page()).rejects.toThrow('sem acesso')
  })
})
