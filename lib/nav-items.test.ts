import { describe, expect, it } from 'vitest'

import { navGroups } from './nav-items'

/**
 * A barra lateral, travada.
 *
 * O dono aprovou esta estrutura exata em 16/09, olhando a tela. Menu é a
 * superfície mais fácil de mexer sem querer — um `push` no fim da lista, um
 * item copiado para o grupo errado — e reordenar navegação de quem usa o
 * produto todos os dias é caro: a pessoa clica por memória muscular, não por
 * leitura, e um item que trocou de lugar vira "sumiu".
 *
 * O teste não impede mudar a ordem. Ele impede mudar sem perceber: quem mover
 * um item de propósito atualiza esta lista no mesmo commit, e o diff mostra a
 * decisão.
 */
describe('navGroups', () => {
  it('mantem os tres blocos, na ordem aprovada em 16/09', () => {
    const estrutura = navGroups.map((g) => [g.title, g.items.map((i) => i.title)])

    expect(estrutura).toEqual([
      [
        'Principal',
        ['Hoje', 'Conversas', 'Funil', 'Contatos', 'Resultados', 'Calendário'],
      ],
      [
        'Configurações',
        ['Perfil', 'Equipe', 'Integrações', 'WhatsApp', 'Preferências'],
      ],
    ])
  })

  it('WhatsApp tem ROTA própria, e não uma aba de /settings', () => {
    // As outras três entradas de Configurações apontam para `/settings` com
    // query. Esta não: o WhatsApp é o plano Max, com conexão por empresa,
    // estado que cai sozinho e um QR que precisa de tela inteira. Uma aba
    // escondida dentro de Preferências seria o oposto do que se paga por ele.
    const item = navGroups[1]?.items.find((i) => i.title === 'WhatsApp')
    expect(item?.href).toBe('/settings/whatsapp')
    expect(item?.aba).toBeUndefined()
  })

  it('o primeiro grupo TEM rotulo', () => {
    // Antes de 16/09 era `null`. Fica como caso próprio porque o efeito de
    // voltar a `null` é silencioso: nada quebra, a barra só volta a ler como
    // seis itens soltos acima de uma seção nomeada.
    expect(navGroups[0]?.title).toBe('Principal')
  })

  it('nenhuma rota se repete, contando a aba', () => {
    // "Equipe", "Integrações" e "Preferências" apontam as três para
    // `/settings`, e o que as separa é a query. Comparar só o pathname daria
    // falso positivo aqui e deixaria passar uma duplicata de verdade.
    const rotas = navGroups.flatMap((g) => g.items.map((i) => i.href))
    expect(new Set(rotas).size).toBe(rotas.length)
  })

  it('nenhum icone se repete', () => {
    // A regra está escrita no próprio `nav-items.ts`: `Users` servia "Contatos"
    // e "Equipe" ao mesmo tempo, e ícone repetido em menu curto anula a função
    // do ícone, que é ser um segundo caminho de reconhecimento além do texto.
    const icones = navGroups.flatMap((g) => g.items.map((i) => i.icon))
    expect(new Set(icones).size).toBe(icones.length)
  })

  it('so os itens de /settings declaram aba', () => {
    // `aba` num item que não é de `/settings` não faria nada — e não fazer
    // nada em silêncio é como o cálculo de item ativo já quebrou antes.
    for (const item of navGroups.flatMap((g) => g.items)) {
      if (item.aba !== undefined) expect(item.href.startsWith('/settings')).toBe(true)
    }
  })

  it('nenhum rotulo tem travessao', () => {
    // Banido em todo texto de tela em 15/09.
    const textos = navGroups.flatMap((g) => [
      g.title ?? '',
      ...g.items.map((i) => i.title),
    ])
    for (const t of textos) expect(t).not.toMatch(/[–—]/)
  })
})
