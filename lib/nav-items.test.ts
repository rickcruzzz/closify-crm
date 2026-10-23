import { describe, expect, it } from 'vitest'
import { navGroups, gruposDeNavegacao, itemDeNavegacaoAtivo } from './nav-items'

describe('navegação comercial organizada por objetivo', () => {
  it('abre pelo Funil e separa comercial, rotina, gestão e configurações', () => {
    expect(navGroups.map((g) => [g.title, g.items.map((i) => i.title)])).toEqual([
      ['Comercial', ['Funil', 'Prospecção', 'Contatos']],
      ['Rotina', ['Hoje', 'WhatsApp', 'Calendário']],
      ['Gestão', ['Resultados', 'Equipe']],
      ['Configurações', ['Empresa', 'Integrações', 'Perfil']],
    ])
    expect(navGroups[0]?.items[0]?.href).toBe('/kanban')
  })
  it('mostra a Prospecção somente na empresa Enterprise ativa', () => {
    expect(
      gruposDeNavegacao(true)[0]?.items.find((i) => i.title === 'Prospecção')?.href,
    ).toBe('/enterprise/eventos')
    expect(
      gruposDeNavegacao(false)
        .flatMap((g) => g.items)
        .some((i) => i.title === 'Prospecção'),
    ).toBe(false)
    expect(gruposDeNavegacao(true)[0]?.items).toHaveLength(3)
  })
  it('mantém um único WhatsApp e preserva as rotas existentes', () => {
    const itens = navGroups.flatMap((g) => g.items)
    expect(itens.filter((i) => i.href === '/conversas')).toHaveLength(1)
    expect(itens.find((i) => i.title === 'Resultados')?.href).toBe('/dashboard')
    expect(itens.some((i) => i.href === '/settings/whatsapp')).toBe(false)
  })
  it('não duplica rotas nem ícones', () => {
    const itens = navGroups.flatMap((g) => g.items)
    expect(new Set(itens.map((i) => i.href)).size).toBe(itens.length)
    expect(new Set(itens.map((i) => i.icon)).size).toBe(itens.length)
  })
  it.each([
    ['/kanban', null, 'Funil'],
    ['/enterprise/eventos', null, 'Prospecção'],
    ['/leads/contato', null, 'Contatos'],
    ['/conversas', null, 'WhatsApp'],
    ['/dashboard', null, 'Resultados'],
    ['/settings', null, 'Empresa'],
    ['/settings', 'equipe', 'Equipe'],
    ['/settings', 'integracoes', 'Integrações'],
    ['/settings', 'plano', 'Empresa'],
    ['/perfil', null, 'Perfil'],
  ])('marca exatamente uma entrada para %s?aba=%s', (rota, aba, titulo) => {
    expect(
      navGroups
        .flatMap((g) => g.items)
        .filter((i) => itemDeNavegacaoAtivo(i, rota, aba))
        .map((i) => i.title),
    ).toEqual([titulo])
  })
  it('não confunde prefixos de rota', () => {
    expect(
      navGroups
        .flatMap((g) => g.items)
        .filter((i) => itemDeNavegacaoAtivo(i, '/kanban-outro', null)),
    ).toEqual([])
  })
  it('não usa rótulos vazios, travessões ou abas em outras rotas', () => {
    for (const grupo of navGroups) {
      expect(grupo.title).toBeTruthy()
      for (const item of grupo.items) {
        expect(item.title).not.toMatch(/[–—]/)
        if (item.aba) expect(item.href.startsWith('/settings')).toBe(true)
      }
    }
  })
})
