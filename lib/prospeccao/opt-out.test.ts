import { describe, expect, it } from 'vitest'

import {
  chaveDeDominio,
  chaveDeEmail,
  chaveDeTelefone,
  pediuParaSair,
  ultimos8,
} from '@/lib/prospeccao/opt-out'

describe('últimos 8 dígitos', () => {
  /**
   * O caso que a regra existe para resolver: o WhatsApp entrega o remetente
   * com DDI e o CSV do universo guardou o número com máscara. Os dois precisam
   * cair na mesma chave, senão o pedido de saída morre em silêncio.
   */
  it('casa o número do WhatsApp com o mesmo número do CSV', () => {
    expect(ultimos8('5571999998888')).toBe('99998888')
    expect(ultimos8('(71) 99999-8888')).toBe('99998888')
    expect(ultimos8('+55 71 9 9999 8888')).toBe('99998888')
  })

  /**
   * Menos de 8 dígitos é ramal ou número truncado. Completar com zero criaria
   * uma chave que casa com telefone de verdade — descadastrando quem nunca
   * pediu, e sem nada apontando por quê.
   */
  it('recusa número curto demais em vez de completar', () => {
    expect(ultimos8('1234567')).toBeNull()
    expect(ultimos8('4002')).toBeNull()
    expect(ultimos8('')).toBeNull()
    expect(ultimos8(null)).toBeNull()
  })
})

describe('chaves', () => {
  it('carregam o canal no prefixo', () => {
    expect(chaveDeEmail('abc')).toBe('email:abc')
    expect(chaveDeTelefone('5571999998888')).toBe('fone:99998888')
    expect(chaveDeDominio('Exemplo.COM.BR')).toBe('dominio:exemplo.com.br')
  })

  /** Sem 8 dígitos não há o que barrar, e uma chave `fone:` truncada casaria com outro número. */
  it('telefone impossível não vira chave', () => {
    expect(chaveDeTelefone('123')).toBeNull()
    expect(chaveDeTelefone(null)).toBeNull()
  })
})

describe('pediu para sair', () => {
  it.each([
    'não quero receber mais mensagens',
    'nao quero mais contato',
    'Pare de mandar mensagem',
    'para de me encher',
    'não me manda mais nada',
    'nao me procure',
    'me descadastra dessa lista',
    'DESCADASTRAR',
    'não tenho interesse',
    'sem interesse',
    'não me interessa',
    'remove meu número dessa lista',
    'tira meu contato do cadastro',
    'me tira daqui',
    'quero sair da lista',
    'não perturbe',
  ])('reconhece "%s"', (texto) => {
    expect(pediuParaSair(texto)).toBe(true)
  })

  /**
   * O caso que obrigou os padrões a nomearem o CONTATO, e não só a recusa.
   *
   * "não quero perder orçamento" contém "não quero" e é a resposta mais quente
   * que a fila pode produzir: a pessoa está dizendo a própria dor. Um padrão
   * solto de `nao quero` descadastraria exatamente ela.
   */
  it('NÃO confunde a dor do cliente com pedido de saída', () => {
    expect(pediuParaSair('não quero perder orçamento nenhum')).toBe(false)
    expect(pediuParaSair('é isso mesmo, não quero mais esquecer de dar retorno')).toBe(false)
  })

  /**
   * Objeção não é saída. Estas três são as respostas mais valiosas da fila —
   * elas dizem o que impede a venda — e tratá-las como opt-out apagaria a
   * conversa que interessa junto com o prospect.
   */
  it.each([
    'já uso outro sistema',
    'quanto custa?',
    'agora não dá, me chama mês que vem',
    'manda mais informação',
    'não conheço, o que é?',
  ])('NÃO trata objeção como saída: "%s"', (texto) => {
    expect(pediuParaSair(texto)).toBe(false)
  })

  /**
   * A abordagem TERMINA numa pergunta ("quem lembra de dar o retorno?"), então
   * um "não" solto responde à pergunta e quer dizer *ninguém lembra* — que é
   * interesse. Descadastrar ali apagaria o prospect mais quente da fila.
   */
  it('"não" sozinho NÃO é pedido de saída', () => {
    expect(pediuParaSair('não')).toBe(false)
    expect(pediuParaSair('nao')).toBe(false)
    expect(pediuParaSair('Não.')).toBe(false)
  })

  /**
   * Palavra curta só vale como pedido quando é a mensagem INTEIRA. Dentro de
   * uma frase ela é outra coisa, e a comparação por igualdade recusa sem
   * precisar de mais nenhuma regra.
   */
  it('palavra curta dentro de frase não dispara', () => {
    expect(pediuParaSair('pare')).toBe(true)
    expect(pediuParaSair('pare pra pensar, faz sentido')).toBe(false)
    expect(pediuParaSair('sair')).toBe(true)
    expect(pediuParaSair('vou sair agora, te falo depois')).toBe(false)
  })

  it('pontuação no fim não muda a intenção', () => {
    expect(pediuParaSair('pare!')).toBe(true)
    expect(pediuParaSair('sem interesse...')).toBe(true)
  })

  it('vazio não é pedido de nada', () => {
    expect(pediuParaSair('')).toBe(false)
    expect(pediuParaSair('   ')).toBe(false)
    expect(pediuParaSair(null)).toBe(false)
    expect(pediuParaSair(undefined)).toBe(false)
  })
})
