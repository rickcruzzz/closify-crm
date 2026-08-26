import { describe, expect, it } from 'vitest'

import { resolverEscopo } from './escopo'

describe('resolverEscopo', () => {
  it('sem URL e sem cookie, começa em "minhas"', () => {
    expect(resolverEscopo(null, null)).toBe('minhas')
    expect(resolverEscopo(undefined, undefined)).toBe('minhas')
  })

  /**
   * O defeito que motivou o arquivo, medido em produção em 26/08/2026.
   *
   * A pessoa escolhia "Da equipe", ia para outra tela e voltava pelo menu
   * lateral — que aponta para `/hoje` sem parâmetro nenhum — e encontrava
   * "Minhas" de volta, sem ter clicado em nada.
   */
  it('sem parâmetro na URL, respeita a última escolha', () => {
    expect(resolverEscopo(null, 'equipe')).toBe('equipe')
  })

  // A URL vence: link compartilhado e botão "voltar" precisam mostrar
  // exatamente o que dizem, mesmo contrariando a preferência guardada.
  it('a URL vence o cookie, nos dois sentidos', () => {
    expect(resolverEscopo('minhas', 'equipe')).toBe('minhas')
    expect(resolverEscopo('equipe', 'minhas')).toBe('equipe')
  })

  // Os dois são digitáveis por quem quiser: o da URL na barra de endereço, o
  // do cookie no console do navegador.
  it('valor desconhecido na URL não vira escopo', () => {
    expect(resolverEscopo('todos', null)).toBe('minhas')
    expect(resolverEscopo('EQUIPE', null)).toBe('minhas')
    expect(resolverEscopo('', null)).toBe('minhas')
  })

  it('valor desconhecido no cookie não vira escopo', () => {
    expect(resolverEscopo(null, 'todos')).toBe('minhas')
    expect(resolverEscopo(null, 'Equipe')).toBe('minhas')
  })

  /**
   * "minhas" continua sendo o piso de quem nunca escolheu.
   *
   * A tela responde "o que EU faço agora": quem abre pela primeira vez e vê
   * quarenta tarefas de outras pessoas não tem o que fazer com elas. O cookie
   * só desloca esse piso DEPOIS de uma escolha explícita.
   */
  it('cookie de "minhas" não muda nada, e é o esperado', () => {
    expect(resolverEscopo(null, 'minhas')).toBe('minhas')
  })
})
