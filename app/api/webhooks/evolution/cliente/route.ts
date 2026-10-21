import { NextResponse } from 'next/server'

import { telefoneNoLog } from '@/lib/log/redigir'
import { registrarNotificacao } from '@/lib/notificacoes/registrar'
import { normalizarMensagem } from '@/lib/prospeccao/mensagem-recebida'
import { createAdminClient } from '@/lib/supabase/admin'
import { instanciaPorSegredo, registrarEstado } from '@/lib/whatsapp/instancia'
import { eventoNovo, gravarMensagem } from '@/lib/whatsapp/receber'

/**
 * A mensagem do cliente entra no CRM, pela Evolution.
 *
 * ## Esta rota NÃO é `/api/webhooks/evolution`, e a diferença é a razão de ela existir
 *
 * A rota de 12/09 resolve a empresa **pelo NOME**, no servidor, com uma lista de
 * escrita de uma empresa só. O comentário dela registra por que isso é seguro:
 * *"prospecção não é multiempresa. A empresa é resolvida no SERVIDOR, pelo nome,
 * e nunca lida da requisição"*.
 *
 * Aqui é multiempresa. Reusar aquela rota mandaria a mensagem do cliente da
 * marcenaria para a empresa `Prospeccao`, e reusar o `EVOLUTION_WEBHOOK_SECRET`
 * dela seria **um segredo global para todas as empresas** — que é literalmente
 * o defeito que fez `c52a718` remover a rota antiga em 28/08.
 *
 * ## O segredo vai no CABEÇALHO, não na URL
 *
 * É a única diferença de forma contra as três rotas da Z-API, e ela existe
 * porque a Z-API **não aceita** cabeçalho customizado: lá o segredo tem que ir
 * no caminho. A Evolution 2.3.7 aceita, conferido lendo de volta com
 * `GET /webhook/find` em 25/09.
 *
 * A Vercel registra a URL de toda requisição em log, e log fica fora de
 * qualquer purga. Quando o provedor deixa escolher, o cabeçalho é o lugar.
 *
 * O segredo continua sendo **por instância**, e continua sendo a identidade:
 * não existe campo de empresa na requisição, então não existe o que forjar.
 * O `instance` do corpo é lido para UMA coisa, conferir contra o que o segredo
 * achou.
 *
 * ## `deNos` é GRAVADO, ao contrário da prospecção
 *
 * `deveRegistrar` joga fora `deNos`, e está certo lá: é a nossa abordagem
 * voltando, e contá-la marcaria o prospect como "respondeu" no segundo em que o
 * disparo saiu.
 *
 * No produto é o oposto. A resposta que o dono manda pelo CELULAR chega por
 * aqui, e sem ela a caixa de entrada mostraria metade da conversa — justamente
 * a metade que prova que alguém respondeu. É a mesma decisão já escrita em
 * `lib/whatsapp/payload.ts` para a Z-API, e por isso esta rota chama
 * `normalizarMensagem` e **não** `deveRegistrar`.
 *
 * ## Nunca 500, e a lição é da fila do Asaas
 *
 * Erro devolvido ao provedor faz a fila penalizar a entrega e interromper, e
 * fila parada é indistinguível de "ninguém escreveu". O webhook do Asaas parou
 * OITO vezes em quinze dias exatamente assim.
 */

export const runtime = 'nodejs'

/** Quinze segundos, o mesmo das outras duas. Folgado para quatro idas ao banco. */
export const maxDuration = 15

/**
 * A Evolution aceita `{"ok":true}`, ao contrário da Z-API, que exige
 * `{"value":true}` nos três callbacks. Mantido no formato dela.
 */
const ACEITO = NextResponse.json({ ok: true })

const EVENTOS_DE_MENSAGEM = new Set(['messages.upsert', 'MESSAGES_UPSERT'])
const EVENTOS_DE_CONEXAO = new Set(['connection.update', 'CONNECTION_UPDATE'])

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor.length > 0 ? valor : null
}

export async function POST(request: Request) {
  // `authorization` e não um cabeçalho próprio: é o que qualquer proxy no
  // caminho já sabe não registrar em log. Mesma escolha da rota de prospecção.
  const cabecalho =
    request.headers.get('authorization') ?? request.headers.get('x-velo-segredo')
  const segredo = cabecalho?.replace(/^Bearer\s+/i, '').trim() ?? ''

  const instancia = await instanciaPorSegredo(segredo)
  // 401 e não 404: 404 diria que a URL não existe, e ela existe. A diferença
  // importa para quem estiver depurando o painel da Evolution.
  if (!instancia) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }

  let corpo: { event?: unknown; instance?: unknown; data?: unknown }
  try {
    corpo = await request.json()
  } catch {
    // 200: corpo inválido não melhora com reentrega.
    return ACEITO
  }

  // A conferência, não a resolução. Divergiu, ignora em silêncio para o
  // provedor e alto no log: é o único sintoma de webhook apontado para a
  // empresa errada, e sem ele a mensagem de um cliente entraria na caixa de
  // outro sem nada falhar.
  const declarada = texto(corpo.instance)
  if (declarada && declarada !== instancia.instanceId) {
    console.error(
      `webhook evolution/cliente: instância divergente. o segredo aponta para ${instancia.instanceId}, o corpo diz ${declarada}`,
    )
    return ACEITO
  }

  const evento = typeof corpo.event === 'string' ? corpo.event : ''

  // ## A queda chega por evento, e é o que a conferência de 23/09 não alcança
  //
  // `conferirConexoes` reconcilia o que o provedor RESPONDE quando perguntado,
  // de meia em meia hora. Este evento é o provedor avisando na hora, e os dois
  // existem porque nenhum cobre o outro: a Z-API deixou de ser paga sem mandar
  // evento nenhum, e uma VPS que perde o pareamento avisa antes da próxima
  // varredura.
  if (EVENTOS_DE_CONEXAO.has(evento)) {
    const dados = corpo.data
    const estado =
      dados && typeof dados === 'object'
        ? texto((dados as Record<string, unknown>).state)
        : null
    // Só `close` decide. `connecting` é o meio do pareamento, e marcar
    // desconectado nele faria a tela piscar durante a leitura do QR.
    if (estado === 'close') {
      const { anterior } = await registrarEstado({
        workspaceId: instancia.workspaceId,
        estado: 'desconectado',
        erro: 'O WhatsApp desconectou. Leia o QR Code de novo para voltar a receber.',
      })

      // ## O sino, e a primeira versão desta rota esqueceu dele
      //
      // A rota `disconnected` da Z-API avisa, e a conferência de 23/09 também.
      // Sem isto, um cliente na Evolution cujo número caísse descobriria pela
      // primeira mensagem que falha — ou seja, por um cliente dele esperando
      // resposta que nunca chega.
      //
      // Achado ao PROVAR os dois eventos contra a rota: `close` mudava a coluna
      // e o sino ficava em zero, do lado onde ele é a única forma de alguém
      // saber. Ler o código não pegaria: não há nada ali que pareça faltando.
      //
      // Só na TRANSIÇÃO, mesma regra do vigia de 01/09: varre sempre, avisa
      // quando muda. Sem isso o sino receberia o mesmo fato a cada evento que a
      // Evolution reenviasse.
      if (anterior === 'conectado') {
        await registrarNotificacao({
          workspaceId: instancia.workspaceId,
          tipo: 'whatsapp_caiu',
          titulo: 'O WhatsApp da sua empresa desconectou',
          corpo:
            'As mensagens dos seus clientes pararam de chegar aqui. Reconecte para voltar a receber.',
          href: '/settings/whatsapp',
          // Para a empresa inteira: quem trabalha as conversas precisa saber por
          // que elas pararam, mesmo sem poder reconectar.
          userId: null,
        })
      }
    }
    if (estado === 'open') {
      await registrarEstado({ workspaceId: instancia.workspaceId, estado: 'conectado' })
    }
    return ACEITO
  }

  if (!EVENTOS_DE_MENSAGEM.has(evento)) return ACEITO

  const mensagem = normalizarMensagem(corpo.data)
  if (!mensagem) return ACEITO

  // Sem id não há dedupe, e gravar sem ele deixaria a mesma mensagem entrar a
  // cada reentrega da Evolution.
  if (!mensagem.id) return ACEITO

  // Grupo não vira conversa: `conversas` é por CONTATO. A decisão fica aqui e
  // não no normalizador porque o normalizador descreve o que chegou, não o que
  // se faz com ele.
  if (mensagem.ehGrupo || !mensagem.telefone) return ACEITO

  const supabase = createAdminClient()
  try {
    if (!(await eventoNovo(supabase, 'evolution', instancia.instanceId, mensagem.id))) {
      return ACEITO
    }
  } catch {
    // A dedupe falhou. Seguir sem ela é melhor que descartar: o índice único de
    // `mensagens.external_id` é a segunda camada, e ela pega o duplicado.
    console.error(
      'webhook evolution/cliente: dedupe indisponível, seguindo pela segunda camada',
    )
  }

  const gravado = await gravarMensagem({ workspaceId: instancia.workspaceId, mensagem })

  if (!gravado.ok) {
    // Telefone REDIGIDO: é dado pessoal sob LGPD, e o log da Vercel não é o
    // sistema onde ele foi consentido.
    console.error(
      `webhook evolution/cliente: mensagem de ${telefoneNoLog(mensagem.telefone)} NÃO gravada na empresa ${instancia.workspaceId}: ${gravado.motivo}`,
    )
    return ACEITO
  }

  // Toda mensagem que chega é prova de que o número está de pé. Sem isto,
  // `vista_em` só avançaria em evento de conexão, e uma instância conversando
  // normalmente pareceria parada.
  await registrarEstado({ workspaceId: instancia.workspaceId, estado: 'conectado' })

  return ACEITO
}
