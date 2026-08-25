import { describe, expect, it } from 'vitest'

import { extrairTokenDaListagem } from './listagem'

/**
 * O defeito que estes testes travam, medido em produção em 25/08.
 *
 * Uma instância existia no servidor Evolution sem linha nenhuma em
 * `integration_connections`. Sem linha não há token; sem token o código tenta
 * criar; e o servidor recusa com `500 {"error":"instance already exists"}`.
 * A empresa ficava presa PARA SEMPRE, porque tentar de novo executava o mesmo
 * passo.
 *
 * A saída é readotar a instância, e readotar depende desta função achar o
 * token na listagem. Se ela passar a devolver `null` por mudança de formato,
 * o sintoma não é erro — é o beco sem saída voltando calado.
 */

const INSTANCIA = 'a39f3166-424d-4804-add5-69ea5640e095'

describe('extrairTokenDaListagem', () => {
  it('acha o token no array cru', () => {
    // Formato real medido contra o servidor em 25/08.
    const resposta = [
      { id: 'outra', token: 'token-da-outra' },
      { id: INSTANCIA, token: 'a428fe8e70b2e5ee', connected: false },
    ]
    expect(extrairTokenDaListagem(resposta, INSTANCIA)).toBe('a428fe8e70b2e5ee')
  })

  it('acha o token quando a resposta vem embrulhada em `data`', () => {
    // O Evolution GO já devolveu as duas formas conforme a versão. Supor uma
    // só faz a readoção parar de funcionar numa atualização do servidor,
    // justamente quando ela é mais necessária.
    const resposta = { data: [{ id: INSTANCIA, token: 'abc123' }] }
    expect(extrairTokenDaListagem(resposta, INSTANCIA)).toBe('abc123')
  })

  it('aceita as duas grafias de campo', () => {
    // A API mistura maiúscula e minúscula entre rotas: `/instance/status` usa
    // `Connected`/`LoggedIn`, `/instance/all` usa minúscula. Apostar numa só
    // é apostar em qual rota mudou por último.
    const resposta = [{ Id: INSTANCIA, Token: 'maiusculo' }]
    expect(extrairTokenDaListagem(resposta, INSTANCIA)).toBe('maiusculo')
  })

  it('devolve null quando a instância não está na lista', () => {
    expect(extrairTokenDaListagem([{ id: 'outra', token: 'x' }], INSTANCIA)).toBeNull()
  })

  it('devolve null quando a instância existe mas sem token', () => {
    // Este caso tem consequência: sem token não dá para operar a instância, e
    // quem chama precisa saber a diferença entre "não achei" e "achei vazio"
    // para decidir apagar e recriar.
    expect(extrairTokenDaListagem([{ id: INSTANCIA, token: '' }], INSTANCIA)).toBeNull()
    expect(extrairTokenDaListagem([{ id: INSTANCIA }], INSTANCIA)).toBeNull()
  })

  it('não estoura com resposta inesperada', () => {
    // Servidor fora do ar, proxy devolvendo HTML, JSON de erro: nenhum desses
    // pode derrubar o fluxo de conexão com exceção não tratada.
    for (const lixo of [null, undefined, '', 0, 'texto', { erro: 'x' }, { data: 'x' }]) {
      expect(extrairTokenDaListagem(lixo, INSTANCIA)).toBeNull()
    }
  })

  it('a primeira instância com o id vence, e ids parecidos não casam', () => {
    // Comparação exata: um prefixo em comum não pode devolver o token de
    // outra empresa. Seria entregar a sessão de WhatsApp de um cliente a
    // outro.
    const resposta = [
      { id: `${INSTANCIA}-copia`, token: 'da-outra-empresa' },
      { id: INSTANCIA, token: 'o-certo' },
    ]
    expect(extrairTokenDaListagem(resposta, INSTANCIA)).toBe('o-certo')
  })
})
