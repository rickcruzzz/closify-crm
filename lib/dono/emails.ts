import 'server-only'

import { exigirAmbienteLocal } from './somente-local'
import type { EmailEnviado, Resultado } from './tipos'

type RespostaDoResend = {
  data: {
    id: string
    to: string[]
    subject: string
    created_at: string
    last_event: string
  }[]
}

/**
 * Os últimos e-mails transacionais e se eles chegaram.
 *
 * ## Por que isso importa o bastante para estar na Central
 *
 * Todo caminho crítico deste produto passa por e-mail: confirmação de cadastro,
 * recuperação de senha, convite de colaborador, aviso de pagamento. Um e-mail
 * que não chega não gera erro em lugar nenhum — a pessoa simplesmente não volta,
 * e isso é indistinguível de desistência. O Resend sabe a diferença
 * (`last_event`), e até agora ninguém estava olhando.
 *
 * O SDK do Resend não expõe listagem de e-mails enviados, só envio, então aqui
 * é `fetch` direto na REST API — mesmo padrão de `scripts/verificar-ambiente.mjs`,
 * que também fala com serviços externos por HTTP cru quando o SDK não cobre.
 */
export async function lerEmails(limite = 25): Promise<Resultado<EmailEnviado[]>> {
  await exigirAmbienteLocal()

  const chave = process.env.RESEND_API_KEY
  if (!chave) {
    return { ok: false, erro: 'RESEND_API_KEY não está no .env.local.' }
  }

  try {
    const resposta = await fetch(`https://api.resend.com/emails?limit=${limite}`, {
      headers: { Authorization: `Bearer ${chave}` },
      cache: 'no-store',
      // Sem teto, um Resend degradado prende a página inteira. Os outros
      // blocos não dependem deste e não têm por que esperar por ele.
      signal: AbortSignal.timeout(10_000),
    })

    if (!resposta.ok) {
      return { ok: false, erro: `Resend respondeu ${resposta.status}.` }
    }

    const corpo = (await resposta.json()) as RespostaDoResend

    return {
      ok: true,
      dados: corpo.data.map((email) => ({
        id: email.id,
        para: email.to[0] ?? '(sem destinatário)',
        assunto: email.subject,
        enviadoEm: email.created_at,
        ultimoEvento: email.last_event,
        // Só `delivered` conta como chegou. `sent` significa que saiu daqui e
        // ainda não há confirmação do servidor do destinatário — o que é
        // normal por alguns segundos e suspeito depois de alguns minutos.
        chegou: email.last_event === 'delivered',
      })),
    }
  } catch (err) {
    return {
      ok: false,
      erro: err instanceof Error ? err.message : 'Não consegui falar com o Resend.',
    }
  }
}
