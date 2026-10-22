import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpc, workspace } = vi.hoisted(() => ({ rpc: vi.fn(), workspace: vi.fn() }))
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: <T>(fn: T) => fn,
}))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ rpc }) }))
vi.mock('@/lib/supabase/workspace', () => ({ getCurrentUserAndWorkspace: workspace }))

import { situacaoDoPlanoDaEmpresaAtiva } from '@/lib/plans/trial-queries'

describe('situação Enterprise da empresa ativa', () => {
  beforeEach(() => {
    workspace.mockResolvedValue({ workspaceId: 'empresa' })
    rpc.mockReset()
  })

  it('reconhece Enterprise independentemente do trial e dos nomes Pro/Max', async () => {
    rpc.mockImplementation(async (name: string) => ({
      data: ['enterprise_vigente', 'em_trial'].includes(name),
    }))
    expect(await situacaoDoPlanoDaEmpresaAtiva()).toEqual({
      temEnterprise: true,
      emTrial: false,
      temAssinaturaPaga: true,
      temMax: true,
      proVigente: true,
    })
    expect(rpc).toHaveBeenCalledWith('enterprise_vigente', {
      target_workspace_id: 'empresa',
    })
  })

  it('não transfere Enterprise para outra empresa sem concessão', async () => {
    rpc.mockResolvedValue({ data: false })
    expect(await situacaoDoPlanoDaEmpresaAtiva()).toEqual({
      temEnterprise: false,
      emTrial: false,
      temAssinaturaPaga: false,
      temMax: false,
      proVigente: false,
    })
  })

  it('mantém o trial e o acesso Pro de empresas que não são Enterprise', async () => {
    rpc.mockImplementation(async (name: string) => ({
      data: ['pro_vigente', 'em_trial'].includes(name),
    }))
    expect(await situacaoDoPlanoDaEmpresaAtiva()).toEqual({
      temEnterprise: false,
      emTrial: true,
      temAssinaturaPaga: false,
      temMax: false,
      proVigente: true,
    })
  })
})
