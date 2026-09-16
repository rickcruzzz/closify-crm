import { NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'
import { instanciaPorSegredo, registrarEstado } from '@/lib/whatsapp/instancia'
import { instanciaDoPayload, normalizarZapi } from '@/lib/whatsapp/payload'
import { eventoNovo, gravarMensagem } from '@/lib/whatsapp/receber'

/**
 * A mensagem do cliente entra no CRM.
 *
 * ## A empresa vem do SEGREDO da URL, nunca do payload
 *
 * A Z-API **não assina o webhook**. O corpo carrega `instanceId` em texto puro
 * e mais nada. Resolver a empresa por esse campo repetiria, com outro nome, o
 * defeito que fez `c52a718` remover a rota da Evolution em 28/08:
 *
 * > o `EVOLUTION_WEBHOOK_SECRET` é único para todas as empresas, então quem o
 * > conhecesse injetaria mensagem falsa no funil de qualquer uma sabendo o UUID
 * > dela
 *
 * Aqui o segredo é aleatório **por instância** e É a identidade: não existe
 * campo de empresa na requisição, então não existe o que forjar. Quem não tem o
 * segredo não alcança empresa nenhuma; quem tem o de uma não alcança a outra.
 *
 * O `instanceId` do corpo continua sendo lido, para uma coisa só: **conferir**
 * contra o que o segredo achou. Divergiu, responde 200 e ignora.
 *
 * ## Nunca 500, e a lição é da fila do Asaas
 *
 * Erro devolvido ao provedor faz a fila penalizar a entrega e interromper, e
 * fila parada é indistinguível de "ninguém escreveu". O webhook do Asaas parou
 * quatro vezes em doze dias exatamente assim.
 *
 * Tudo que não é mensagem responde 200. Tudo que falha ao gravar responde 200 e
 * registra alto — a mensagem se perde uma vez, contra a fila se perder para
 * sempre.
 *
 * ## A resposta é `{"value": true}`
 *
 * Exigência documentada da Z-API, nos três callbacks. Um `{"ok":true}` daqui
 * seria aceito pelo HTTP e recusado por ela.
 */

export const runtime = 'nodejs'

/**
 * Quinze segundos, o mesmo da rota da Evolution.
 *
 * É folgado para o que esta faz (quatro idas ao banco) e é o que impede a
 * gravação de ficar pendurada quando o Supabase engasga.
 */
export const maxDuration = 15

const ACEITO = NextResponse.json({ value: true })

export async function POST(
  request: Request,
  { params }: { params: { segredo: string } },
) {
  const instancia = await instanciaPorSegredo(params.segredo)
  // 401 e não 404: 404 diria que a URL não existe, e a URL existe. A diferença
  // importa para quem estiver depurando uma configuração errada no painel.
  if (!instancia) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }

  let corpo: unknown
  try {
    corpo = await request.json()
  } catch {
    // 200: um corpo inválido não melhora com reentrega.
    return ACEITO
  }

  // A conferência, não a resolução. Ver o cabeçalho.
  const declarada = instanciaDoPayload(corpo)
  if (declarada && declarada !== instancia.instanceId) {
    console.error(
      `webhook zapi: instanceId divergente. segredo aponta para ${instancia.instanceId}, payload diz ${declarada}`,
    )
    return ACEITO
  }

  const mensagem = normalizarZapi(corpo)
  if (!mensagem) return ACEITO

  // Sem id não há dedupe possível, e gravar sem ele deixaria a porta aberta
  // para a mesma mensagem entrar a cada reentrega.
  if (!mensagem.id) return ACEITO

  // Grupo não vira conversa: `conversas` é por CONTATO, e um grupo não é um
  // contato. A decisão fica aqui e não no normalizador porque o normalizador
  // descreve o que chegou, não o que se faz com ele.
  if (mensagem.ehGrupo || !mensagem.telefone) return ACEITO

  const supabase = createAdminClient()
  try {
    if (!(await eventoNovo(supabase, instancia.instanceId, mensagem.id))) {
      return ACEITO
    }
  } catch {
    // A dedupe falhou. Seguir sem ela é melhor que descartar: o índice único de
    // `mensagens.external_id` é a segunda camada, e ela pega o duplicado.
    console.error('webhook zapi: dedupe indisponível, seguindo pela segunda camada')
  }

  const gravado = await gravarMensagem({
    workspaceId: instancia.workspaceId,
    mensagem,
  })

  if (!gravado.ok) {
    console.error(
      `webhook zapi: mensagem de +${mensagem.telefone} NAO gravada na empresa ${instancia.workspaceId}: ${gravado.motivo}`,
    )
    return ACEITO
  }

  // Toda mensagem que chega é prova de que o número está de pé. Sem isto,
  // `vista_em` só avançaria em webhook de status, e uma instância conversando
  // normalmente pareceria parada.
  await registrarEstado({ workspaceId: instancia.workspaceId, estado: 'conectado' })

  return ACEITO
}
