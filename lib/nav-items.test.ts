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
        ['Hoje', 'WhatsApp', 'Funil', 'Contatos', 'Resultados', 'Calendário'],
      ],
      ['Configurações', ['Perfil', 'Equipe', 'Integrações', 'Preferências']],
    ])
  })

  it('o WhatsApp tem UMA entrada, nao duas', () => {
    // Eram dois itens ate 17/09: "Conversas" para a caixa de entrada e
    // "WhatsApp" para a conexao. Sao a caixa e o cano da mesma coisa, e a
    // divisao cobrava da pessoa uma distincao que so faz sentido para quem
    // construiu: quem nao ve mensagem chegando abre Conversas, encontra uma
    // lista vazia que nao explica nada, e a resposta esta no item de baixo.
    //
    // Este caso trava o numero de entradas, e nao so os rotulos: reintroduzir
    // "Conversas" e a regressao obvia, porque a rota continua existindo.
    const titulos = navGroups.flatMap((g) => g.items.map((i) => i.title))
    expect(titulos.filter((t) => t === 'WhatsApp')).toHaveLength(1)
    expect(titulos).not.toContain('Conversas')

    const rotas = navGroups.flatMap((g) => g.items.map((i) => i.href))
    expect(rotas.filter((h) => h === '/conversas')).toHaveLength(1)
    expect(rotas).not.toContain('/settings/whatsapp')
  })

  it('a ROTA continua em /conversas, e nao em /settings', () => {
    // O item passou a apontar para a caixa, que e a tela que decide o que
    // mostrar. `/settings/whatsapp` virou redirecionamento e nao volta ao
    // menu: dois caminhos para a mesma tela e o que acabou de ser desfeito.
    //
    // E `aba` fica indefinido porque ele NAO e uma aba de Preferencias.
    const item = navGroups[0]?.items.find((i) => i.title === 'WhatsApp')
    expect(item?.href).toBe('/conversas')
    expect(item?.aba).toBeUndefined()
  })

  it('o WhatsApp vem logo depois de Hoje, e antes do Funil', () => {
    // A ordem e a da manha: "o que eu faco agora" (Hoje), depois "quem esta
    // esperando resposta" (WhatsApp). Conversa sem resposta vira venda perdida
    // em minutos; negocio parado no funil espera dias sem piorar.
    const principal = navGroups[0]?.items.map((i) => i.title) ?? []
    expect(principal.indexOf('WhatsApp')).toBe(principal.indexOf('Hoje') + 1)
    expect(principal.indexOf('WhatsApp')).toBeLessThan(principal.indexOf('Funil'))
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
