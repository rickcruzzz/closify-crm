import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const m = vi.hoisted(() => ({ cliente: vi.fn(), sessao: vi.fn(), enviar: vi.fn(), existente: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: m.cliente }))
vi.mock('@/lib/supabase/workspace', () => ({ getCurrentUserAndWorkspace: m.sessao }))
vi.mock('@/lib/conversas/actions', () => ({ enviarMensagem: m.enviar }))
vi.mock('@/lib/leads/contato-existente', () => ({ contatoJaCadastrado: m.existente }))
import { abrirConversaDoEvento, enviarMensagemDoEvento } from './actions'

const empresa = '11111111-1111-4111-8111-111111111111'
const leadId = '22222222-2222-4222-8222-222222222222'
const conversaId = '33333333-3333-4333-8333-333333333333'
let telefone: string | null
let arquivada: boolean
let falhaReabrir: boolean
let encontrado: boolean
let vinculado: boolean
let completo: boolean
const escritas: string[] = []
const filtros: { tabela: string; campo: string; valor: unknown }[] = []
beforeEach(() => {
  vi.clearAllMocks()
  telefone = '(71) 99999-1234'; arquivada = false; falhaReabrir = false
  encontrado = true; vinculado = true; completo = true
  escritas.length = 0; filtros.length = 0
  m.sessao.mockResolvedValue({ workspaceId: empresa, user: { id: 'usuario' } })
  m.enviar.mockResolvedValue({ success: true })
  m.existente.mockResolvedValue({ id: leadId, name: 'Contato existente' })
  m.cliente.mockResolvedValue({ rpc: async () => ({ data: true, error: null }), from: (tabela: string) => {
    let operacao = 'select'
    const resultado = () => {
      if (tabela === 'enterprise_eventos') return { data: encontrado ? {
        id: 'evento', lead_id: vinculado ? leadId : null, contato_email: completo ? 'comercial@evento.com.br' : null,
        contato_telefone: '5571999991234', mensagem_aprovada: 'Mensagem revisada', aprovada_em: '2026-10-22T12:00:00Z',
      } : null, error: null }
      if (tabela === 'leads') return { data: { phone: telefone }, error: null }
      if (operacao === 'update' && falhaReabrir) return { data: null, error: { message: 'falha' } }
      return { data: { id: conversaId, arquivada_em: arquivada ? '2026-10-22T12:00:00Z' : null }, error: null }
    }
    const q = {
      select: () => q,
      eq: (campo: string, valor: unknown) => { filtros.push({ tabela, campo, valor }); return q },
      upsert: () => { operacao = 'upsert'; escritas.push(tabela + ':upsert'); return q },
      update: () => { operacao = 'update'; escritas.push(tabela + ':update'); return q },
      single: async () => resultado(), maybeSingle: async () => resultado(),
      then: (resolver: (r: ReturnType<typeof resultado>) => unknown) => Promise.resolve(resultado()).then(resolver),
    }
    return q
  } })
})
describe('Radar abre e envia para o contato conferido', () => {
  it.each([
    { workspaceId: empresa, telefone: '5571988887777' },
    { workspaceId: 'outra-empresa', telefone: '5571999991234' },
  ])('recusa o destino alterado desde a renderização do cartão: %j', async destino => {
    const r = await enviarMensagemDoEvento('evento', destino)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toContain('destinatário mudou')
    expect(m.enviar).not.toHaveBeenCalled()
    expect(escritas).toEqual([])
    expect((await abrirConversaDoEvento('evento', destino)).ok).toBe(false)
  })
  it('aceita o destino exibido no cartão sem trocar de contato', async () => {
    expect(await abrirConversaDoEvento('evento', { workspaceId: empresa, telefone: '(71) 99999-1234' })).toEqual({ ok: true, conversaId })
  })
  it('abre exatamente a conversa do contato, sem enviar mensagem', async () => {
    expect(await abrirConversaDoEvento('evento')).toEqual({ ok: true, conversaId })
    expect(m.enviar).not.toHaveBeenCalled()
    expect(filtros).toContainEqual({ tabela: 'conversas', campo: 'lead_id', valor: leadId })
    expect(filtros).toContainEqual({ tabela: 'conversas', campo: 'workspace_id', valor: empresa })
  })
  it('leva ao envio a empresa, o contato e o telefone confirmados', async () => {
    expect(await enviarMensagemDoEvento('evento')).toEqual({ ok: true, conversaId })
    expect(m.enviar).toHaveBeenCalledWith(conversaId, 'Mensagem revisada', {
      workspaceId: empresa, leadId, telefone: '5571999991234',
    })
  })
  it.each([true, false])('bloqueia número divergente com ou sem vínculo prévio: %s', async (jaVinculado) => {
    vinculado = jaVinculado; telefone = '71988887777'
    const r = await enviarMensagemDoEvento('evento')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toContain('diferente')
    expect(m.enviar).not.toHaveBeenCalled()
    expect(escritas).toEqual([])
  })
  it('não retorna sucesso se não puder desarquivar', async () => {
    arquivada = true; falhaReabrir = true
    const r = await enviarMensagemDoEvento('evento')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toContain('reabrir')
    expect(m.enviar).not.toHaveBeenCalled()
  })
  it('ignora evento que não foi encontrado no workspace atual', async () => {
    encontrado = false
    expect((await abrirConversaDoEvento('evento-alheio')).ok).toBe(false)
    expect(filtros).toContainEqual({ tabela: 'enterprise_eventos', campo: 'workspace_id', valor: empresa })
    expect(escritas).toEqual([])
  })
  it('não cria contato/conversa de evento incompleto', async () => {
    completo = false
    expect((await abrirConversaDoEvento('evento')).ok).toBe(false)
    expect(escritas).toEqual([])
    expect(m.existente).not.toHaveBeenCalled()
  })
})
