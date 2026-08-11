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
 * A senha é o próprio e-mail de login, ou o nome de usuário dele?
 *
 * Três formas do mesmo caso são reconhecidas, tomando "fulano@gmail.com" como
 * exemplo:
 *
 * 1. a senha igual ao e-mail inteiro — "fulano@gmail.com"
 * 2. a senha igual à parte antes do arroba — "fulano"
 * 3. a senha CONTENDO essa parte — "Fulano#2026"
 *
 * A terceira é a que mais aparece na prática e a que mais gera dúvida de quem
 * lê o código: uma senha longa parece forte, mas se ela embute o nome de
 * usuário do endereço, é derivada dele.
 *
 * O corte de 4 caracteres evita falso positivo em endereço curto: com
 * "ana@empresa.com", qualquer senha contendo "ana" seria recusada — inclusive
 * "planejamento", que não tem nada a ver com o endereço.
 */
export function senhaDerivadaDoEmail(senha: string, email: string | undefined | null): boolean {
  if (!senha || !email) return false

  const s = senha.trim().toLowerCase()
  const e = email.trim().toLowerCase()
  if (!s || !e) return false

  if (s === e) return true

  const usuario = e.split('@')[0] ?? ''
  if (!usuario) return false
  if (s === usuario) return true

  return usuario.length >= 4 && s.includes(usuario)
}
