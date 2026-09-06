import { timingSafeEqual } from 'node:crypto'

import { NextResponse } from 'next/server'

import { enriquecerLote } from '@/lib/inteligencia-de-mercado/servico'
import { reportarErro } from '@/lib/erros/reportar'

/**
 * A fila da inteligência de mercado, uma passagem a cada 15 minutos.
 *
 * ## Por que não há fila de verdade
 *
 * O projeto não tem Redis, BullMQ nem worker — zero dependência de fila,
 * conferido no `package.json`. Introduzir uma seria a maior mudança de
 * infraestrutura do repositório, para um recurso que ainda não tem um cliente
 * pagante.
 *
 * Fila com um consumidor só é exatamente isto: uma tabela com `status =
 * 'pendente'`, um índice parcial sobre ela (0072) e um cron que puxa um lote.
 * O que muda no dia em que o volume exigir de verdade não é o `servico.ts` — é
 * só quem o chama.
 *
 * ## O corpo é curto de propósito
 *
 * Toda a decisão vive em `lib/inteligencia-de-mercado/`. Esta rota existe
 * porque o Vercel Cron só enxerga caminho dentro de `app/api/`, e nada mais.
 * Se ela crescer, é sinal de que uma regra vazou para fora do módulo.
 */
export const runtime = 'nodejs'

/**
 * Doze leads a alguns segundos cada cabe folgado em 60s. O teto explícito faz
 * a passagem falhar rápido em vez de ser cortada no meio pela plataforma — que
 * deixaria leads marcados como `pendente` tendo custado a consulta.
 */
export const maxDuration = 60

function segredoValido(cabecalho: string | null): boolean {
  const esperado = process.env.CRON_SECRET
  if (!cabecalho || !esperado) return false

  const prefixo = 'Bearer '
  if (!cabecalho.startsWith(prefixo)) return false

  // Comparação de tempo constante, como nas outras rotas de cron: comparar com
  // `===` vaza o tamanho do prefixo correto pelo tempo de resposta.
  const a = Buffer.from(cabecalho.slice(prefixo.length))
  const b = Buffer.from(esperado)
  if (a.length !== b.length) return false

  return timingSafeEqual(a, b)
}

export async function GET(requisicao: Request) {
  if (!segredoValido(requisicao.headers.get('authorization'))) {
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 })
  }

  // Sem a chave não há o que fazer, e 200 seria mentira: o cron passaria a
  // reportar sucesso todo dia enquanto nada acontece. É a mesma distinção que
  // o vigia faz entre "conferi e está zerado" e "não consegui conferir".
  if (!process.env.EXA_API_KEY) {
    return NextResponse.json(
      { erro: 'EXA_API_KEY ausente. A fila não rodou.' },
      { status: 503 },
    )
  }

  try {
    const resultado = await enriquecerLote()
    return NextResponse.json({ ok: true, ...resultado })
  } catch (erro) {
    reportarErro(erro as Error, 'global')
    return NextResponse.json({ ok: false, erro: 'Falha na passagem.' }, { status: 500 })
  }
}
