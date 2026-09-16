import { NextResponse } from 'next/server'

import { instanciaPorSegredo, registrarEstado } from '@/lib/whatsapp/instancia'
import { statusDaZapi } from '@/lib/whatsapp/entrega'
import { instanciaDoPayload, normalizarStatusZapi } from '@/lib/whatsapp/payload'
import { moverStatusDeEntrega } from '@/lib/whatsapp/receber'

/**
 * A mensagem que saiu foi entregue, ou lida.
 *
 * ## Por que isto existe, e não é enfeite
 *
 * Saber que o cliente LEU é o dado que separa duas leituras opostas do mesmo
 * silêncio: ele não respondeu porque não viu, ou porque não quis. As duas pedem
 * ações contrárias — mandar de novo, ou parar de insistir —, e sem este webhook
 * a tela não distingue.
 *
 * É o mesmo raciocínio que faz `respondida_em` existir em vez de
 * `unread_count`: o produto não é um chat, é um relógio.
 *
 * ## A escada só anda para FRENTE
 *
 * Webhook entrega fora de ordem, e `READ` antes de `RECEIVED` é normal quando a
 * pessoa abre o WhatsApp no instante em que a mensagem cai. Quem impede a
 * regressão é `proximoStatusDeEntrega`, com o cuidado de nunca comparar um
 * `-1` — o defeito exato que desfazia pedidos de saída em 12/09.
 *
 * ## Sem dedupe próprio, de propósito
 *
 * Reprocessar um callback de status é idempotente por construção: o mesmo
 * degrau de novo não muda nada, e um degrau anterior é recusado pela escada.
 * Gravar uma linha de dedupe por confirmação encheria a tabela com o evento
 * mais frequente do sistema para proteger de um risco que não existe.
 */

export const runtime = 'nodejs'
export const maxDuration = 15

const ACEITO = NextResponse.json({ value: true })

export async function POST(
  request: Request,
  { params }: { params: { segredo: string } },
) {
  const instancia = await instanciaPorSegredo(params.segredo)
  if (!instancia) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }

  let corpo: unknown
  try {
    corpo = await request.json()
  } catch {
    return ACEITO
  }

  const declarada = instanciaDoPayload(corpo)
  if (declarada && declarada !== instancia.instanceId) {
    console.error('webhook zapi status: instanceId divergente, ignorado')
    return ACEITO
  }

  const evento = normalizarStatusZapi(corpo)
  if (!evento) return ACEITO

  const novo = statusDaZapi(evento.status)
  // `null` cobre dois casos diferentes, e nenhum grava: status que ninguém
  // mapeou (gravar um palpite viraria 23514 no `check` da 0090) e `READ_BY_ME`,
  // que é sobre NÓS termos lido algo, não sobre o cliente ter lido o nosso.
  if (!novo) return ACEITO

  const movidas = await moverStatusDeEntrega({
    workspaceId: instancia.workspaceId,
    externalIds: evento.ids,
    novo,
  })

  // Confirmação de entrega também é sinal de vida do número.
  await registrarEstado({ workspaceId: instancia.workspaceId, estado: 'conectado' })

  // O número entra na resposta para o painel da Z-API mostrar algo útil em vez
  // de um `true` mudo. Não afeta o contrato: ela exige a chave `value`.
  return NextResponse.json({ value: true, movidas })
}
