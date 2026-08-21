import { createHash } from 'node:crypto'

const GRAPH_API_VERSION = 'v21.0'

type EventoDeAtribuicao = {
  email: string
  eventId: string
  /** `fb.1.<ms>.<fbclid>`, ver components/landing/utm-capture.tsx. */
  fbc?: string | null
  /** Cookie `_fbp` do próprio Pixel. */
  fbp?: string | null
  /**
   * Telefone em qualquer formato — a Meta normaliza por conta própria
   * (documentação oficial: aceita com/sem DDI, remove pontuação). Quando
   * `null`/ausente, o campo `ph` simplesmente não entra no payload.
   */
  telefone?: string | null
  /**
   * UUID do usuário no Supabase Auth. Vira `external_id` hasheado — um
   * terceiro identificador estável que não depende de cookie nem de o
   * e-mail bater exatamente, e é o que a documentação da Meta lista junto
   * de e-mail/telefone como os três que mais elevam o Event Match Quality
   * (a métrica que decide o quanto o algoritmo reconhece a conversão e
   * consegue otimizar a entrega em cima dela).
   */
  userId?: string | null
}

/**
 * Envia um evento pra Conversions API do Meta, direto do servidor, sem
 * cookie de terceiro, sem depender do navegador de quem converteu (o
 * pagamento acontece na página hospedada do Asaas, fora do site; o registro
 * de conta é Server Action, sem requisição de navegador própria nesse
 * instante).
 *
 * `action_source: 'system_generated'` é o valor certo aqui: não existe
 * sessão de navegador associada a ESTE request específico, mas `fbc`/`fbp`,
 * quando existem (capturados na landing e persistidos no workspace, ver
 * migration 0042), continuam sendo enviados: são âncoras de identidade que
 * não dependem do request atual ter vindo de um navegador.
 *
 * E-mail é o único identificador que sempre existe, hasheado em SHA-256
 * minúsculo, como a API exige. Telefone e `external_id` entram do mesmo
 * jeito quando disponíveis — mais identificadores por evento é o que a
 * documentação da Meta aponta como o principal alavancador do Event Match
 * Quality, e Match Quality mais alto é o que faz o algoritmo aprender mais
 * rápido quem de fato converte. `fbc`/`fbp` nunca são hasheados (a API
 * espera o valor cru nesses dois campos).
 */
export function normalizarTelefone(valor: string): string {
  // A Meta documenta que aceita variação de formatação, mas recomenda
  // remover tudo que não é dígito antes de hashear — reduz a chance de duas
  // grafias do mesmo número ("(11) 99999-9999" vs "11999999999") virarem
  // hashes diferentes e nunca casarem.
  return valor.replace(/\D/g, '')
}

function sha256(valor: string): string {
  return createHash('sha256').update(valor).digest('hex')
}

async function enviarEventoParaMeta(
  eventName: 'CompleteRegistration' | 'Purchase',
  params: EventoDeAtribuicao & { customData?: Record<string, unknown> },
): Promise<void> {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID
  const token = process.env.META_CONVERSIONS_API_TOKEN

  // Sem as duas credenciais, não tem o que mandar, mesmo padrão do resto
  // do projeto: falta de env var não quebra nada, só não faz o efeito.
  if (!pixelId || !token) return

  const emailHash = sha256(params.email.trim().toLowerCase())
  const telefoneHash = params.telefone ? sha256(normalizarTelefone(params.telefone)) : null
  const externalIdHash = params.userId ? sha256(params.userId) : null

  const corpo = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: params.eventId,
        action_source: 'system_generated',
        user_data: {
          em: [emailHash],
          ...(telefoneHash ? { ph: [telefoneHash] } : {}),
          ...(externalIdHash ? { external_id: [externalIdHash] } : {}),
          ...(params.fbc ? { fbc: params.fbc } : {}),
          ...(params.fbp ? { fbp: params.fbp } : {}),
        },
        ...(params.customData ? { custom_data: params.customData } : {}),
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
      console.error(`Meta Conversions API: falha ao enviar ${eventName}`, res.status, texto)
    }
  } catch (err) {
    console.error(`Meta Conversions API: erro ao enviar ${eventName}`, err)
  }
}

/**
 * "Purchase", disparado quando o webhook do Asaas confirma pagamento de
 * verdade (app/api/webhooks/asaas/route.ts). `event_id` vem do id de evento
 * do próprio webhook, que já é único por natureza do dedupe existente.
 */
export async function enviarConversaoDeCompra(
  params: EventoDeAtribuicao & { valor: number },
): Promise<void> {
  await enviarEventoParaMeta('Purchase', {
    ...params,
    customData: { currency: 'BRL', value: params.valor },
  })
}

/**
 * "CompleteRegistration", disparado quando a empresa nasce de verdade
 * (lib/onboarding/actions.ts, finalizarOnboarding), pra toda conta, Pro ou
 * Free. Existe porque mandar só o Purchase falha em ciclo de venda que não
 * é instantâneo (Pix/boleto levam horas, e o produto é Free-primeiro): sem
 * um evento intermediário, o clique original pode já ter saído da janela
 * de atribuição quando o pagamento finalmente confirma.
 */
export async function enviarConversaoDeRegistro(params: EventoDeAtribuicao): Promise<void> {
  await enviarEventoParaMeta('CompleteRegistration', params)
}
