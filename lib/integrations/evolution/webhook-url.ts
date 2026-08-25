/**
 * A URL que o servidor Evolution vai chamar quando chegar mensagem.
 *
 * ## O defeito que isto impede, medido em 25/08
 *
 * Conectar o WhatsApp por uma máquina de desenvolvimento gravava
 * `http://localhost:3000/api/webhooks/...` como webhook da instância. O
 * servidor Evolution roda numa VPS: quando ele posta em `localhost`, bate no
 * **próprio localhost dele**, não na máquina de quem conectou.
 *
 * O resultado é o pior tipo de falha deste produto. A tela diz "conectado", o
 * `LoggedIn` é `true`, o número está pareado de verdade — e **toda mensagem
 * recebida some**, sem erro em lugar nenhum. Num produto cuja promessa é não
 * perder venda, uma conexão que parece viva e não entrega é pior que uma
 * conexão que falha na cara.
 *
 * Pior ainda: `conectarInstancia` grava o webhook em TODA conexão. Reconectar
 * de uma máquina local uma instância que estava com a URL certa **substitui a
 * boa pela morta**. Conferido em 25/08 que nenhuma instância de cliente tinha
 * sido atingida, mas o caminho existia.
 *
 * ## Por que recusar em vez de corrigir sozinho
 *
 * Apontar para produção automaticamente seria pior: quem desenvolve mandaria,
 * sem saber, as mensagens de um número de teste para dentro do banco de
 * produção. Recusar com o motivo escrito deixa a decisão com quem está no
 * teclado, e `EVOLUTION_WEBHOOK_PUBLIC_URL` é a forma de dizer "eu sei o que
 * estou fazendo".
 */

/**
 * Endereços que o servidor Evolution nunca vai alcançar a partir da VPS.
 *
 * Inclui as faixas privadas, e não só `localhost`: uma máquina de
 * desenvolvimento configurada com o próprio IP da rede (`192.168.x.x`) falha
 * exatamente do mesmo jeito e é ainda mais convincente, porque o endereço
 * "parece" externo.
 */
function ehInalcancavelDeFora(hostname: string): boolean {
  const h = hostname.toLowerCase()

  if (h === 'localhost' || h.endsWith('.localhost') || h === '::1') return true
  if (h === '0.0.0.0') return true
  if (/^127\./.test(h)) return true
  if (/^10\./.test(h)) return true
  if (/^192\.168\./.test(h)) return true
  // 172.16.0.0 até 172.31.255.255
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true
  // Link-local, que é o que aparece quando não há DHCP
  if (/^169\.254\./.test(h)) return true

  return false
}

export type ResultadoDoWebhook =
  | { ok: true; url: string }
  | { ok: false; motivo: string }

export function montarUrlDoWebhook(params: {
  /** `appUrl()`, ou o override público quando ele existir. */
  base: string
  workspaceId: string
  segredo: string | undefined
}): ResultadoDoWebhook {
  const { base, workspaceId, segredo } = params

  if (!segredo) {
    return {
      ok: false,
      motivo:
        'Falta EVOLUTION_WEBHOOK_SECRET no ambiente. Sem ele o servidor não teria como provar que a chamada é dele, e qualquer um poderia injetar mensagem no funil.',
    }
  }

  let endereco: URL
  try {
    endereco = new URL(base)
  } catch {
    return { ok: false, motivo: `Endereço da aplicação inválido: ${base}` }
  }

  if (ehInalcancavelDeFora(endereco.hostname)) {
    return {
      ok: false,
      motivo:
        `O endereço da aplicação é ${endereco.origin}, que o servidor do WhatsApp não alcança de fora — ` +
        'a conexão apareceria como ativa e nenhuma mensagem entraria. ' +
        'Para conectar daqui, defina EVOLUTION_WEBHOOK_PUBLIC_URL com um endereço público ' +
        '(o domínio de produção ou um túnel), ciente de que as mensagens deste número vão para o banco desse ambiente.',
    }
  }

  return {
    ok: true,
    url: `${endereco.origin}/api/webhooks/evolution/${encodeURIComponent(workspaceId)}/${segredo}`,
  }
}

/**
 * De onde a URL do webhook deve partir.
 *
 * `EVOLUTION_WEBHOOK_PUBLIC_URL` ganha de `appUrl()` quando existe, porque é a
 * declaração explícita de para onde as mensagens devem ir. Em produção ela não
 * é definida e `appUrl()` já é o domínio real.
 */
export function baseDoWebhook(appUrlAtual: string): string {
  return process.env.EVOLUTION_WEBHOOK_PUBLIC_URL?.trim() || appUrlAtual
}
