import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Limites por ação. Cada um responde a uma ameaça diferente, então os números
 * não são o mesmo chute repetido:
 *
 * - `signin`: força bruta de senha. 8 tentativas em 15 min é folgado para quem
 *   errou a senha de verdade e apertado para quem varre uma lista.
 * - `invite`: nosso Resend virando máquina de spam. 20/hora cobre um admin
 *   montando o time de uma vez.
 * - `accept-invite`: adivinhação de token de convite. O token é UUID, então
 *   adivinhar é inviável de qualquer forma; o limite existe para não deixar
 *   ninguém martelar o endpoint de graça.
 */
const LIMITES = {
  signin: { limite: 8, janelaSegundos: 15 * 60 },
  invite: { limite: 20, janelaSegundos: 60 * 60 },
  'accept-invite': { limite: 15, janelaSegundos: 15 * 60 },
} as const

export type AcaoLimitada = keyof typeof LIMITES

/**
 * Registra a tentativa e diz se a ação deve ser bloqueada.
 *
 * Contagem e inserção acontecem na mesma transação, dentro da função do
 * Postgres: separadas, duas requisições simultâneas leriam a mesma contagem
 * antiga e passariam as duas.
 *
 * Em caso de falha do banco, **libera a ação**. Um limitador indisponível não
 * pode virar uma tranca no login de todo mundo — a proteção é contra abuso,
 * não uma barreira de autenticação, e o guard real continua sendo a senha.
 */
export async function excedeuLimite(
  acao: AcaoLimitada,
  identificador: string,
): Promise<boolean> {
  const { limite, janelaSegundos } = LIMITES[acao]
  const chave = `${acao}:${identificador.toLowerCase().trim()}`

  try {
    const { data, error } = await createAdminClient().rpc('registrar_tentativa', {
      p_chave: chave,
      p_limite: limite,
      p_janela_segundos: janelaSegundos,
    })

    if (error) {
      console.error('rate limit indisponivel, liberando acao', { acao, error })
      return false
    }

    return data === true
  } catch (err) {
    console.error('rate limit falhou, liberando acao', { acao, err })
    return false
  }
}

/** Chamado após sucesso: quem acertou não carrega as tentativas erradas. */
export async function limparTentativas(acao: AcaoLimitada, identificador: string) {
  const chave = `${acao}:${identificador.toLowerCase().trim()}`
  try {
    await createAdminClient().rpc('limpar_tentativas', { p_chave: chave })
  } catch (err) {
    console.error('falha ao limpar tentativas', { acao, err })
  }
}
