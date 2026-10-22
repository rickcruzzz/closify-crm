import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const mocks = vi.hoisted(() => ({ cliente: vi.fn(), workspace: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.cliente }))
vi.mock('@/lib/supabase/workspace', () => ({ getCurrentUserAndWorkspace: mocks.workspace }))
import { getMensagensDaConversa } from './queries'

const pedidos: { tabela: string; campo: string; valor: unknown }[] = []
let autorizada: boolean
let falha: boolean
let audio: boolean

beforeEach(() => {
  vi.clearAllMocks()
  pedidos.length = 0
  autorizada = true
  falha = false
  audio = false
  mocks.workspace.mockResolvedValue({ workspaceId: 'empresa-a' })
  mocks.cliente.mockResolvedValue({ from: (tabela: string) => {
    const linhas = Array.from({ length: 150 }, (_, i) => ({
      id: `mensagem-${String(i + 1).padStart(3, '0')}`, direcao: i === 149 ? 'enviada' : 'recebida',
      tipo: audio ? 'audio' : 'texto', texto: `Mensagem ${i + 1}`, midia_chave: audio ? 'https://f004.backblazeb2.com/privado.ogg' : null,
      midia_mime: audio ? 'audio/ogg' : null, midia_segundos: audio ? 10 : null, status: 'enviada', erro: null,
      created_at: new Date(Date.UTC(2026, 9, 22, 0, i)).toISOString(), enviada_por: null,
    }))
    let limite = 1000
    const q = {
      select: () => q,
      eq: (campo: string, valor: unknown) => { pedidos.push({ tabela, campo, valor }); return q },
      order: (campo: string, opcoes: { ascending: boolean }) => {
        pedidos.push({ tabela, campo: `order:${campo}`, valor: opcoes.ascending })
        if (campo === 'created_at') linhas.sort((a, b) => opcoes.ascending ? a.created_at.localeCompare(b.created_at) : b.created_at.localeCompare(a.created_at))
        return q
      },
      limit: (n: number) => { limite = n; return q },
      maybeSingle: async () => ({ data: autorizada ? { id: 'conversa-a', lead_id: 'contato-a' } : null, error: null }),
      then: (resolver: (r: { data: typeof linhas; error: { message: string } | null }) => unknown) =>
        Promise.resolve({ data: linhas.slice(0, limite), error: falha ? { message: 'falha' } : null }).then(resolver),
    }
    return q
  } })
})

describe('histórico recente das conversas', () => {
  it('inclui o último envio mesmo após cem mensagens, em ordem cronológica', async () => {
    const r = await getMensagensDaConversa('conversa-a')
    expect(r!.mensagens).toHaveLength(100)
    expect(r!.mensagens[0]!.id).toBe('mensagem-051')
    expect(r!.mensagens[99]!).toMatchObject({ id: 'mensagem-150', direcao: 'enviada' })
    expect(pedidos).toContainEqual({ tabela: 'mensagens', campo: 'workspace_id', valor: 'empresa-a' })
    expect(pedidos).toContainEqual({ tabela: 'mensagens', campo: 'conversa_id', valor: 'conversa-a' })
  })
  it('não consulta mensagens de uma conversa fora da empresa ativa', async () => {
    autorizada = false
    expect(await getMensagensDaConversa('conversa-alheia')).toBeNull()
    expect(pedidos.filter(p => p.tabela === 'mensagens')).toHaveLength(0)
  })
  it('mantém URLs privadas de áudio somente no servidor', async () => {
    audio = true
    const r = await getMensagensDaConversa('conversa-a')
    expect(r!.mensagens[0]!.midiaChave).toBeNull()
    expect(JSON.stringify(r)).not.toContain('backblazeb2.com')
  })
  it('não confunde erro de leitura com conversa vazia', async () => {
    falha = true
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await getMensagensDaConversa('conversa-a')).toBeNull()
    log.mockRestore()
  })
})
