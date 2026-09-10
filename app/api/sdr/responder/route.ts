import { NextResponse } from 'next/server'
import { z } from 'zod'

import {
  instrucoesDoAgente,
  limparResposta,
  pediuPassagem,
} from '@/lib/sdr/instrucoes'

export const runtime = 'nodejs'

/**
 * O agente SDR, exposto para o n8n.
 *
 * ## Por que o cérebro fica AQUI e não no n8n
 *
 * O reflexo é colar o prompt num nó de "AI Agent" do n8n e pronto. Isso cria
 * uma segunda cópia do preço, dos limites e da lista do que o produto não faz —
 * e cópia que diverge em silêncio é a classe de defeito mais cara deste
 * projeto. Já custou: `price: 'R$49'` escrito à mão ao lado da linha que lia a
 * constante; a arte anunciando trial aposentado dois dias antes; a bio do
 * Instagram com limite de 300 contatos meses depois de virar 50.
 *
 * Um prompt no n8n seria a pior das três, porque ninguém revisa JSON de
 * workflow ao mudar preço — e o agente que erra o preço erra numa conversa de
 * venda, com o cliente lendo.
 *
 * Aqui, `instrucoesDoAgente()` deriva tudo de `lib/plans.ts` em tempo de
 * chamada. Trocar `PRO_PLAN_PRICE` atualiza o agente sem tocar no n8n.
 *
 * **O n8n orquestra: recebe do WhatsApp, chama esta rota, devolve a resposta e
 * avisa o dono. Ele não decide o que dizer.**
 *
 * ## O gate é segredo compartilhado, não sessão
 *
 * Quem chama é um servidor (a VPS), não uma pessoa logada. Mesmo padrão do
 * `CRON_SECRET` que já protege as rotas de cron: cabeçalho com segredo, e 401
 * sem ele. Sem gate, esta rota seria um proxy de OpenAI aberto na internet —
 * qualquer um gastaria a chave do dono.
 */

const entrada = z.object({
  /** O que a pessoa escreveu agora. */
  mensagem: z.string().trim().min(1).max(4000),
  /** Nome da empresa, quando a prospecção sabe. */
  empresa: z.string().trim().max(120).optional().nullable(),
  /** Nicho, para o agente falar a língua certa. */
  vertical: z.string().trim().max(60).optional().nullable(),
  /** O bloco já montado por `lib/sdr/enriquecer.ts`. Opcional. */
  pesquisa: z.string().trim().max(4000).optional().nullable(),
  /**
   * A conversa até agora, do mais antigo ao mais novo.
   *
   * Teto de 20 turnos: o suficiente para o agente lembrar o que foi dito, e
   * curto o bastante para uma conversa longa não virar prompt de dez mil
   * tokens a cada mensagem nova.
   */
  historico: z
    .array(z.object({ de: z.enum(['cliente', 'agente']), texto: z.string().max(4000) }))
    .max(20)
    .optional(),
})

const MODELO = 'gpt-4.1'

export async function POST(req: Request) {
  const segredo = process.env.SDR_WEBHOOK_SECRET
  if (!segredo) {
    // Falha fechada. Sem o segredo configurado, a rota não responde — o
    // contrário deixaria a chave da OpenAI aberta enquanto alguém "ainda não
    // configurou".
    return NextResponse.json({ error: 'agente não configurado' }, { status: 503 })
  }
  if (req.headers.get('authorization') !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }

  const chave = process.env.OPENAI_API_KEY
  if (!chave) {
    return NextResponse.json({ error: 'OPENAI_API_KEY ausente' }, { status: 503 })
  }

  let corpo: unknown
  try {
    corpo = await req.json()
  } catch {
    return NextResponse.json({ error: 'corpo inválido' }, { status: 400 })
  }

  const lido = entrada.safeParse(corpo)
  if (!lido.success) {
    return NextResponse.json(
      { error: lido.error.issues[0]?.message ?? 'dados inválidos' },
      { status: 400 },
    )
  }

  const { mensagem, empresa, vertical, pesquisa, historico } = lido.data

  const mensagens = [
    { role: 'system' as const, content: instrucoesDoAgente({ empresa, vertical, pesquisa }) },
    ...(historico ?? []).map((h) => ({
      role: h.de === 'cliente' ? ('user' as const) : ('assistant' as const),
      content: h.texto,
    })),
    { role: 'user' as const, content: mensagem },
  ]

  let resposta: Response
  try {
    resposta = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODELO,
        messages: mensagens,
        // Curto de propósito. É WhatsApp: resposta longa não é lida, e o teto
        // é mais confiável que pedir brevidade no prompt.
        max_tokens: 300,
        // 0.7 e não 0: o agente precisa soar como gente. Determinístico demais
        // produz a mesma frase para todo mundo, que é o que denuncia robô.
        temperature: 0.7,
      }),
    })
  } catch {
    return NextResponse.json({ error: 'falha ao falar com a OpenAI' }, { status: 502 })
  }

  if (!resposta.ok) {
    return NextResponse.json(
      { error: `openai ${resposta.status}` },
      { status: resposta.status === 429 ? 429 : 502 },
    )
  }

  const dados = (await resposta.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const bruta = dados.choices?.[0]?.message?.content?.trim() ?? ''

  if (!bruta) {
    // Resposta vazia é pior que erro: o n8n mandaria uma mensagem em branco
    // para o cliente. Vira passagem para o dono.
    return NextResponse.json({ texto: '', passar: true, motivo: 'resposta vazia' })
  }

  return NextResponse.json({
    texto: limparResposta(bruta),
    passar: pediuPassagem(bruta),
    modelo: MODELO,
  })
}
