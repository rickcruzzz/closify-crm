import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const m = vi.hoisted(() => ({ cliente: vi.fn(), enviar: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: m.cliente }))
vi.mock('@/lib/workspace/ativo', () => ({ resolverWorkspaceAtivo: async () => '11111111-1111-4111-8111-111111111111' }))
vi.mock('@/lib/conversas/remetente', () => ({ escolherRemetente: () => ({ tetoPorHora: () => null, enviarTexto: m.enviar }) }))
vi.mock('@/lib/integrations/whatsapp-estado', () => ({ podeEnviarWhatsapp: () => true }))
vi.mock('@/lib/plans/max', () => ({ direitoAoWhatsapp: () => ({ pode: true }) }))
vi.mock('@/lib/plans/max-queries', () => ({ situacaoDoMax: async () => ({}) }))
vi.mock('@/lib/whatsapp/instancia', () => ({ conexaoDaEmpresa: async () => ({ estado: 'conectado', conectadaEm: null }) }))
import { enviarMensagem } from './actions'
const empresa = '11111111-1111-4111-8111-111111111111'
const leadId = '22222222-2222-4222-8222-222222222222'
const conversaId = '33333333-3333-4333-8333-333333333333'
const outroId = '44444444-4444-4444-8444-444444444444'
beforeEach(() => {
  vi.clearAllMocks()
  m.enviar.mockResolvedValue({ ok: true, externalId: 'somente-mock' })
  m.cliente.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: 'usuario' } } }) },
    from: (tabela: string) => {
      const q = {
        select: () => q, eq: () => q, is: () => q, update: () => q, insert: () => q,
        maybeSingle: async () => ({ data: { lead_id: leadId, leads: { phone: '(71) 99999-1234' } }, error: null }),
        single: async () => ({ data: { id: 'mensagem-mock' }, error: null }),
        then: (resolver: (r: { data: unknown[]; error: null }) => unknown) => Promise.resolve({ data: tabela === 'tasks' ? [] : [], error: null }).then(resolver),
      }
      return q
    },
  })
})
describe('destino permanece o mesmo até o transporte', () => {
  it('manda somente ao número conferido, usando transporte simulado', async () => {
    expect(await enviarMensagem(conversaId, 'Mensagem de teste local', { workspaceId: empresa, leadId, telefone: '5571999991234' })).toEqual({ success: true })
    expect(m.enviar).toHaveBeenCalledWith(empresa, '5571999991234', 'Mensagem de teste local')
  })
  it.each([
    { workspaceId: outroId, leadId, telefone: '5571999991234' },
    { workspaceId: empresa, leadId: outroId, telefone: '5571999991234' },
    { workspaceId: empresa, leadId, telefone: '5571988887777' },
    { workspaceId: empresa, leadId, telefone: 'inválido' },
  ])('bloqueia mudança de empresa, contato ou telefone antes do envio: %j', async (destino) => {
    expect(await enviarMensagem(conversaId, 'Não deve sair', destino)).toEqual({ error: 'O destinatário mudou. Volte ao evento e confira o contato antes de enviar.' })
    expect(m.enviar).not.toHaveBeenCalled()
  })
})
