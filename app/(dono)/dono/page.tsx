import { CentralClient } from '@/components/dono/central-client'
import { lerCentral } from '@/lib/dono/central'
import { exigirAmbienteLocal } from '@/lib/dono/somente-local'

/**
 * Nunca estática, nunca cacheada.
 *
 * Uma tela de monitoramento que mostra número velho é pior que não existir:
 * ela dá a sensação de estar acompanhando enquanto esconde o problema que
 * apareceu depois do último build. `force-dynamic` também garante que o gate
 * de ambiente rode a cada requisição, em vez de ser resolvido uma vez.
 */
export const dynamic = 'force-dynamic'

export default async function PaginaDaCentral() {
  await exigirAmbienteLocal()

  const dados = await lerCentral()

  return <CentralClient dados={dados} />
}
