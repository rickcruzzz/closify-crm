import 'server-only'

/**
 * O envio do aviso pela Evolution. O TEXTO mora em `aviso-whatsapp.ts`.
 *
 * A separação existe porque `server-only` impede o vitest de importar o
 * módulo, e o texto é a parte que precisa de teste. Mesmo desenho de
 * `google-ads.ts` / `google-ads-queries.ts`.
 */

/**
 * Para onde o aviso vai.
 *
 * Número do dono, com DDI, como a Evolution exige. Fica em variável de
 * ambiente com este valor como padrão porque o vigia roda na Vercel, onde
 * esquecer de configurar significaria silêncio — e silêncio é exatamente o que
 * este canal existe para acabar.
 */
const DESTINO = process.env.VIGIA_WHATSAPP_DESTINO ?? '5571985040900'

const EVOLUTION =
  process.env.EVOLUTION_BASE_URL ?? 'https://8-evolution-api.zohnng.easypanel.host'
const INSTANCIA = process.env.EVOLUTION_INSTANCIA ?? 'VELO'

/**
 * Manda o aviso. Devolve o que aconteceu em vez de lançar.
 *
 * O chamador precisa seguir para o e-mail mesmo quando isto falha, então uma
 * exceção aqui seria o mecanismo errado: ela obrigaria um `try/catch` em volta
 * que, esquecido uma vez, apagaria o aviso inteiro.
 */
export async function avisarNoWhatsapp(
  texto: string,
): Promise<{ enviado: boolean; erro?: string }> {
  const chave = process.env.EVOLUTION_API_KEY
  if (!chave) {
    // Ausência de credencial não é erro de execução: é configuração que falta,
    // e o vigia precisa continuar pelo e-mail em vez de devolver 500.
    return { enviado: false, erro: 'EVOLUTION_API_KEY não está definida' }
  }

  try {
    const r = await fetch(
      `${EVOLUTION}/message/sendText/${encodeURIComponent(INSTANCIA)}`,
      {
        method: 'POST',
        headers: { apikey: chave, 'content-type': 'application/json' },
        body: JSON.stringify({ number: DESTINO, text: texto }),
        // O cron da Vercel tem teto de execução, e a Evolution mora numa VPS
        // que já saiu do ar antes. Sem o sinal, uma VPS pendurada seguraria o
        // vigia até o timeout da função e o e-mail nunca sairia.
        signal: AbortSignal.timeout(10_000),
      },
    )
    if (!r.ok) {
      return { enviado: false, erro: `HTTP ${r.status}` }
    }
    return { enviado: true }
  } catch (e) {
    return { enviado: false, erro: e instanceof Error ? e.message : String(e) }
  }
}
