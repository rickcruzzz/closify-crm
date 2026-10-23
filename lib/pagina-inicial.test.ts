import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PAGINA_INICIAL } from './pagina-inicial'

describe('o CRM abre no Kanban', () => {
  it('mantém o destino padrão no Funil', () => {
    expect(PAGINA_INICIAL).toBe('/kanban')
  })
  it.each([
    'lib/supabase/actions.ts',
    'lib/supabase/middleware.ts',
    'app/auth/callback/route.ts',
    'components/auth/bem-vindo-client.tsx',
    'components/onboarding/assistente.tsx',
    'lib/onboarding/actions.ts',
    'app/(auth)/(transicao)/onboarding/page.tsx',
    'app/(auth)/(transicao)/bem-vindo/page.tsx',
    'app/(auth)/(transicao)/confirmar/page.tsx',
    'app/(auth)/(transicao)/redefinir-senha/page.tsx',
    'app/convite/[token]/page.tsx',
  ])('usa a entrada comum sem desviar para Resultados: %s', (arquivo) => {
    const fonte = readFileSync(join(process.cwd(), arquivo), 'utf8')
    expect(fonte).toContain('PAGINA_INICIAL')
    expect(fonte).not.toMatch(/(?:redirect|router\.(?:push|replace))\('\/dashboard'\)/)
  })
  it('preserva a recuperação de senha e a tela de boas-vindas no callback', () => {
    const fonte = readFileSync(join(process.cwd(), 'app/auth/callback/route.ts'), 'utf8')
    expect(fonte).toContain("next === '/redefinir-senha' ? next : PAGINA_INICIAL")
    expect(fonte).toContain('`${origin}/bem-vindo`')
  })
  it('os indicadores ficam antes do quadro e o guia vazio fica depois', () => {
    const fonte = readFileSync(
      join(process.cwd(), 'app/(dashboard)/kanban/page.tsx'),
      'utf8',
    )
    expect(fonte.indexOf('<MetricCardsAsync')).toBeLessThan(fonte.indexOf('<KanbanBoard'))
    expect(fonte.indexOf('<GettingStartedCard')).toBeGreaterThan(
      fonte.indexOf('<KanbanBoard'),
    )
    expect(fonte).toContain('workspaceId={workspaceId} compacto')
  })
  it('o arrasto mantém a identificação acessível igual no servidor e no navegador', () => {
    const fonte = readFileSync(
      join(process.cwd(), 'components/kanban/kanban-board.tsx'),
      'utf8',
    )
    expect(fonte).toMatch(/<DndContext\s+id="funil-de-negocios"/)
  })
})
