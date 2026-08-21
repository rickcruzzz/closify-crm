import 'server-only'

import { evolutionFetch } from './client'

/**
 * As operações do Evolution que este produto usa.
 *
 * ## O que NÃO existe aqui, de propósito
 *
 * Não há função de disparo em massa. Nenhuma aceita lista de destinatários —
 * `enviarTexto` manda para **um** número por chamada, e é assim que fica.
 *
 * Isso não é uma regra de conduta pedida ao usuário: é ausência de superfície.
 * Se a funcionalidade não existe no código, ninguém consegue usar o Velo Funil
 * para disparar em massa, e disparo em massa é a causa número um de banimento.
 * Um concorrente que oferece "dispare para toda a sua lista" está vendendo a
 * própria causa do problema como recurso.
 *
 * O efeito colateral é comercial e honesto: dá para dizer, com verdade, que o
 * número do cliente não é exposto a esse risco pelo produto.
 */

/** O estado de uma conexão, como o Evolution reporta. */
export type EstadoDaConexao = 'open' | 'connecting' | 'close'

export type Instancia = {
  nome: string
  estado: EstadoDaConexao
  /** Número conectado, quando já houve leitura do QR Code. */
  numero: string | null
}

type RespostaDeInstancia = {
  instance?: { instanceName?: string; state?: string; owner?: string }
  instanceName?: string
  state?: string
  owner?: string
}

function normalizar(bruto: RespostaDeInstancia): Instancia {
  const dados = bruto.instance ?? bruto
  const estado = (dados.state ?? 'close') as EstadoDaConexao

  return {
    nome: dados.instanceName ?? '',
    estado: ['open', 'connecting', 'close'].includes(estado) ? estado : 'close',
    // O Evolution devolve o dono como `5511999998888@s.whatsapp.net`.
    numero: dados.owner ? dados.owner.split('@')[0] : null,
  }
}

/**
 * Cria a instância e devolve o QR Code para leitura.
 *
 * O QR expira em ~20 segundos e o Evolution gera outro sozinho, então ele
 * **nunca é guardado** — é buscado ao vivo toda vez que a tela precisa dele.
 * Persistir um QR seria persistir algo que já nasce vencido.
 */
export async function criarInstancia(nome: string): Promise<{ qrCode: string | null }> {
  const resposta = await evolutionFetch<{ qrcode?: { base64?: string } }>(
    '/instance/create',
    {
      method: 'POST',
      body: JSON.stringify({
        instanceName: nome,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
      }),
    },
  )

  return { qrCode: resposta?.qrcode?.base64 ?? null }
}

/** Busca um QR novo para uma instância que ainda não foi conectada. */
export async function obterQrCode(nome: string): Promise<string | null> {
  const resposta = await evolutionFetch<{ base64?: string }>(
    `/instance/connect/${encodeURIComponent(nome)}`,
  )
  return resposta?.base64 ?? null
}

export async function obterEstado(nome: string): Promise<Instancia> {
  const resposta = await evolutionFetch<RespostaDeInstancia>(
    `/instance/connectionState/${encodeURIComponent(nome)}`,
  )
  return normalizar(resposta)
}

export async function listarInstancias(): Promise<Instancia[]> {
  const resposta = await evolutionFetch<RespostaDeInstancia[]>('/instance/fetchInstances')
  return (resposta ?? []).map(normalizar)
}

/** Desconecta o número sem apagar a instância — dá para reconectar depois. */
export async function desconectar(nome: string): Promise<void> {
  await evolutionFetch(`/instance/logout/${encodeURIComponent(nome)}`, { method: 'DELETE' })
}

/** Apaga a instância de vez. */
export async function apagarInstancia(nome: string): Promise<void> {
  await evolutionFetch(`/instance/delete/${encodeURIComponent(nome)}`, { method: 'DELETE' })
}

/**
 * Manda uma mensagem de texto para UM número.
 *
 * ## Por que o atraso de digitação não é enfeite
 *
 * `delay` faz o Evolution mostrar "digitando..." antes de enviar, e é uma das
 * coisas que a Meta observa para separar humano de robô: mensagem que sai no
 * milissegundo seguinte ao gatilho tem assinatura de automação. O padrão de
 * 1,2s é proporcional a uma frase curta digitada por pessoa.
 *
 * Não torna o envio seguro — só remove um sinal óbvio.
 */
export async function enviarTexto(
  instancia: string,
  numero: string,
  texto: string,
  delayMs = 1200,
): Promise<{ id: string | null }> {
  const resposta = await evolutionFetch<{ key?: { id?: string } }>(
    `/message/sendText/${encodeURIComponent(instancia)}`,
    {
      method: 'POST',
      body: JSON.stringify({
        number: numero,
        text: texto,
        delay: delayMs,
      }),
    },
  )

  return { id: resposta?.key?.id ?? null }
}

/**
 * Configura para onde o Evolution manda os eventos.
 *
 * ## Por que a lista de eventos é curta
 *
 * O Evolution oferece dezenas de eventos, incluindo `PRESENCE_UPDATE`
 * ("digitando", "online") e `CHATS_UPDATE`. Assinar tudo multiplicaria o
 * volume de webhook por 3 ou 4 sem que nada disso vire informação no CRM — só
 * custo de função e linha de dedupe.
 *
 * `MESSAGES_UPSERT` é o que importa (mensagem chegou) e
 * `CONNECTION_UPDATE` avisa quando o número cai — que é justamente o evento
 * que não pode passar despercebido numa integração não oficial.
 */
export async function configurarWebhook(instancia: string, url: string): Promise<void> {
  await evolutionFetch(`/webhook/set/${encodeURIComponent(instancia)}`, {
    method: 'POST',
    body: JSON.stringify({
      webhook: {
        enabled: true,
        url,
        byEvents: false,
        base64: false,
        events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
      },
    }),
  })
}
