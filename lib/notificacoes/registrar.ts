import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import type { TipoDeNotificacao } from '@/lib/notificacoes/tipos'

/**
 * O ÚNICO lugar que escreve notificação.
 *
 * ## Por que um lugar só
 *
 * É o mesmo motivo de `lib/asaas/aplicar-evento.ts` ser compartilhado entre o
 * webhook e o cron: duas cópias da mesma regra divergem na primeira mudança, e
 * a que diverge em silêncio é sempre a que ninguém está olhando. Aqui a regra é
 * "quando o produto avisa por e-mail, avisa também na tela" — se cada chamador
 * montasse o próprio `insert`, o texto do sino e o do e-mail passariam a
 * discordar sem nada falhar.
 *
 * ## Por que `createAdminClient`
 *
 * A tabela (0066) não tem policy de `insert` para `authenticated`, de
 * propósito: notificação forjável é aviso de cobrança forjável, e o PostgREST
 * fica ao lado de toda Server Action com a chave pública que está no HTML por
 * design. Escrever exige `service_role`, e por isso este módulo é
 * `server-only`.
 *
 * ## Falhar aqui NÃO derruba o chamador
 *
 * Todo chamador está no meio de algo que importa mais que o aviso: aplicar um
 * pagamento, processar um webhook, rodar o cron da assinatura. Se o `insert`
 * falhar, a pessoa perde a notificação na tela e continua recebendo o e-mail —
 * derrubar o caminho principal por causa do aviso trocaria um incômodo por um
 * defeito. Mesma decisão de `desligarNotificacoesDoCliente` no checkout,
 * registrada em 31/08.
 *
 * O erro vai para o `console.error`, que é o que o vigia de 01/09 varre.
 */
export async function registrarNotificacao(dados: {
  workspaceId: string
  tipo: TipoDeNotificacao
  titulo: string
  corpo?: string | null
  /** Caminho interno. A tabela recusa qualquer coisa que não comece com `/`. */
  href?: string | null
  /** Nulo (o padrão) = para toda a empresa. */
  userId?: string | null
}): Promise<void> {
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('notificacoes').insert({
      workspace_id: dados.workspaceId,
      user_id: dados.userId ?? null,
      tipo: dados.tipo,
      titulo: dados.titulo,
      corpo: dados.corpo ?? null,
      href: dados.href ?? null,
    })

    // Checar o `error` e não só o `catch`: o supabase-js **não lança** em falha
    // de RLS ou de constraint, devolve `{ error }`. Foi exatamente assim que um
    // `activities.insert` engoliu mensagem de WhatsApp em 24/08, e como o SDK
    // do Resend engolia falha de envio em 30/08.
    if (error) {
      console.error('Notificação não gravada', { tipo: dados.tipo, error })
    }
  } catch (erro) {
    console.error('Notificação não gravada', { tipo: dados.tipo, erro })
  }
}
