import { timingSafeEqual } from 'node:crypto'

import { NextResponse } from 'next/server'

import { conferirConexoes } from '@/lib/whatsapp/conferir-conexao'
import { reenviarMensagensQueFalharam } from '@/lib/whatsapp/reenvio-fila'

/**
 * A segunda chance da mensagem que não saiu.
 *
 * ## Por que existe
 *
 * `enviarMensagem` grava a linha como `pendente`, tenta entregar e marca
 * `falhou` com o motivo quando o provedor recusa. O dado **não se perde**, e
 * ninguém tentava de novo: uma indisponibilidade de trinta segundos da Z-API
 * deixava a mensagem parada para sempre, num produto cuja promessa é não
 * perder venda por esquecimento.
 *
 * ## Cron, e não retentativa dentro do clique
 *
 * Tentar de novo ali prenderia a pessoa numa tela girando pelo tempo do
 * terceiro, e é o caminho pelo qual o webhook do Asaas ficou `interrupted`
 * quatro vezes em nove dias. Separado, o pior caso é uma entrega atrasada, e a
 * mensagem já está no banco e visível na conversa.
 *
 * ## Aos :10 e :40, e os minutos são deslocados de propósito
 *
 *     :00   vigia
 *     :10   reenvio            <- aqui
 *     :15   classificar-respostas
 *     :30   vigiar_o_vigia (pg_cron)
 *     :40   reenvio            <- e aqui
 *     :45   reconciliar-assinaturas
 *
 * Duas passagens por hora, e nao de cinco em cinco minutos: a primeira
 * espera da escada e de dois
 * minutos, mas o teto de aquecimento e de 10 a 30 mensagens **por hora**.
 * Uma cadencia mais curta nao entregaria nada mais rapido, e ligaria o
 * provedor doze vezes por hora para achar fila vazia.
 *
 * **Fila vazia não custa quase nada**: uma consulta com índice parcial (0095)
 * e nenhuma chamada ao provedor.
 */

export const runtime = 'nodejs'

/**
 * Sessenta segundos. O teto por rodada é 40 mensagens, e cada envio leva menos
 * de um segundo contra a Z-API. Se passar disso o problema é outro (provedor
 * lento, fila represada) e falhar rápido expõe isso em vez de esconder.
 */
export const maxDuration = 60

function segredoValido(cabecalho: string | null): boolean {
  const esperado = process.env.CRON_SECRET
  if (!cabecalho || !esperado) return false

  const prefixo = 'Bearer '
  if (!cabecalho.startsWith(prefixo)) return false

  const a = Buffer.from(cabecalho.slice(prefixo.length))
  const b = Buffer.from(esperado)
  if (a.length !== b.length) return false

  return timingSafeEqual(a, b)
}

export async function GET(requisicao: Request) {
  if (!segredoValido(requisicao.headers.get('authorization'))) {
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 })
  }

  try {
    // ## As duas em PARALELO, e a ordem entre elas não importa
    //
    // São independentes: uma lê `mensagens`, a outra lê `whatsapp_instances`.
    // Em série a rota somaria as duas latências por nada.
    //
    // ## A conferência mora AQUI, e não num cron próprio
    //
    // Esta rota já roda aos :10 e :40 e já fala com a Z-API. Cron próprio
    // seria mais uma entrada para falhar em silêncio, que é o argumento que a
    // purga de instâncias usou em 17/09 para morar dentro da reconciliação de
    // assinaturas.
    const [r, conexao] = await Promise.all([
      reenviarMensagensQueFalharam({ teto: 40 }),
      conferirConexoes(),
    ])

    // `desistidas` sai no corpo e não só no log: um cron que devolve `ok: true`
    // escondendo falha é o defeito que `classificar-respostas` carregou até
    // 18/09, com 20 de 20 falhando dentro de um `ok`.
    //
    // `conexao` sai junto pela mesma razão: `derrubadas: 0` e `conferidas: 0`
    // dizem coisas diferentes, e sem os dois números um cron que parou de
    // listar instâncias pareceria um cron sem trabalho a fazer.
    return NextResponse.json({ ok: true, ...r, conexao })
  } catch (e) {
    console.error('reenviar-mensagens falhou', e)
    return NextResponse.json(
      { ok: false, erro: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
