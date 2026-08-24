import { describe, expect, it } from 'vitest'

import { avaliarSenha, senhaDerivadaDoEmail,
  MINIMO_DE_CARACTERES,
  requisitosDaSenha,
} from './password-strength'

describe('avaliarSenha', () => {
  it('marca como fraca o que não protege nada', () => {
    for (const senha of ['12345678', '123456', 'senha123', 'password', 'aaaaaaaa']) {
      expect(avaliarSenha(senha).nivel, senha).toBe('fraca')
    }
  })

  it('marca como fraca qualquer coisa com menos de 8 caracteres', () => {
    expect(avaliarSenha('Ab#1').nivel).toBe('fraca')
  })

  // Defeito corrigido: o detector de sequência derrubava para "fraca" qualquer
  // senha contendo "12345" em QUALQUER posição. "Kmtbvn123456" (12 caracteres,
  // três classes) recebia nota pior que "Xyzqwr12" (8 caracteres), a senha
  // melhor levava a nota pior. Agora a checagem é por proporção.
  it('não pune senha longa só por conter uma sequência curta', () => {
    expect(avaliarSenha('Kmtbvn123456').nivel).not.toBe('fraca')
  })

  it('exige tamanho e variedade para dar nota forte', () => {
    expect(avaliarSenha('Tr0vao#Chuva2026').nivel).toBe('forte')
    expect(avaliarSenha('Xyzqwr12').nivel).toBe('media')
  })

  // Palavra de dicionário com contador atrás não merece selo de forte, mesmo
  // com 12 caracteres e três classes.
  it('cobra as quatro classes quando há padrão previsível', () => {
    expect(avaliarSenha('Senha1234567').nivel).toBe('media')
  })

  it('senha vazia não quebra e não sugere nada', () => {
    const r = avaliarSenha('')
    expect(r.nivel).toBe('fraca')
    expect(r.rotulo).toBe('')
  })

  it('o percentual acompanha o nível', () => {
    expect(avaliarSenha('12345678').percentual).toBe(33)
    expect(avaliarSenha('Xyzqwr12').percentual).toBe(66)
    expect(avaliarSenha('Tr0vao#Chuva2026').percentual).toBe(100)
  })
})


describe('senhaDerivadaDoEmail', () => {
  const email = 'henriquestn24@gmail.com'

  // O caso que motivou a regra: a pessoa usar o próprio endereço de login
  // como senha.
  it('recusa a senha igual ao e-mail inteiro', () => {
    expect(senhaDerivadaDoEmail(email, email)).toBe(true)
  })

  it('recusa a senha igual ao nome de usuário do e-mail', () => {
    expect(senhaDerivadaDoEmail('henriquestn24', email)).toBe(true)
  })

  // Variação mais comum: manter o nome de usuário e pendurar símbolo e ano.
  // Continua sendo o e-mail de login dentro da senha.
  it('recusa a senha que apenas embute o nome de usuário', () => {
    expect(senhaDerivadaDoEmail('Henriquestn24#2026', email)).toBe(true)
    expect(senhaDerivadaDoEmail('@@henriquestn24!!', email)).toBe(true)
  })

  it('ignora diferença de caixa e espaço em volta', () => {
    expect(senhaDerivadaDoEmail('  HENRIQUESTN24@GMAIL.COM  ', email)).toBe(true)
  })

  it('aceita senha que não tem relação com o endereço', () => {
    expect(senhaDerivadaDoEmail('Tr0vao#Chuva2026', email)).toBe(false)
  })

  // Sem o corte de tamanho, quem usa um endereço curto teria senhas
  // legítimas recusadas só por conterem três letras comuns.
  it('não recusa por causa de nome de usuário curto demais', () => {
    expect(senhaDerivadaDoEmail('planejamento2026', 'ana@empresa.com')).toBe(false)
  })

  // Sem e-mail conhecido a regra não tem como valer, e recusar a troca de
  // senha inteira por isso seria pior do que deixar passar.
  it('não bloqueia quando o e-mail não veio', () => {
    expect(senhaDerivadaDoEmail('qualquercoisa', undefined)).toBe(false)
    expect(senhaDerivadaDoEmail('qualquercoisa', '')).toBe(false)
  })
})

describe('requisitosDaSenha', () => {
  const porId = (senha: string) =>
    Object.fromEntries(requisitosDaSenha(senha).map((r) => [r.id, r.atendido]))

  it('senha vazia não atende nada', () => {
    expect(porId('')).toEqual({
      tamanho: false,
      maiuscula: false,
      numero: false,
      simbolo: false,
    })
  })

  it('marca cada item conforme a senha ganha o caractere', () => {
    // O caso que motivou o componente: a pessoa digita e vê o item virar
    // verde. Cada passo aqui é um caractere a mais.
    expect(porId('abcdefg').tamanho).toBe(false)
    expect(porId('abcdefgh').tamanho).toBe(true)
    expect(porId('abcdefgH').maiuscula).toBe(true)
    expect(porId('abcdefgH1').numero).toBe(true)
    expect(porId('abcdefgH1!').simbolo).toBe(true)
  })

  it('só o tamanho é obrigatório', () => {
    // A decisão de produto que este arquivo carrega: exigir as quatro classes
    // custaria cadastro, e cadastro é o único funil que o produto tem.
    const obrigatorios = requisitosDaSenha('qualquer')
      .filter((r) => r.obrigatorio)
      .map((r) => r.id)
    expect(obrigatorios).toEqual(['tamanho'])
  })

  it('o mínimo bate com o que o schema de cadastro exige', () => {
    // Se `signUpSchema` mudar o `min()` e isto não mudar junto, a tela diria
    // "pode cadastrar" e o servidor recusaria — o pior tipo de divergência,
    // porque a pessoa não tem como saber quem está certo.
    expect(MINIMO_DE_CARACTERES).toBe(8)
    expect(requisitosDaSenha('1234567').find((r) => r.id === 'tamanho')?.atendido).toBe(false)
    expect(requisitosDaSenha('12345678').find((r) => r.id === 'tamanho')?.atendido).toBe(true)
  })

  it('não discorda de avaliarSenha sobre a mesma senha', () => {
    // As duas leem a senha e aparecem juntas na tela. Uma dizendo "forte"
    // enquanto a outra mostra item vermelho faria a pessoa não saber em qual
    // acreditar.
    const forte = 'Kj8#mQ2vLp9x'
    expect(avaliarSenha(forte).nivel).toBe('forte')
    expect(requisitosDaSenha(forte).every((r) => r.atendido)).toBe(true)
  })
})
