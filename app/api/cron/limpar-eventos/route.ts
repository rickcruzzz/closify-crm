import { timingSafeEqual } from 'node:crypto'

import { NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Apaga os eventos de webhook velhos, uma vez por dia.
 *
 * ## Por que isto precisa existir
 *
 * As tabelas de dedupe só crescem. Elas guardam um id por evento processado,
 * para não aplicar o mesmo webhook duas vezes — informação que perde o valor
 * assim que a janela de retry do fornecedor passa.
 *
 * Com o Asaas isso nunca doeu: são poucas linhas por assinatura por mês. Com o
 * WhatsApp muda de ordem de grandeza — 400 clientes conversando geram mais
 * eventos em um dia que o Asaas na vida inteira do projeto. Projetado a 240 mil
 * eventos/dia, a tabela de dedupe sozinha chegaria a **9,7 GB em 12 meses** e
 * estouraria os 8 GB do plano do Supabase em ~9 meses, guardando dado que não
 * responde pergunta nenhuma.
 *
 * ## Por que Vercel Cron e não pg_cron
 *
 * `purge_old_asaas_webhook_events()` existe desde a migration 0014 e **nunca
 * foi agendada** — o comentário de lá dizia que o agendamento dependia da
 * extensão `pg_cron`. Não depende: o projeto já tem Vercel Cron rodando
 * (`vercel.json`) e um handler autenticado por `CRON_SECRET`. Esta rota liga
 * uma função que estava pronta e parada há semanas.
 */
export const runtime = 'nodejs'

/**
 * Teto explícito: um `delete` de milhões de linhas pode demorar, mas se passar
 * de um minuto o problema é outro (falta índice, ou a janela de retenção ficou
 * grande demais) e falhar rápido expõe isso em vez de esconder.
 */
export const maxDuration = 60

function segredoValido(cabecalho: string | null): boolean {
  const esperado = process.env.CRON_SECRET
  if (!cabecalho || !esperado) return false

  const prefixo = 'Bearer '
  if (!cabecalho.startsWith(prefixo)) return false

  const a = Buffer.from(cabecalho.slice(prefixo.length))
  const b = Buffer.from(esperado)
  if (a.length !== b.length) return false

  return timingSafeEqual(a, b)
}

export async function GET(requisicao: Request) {
  if (!segredoValido(requisicao.headers.get('authorization'))) {
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 })
  }

  const admin = createAdminClient()

  // As duas em paralelo: são tabelas independentes e nenhuma depende do
  // resultado da outra.
  const [asaas, whatsapp, erros, feedback] = await Promise.all([
    admin.rpc('purge_old_asaas_webhook_events'),
    admin.rpc('purge_old_whatsapp_webhook_events'),
    // `error_logs` era a única tabela de sistema sem purga, e tem o mesmo
    // desenho das outras duas: linha de texto que só cresce. A 0047 nasceu
    // com purga por uma conta explícita — 9,7 GB em 12 meses a 400 clientes;
    // esta faltava fazer.
    admin.rpc('purge_old_error_logs'),
    // `feedback` (0060) nasceu JÁ com purga, em vez de esperar catorze
    // migrations como a `error_logs` esperou. A janela dela é maior de
    // propósito — um ano para relato de cliente, contra 90 dias do erro
    // técnico: erro de três meses atrás não responde mais nada, mas "cinco
    // pessoas pediram exportação em CSV" continua sendo a razão de construir
    // a funcionalidade um ano depois.
    admin.rpc('purge_old_feedback'),
  ])

  // Uma falhar não pode impedir a outra de ter rodado: o retorno reporta as
  // quatro separadamente para o problema aparecer no log em vez de sumir.
  if (asaas.error) console.error('Purga do Asaas falhou', asaas.error)
  if (whatsapp.error) console.error('Purga do WhatsApp falhou', whatsapp.error)
  if (erros.error) console.error('Purga de error_logs falhou', erros.error)
  if (feedback.error) console.error('Purga de feedback falhou', feedback.error)

  return NextResponse.json({
    ok: !asaas.error && !whatsapp.error && !erros.error && !feedback.error,
    apagados: {
      asaas: asaas.data ?? null,
      whatsapp: whatsapp.data ?? null,
      erros: erros.data ?? null,
      feedback: feedback.data ?? null,
    },
  })
}
