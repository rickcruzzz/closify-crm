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
        ['Hoje', 'Conversas', 'WhatsApp', 'Funil', 'Contatos', 'Resultados', 'Calendário'],
      ],
      ['Configurações', ['Perfil', 'Equipe', 'Integrações', 'Preferências']],
    ])
  })

  it('WhatsApp fica COLADO em Conversas, e não em Configurações', () => {
    // Ele morava em Configurações até 17/09, cinco itens abaixo, numa seção que
    // a pessoa só visita para mexer em cobrança. Conectar o número acontece uma
    // vez; o que ela procura ali depois é o estado da conexão — e ela procura
    // isso justamente quando abre Conversas e não vê mensagem chegando.
    const principal = navGroups[0]?.items.map((i) => i.title) ?? []
    expect(principal.indexOf('WhatsApp')).toBe(principal.indexOf('Conversas') + 1)

    const config = navGroups[1]?.items.map((i) => i.title) ?? []
    expect(config).not.toContain('WhatsApp')
  })

  it('a ROTA continua em /settings, mesmo com o item fora de lá', () => {
    // Mudou o lugar no menu, não o endereço: renomear a rota quebraria link
    // salvo para trocar uma palavra que ninguém digita. Mesma decisão de
    // "Funil", que lê Funil e continua em `/kanban`.
    //
    // E `aba` fica indefinido porque ele NÃO é uma aba de Preferências: é tela
    // própria, com QR e estado que cai sozinho.
    const item = navGroups[0]?.items.find((i) => i.title === 'WhatsApp')
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
