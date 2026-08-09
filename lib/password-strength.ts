/**
 * Força de senha, medida por composição e tamanho.
 *
 * Não é medidor de entropia real (isso exigiria dicionário de senhas
 * vazadas, que é a proteção que fica pendente no painel do Supabase). O
 * objetivo aqui é dar retorno imediato enquanto a pessoa digita, para que ela
 * escolha melhor — não bloquear.
 */
export type NivelSenha = 'fraca' | 'media' | 'forte'

export type ForcaSenha = {
  nivel: NivelSenha
  /** 0 a 100, para a barra. */
  percentual: number
  rotulo: string
  /** O que falta para subir de nível. Vazio quando já está forte. */
  sugestao: string
}

export function avaliarSenha(senha: string): ForcaSenha {
  if (!senha) {
    return { nivel: 'fraca', percentual: 0, rotulo: '', sugestao: '' }
  }

  const temMinuscula = /[a-z]/.test(senha)
  const temMaiuscula = /[A-Z]/.test(senha)
  const temNumero = /\d/.test(senha)
  const temSimbolo = /[^A-Za-z0-9]/.test(senha)
  const variedade = [temMinuscula, temMaiuscula, temNumero, temSimbolo].filter(
    Boolean,
  ).length

  // Sequência óbvia ou caractere repetido derruba para fraca, mesmo que o
  // tamanho engane: "12345678" tem 8 caracteres e não protege nada.
  //
  // A checagem é por PROPORÇÃO, não por simples ocorrência. Antes bastava a
  // senha conter "12345" em qualquer posição para virar fraca, e isso punia
  // senha boa: "Kmtbvn123456" (12 caracteres, três classes) caía para fraca
  // enquanto "Xyzqwr12" (8 caracteres) passava como média — nota pior para a
  // senha melhor. Agora só derruba quando o padrão previsível domina a senha,
  // que é quando ele de fato entrega o segredo.
  const padraoObvio = /12345|abcde|qwert|senha|password/i.exec(senha)
  const obvia =
    /^(.)\1+$/.test(senha) ||
    (padraoObvio !== null && padraoObvio[0].length * 2 >= senha.length)

  // Padrão previsível que não chega a dominar a senha não a torna fraca, mas
  // também não deveria receber selo de "forte" de graça: "Senha1234567" tem
  // 12 caracteres e três classes, e ainda assim é uma palavra de dicionário
  // com um contador atrás. Nesse caso exigimos as quatro classes.
  const temPadraoPrevisivel = padraoObvio !== null
  const variedadeParaForte = temPadraoPrevisivel ? 4 : 3

  let nivel: NivelSenha
  if (obvia || senha.length < 8 || variedade <= 1) {
    nivel = 'fraca'
  } else if (senha.length >= 12 && variedade >= variedadeParaForte) {
    nivel = 'forte'
  } else {
    nivel = 'media'
  }

  const faltas: string[] = []
  if (senha.length < 12) faltas.push('mais caracteres')
  if (!temMaiuscula) faltas.push('uma maiúscula')
  if (!temNumero) faltas.push('um número')
  if (!temSimbolo) faltas.push('um símbolo')

  return {
    nivel,
    percentual: nivel === 'fraca' ? 33 : nivel === 'media' ? 66 : 100,
    rotulo: nivel === 'fraca' ? 'Senha fraca' : nivel === 'media' ? 'Senha média' : 'Senha forte',
    sugestao: nivel === 'forte' ? '' : `Adicione ${faltas.slice(0, 2).join(' e ')}.`,
  }
}

/**
 * Gera uma senha forte usando `crypto.getRandomValues`, não `Math.random`,
 * que é previsível e não serve para gerar segredo.
 */
export function gerarSenhaForte(tamanho = 16): string {
  const minusculas = 'abcdefghijkmnopqrstuvwxyz'
  const maiusculas = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  // Sem l, I, O, 0 e 1: a pessoa vai ler isso da tela para anotar.
  const numeros = '23456789'
  const simbolos = '!@#$%&*?'
  const todos = minusculas + maiusculas + numeros + simbolos

  const sorteia = (alfabeto: string) => {
    const buf = new Uint32Array(1)
    crypto.getRandomValues(buf)
    return alfabeto[buf[0]! % alfabeto.length]!
  }

  // Garante pelo menos um de cada classe, senão o sorteio puro pode devolver
  // algo sem número e cair para "média".
  const obrigatorios = [
    sorteia(minusculas),
    sorteia(maiusculas),
    sorteia(numeros),
    sorteia(simbolos),
  ]
  const resto = Array.from({ length: Math.max(0, tamanho - obrigatorios.length) }, () =>
    sorteia(todos),
  )

  const chars = [...obrigatorios, ...resto]

  // Embaralha, senão as quatro primeiras posições teriam classe previsível.
  for (let i = chars.length - 1; i > 0; i--) {
    const buf = new Uint32Array(1)
    crypto.getRandomValues(buf)
    const j = buf[0]! % (i + 1)
    ;[chars[i], chars[j]] = [chars[j]!, chars[i]!]
  }

  return chars.join('')
}
