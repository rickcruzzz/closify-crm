import { createHash } from 'node:crypto'

const GRAPH_API_VERSION = 'v21.0'

/**
 * Manda o evento de "Purchase" pra Conversions API do Meta, direto do
 * servidor — sem cookie de terceiro, sem depender do navegador de quem
 * pagou (o pagamento acontece na página hospedada do Asaas, fora do site).
 *
 * `action_source: 'system_generated'` é o valor certo aqui: não existe
 * sessão de navegador associada a este evento (é o webhook do Asaas
 * chamando, não um clique na tela) — usar 'website' sem `client_ip_address`/
 * `fbc` de verdade prejudicaria a qualidade do match sem ganhar nada.
 *
 * E-mail é o único identificador que sempre existe aqui (é pra quem a
 * cobrança foi emitida) — hasheado em SHA-256 minúsculo, como a API exige.
 *
 * `event_id` existe pra dedupe do lado do Meta: se este evento e um
 * eventual Pixel do navegador (que não manda Purchase hoje, só PageView)
 * um dia mandarem o mesmo `event_id`, o Meta conta uma vez só.
 */
export async function enviarConversaoDeCompra(params: {
  email: string
  valor: number
  eventId: string
}): Promise<void> {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID
  const token = process.env.META_CONVERSIONS_API_TOKEN

  // Sem as duas credenciais, não tem o que mandar — mesmo padrão do resto
  // do projeto: falta de env var não quebra nada, só não faz o efeito.
  if (!pixelId || !token) return

  const emailHash = createHash('sha256').update(params.email.trim().toLowerCase()).digest('hex')

  const corpo = {
    data: [
      {
        event_name: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        event_id: params.eventId,
        action_source: 'system_generated',
        user_data: { em: [emailHash] },
        custom_data: { currency: 'BRL', value: params.valor },
      },
    ],
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${pixelId}/events?access_token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      },
    )

    if (!res.ok) {
      const texto = await res.text()
      console.error('Meta Conversions API: falha ao enviar evento', res.status, texto)
    }
  } catch (err) {
    console.error('Meta Conversions API: erro ao enviar evento', err)
  }
}
