import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const mocks = vi.hoisted(() => ({ admin: vi.fn(), credenciais: vi.fn(), foto: vi.fn(), baixar: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.admin }))
vi.mock('@/lib/whatsapp/instancia', () => ({ credenciaisDaEmpresa: mocks.credenciais }))
vi.mock('@/lib/whatsapp/zapi', () => ({ fotoDePerfil: mocks.foto }))
vi.mock('@/lib/enterprise/imagem', () => ({ baixarImagemPublica: mocks.baixar }))

import { rodarBuscaDeFotos } from '@/lib/whatsapp/foto-fila'

type Contato = { id: string; workspace_id: string; phone: string; foto_path: string | null;
  foto_verificada_em: string | null; foto_tentada_em: string | null }
const contato = (id: string, workspace = 'empresa-a'): Contato => ({ id, workspace_id: workspace,
  phone: '5571999999999', foto_path: null, foto_verificada_em: null, foto_tentada_em: null })

function banco(contatos: Contato[], opcoes: { uploadFalha?: boolean; caminhoFalha?: boolean; reservaPerdida?: boolean } = {}) {
  const escritas: { values: Record<string, unknown>; filtros: [string, unknown][] }[] = []
  const filtrosDeBusca: string[] = []
  const upload = vi.fn(async () => ({ error: opcoes.uploadFalha ? { message: 'falha' } : null }))
  const from = (tabela: string) => {
    let values: Record<string, unknown> | undefined
    const filtros: [string, unknown][] = []
    const executar = () => {
      if (tabela === 'whatsapp_instances') return { data: Array.from(new Set(contatos.map(c => c.workspace_id))).map(workspace_id => ({ workspace_id })), error: null }
      if (!values) return { data: contatos.map(c => ({ ...c })), error: null }
      escritas.push({ values, filtros })
      if (opcoes.reservaPerdida && 'foto_tentada_em' in values) return { data: null, error: null }
      if (opcoes.caminhoFalha && 'foto_path' in values) return { data: null, error: { message: 'falha' } }
      const c = contatos.find(c => filtros.every(([k, v]) => c[k as keyof Contato] === v))
      if (c) Object.assign(c, values)
      return { data: c ? { id: c.id } : null, error: null }
    }
    const q = {
      select: (_campos: string) => q,
      eq: (k: string, v: unknown) => { filtros.push([k, v]); return q },
      in: (_k: string, _v: unknown[]) => q,
      not: (_k: string, _op: string, _v: unknown) => q,
      or: (filtro: string) => { if (!values) filtrosDeBusca.push(filtro); return q },
      order: (_k: string, _op: unknown) => q,
      limit: (_n: number) => q,
      update: (novos: Record<string, unknown>) => { values = novos; return q },
      maybeSingle: async () => executar(),
      then: (resolver: (r: ReturnType<typeof executar>) => unknown) => Promise.resolve(executar()).then(resolver),
    }
    return q
  }
  mocks.admin.mockReturnValue({ from, storage: { from: () => ({ upload }) } })
  return { escritas, filtrosDeBusca, upload }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.credenciais.mockResolvedValue({ instanceId: 'instancia', token: 'nao-expor' })
  mocks.foto.mockResolvedValue('https://pps.whatsapp.net/foto.jpg')
  mocks.baixar.mockResolvedValue({ bytes: Buffer.from([255, 216, 255]), tipoMime: 'image/jpeg' })
})

describe('sincronização das fotos de contatos', () => {
  it('reserva, guarda bytes privados e só então confirma o caminho na empresa correta', async () => {
    const c = contato('contato-a')
    const db = banco([c])
    const r = await rodarBuscaDeFotos()
    expect(r).toMatchObject({ ok: true, perguntados: 1, guardadas: 1, semFoto: 0 })
    expect(db.upload).toHaveBeenCalledWith('empresa-a/contato-a.jpg', expect.any(Buffer), { contentType: 'image/jpeg', upsert: true })
    expect(c.foto_tentada_em).toBeTruthy()
    expect(c.foto_verificada_em).toBeTruthy()
    expect(c.foto_path).toBe('empresa-a/contato-a.jpg')
    for (const escrita of db.escritas) expect(escrita.filtros).toContainEqual(['workspace_id', 'empresa-a'])
    expect(db.filtrosDeBusca.some(f => f.startsWith('foto_verificada_em.is.null,foto_verificada_em.lte.'))).toBe(true)
    expect(db.filtrosDeBusca.some(f => f.startsWith('foto_tentada_em.is.null,foto_tentada_em.lte.'))).toBe(true)
  })

  it('download recusado continua pendente e não impede a foto do próximo contato', async () => {
    const contatos = [contato('a'), contato('b')]
    banco(contatos)
    mocks.baixar.mockRejectedValueOnce(new Error('HTML, vazio, acima de512KB ou endereço privado'))
    const r = await rodarBuscaDeFotos()
    expect(r).toMatchObject({ ok: false, guardadas: 1, semFoto: 0 })
    expect(contatos[0]!.foto_tentada_em).toBeTruthy()
    expect(contatos[0]!.foto_verificada_em).toBeNull()
    expect(contatos[0]!.foto_path).toBeNull()
    expect(contatos[1]!.foto_path).toBeTruthy()
    expect(mocks.credenciais).toHaveBeenCalledTimes(1)
  })

  it.each([{ uploadFalha: true }, { caminhoFalha: true }])('falha de armazenamento não vira confirmação: %j', async opcoes => {
    const c = contato('a')
    banco([c], opcoes)
    expect((await rodarBuscaDeFotos()).ok).toBe(false)
    expect(c.foto_tentada_em).toBeTruthy()
    expect(c.foto_verificada_em).toBeNull()
    expect(c.foto_path).toBeNull()
  })

  it('ausência real de foto registra a consulta sem tentar baixar', async () => {
    const c = contato('a')
    c.foto_path = 'empresa-a/foto-antiga.jpg'
    banco([c])
    mocks.foto.mockResolvedValue(null)
    expect(await rodarBuscaDeFotos()).toMatchObject({ ok: true, semFoto: 1, guardadas: 0 })
    expect(c.foto_verificada_em).toBeTruthy()
    expect(c.foto_path).toBeNull()
    expect(mocks.baixar).not.toHaveBeenCalled()
  })

  it('credencial recusada não bloqueia outra empresa nem vaza o erro bruto', async () => {
    const contatos = [contato('a'), contato('b', 'empresa-b')]
    banco(contatos)
    mocks.credenciais.mockRejectedValueOnce(new Error('token-secreto')).mockResolvedValueOnce({ instanceId: 'b', token: 'outro-segredo' })
    const r = await rodarBuscaDeFotos()
    expect(r).toMatchObject({ ok: false, guardadas: 1 })
    expect(JSON.stringify(r)).not.toContain('segredo')
    expect(JSON.stringify(r)).not.toContain('token-secreto')
    expect(contatos[0]!.foto_verificada_em).toBeNull()
    expect(contatos[1]!.foto_path).toBe('empresa-b/b.jpg')
  })

  it('outra rodada já reservou o lead: não consulta nem grava foto', async () => {
    banco([contato('a')], { reservaPerdida: true })
    expect(await rodarBuscaDeFotos()).toMatchObject({ ok: true, perguntados: 0, guardadas: 0 })
    expect(mocks.foto).not.toHaveBeenCalled()
  })

  it('tentativa recente não volta ao provedor, mesmo sem foto concluída', async () => {
    const c = contato('a')
    c.foto_tentada_em = new Date().toISOString()
    banco([c])
    expect(await rodarBuscaDeFotos()).toMatchObject({ ok: true, perguntados: 0 })
    expect(mocks.foto).not.toHaveBeenCalled()
  })
})
