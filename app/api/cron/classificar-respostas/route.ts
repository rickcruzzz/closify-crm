import { timingSafeEqual } from 'node:crypto'

import { NextResponse } from 'next/server'

import { classificarRespostasPendentes } from '@/lib/prospeccao/classificar-pendentes'

/**
 * FASE 2: a resposta que chegou vira categoria comparável.
 *
 * ## Por que cron, e não dentro do webhook
 *
 * O webhook tem que ser rápido: ele valida, persiste e responde. Pendurar uma
 * chamada à OpenAI ali dentro amarraria a gravação da mensagem ao tempo de
 * resposta de um terceiro — e quando a OpenAI engasgasse, a Evolution veria
 * timeout, reentregaria, e a fila dela penalizaria o endereço. É exatamente o
 * caminho pelo qual o webhook do Asaas ficou `interrupted` quatro vezes em
 * nove dias.
 *
 * Separado, o pior caso é uma classificação atrasada. A mensagem já está no
 * banco e o dono já foi avisado no WhatsApp no segundo em que ela chegou.
 *
 * ## De hora em hora, aos :15
 *
 * Deslocado do vigia (:00) e de `vigiar_o_vigia` (:30) pela mesma razão
 * registrada lá: três tarefas na mesma marca disputam a mesma janela.
 *
 * **Fila vazia não custa nada.** Sem mensagem pendente não há chamada à
 * OpenAI — só uma consulta ao Supabase. É o que torna aceitável agendar isto
 * antes de existirem respostas em volume: quando elas vierem, já estará
 * rodando, em vez de esperar alguém lembrar.
 *
 * ## O que ela NÃO faz
 *
 * Não responde ninguém. O agente SDR continua desligado e esta rota não o
 * chama. Fase 2 é classificação sem envio — a ordem pedida é capture, meça,
 * compare, só então otimize.
 */

export const runtime = 'nodejs'

/**
 * Sessenta segundos. O teto por rodada é de 20 mensagens e cada chamada leva
 * ~1s, então a folga é grande — e se passar disso o problema é outro (fila
 * represada, OpenAI lenta) e falhar rápido expõe isso em vez de esconder.
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

  if (!process.env.OPENAI_API_KEY) {
    // Não é erro de execução: é configuração ausente. 200 com o motivo escrito
    // para o vigia não passar a acusar um cron quebrado que só não tem chave.
    return NextResponse.json({ ok: true, pulado: 'OPENAI_API_KEY ausente' })
  }

  const resultado = await classificarRespostasPendentes({ teto: 20 })
  return NextResponse.json({ ok: true, ...resultado })
}
