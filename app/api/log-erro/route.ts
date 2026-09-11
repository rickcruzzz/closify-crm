import { NextResponse } from 'next/server'
import { z } from '@/lib/validations/zod'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { resolverWorkspaceAtivo } from '@/lib/workspace/ativo'
import { excedeuLimite } from '@/lib/rate-limit'
import { ipDaRequisicao } from '@/lib/request-ip'
import { ehRuidoDeDesenvolvimento } from '@/lib/erros/ruido'
import { ehContaDeTeste } from '@/lib/dono/contas-internas'

export const runtime = 'nodejs'

const payloadSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  digest: z.string().trim().max(200).optional(),
  stack: z.string().trim().max(8000).optional(),
  // A árvore de componentes por NOME, que só o boundary de classe tem.
  // 8000 porque ela é mais curta que o stack minificado, mas pode ser
  // longa numa árvore profunda — e cortada no meio ela perde o nome que
  // importa, que costuma estar no topo.
  componentStack: z.string().trim().max(8000).optional(),
  url: z.string().trim().max(2000).optional(),
  origem: z.enum(['dashboard', 'funil', 'global', 'publico']),
})

/**
 * Recebe o erro que os error boundaries (`app/(dashboard)/error.tsx`,
 * `app/global-error.tsx`) hoje só jogam em `console.error`, morrendo no log
 * da Vercel. Sem autenticação exigida: o erro pode acontecer ANTES de
 * qualquer sessão resolver (ex.: falha no próprio layout raiz). Por isso
 * Route Handler, não Server Action — mesmo critério do projeto para
 * `api/webhooks/*`, reservado ao que não é fluxo normal de tela com sessão
 * garantida.
 *
 * Nunca lança erro para quem chama: uma rota de log que falha não pode virar
 * um novo erro não capturado dentro de um error boundary.
 */
export async function POST(request: Request) {
  try {
    const ip = await ipDaRequisicao()
    if (await excedeuLimite('log-erro', ip)) {
      return NextResponse.json({ ok: false }, { status: 429 })
    }

    const body = await request.json()
    const parsed = payloadSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    // **Erro de localhost não vira linha.** Em 30/08 a tabela tinha 73
    // registros e 67 vinham de `localhost:3000`, `:3979`, `:3984`, `:3985` —
    // servidores subidos durante os testes. Uma fila com 92% de ruído ensina
    // a ignorar a fila inteira, que é a lição que a Central do Dono pagou em
    // 20/08 com 8 de 11 alertas falsos.
    //
    // Vem antes de resolver a sessão de propósito: recusar cedo poupa uma ida
    // ao Supabase Auth por erro descartado, e são a maioria.
    //
    // `204` e não `400`: quem reportou não fez nada errado, e o cliente
    // (`reportarErro`) ignora a resposta de qualquer forma.
    if (ehRuidoDeDesenvolvimento(parsed.data.url)) {
      return new NextResponse(null, { status: 204 })
    }

    // Best-effort: se houver sessão válida, o log ganha workspace/usuário
    // para facilitar investigação. Se não houver (ou a resolução falhar),
    // grava mesmo assim — o registro do erro importa mais que o contexto.
    let workspaceId: string | null = null
    let userId: string | null = null
    // Marca, NUNCA descarta: foi um registro de conta interna, `origem:
    // global`, que resolveu a tela preta de 24/08. O que muda é que ele deixa
    // de se misturar com erro de cliente.
    let interno = false
    try {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        userId = user.id
        workspaceId = await resolverWorkspaceAtivo(supabase, user.id)
        // A MESMA função que a Central usa em Ativação e em Decidindo agora.
        // Uma segunda cópia da lista divergiria na primeira atualização, e as
        // três telas continuariam mostrando número plausível.
        interno = ehContaDeTeste(user.email)
      }
    } catch {
      // Sessão indisponível ou falhou ao resolver — segue sem contexto.
    }

    const admin = createAdminClient()
    const { error } = await admin.from('error_logs').insert({
      message: parsed.data.message,
      digest: parsed.data.digest ?? null,
      stack: parsed.data.stack ?? null,
      component_stack: parsed.data.componentStack ?? null,
      url: parsed.data.url ?? null,
      origem: parsed.data.origem,
      workspace_id: workspaceId,
      user_id: userId,
      interno,
    })

    if (error) {
      console.error('log-erro: insert falhou', error)
      return NextResponse.json({ ok: false }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('log-erro: falha inesperada', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
