import { describe, expect, it } from 'vitest'

import {
  DESTINO_DO_UPGRADE,
  FREE_COLABORADORES,
  FREE_MEMBER_LIMIT,
  PAPEIS_DO_COLABORADOR,
  ehLimiteDePlano,
} from './plans'

describe('limite de plano: o off-by-one e o caminho', () => {
  /**
   * ## O defeito, achado em 15/09
   *
   * `plan-card.tsx` e `plan-comparison-table.tsx` diziam "até 2
   * colaboradores". `FREE_MEMBER_LIMIT` conta PESSOAS na empresa, e
   * `verificarLimiteDeMembros` soma `workspace_members` — que inclui o dono.
   *
   * Duas telas prometiam TRÊS pessoas onde cabem duas, e quem convidasse a
   * terceira tomava o erro depois de o convite já ter sido mandado.
   */
  it('colaboradores é membros MENOS o dono', () => {
    expect(FREE_COLABORADORES).toBe(FREE_MEMBER_LIMIT - 1)
    expect(FREE_COLABORADORES).toBe(1)
  })

  it('os dois papéis existem e dizem o que podem', () => {
    expect(PAPEIS_DO_COLABORADOR).toHaveLength(2)
    expect(PAPEIS_DO_COLABORADOR.map((p) => p.papel)).toEqual(['Administrador', 'Membro'])
    for (const p of PAPEIS_DO_COLABORADOR) expect(p.pode.length).toBeGreaterThan(10)
  })

  /**
   * Sete lugares do produto mandam fazer upgrade, e as sete frases chegam à
   * tela como texto num toast. `ehLimiteDePlano` é o que transforma isso num
   * botão — e ela reconhece as SETE, escritas como estão hoje no código.
   */
  it.each([
    'Plano Free permite no máximo 50 leads. Faça upgrade para o Pro para continuar.',
    'Plano Free permite no máximo 2 membros. Faça upgrade para o Pro para convidar mais.',
    'O plano Free inclui 1 empresa. Faça upgrade para o Pro para gerenciar várias.',
    'O plano Free acompanha 3 orçamentos ao mesmo tempo. Feche um negócio ou faça upgrade para o Pro para acompanhar quantos quiser.',
    'Integrações são um recurso Pro. Faça upgrade para conectar.',
    'O PDF do orçamento é um recurso Pro. Faça upgrade para enviar orçamentos em PDF.',
    'O WhatsApp faz parte do plano Pro. Faça upgrade para responder por aqui.',
  ])('reconhece: "%s"', (mensagem) => {
    expect(ehLimiteDePlano(mensagem)).toBe(true)
  })

  /**
   * Errar para o lado de oferecer o upgrade mostra um botão a mais; errar para
   * o outro deixa a pessoa no beco. Mesmo assim, erro comum não pode virar
   * oferta — senão o botão perde o sentido por aparecer sempre.
   */
  it.each([
    'Não foi possível salvar. Tente de novo.',
    'Esse e-mail já está cadastrado nesta empresa.',
    'A planilha não tem nenhuma linha além do cabeçalho.',
    '',
  ])('NÃO oferece upgrade em: "%s"', (mensagem) => {
    expect(ehLimiteDePlano(mensagem)).toBe(false)
  })

  it('acento não muda a decisão', () => {
    expect(ehLimiteDePlano('Faca upgrade para o Pro')).toBe(true)
    expect(ehLimiteDePlano('Faça upgrade para o Pro')).toBe(true)
  })

  /** Sem `?assinar=1` a pessoa cai na tela e procura o botão de novo. */
  it('o destino abre o formulário sozinho', () => {
    expect(DESTINO_DO_UPGRADE).toContain('assinar=1')
  })
})
