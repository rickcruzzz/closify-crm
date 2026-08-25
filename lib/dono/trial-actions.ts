'use server'

import { revalidatePath } from 'next/cache'

import { desmarcarContato, marcarComoFalado } from './contatos-do-trial'
import { registrarNoDiario } from './diario'
import { exigirAmbienteLocal } from './somente-local'
import type { ResultadoDaAcao } from './actions'

/**
 * Marca que o dono falou com uma empresa em trial.
 *
 * Vai para o diário pela mesma razão que liberar Pro de cortesia vai: daqui a
 * um mês, quando essa empresa tiver assinado ou sumido, a única pergunta que
 * importa é *o contato mudou alguma coisa?* — e ela só tem resposta se a data
 * de cada toque estiver escrita em algum lugar que sobreviva ao fechamento do
 * terminal.
 */
export async function marcarQueFalei(
  workspaceId: string,
  nome: string,
): Promise<ResultadoDaAcao> {
  await exigirAmbienteLocal()

  await marcarComoFalado(workspaceId)
  await registrarNoDiario('falei-com-trial', { workspaceId, nome })

  revalidatePath('/dono/trial')
  return { ok: true, mensagem: `Anotado: você falou com ${nome}.` }
}

/** Desfaz a marcação. Marcar sem poder desmarcar é o mesmo que errar de vez. */
export async function desmarcarQueFalei(
  workspaceId: string,
  nome: string,
): Promise<ResultadoDaAcao> {
  await exigirAmbienteLocal()

  await desmarcarContato(workspaceId)
  await registrarNoDiario('desmarquei-contato-de-trial', { workspaceId, nome })

  revalidatePath('/dono/trial')
  return { ok: true, mensagem: `${nome} voltou para a fila.` }
}
