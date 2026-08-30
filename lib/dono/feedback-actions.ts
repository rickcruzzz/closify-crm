'use server'

import { revalidatePath } from 'next/cache'

import { createAdminClient } from '@/lib/supabase/admin'
import type { StatusDeFeedback } from '@/types/supabase'

import { registrarNoDiario } from './diario'
import { exigirAmbienteLocal } from './somente-local'
import type { ResultadoDaAcao } from './actions'

/**
 * O acompanhamento de um relato, na Central de Suporte.
 *
 * ## Por que o estado saiu do arquivo local e foi para o banco
 *
 * Antes o único gesto era "Já tratei", guardado em `.dono-silenciados.json` —
 * uma preferência de máquina, fora do Git. Isso funcionava para alerta gerado
 * pelo sistema, que se repete sozinho no dia seguinte se o problema persistir.
 *
 * Relato de gente é diferente: é escrito uma vez, e a decisão sobre ele é a
 * única informação que sobra. Guardar isso num arquivo local significa perder
 * ao trocar de máquina — e perder junto o motivo pelo qual algo NÃO foi feito,
 * que é o que se quer reler quando a mesma coisa for pedida de novo por outra
 * pessoa seis meses depois.
 *
 * Toda ação vai também para o diário (`.dono-registro.jsonl`), pelo mesmo
 * motivo que liberar Pro de cortesia vai: decisão que mexe em cliente e só
 * existe no terminal some quando a janela fecha.
 */
export async function mudarStatusDoRelato(
  id: string,
  status: StatusDeFeedback,
): Promise<ResultadoDaAcao> {
  await exigirAmbienteLocal()

  const admin = createAdminClient()

  // `resolvido_em` acompanha o status em vez de ser preenchido à parte: os
  // dois PRECISAM concordar, e deixar a data por conta de quem chama é como
  // nasce a linha "resolvido" sem data e a linha "aberto" com data de
  // resolução.
  const { error } = await admin
    .from('feedback')
    .update({
      status,
      resolvido_em:
        status === 'resolvido' || status === 'descartado' ? new Date().toISOString() : null,
    })
    .eq('id', id)

  if (error) {
    console.error('mudarStatusDoRelato falhou', error)
    return { ok: false, erro: 'Não foi possível mudar o status.' }
  }

  await registrarNoDiario('feedback_status', { id, status })
  revalidatePath('/dono/suporte')
  return { ok: true, mensagem: `Marcado como ${ROTULO[status]}.` }
}

const ROTULO: Record<StatusDeFeedback, string> = {
  aberto: 'aberto',
  em_andamento: 'em andamento',
  resolvido: 'resolvido',
  descartado: 'descartado',
}

/**
 * O que foi feito sobre o relato.
 *
 * Texto livre porque a resposta útil é uma frase — "era cache do navegador,
 * pedi para limpar" —, não um campo estruturado. Campo estruturado obrigaria a
 * escolher entre categorias inventadas antes de existir um único relato real
 * para calibrá-las.
 */
export async function registrarSolucao(id: string, solucao: string): Promise<ResultadoDaAcao> {
  await exigirAmbienteLocal()

  const texto = solucao.trim()
  if (texto.length === 0) {
    return { ok: false, erro: 'Escreva o que foi feito.' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('feedback')
    .update({ solucao: texto.slice(0, 4000) })
    .eq('id', id)

  if (error) {
    console.error('registrarSolucao falhou', error)
    return { ok: false, erro: 'Não foi possível salvar.' }
  }

  await registrarNoDiario('feedback_solucao', { id })
  revalidatePath('/dono/suporte')
  return { ok: true, mensagem: 'Solução registrada.' }
}
