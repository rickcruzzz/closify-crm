import type { Metadata } from 'next'

import { exigirAmbienteLocal } from '@/lib/dono/somente-local'

export const metadata: Metadata = {
  title: 'Central do Dono',
  // Mesmo que a rota nunca exista em produção, deixar explícito: nada aqui
  // deve ser indexado nem seguido, em nenhuma circunstância.
  robots: { index: false, follow: false },
}

/**
 * A Central do Dono não usa o layout do produto de propósito.
 *
 * Ela não é uma tela do CRM: não tem barra lateral, não tem seletor de
 * empresa, não tem sessão de usuário. É o painel de quem opera o negócio
 * inteiro, e misturá-la com a navegação do produto convidaria exatamente a
 * confusão que o gate de ambiente existe para evitar.
 *
 * O `exigirAmbienteLocal()` aqui é a primeira das três camadas — a página e
 * cada leitura repetem a checagem. Redundante por escolha: no layout, a
 * proteção depende do Next executar este componente antes de renderizar os
 * filhos, e não vale apostar a base de clientes inteira num detalhe de ordem
 * de execução do framework.
 */
export default async function LayoutDaCentral({ children }: { children: React.ReactNode }) {
  await exigirAmbienteLocal()

  return (
    <div className="bg-background min-h-dvh">
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-6 md:py-8">{children}</div>
    </div>
  )
}
