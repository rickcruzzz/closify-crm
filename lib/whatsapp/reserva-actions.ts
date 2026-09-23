'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { exigirAmbienteLocal } from '@/lib/dono/somente-local'
import { guardarNaReserva } from '@/lib/whatsapp/reserva'

/**
 * Cadastrar uma instância comprada na reserva.
 *
 * ## O gate é o mesmo da Central inteira, e ele é a segurança
 *
 * `exigirAmbienteLocal` devolve 404 fora de `localhost`. Sem ele, esta Server
 * Action seria um endpoint HTTP público que grava credencial de provedor: a
 * regra de que Server Action é endpoint está escrita neste projeto desde as
 * migrations 0019 a 0024, que nasceram exatamente de validação que só vivia na
 * Action.
 *
 * Aqui não há RLS para segurar atrás dele — a tabela tem zero policies e a
 * escrita é por `service_role`. O gate é a única porta, e por isso ele vem
 * ANTES de ler o payload.
 *
 * ## O `await` não é estilo, é o gate inteiro
 *
 * `exigirAmbienteLocal` é `async`. Sem o `await`, o `notFound()` rejeita uma
 * promise que ninguém observa e **a execução continua**: o schema valida e
 * `guardarNaReserva` grava a credencial do provedor. O portão roda, falha, e
 * não para nada.
 *
 * E a ação existe no build de produção mesmo com a página em 404, porque
 * `components/dono/reserva-de-instancias.tsx` a importa e o action-id é
 * emitido. Quem envenenasse a reserva entregaria uma instância controlada por
 * ele ao próximo cliente que pagasse o Max, e passaria a ler o WhatsApp desse
 * cliente.
 *
 * Nenhum dos quatro portões pega: `@typescript-eslint/no-floating-promises` é
 * type-aware e estava desligada. Ligada junto com esta correção.
 */

const reservaSchema = z.object({
  instanceId: z
    .string()
    .trim()
    .min(8, 'O ID da instância parece curto demais.')
    .max(128, 'O ID da instância parece longo demais.'),
  token: z
    .string()
    .trim()
    .min(8, 'O token parece curto demais.')
    .max(256, 'O token parece longo demais.'),
  observacao: z.string().trim().max(200, 'A anotação ficou longa demais.').optional(),
})

export async function cadastrarNaReserva(
  valores: unknown,
): Promise<{ ok: boolean; error?: string }> {
  await exigirAmbienteLocal()

  const lido = reservaSchema.safeParse(valores)
  if (!lido.success) {
    return { ok: false, error: lido.error.issues[0]?.message ?? 'Dados inválidos.' }
  }

  const guardada = await guardarNaReserva({
    instanceId: lido.data.instanceId,
    token: lido.data.token,
    observacao: lido.data.observacao,
  })

  if (!guardada.ok) return { ok: false, error: guardada.motivo }

  revalidatePath('/dono/reserva')
  return { ok: true }
}
