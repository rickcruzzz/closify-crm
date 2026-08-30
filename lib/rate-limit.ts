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
 * - `reset-password`: usar nosso Resend para encher a caixa de entrada de um
 *   terceiro. 5 por hora cobre quem não recebeu e pediu de novo, sem servir de
 *   canhão contra um endereço conhecido.
 * - `reenviar-confirmacao`: mesma ameaça do reset, e o mesmo número. Quem não
 *   recebeu o e-mail de cadastro tenta de novo uma ou duas vezes; cinco por
 *   hora cobre isso com folga e não serve de canhão. O limite do próprio
 *   Supabase existe, mas é global por projeto, barrar aqui, por endereço,
 *   impede que uma pessoa insistindo consuma a cota de todo mundo.
 * - `signin-ip`: o `signin` por e-mail sozinho não pega password spraying —
 *   uma senha comum testada contra MUITOS e-mails diferentes nunca esbarra no
 *   limite de nenhuma conta individual. Este é o segundo andar: bem mais
 *   folgado que o de e-mail de propósito, porque o IP visto pelo servidor é
 *   compartilhado por NAT, CGNAT, VPN corporativa e rede de escritório — não
 *   dá para tratar "muita gente atrás do mesmo IP" como sinal de ataque. 60
 *   tentativas em 15 min é alto o bastante para um escritório inteiro errando
 *   senha ao mesmo tempo, e baixo o bastante para travar uma varredura de
 *   lista.
 * - `log-erro`: `/api/log-erro` não exige sessão (o erro pode acontecer antes
 *   de qualquer login resolver), então qualquer script pode martelar o
 *   endpoint com payload arbitrário e encher `error_logs` de ruído. 30/hora
 *   por IP cobre um usuário real com erro em loop (ex.: tela quebrando a
 *   cada render) sem virar canhão de flood.
 * - `feedback`: por USUÁRIO, não por IP, e é a diferença que importa aqui —
 *   Server Action exige sessão, então há sempre alguém identificado, e limitar
 *   por IP puniria um escritório inteiro pelo excesso de uma pessoa. 10/hora é
 *   folgado para quem está genuinamente com problema e relata três ou quatro
 *   coisas seguidas, e fecha o caminho de encher a tabela — que, diferente de
 *   `error_logs`, dispara e-mail e portanto tem custo por linha.
 */
const LIMITES = {
  signin: { limite: 8, janelaSegundos: 15 * 60 },
  'signin-ip': { limite: 60, janelaSegundos: 15 * 60 },
  invite: { limite: 20, janelaSegundos: 60 * 60 },
  'accept-invite': { limite: 15, janelaSegundos: 15 * 60 },
  'reset-password': { limite: 5, janelaSegundos: 60 * 60 },
  'reenviar-confirmacao': { limite: 5, janelaSegundos: 60 * 60 },
  'log-erro': { limite: 30, janelaSegundos: 60 * 60 },
  feedback: { limite: 10, janelaSegundos: 60 * 60 },
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
 * pode virar uma tranca no login de todo mundo, a proteção é contra abuso,
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
