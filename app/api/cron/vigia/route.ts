import { timingSafeEqual } from 'node:crypto'

import { NextResponse } from 'next/server'

import {
  assuntoDoVigia,
  deveEnviar,
  leiturasQueFalharam,
  montarAlertas,
  DIAS_DE_ANTECEDENCIA_DO_TRIAL,
  HORAS_ATE_SUPORTE_VIRAR_ALERTA,
  type LeituraDoVigia,
} from '@/lib/dono/vigia'
import { renderVigiaEmail } from '@/lib/emails/vigia'
import { getResend } from '@/lib/resend/client'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * O vigia: uma varredura por dia, e um e-mail só quando há algo.
 *
 * ## Por que isto existe, e por que não é uma tela
 *
 * A Central (`/dono`) responde tudo isto e mais — e só abre em `localhost`,
 * por um gate de duas condições que protege dado pessoal de cliente sob a
 * LGPD. Publicá-la exigiria desligar esse gate.
 *
 * O vigia resolve a necessidade real sem tocar nele: em vez de uma tela que
 * alguém precisa lembrar de abrir, um e-mail que chega sozinho. E resolve
 * melhor, porque tela só informa quem foi olhar.
 *
 * ## Cada leitura é isolada, de propósito
 *
 * Cinco medições independentes, cada uma no seu `try`. Uma falha não derruba
 * as outras, e o campo fica `null` — que no vocabulário de `lib/dono/vigia.ts`
 * significa **não sei**, nunca "está zerado". A diferença já custou caro aqui:
 * em 30/08 a Central declarava R$ 490/mês de receita com R$ 0,00 real porque
 * as duas coisas tinham virado o mesmo valor.
 */
export const runtime = 'nodejs'
export const maxDuration = 60

/** Para onde o alerta vai. Não é a lista de contas internas do dono, que serve
 *  para FILTRAR métrica — misturar as duas mandaria e-mail para cinco caixas. */
const DESTINATARIO = 'notificacaosistemavelofunil@gmail.com'

function autorizado(cabecalho: string | null): boolean {
  const esperado = process.env.CRON_SECRET
  if (!cabecalho || !esperado) return false

  const prefixo = 'Bearer '
  if (!cabecalho.startsWith(prefixo)) return false

  const a = Buffer.from(cabecalho.slice(prefixo.length))
  const b = Buffer.from(esperado)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** Roda a leitura e devolve `null` se ela falhar, em vez de derrubar o resto. */
async function medir(nome: string, fn: () => Promise<number>): Promise<number | null> {
  try {
    return await fn()
  } catch (err) {
    console.error(`vigia: falhou ao ler ${nome}`, err)
    return null
  }
}

export async function GET(request: Request) {
  if (!autorizado(request.headers.get('authorization'))) {
    return NextResponse.json({ erro: 'não autorizado' }, { status: 401 })
  }

  const admin = createAdminClient()
  const agora = new Date()
  const ontem = new Date(agora.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const limiteSuporte = new Date(
    agora.getTime() - HORAS_ATE_SUPORTE_VIRAR_ALERTA * 60 * 60 * 1000,
  ).toISOString()
  const limiteTrial = new Date(
    agora.getTime() + DIAS_DE_ANTECEDENCIA_DO_TRIAL * 24 * 60 * 60 * 1000,
  ).toISOString()

  // ## As tres leituras vao em PARALELO
  //
  // Escritas como `await` em sequencia, elas eram tres idas em serie ao
  // Supabase para responder perguntas que nao dependem umas das outras — o
  // mesmo defeito que a auditoria de 19/08 corrigiu em `/settings/billing` e
  // que o layout do dashboard ja resolvia com `Promise.all`. Numa rota com
  // teto de 60s isso e folga jogada fora.
  const [errosNovos, trialsVencendo, suporteParado] = await Promise.all([
    medir('error_logs', async () => {
      const { count, error } = await admin
        .from('error_logs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', ontem)
      if (error) throw error
      return count ?? 0
    }),

    medir('trial_ate', async () => {
      const { count, error } = await admin
        .from('workspaces')
        .select('id', { count: 'exact', head: true })
        .not('trial_ate', 'is', null)
        .gte('trial_ate', agora.toISOString())
        .lte('trial_ate', limiteTrial)
      if (error) throw error
      return count ?? 0
    }),

    medir('feedback', async () => {
      // ## A fila precisa EXCLUIR conta de teste, e isto e a armadilha nº 1
      //
      // `lerFilaDeFeedback` ja faz isso na Central. Contar direto na tabela
      // repetiria o defeito de 20/08, quando 8 dos 11 alertas eram e-mails de
      // teste gerados por script — e uma fila com 70% de lixo ensina a ignorar
      // a fila inteira, junto com o alerta que importa.
      //
      // A tabela ja carrega `interno`, decidido por `ehContaDeTeste` no
      // momento da gravacao (0060). Filtrar por ele em vez de resolver o
      // e-mail aqui evita uma segunda copia da regra — e duas copias divergem
      // na primeira mudanca, com a que diverge em silencio sendo sempre a
      // escrita depois.
      const { count, error } = await admin
        .from('feedback')
        .select('id', { count: 'exact', head: true })
        .eq('interno', false)
        .lte('created_at', limiteSuporte)
        // A 0061 chama isto de `status`, com `aberto` como estado inicial —
        // nao de `tratado_em`, que foi o palpite da primeira versao. Errar a
        // coluna nao derrubou nada: a leitura virou `null` e o e-mail disse
        // que nao conferiu a fila. E o comportamento certo funcionando, e foi
        // assim que o defeito apareceu.
        .in('status', ['aberto', 'em_andamento'])
      if (error) throw error
      return count ?? 0
    }),
  ])

  const leitura: LeituraDoVigia = {
    errosNovos,
    trialsVencendo,
    suporteParado,

    // As duas do gateway ficam para uma rodada seguinte: `lerDinheiro()` já
    // existe em `lib/dono/dinheiro.ts` e é `import 'server-only'` amarrado ao
    // gate de ambiente. Trazê-lo para uma rota que roda na Vercel exige
    // separar a leitura do gate primeiro, e fazer isso às pressas é como se
    // desfaz uma trava de segurança sem perceber.
    //
    // Enquanto isso, `null` — e o e-mail diz, em texto, que não conferiu.
    // Silêncio sobre dinheiro seria pior que a ausência do dado.
    assinaturasSemPro: null,
    cobrancasVencidas: null,
  }

  const alertas = montarAlertas(leitura)
  const naoConferido = leiturasQueFalharam(leitura)

  if (!deveEnviar(leitura)) {
    return NextResponse.json({ enviado: false, motivo: 'nada a relatar' })
  }

  const dia = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
  }).format(agora)

  const { error } = await getResend().emails.send({
    from: 'Velo Funil <suporte@velofunil.com.br>',
    to: DESTINATARIO,
    subject: assuntoDoVigia(alertas, naoConferido),
    html: renderVigiaEmail({ alertas, naoConferido, dia }),
  })

  // O SDK do Resend NÃO lança em falha de envio — devolve `{ error }`. Com só
  // `try/catch`, um 401 ou domínio não verificado passaria em silêncio
  // absoluto, e o vigia ficaria mudo exatamente como o problema que ele existe
  // para evitar. Mesma classe do `activities.insert` sem checagem, de 24/08.
  if (error) {
    console.error('vigia: falha ao enviar', error)
    return NextResponse.json({ enviado: false, erro: String(error) }, { status: 500 })
  }

  return NextResponse.json({
    enviado: true,
    alertas: alertas.length,
    naoConferido: naoConferido.length,
  })
}
