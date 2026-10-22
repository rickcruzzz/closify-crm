import { Children, isValidElement, type ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ enviar: vi.fn(), texto: '' }))
vi.mock('server-only', () => ({}))
vi.mock('react', async importar => ({
  ...await importar<typeof import('react')>(),
  useEffect: vi.fn(), useMemo: (f: () => unknown) => f(), useRef: () => ({ current: null }),
  useState: (inicial: unknown) => [inicial === '' ? m.texto : inicial, vi.fn()],
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.mock('@/lib/conversas/actions', () => ({ enviarMensagem: m.enviar, arquivarConversa: vi.fn(), marcarComoRespondida: vi.fn() }))
import { ConversasClient } from '@/components/conversas/conversas-client'
import type { ConversaNaLista } from './queries'

type Elemento = ReactElement<Record<string, unknown>>
function elementos(raiz: unknown): Elemento[] {
  if (!isValidElement<Record<string, unknown>>(raiz)) return []
  return [raiz, ...Children.toArray(raiz.props.children as import('react').ReactNode).flatMap(elementos)]
}
const conversa: ConversaNaLista = {
  id: '33333333-3333-4333-8333-333333333333', leadId: '22222222-2222-4222-8222-222222222222',
  nome: 'Contato de teste', telefone: '5571999991234', fotoUrl: null, donoId: null, assumidaEm: null,
  previa: '', valorDoNegocio: null, etapaDoNegocio: null, proximaAcao: null,
  ultimoRecebidoEm: null, ultimoEnviadoEm: null, respondidaEm: null,
}
const empresa = '11111111-1111-4111-8111-111111111111'
function formulario(c = conversa, workspaceId = empresa) {
  const arvore = ConversasClient({ conversas: [c], conversaAberta: c.id, mensagens: [],
    usuarioId: 'teste', nomesPorUsuario: {}, workspaceId })
  return elementos(arvore).find(e => e.props.conversa === c)!
}
beforeEach(() => { vi.clearAllMocks(); m.texto = ''; m.enviar.mockResolvedValue({ success: true }) })
describe('destinatário do formulário de conversa', () => {
  it('reinicia o rascunho ao mudar conversa, empresa, contato ou telefone', () => {
    const inicial = formulario().key
    expect(formulario({ ...conversa, id: 'outra-conversa' }).key).not.toBe(inicial)
    expect(formulario({ ...conversa, leadId: 'outro-contato' }).key).not.toBe(inicial)
    expect(formulario({ ...conversa, telefone: '5571988887777' }).key).not.toBe(inicial)
    expect(formulario(conversa, 'outra-empresa').key).not.toBe(inicial)
    expect(formulario().key).toBe(inicial)
  })
  it('o Enter envia o contato e o telefone da conversa exibida, não só o ID', async () => {
    m.texto = 'Texto do contato de teste'
    const f = formulario()
    const renderizar = f.type as (props: Record<string, unknown>) => unknown
    const campo = elementos(renderizar(f.props)).find(e => typeof e.props.onKeyDown === 'function')!
    const teclado = campo.props.onKeyDown as (e: unknown) => void
    teclado({ key: 'Enter', shiftKey: false, preventDefault: vi.fn() })
    expect(m.enviar).toHaveBeenCalledWith(conversa.id, m.texto, {
      workspaceId: empresa, leadId: conversa.leadId, telefone: conversa.telefone,
    })
    await Promise.resolve()
  })
})
