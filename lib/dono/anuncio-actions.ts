'use server'

import { revalidatePath } from 'next/cache'

import type { ResultadoDaAcao } from './actions'
import { registrarNoDiario } from './diario'
import { CONTA_DE_ANUNCIO } from './meta-ads'
import { exigirAmbienteLocal } from './somente-local'

const VERSAO_DA_API = 'v21.0'

/**
 * As ações do dia a dia sobre uma campanha.
 *
 * ## Por que só estas três, e não criar campanha
 *
 * Pausar, despausar e mudar orçamento são **reversíveis**: clicou errado,
 * clica de volta, e o prejuízo é de minutos de veiculação. Criar campanha tem
 * uns quinze campos acoplados (objetivo, público, criativo, lance, evento de
 * conversão) onde errar um queima dinheiro em silêncio por dias — e é decisão
 * estratégica, não operação de rotina. Continua acontecendo pelo chat, onde há
 * conversa antes do clique.
 *
 * A regra que decide o que entra aqui: se o pior caso de um clique errado for
 * "desfaço agora", entra. Se for "descubro na fatura", não entra.
 */
async function escrever(
  entidadeId: string,
  campos: Record<string, string | number>,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const token = process.env.META_ADS_TOKEN
  if (!token) {
    return { ok: false, erro: 'Falta o META_ADS_TOKEN com permissão ads_management.' }
  }

  const corpo = new URLSearchParams()
  for (const [chave, valor] of Object.entries(campos)) corpo.set(chave, String(valor))

  const resposta = await fetch(`https://graph.facebook.com/${VERSAO_DA_API}/${entidadeId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: corpo,
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  })

  const json = (await resposta.json()) as { error?: { message: string }; success?: boolean }
  if (json.error) return { ok: false, erro: json.error.message }

  return { ok: true }
}

export async function pausarCampanha(
  campanhaId: string,
  nome: string,
): Promise<ResultadoDaAcao> {
  await exigirAmbienteLocal()

  const r = await escrever(campanhaId, { status: 'PAUSED' })
  if (!r.ok) return { ok: false, erro: r.erro }

  await registrarNoDiario('pausar-campanha', { campanhaId, nome, conta: CONTA_DE_ANUNCIO.id })
  revalidatePath('/dono/anuncio')

  return { ok: true, mensagem: `"${nome}" pausada. Para de gastar a partir de agora.` }
}

export async function ligarCampanha(campanhaId: string, nome: string): Promise<ResultadoDaAcao> {
  await exigirAmbienteLocal()

  const r = await escrever(campanhaId, { status: 'ACTIVE' })
  if (!r.ok) return { ok: false, erro: r.erro }

  await registrarNoDiario('ligar-campanha', { campanhaId, nome, conta: CONTA_DE_ANUNCIO.id })
  revalidatePath('/dono/anuncio')

  return { ok: true, mensagem: `"${nome}" no ar. Começa a gastar o orçamento diário.` }
}

/**
 * Muda quanto a campanha pode gastar por dia.
 *
 * O valor chega em reais (é o que a pessoa digita) e vai em centavos, que é o
 * que a API espera. Confundir as duas unidades multiplica o orçamento por cem
 * — o erro mais caro possível nesta tela, e por isso a conversão acontece num
 * lugar só, aqui.
 */
export async function mudarOrcamentoDiario(
  campanhaId: string,
  nome: string,
  reaisPorDia: number,
): Promise<ResultadoDaAcao> {
  await exigirAmbienteLocal()

  if (!Number.isFinite(reaisPorDia) || reaisPorDia <= 0) {
    return { ok: false, erro: 'O orçamento precisa ser um valor maior que zero.' }
  }

  // A Meta recusa abaixo do mínimo da conta (R$5,14 na Rickdaskin Ads), mas
  // com uma mensagem genérica. Barrar aqui explica o que aconteceu.
  if (reaisPorDia < 6) {
    return { ok: false, erro: 'A Meta não aceita orçamento diário abaixo de ~R$ 6 nesta conta.' }
  }

  const centavos = Math.round(reaisPorDia * 100)
  const r = await escrever(campanhaId, { daily_budget: centavos })
  if (!r.ok) return { ok: false, erro: r.erro }

  await registrarNoDiario('mudar-orcamento', {
    campanhaId,
    nome,
    reaisPorDia,
    conta: CONTA_DE_ANUNCIO.id,
  })
  revalidatePath('/dono/anuncio')

  return {
    ok: true,
    mensagem: `Orçamento de "${nome}" agora é R$ ${reaisPorDia.toFixed(2).replace('.', ',')} por dia.`,
  }
}
