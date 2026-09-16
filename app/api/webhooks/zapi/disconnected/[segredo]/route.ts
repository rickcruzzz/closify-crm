import { NextResponse } from 'next/server'

import { instanciaPorSegredo, registrarEstado } from '@/lib/whatsapp/instancia'
import { instanciaDoPayload, normalizarDesconexaoZapi } from '@/lib/whatsapp/payload'

/**
 * O número caiu.
 *
 * ## Por que uma rota só para isto
 *
 * Porque o silêncio é o pior aviso possível. Sem este webhook, um número
 * desconectado seria descoberto pela primeira mensagem que falha — ou seja, por
 * um cliente esperando resposta que nunca chega, e por um vendedor que acha que
 * respondeu.
 *
 * A conexão não oficial CAI: celular sem bateria, aparelho trocado, WhatsApp
 * Web derrubado pela Meta. Não é exceção, é rotina, e é a razão número um de
 * chamado neste tipo de integração.
 *
 * ## A linha NÃO é apagada
 *
 * Só o estado muda. Apagar obrigaria a criar outra instância na reconexão, o
 * que gasta dinheiro no provedor e troca o `instanceId` que os webhooks já
 * conhecem — e o número continua pareado do outro lado.
 *
 * ## O motivo vai CRU para a tela
 *
 * `error` vem do provedor e é gravado sem tradução. Inventar uma frase
 * amigável a partir de um texto que não controlamos esconderia o motivo real de
 * quem precisa dele, e quem precisa é justamente quem vai reconectar.
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
    console.error('webhook zapi desconexão: instanceId divergente, ignorado')
    return ACEITO
  }

  const evento = normalizarDesconexaoZapi(corpo)
  if (!evento) return ACEITO

  await registrarEstado({
    workspaceId: instancia.workspaceId,
    estado: 'desconectado',
    erro: evento.erro,
  })

  return ACEITO
}
