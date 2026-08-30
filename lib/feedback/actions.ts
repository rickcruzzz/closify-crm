'use server'

import { headers } from 'next/headers'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUserAndWorkspace } from '@/lib/supabase/workspace'
import { feedbackSchema } from '@/lib/validations/feedback'
import { excedeuLimite } from '@/lib/rate-limit'
import { ehContaDeTeste } from '@/lib/dono/contas-internas'
import { getResend } from '@/lib/resend/client'
import { renderFeedbackRecebidoEmail } from '@/lib/emails/feedback-recebido'
import { CONTROLADOR } from '@/lib/legal'

/**
 * O relato do cliente, enviado de dentro do produto.
 *
 * ## Server Action, não Route Handler
 *
 * Aqui há sessão garantida — o diálogo só existe na área logada. A doutrina do
 * projeto reserva Route Handler para webhook e para o que acontece SEM sessão,
 * que é por que `/api/log-erro` é rota: o erro pode estourar antes de qualquer
 * login resolver.
 *
 * ## Grava com `createAdminClient`, e isso é a tabela, não um atalho
 *
 * `feedback` tem RLS ligada e ZERO policy, igual a `error_logs` e
 * `asaas_webhook_events`. Nenhum papel de usuário escreve nela; só a chave de
 * serviço. A alternativa seria criar policy por workspace, e aí o cliente
 * poderia reler o que enviou — recurso que não foi pedido e que traria uma
 * segunda doutrina de autorização para uma tabela de sistema.
 */
export async function enviarFeedback(values: unknown) {
  const parsed = feedbackSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Não foi possível enviar.' }
  }

  const { user, workspaceId, workspaces } = await getCurrentUserAndWorkspace()

  // Por USUÁRIO, não por IP: aqui sempre há alguém identificado, e limitar por
  // IP puniria um escritório inteiro pelo excesso de uma pessoa. Checado antes
  // de qualquer outra coisa, para a tentativa nem chegar ao banco.
  if (await excedeuLimite('feedback', user.id)) {
    return { error: 'Você enviou várias mensagens seguidas. Tente de novo em alguns minutos.' }
  }

  const supabase = await createClient()

  // O plano vem de `pro_vigente()`, não da coluna `workspaces.plan`.
  //
  // Aqui ele é só rótulo — decide se o assunto do e-mail diz "Pro" ou
  // "Grátis". Mesmo assim lê a função, porque a coluna é o último valor
  // gravado e não sabe que o tempo passou: um Pro vencido ontem apareceria
  // como Pro e daria ao relato uma urgência que ele não tem. E porque criar
  // aqui um lugar onde a coluna é lida convida o próximo a copiar o padrão
  // para uma REGRA — que é exatamente o defeito que a 0028 pagou.
  const { data: temPro } = await supabase.rpc('pro_vigente', { target_workspace_id: workspaceId })
  const plano = temPro ? 'pro' : 'free'

  const empresa = workspaces.find((w) => w.id === workspaceId)?.name ?? 'Empresa sem nome'
  const cabecalhos = await headers()

  // A MESMA função que a Central usa em Ativação, em Decidindo agora e no
  // `error_logs`. Escrever um filtro novo aqui repetiria o erro de 29/08, que
  // classificou 23 empresas como externas quando eram 6 — e o que torna esse
  // erro caro é que ele produz um número plausível, sem sinal de que está
  // errado até alguém conferir.
  const interno = ehContaDeTeste(user.email)

  const admin = createAdminClient()
  const { error } = await admin.from('feedback').insert({
    tipo: parsed.data.tipo,
    mensagem: parsed.data.mensagem,
    rota: parsed.data.rota ?? null,
    plano,
    user_agent: cabecalhos.get('user-agent'),
    workspace_id: workspaceId,
    user_id: user.id,
    interno,
  })

  if (error) {
    console.error('enviarFeedback: insert falhou', error)
    return { error: 'Não foi possível enviar agora. Tente de novo em instantes.' }
  }

  // ## O e-mail sai só para problema, e só de cliente
  //
  // Sugestão espera dias sem custo; problema é alguém travado e pagando. E
  // relato interno (meu ou do dono testando) não pode tocar a campainha —
  // e-mail para tudo vira ruído, e ruído treina a ignorar a caixa. Foi o que a
  // Central pagou em 20/08, com 8 de 11 alertas falsos.
  //
  // Falha aqui NÃO desfaz o insert e não vira erro na tela: o relato já está
  // guardado e aparece na Central. Devolver erro faria a pessoa reenviar e
  // duplicar um registro que chegou inteiro.
  if (parsed.data.tipo === 'problema' && !interno) {
    try {
      const { subject, html } = renderFeedbackRecebidoEmail({
        emailDoCliente: user.email ?? 'sem e-mail',
        empresa,
        plano,
        rota: parsed.data.rota ?? null,
        mensagem: parsed.data.mensagem,
      })

      // O retorno é `{ data, error }` — o SDK do Resend **não lança** em
      // falha de envio. Só o `try/catch` deixaria passar 401, domínio não
      // verificado e destinatário recusado em silêncio absoluto: o relato
      // ficaria na tabela, o dono nunca seria avisado, e nada apareceria em
      // lugar nenhum. Mesma classe do `activities.insert` sem checagem que
      // fez o webhook do WhatsApp perder mensagem em 24/08.
      //
      // Achado pela própria prova desta implementação: com a chave trocada
      // por uma inválida de propósito, o log ficou VAZIO — o que passaria por
      // "não tentou mandar" quando o certo é "tentou e falhou".
      const { error: erroDoEmail } = await getResend().emails.send({
        from: `Velo Funil <${CONTROLADOR.email}>`,
        to: CONTROLADOR.email,
        // Responder ao cliente é a ação deste e-mail: com `replyTo`, o botão
        // "Responder" do celular já vai para a pessoa certa, sem copiar
        // endereço do corpo.
        replyTo: user.email ?? undefined,
        subject,
        html,
      })

      if (erroDoEmail) {
        console.error('enviarFeedback: aviso por e-mail falhou', erroDoEmail)
      }
    } catch (err) {
      // `getResend()` lança quando a variável não existe, e a rede pode cair.
      console.error('enviarFeedback: aviso por e-mail falhou', err)
    }
  }

  return { success: true, tipo: parsed.data.tipo }
}
