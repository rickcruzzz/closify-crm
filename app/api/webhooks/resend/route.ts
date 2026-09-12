import { createHmac, timingSafeEqual } from 'node:crypto'

import { NextResponse } from 'next/server'

import { hashDoToken, tokenDeSaida } from '@/lib/prospeccao/descadastro'
import { chaveDeEmail } from '@/lib/prospeccao/opt-out'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Bounce e reclamação do Resend viram opt-out, na hora.
 *
 * ## Por que isto é mais urgente que o disparador
 *
 * Hard bounce que não sai da lista é o sinal **número um** que provedor usa
 * para classificar remetente como spammer. Um endereço morto reenviado três
 * vezes vale mais contra a reputação do domínio que cinquenta e-mails bem
 * entregues valem a favor.
 *
 * E reclamação (`email.complained`, o "marcar como spam") é pior: acima de
 * 0,3% o Gmail passa a tratar o domínio inteiro como suspeito. Sem este
 * caminho, a pessoa marca spam, continua na lista, recebe de novo — e marca de
 * novo.
 *
 * O disparador sem isto funciona e queima o domínio em dias. Por isso foi
 * escrito primeiro.
 *
 * ## A assinatura é conferida, e não é decoração
 *
 * Sem verificar, qualquer um descadastraria endereços arbitrários mandando
 * JSON para esta rota. O estrago não é grande — a lista encolhe — mas é
 * silencioso: ninguém descobre que a fila está sendo drenada.
 *
 * O Resend assina com o esquema do Svix: `svix-id.svix-timestamp.corpo`,
 * HMAC-SHA256 com o segredo em base64 depois do prefixo `whsec_`. Implementado
 * com `node:crypto` em vez de instalar a biblioteca: são dez linhas, e uma
 * dependência nova para dez linhas é dívida com juros.
 *
 * ## Ela grava as DUAS chaves quando pode
 *
 * `email:<hash>` é a chave exata, e depende do tempero — o mesmo que gera o
 * link de saída. E o `dominio`, quando derivável do endereço, porque o
 * disparador filtra pelos dois: um `contato@empresa.com.br` morto costuma
 * significar que a empresa inteira não é alcançável por e-mail.
 */

export const runtime = 'nodejs'

/** Bounce PERMANENTE e reclamação saem da lista. Bounce temporário não. */
const TIPOS = new Set(['email.bounced', 'email.complained'])

type Payload = {
  type?: string
  data?: {
    to?: string[] | string
    email_id?: string
    bounce?: { type?: string; subType?: string }
  }
}

/**
 * A assinatura do Svix confere?
 *
 * O cabeçalho `svix-signature` traz uma ou mais assinaturas separadas por
 * espaço, cada uma no formato `v1,<base64>`. Basta UMA casar — é assim que a
 * rotação de segredo funciona sem janela de indisponibilidade.
 */
function assinaturaConfere(
  segredo: string,
  id: string | null,
  timestamp: string | null,
  assinaturas: string | null,
  corpo: string,
): boolean {
  if (!id || !timestamp || !assinaturas) return false

  // O timestamp existe para impedir reenvio de um corpo capturado. Cinco
  // minutos é a janela que o próprio Svix recomenda.
  const idade = Math.abs(Date.now() / 1000 - Number(timestamp))
  if (!Number.isFinite(idade) || idade > 300) return false

  const chave = Buffer.from(segredo.replace(/^whsec_/, ''), 'base64')
  const esperada = createHmac('sha256', chave)
    .update(`${id}.${timestamp}.${corpo}`)
    .digest('base64')
  const esperadaBuffer = Buffer.from(esperada)

  return assinaturas.split(' ').some((parte) => {
    const valor = parte.split(',')[1]
    if (!valor) return false
    const recebida = Buffer.from(valor)
    if (recebida.length !== esperadaBuffer.length) return false
    return timingSafeEqual(recebida, esperadaBuffer)
  })
}

export async function POST(request: Request) {
  const segredo = process.env.RESEND_WEBHOOK_SECRET
  if (!segredo) {
    // Falha FECHADA, como o webhook da Evolution: o contrário deixaria uma
    // porta de escrita aberta enquanto alguém "ainda não configurou".
    return NextResponse.json({ erro: 'webhook não configurado' }, { status: 503 })
  }

  const corpo = await request.text()
  const confere = assinaturaConfere(
    segredo,
    request.headers.get('svix-id'),
    request.headers.get('svix-timestamp'),
    request.headers.get('svix-signature'),
    corpo,
  )
  if (!confere) {
    return NextResponse.json({ erro: 'assinatura inválida' }, { status: 401 })
  }

  let payload: Payload
  try {
    payload = JSON.parse(corpo) as Payload
  } catch {
    return NextResponse.json({ erro: 'corpo inválido' }, { status: 400 })
  }

  const tipo = payload.type ?? ''
  if (!TIPOS.has(tipo)) {
    // `email.delivered`, `email.opened` e companhia chegam pelo mesmo caminho.
    // 200 e segue: devolver erro faria o Resend penalizar a entrega, e fila de
    // webhook parada é indistinguível de "ninguém deu bounce" — o defeito que
    // o Asaas cometeu quatro vezes em nove dias.
    return NextResponse.json({ ok: true, ignorado: tipo || 'sem tipo' })
  }

  // Bounce temporário (caixa cheia, servidor fora) NÃO sai da lista: o
  // endereço é válido e amanhã entrega. Tirar por isso jogaria fora prospect
  // bom, e é o erro oposto ao que esta rota existe para evitar.
  const permanente = tipo === 'email.complained' || payload.data?.bounce?.type !== 'Transient'
  if (!permanente) {
    return NextResponse.json({ ok: true, ignorado: 'bounce temporário' })
  }

  const destinos = Array.isArray(payload.data?.to)
    ? payload.data!.to
    : payload.data?.to
      ? [payload.data.to]
      : []
  if (destinos.length === 0) {
    return NextResponse.json({ ok: true, ignorado: 'sem destinatário' })
  }

  const tempero = process.env.PROSPECCAO_TEMPERO
  const supabase = createAdminClient()
  const origem = tipo === 'email.complained' ? 'manual' : 'bounce'
  let gravados = 0

  for (const endereco of destinos) {
    const email = String(endereco).trim().toLowerCase()
    if (!email.includes('@')) continue

    // O domínio do e-mail, que é quase sempre o do site na prospecção. Ele
    // entra porque o disparador filtra pelos dois, e um endereço de papel
    // morto costuma significar a empresa inteira inalcançável.
    const dominio = email.split('@')[1] ?? null

    // Sem o tempero a chave exata não pode ser derivada. A linha é gravada
    // pelo domínio de qualquer forma — perder o bounce inteiro porque falta
    // uma variável seria trocar a proteção do domínio por configuração.
    const chave = tempero
      ? chaveDeEmail(hashDoToken(tokenDeSaida(email, tempero)))
      : dominio
        ? `dominio:${dominio}`
        : null
    if (!chave) continue

    const { error } = await supabase
      .from('descadastro_de_prospeccao')
      .upsert({ chave, dominio, origem }, { onConflict: 'chave' })
    if (!error) gravados += 1
    else console.error(`resend: nao gravei o opt-out de ${dominio}: ${error.message}`)
  }

  return NextResponse.json({ ok: true, tipo, gravados })
}
