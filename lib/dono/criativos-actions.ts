'use server'

import { revalidatePath } from 'next/cache'

import { anotarCriativo } from './criativos'
import { exigirAmbienteLocal } from './somente-local'

/**
 * Grava a anotação de uma arte.
 *
 * Server Action separada de `criativos.ts` porque aquele módulo também é
 * importado por um Server Component para LER a pasta, e um arquivo não pode ser
 * `'use server'` inteiro e exportar tipos ao mesmo tempo.
 */
export async function anotarCriativoAction(arquivo: string, nota: string): Promise<void> {
  await exigirAmbienteLocal()
  await anotarCriativo(arquivo, nota)
  revalidatePath('/dono/criativos')
}
