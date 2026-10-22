import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const mocks = vi.hoisted(() => ({ cliente: vi.fn(), workspace: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.cliente }))
vi.mock('@/lib/workspace/ativo', () => ({ resolverWorkspaceAtivo: mocks.workspace }))
import { GET } from '@/app/api/conversas/mensagens/[id]/audio/route'

const id = '11111111-1111-4111-8111-111111111111'
const ogg = new TextEncoder().encode('OggS000000000000')
let usuario: { id: string } | null
let empresaDaMensagem: string
let tipo: string
let falhaBanco: boolean
let buscar: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.resetAllMocks()
  usuario = { id: 'usuario-a' }
  empresaDaMensagem = 'empresa-a'
  tipo = 'audio'
  falhaBanco = false
  mocks.workspace.mockResolvedValue('empresa-a')
  mocks.cliente.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: usuario } }) }, from: () => {
    const filtros = new Map<string, unknown>()
    const q = {
      select: () => q,
      eq: (campo: string, valor: unknown) => { filtros.set(campo, valor); return q },
      maybeSingle: async () => ({ error: falhaBanco ? { message: 'falha' } : null,
        data: filtros.get('workspace_id') === empresaDaMensagem && filtros.get('tipo') === tipo && filtros.get('id') === id
          ? { midia_chave: 'https://f004.backblazeb2.com/file/exemplo/audio.ogg', midia_mime: 'audio/ogg' } : null }),
    }
    return q
  } })
  buscar = vi.fn().mockImplementation(async () => new Response(ogg, { headers: { 'content-type': 'audio/ogg', 'content-length': String(ogg.length) } }))
  vi.stubGlobal('fetch', buscar)
})

describe('autorização do áudio por mensagem', () => {
  const abrir = (mensagemId = id) => GET(new Request(`https://crm.example/api/conversas/mensagens/${mensagemId}/audio`), { params: { id: mensagemId } })
  it('sem sessão retorna 401 antes de buscar qualquer arquivo', async () => {
    usuario = null
    expect((await abrir()).status).toBe(401)
    expect(buscar).not.toHaveBeenCalled()
  })
  it('não lê áudio de outra empresa', async () => {
    empresaDaMensagem = 'empresa-b'
    expect((await abrir()).status).toBe(404)
    expect(buscar).not.toHaveBeenCalled()
  })
  it('não serve uma mensagem de texto como áudio', async () => {
    tipo = 'texto'
    expect((await abrir()).status).toBe(404)
    expect(buscar).not.toHaveBeenCalled()
  })
  it('recusa identificador inválido antes da rede externa', async () => {
    expect((await abrir('outro')).status).toBe(404)
    expect(buscar).not.toHaveBeenCalled()
  })
  it('falha do banco retorna 503, não mensagem inexistente', async () => {
    falhaBanco = true
    expect((await abrir()).status).toBe(503)
    expect(buscar).not.toHaveBeenCalled()
  })
  it('membro autorizado recebe o áudio e não a URL do fornecedor', async () => {
    const r = await abrir()
    expect(r.status).toBe(200)
    expect(r.headers.get('cache-control')).toBe('private, no-store')
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(ogg)
    expect(r.headers.get('location')).toBeNull()
  })
})
