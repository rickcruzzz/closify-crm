import 'server-only'

/**
 * O envio da resposta automática para o PROSPECT.
 *
 * Irmão de `lib/dono/aviso-whatsapp-envio.ts`, e separado dele de propósito:
 * aquele manda para um destino fixo, o número do dono, e este manda para
 * terceiro. Reaproveitar a mesma função com o destino virando parâmetro faria
 * um erro de chamada mandar aviso interno para cliente, e esse é o tipo de
 * defeito que só aparece depois de sair.
 *
 * Devolve o que aconteceu em vez de lançar, pelo mesmo motivo do irmão: o
 * webhook precisa responder 200 e seguir mesmo quando a Evolution está fora
 * do ar. Lançar faria a Evolution reentregar um evento cuja mensagem já está
 * gravada, e a única consequência seria ruído.
 */

const EVOLUTION =
  process.env.EVOLUTION_BASE_URL ?? 'https://8-evolution-api.zohnng.easypanel.host'
const INSTANCIA = process.env.EVOLUTION_INSTANCIA ?? 'VELO'

export async function responderProspect(
  telefone: string,
  texto: string,
): Promise<{ enviado: boolean; erro?: string }> {
  const chave = process.env.EVOLUTION_API_KEY
  if (!chave) return { enviado: false, erro: 'EVOLUTION_API_KEY não está definida' }

  try {
    const r = await fetch(`${EVOLUTION}/message/sendText/${encodeURIComponent(INSTANCIA)}`, {
      method: 'POST',
      headers: { apikey: chave, 'content-type': 'application/json' },
      body: JSON.stringify({ number: telefone, text: texto }),
      // A Evolution mora numa VPS que já saiu do ar. Sem o sinal, uma VPS
      // pendurada seguraria o webhook até o timeout da função, e a Evolution
      // reentregaria o mesmo evento achando que falhou.
      signal: AbortSignal.timeout(10_000),
    })
    if (!r.ok) return { enviado: false, erro: `HTTP ${r.status}` }
    return { enviado: true }
  } catch (e) {
    return { enviado: false, erro: e instanceof Error ? e.message : String(e) }
  }
}
