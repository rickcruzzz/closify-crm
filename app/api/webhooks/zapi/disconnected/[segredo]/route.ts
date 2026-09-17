import { NextResponse } from 'next/server'

import { instanciaPorSegredo, registrarEstado } from '@/lib/whatsapp/instancia'
import { registrarNotificacao } from '@/lib/notificacoes/registrar'
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

  const { anterior } = await registrarEstado({
    workspaceId: instancia.workspaceId,
    estado: 'desconectado',
    erro: evento.erro,
  })

  // ## O aviso só sai na TRANSIÇÃO, e nunca na repetição
  //
  // Uma conexão que oscila manda vários `DisconnectedCallback` seguidos.
  // Avisar em todos encheria o sino com o mesmo fato, e é assim que uma fila
  // deixa de ser olhada — em 20/08, 8 de 11 alertas da Central eram ruído e o
  // efeito foi ninguém mais abrir. Junto com o item chato vai embora o alerta
  // que importa.
  //
  // Mesma regra do vigia de 01/09: varre sempre, avisa quando MUDA.
  if (anterior === 'conectado') {
    await registrarNotificacao({
      workspaceId: instancia.workspaceId,
      tipo: 'whatsapp_caiu',
      titulo: 'O WhatsApp da sua empresa desconectou',
      // O motivo do provedor NÃO entra aqui: ele vem em inglês e descreve o
      // estado interno dele ("Device has been disconnected"). A tela de
      // Configurações já o mostra cru, para quem for reconectar. No sino, o que
      // importa é a CONSEQUÊNCIA, e ela é a mesma seja qual for o motivo.
      corpo: 'As mensagens dos seus clientes pararam de chegar aqui. Reconecte para voltar a receber.',
      href: '/settings/whatsapp',
      // Para a empresa inteira, e não só para quem conectou: quem trabalha as
      // conversas precisa saber por que elas pararam, mesmo sem poder
      // reconectar. A tela diz que só administrador reconecta.
      userId: null,
    })
  }

  return ACEITO
}
