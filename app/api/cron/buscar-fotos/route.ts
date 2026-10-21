import { timingSafeEqual } from 'node:crypto'

import { NextResponse } from 'next/server'

import { rodarBuscaDeFotos } from '@/lib/whatsapp/foto-fila'

/**
 * A foto de perfil de quem escreve entra na caixa.
 *
 * ## Por que um cron, e não o webhook de recebimento
 *
 * O webhook tem que responder rápido: fila que demora é fila que o provedor
 * penaliza, e a do Asaas parou quatro vezes em doze dias exatamente assim.
 * Pendurar uma chamada ao provedor, mais um download e um upload, dentro dele
 * poria a caixa de entrada inteira atrás de um avatar de 32 pixels.
 *
 * A foto chega minutos depois, e minutos depois basta: a lista já mostra as
 * iniciais nesse meio tempo, e elas ficam certas desde `cca705c`.
 *
 * ## O horário, e ele é deslocado de propósito
 *
 *     :00   vigia
 *     :10   reenvio de mensagem
 *     :15   classificar respostas
 *     :20   ESTE
 *     :30   vigiar o vigia (pg_cron)
 *     :40   reenvio de mensagem
 *     :45   reconciliar assinaturas
 *
 * A 0063 já tinha usado esse raciocínio: cron na mesma marca disputa a mesma
 * função e o mesmo banco, e o que perde vira falha intermitente sem causa
 * aparente.
 */

export const runtime = 'nodejs'

/**
 * Sessenta segundos. Vinte contatos, cada um com uma chamada ao provedor mais
 * um download, cabem com folga — a foto que medimos tinha 30 KB.
 */
export const maxDuration = 60

/**
 * O portão, no mesmo formato dos outros cinco crons.
 *
 * Esta rota era a ÚNICA das seis que comparava com `!==` cru. Na prática a
 * diferença de tempo não é explorável através da rede da Vercel — o ruído é
 * ordens de grandeza maior que o sinal —, e o motivo de mudar não é esse: é
 * que uma exceção sem razão escrita vira precedente, e a próxima rota copia a
 * versão errada porque ela estava ali.
 *
 * `timingSafeEqual` exige tamanhos iguais, daí a comparação de comprimento
 * antes — ela vaza só o TAMANHO do segredo, que não ajuda ninguém.
 */
function segredoValido(cabecalho: string | null): boolean {
  const esperado = process.env.CRON_SECRET
  // Falha FECHADA: sem a variável no ambiente, ninguém entra. O contrário
  // deixaria a rota pública no dia em que alguém apagasse o segredo do painel.
  if (!cabecalho || !esperado) return false

  const prefixo = 'Bearer '
  if (!cabecalho.startsWith(prefixo)) return false

  const a = Buffer.from(cabecalho.slice(prefixo.length))
  const b = Buffer.from(esperado)
  if (a.length !== b.length) return false

  return timingSafeEqual(a, b)
}

export async function GET(request: Request) {
  // Mesmo portão dos outros crons. Sem ele, a rota é pública e qualquer um
  // faria o servidor gastar chamadas ao provedor em nome dos clientes.
  if (!segredoValido(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }

  const resultado = await rodarBuscaDeFotos()

  // `perguntados` e `semFoto` saem no corpo, e não só `guardadas`. Fila que
  // encolhe sem explicação é indistinguível de fila que parou de ser lida, e a
  // Central já disse uma vez "tudo que chegou já foi lido" sobre 41 mensagens
  // que não tinham sido.
  return NextResponse.json(resultado)
}
