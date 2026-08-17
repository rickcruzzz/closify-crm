'use server'

import { guardarAtribuicaoUtm, type AtribuicaoUtm } from '@/lib/auth/intencao'

/**
 * Chamada pelo `components/landing/utm-capture.tsx` no primeiro carregamento
 * da landing, quando a URL trouxer `utm_*`. Fica em arquivo próprio porque
 * `lib/auth/intencao.ts` não é `'use server'`, mistura leitura e escrita de
 * cookie usada de dentro de outras Server Actions, e vira Server Action de
 * verdade só aqui, no único ponto chamado direto do client.
 */
export async function capturarUtm(utm: AtribuicaoUtm) {
  await guardarAtribuicaoUtm(utm)
}
