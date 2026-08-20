import type { Metadata } from 'next'

import { Navegacao } from '@/components/dono/navegacao'
import { Toaster } from '@/components/ui/sonner'
import { contarAlertasAbertos } from '@/lib/dono/contador'
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
 * ## Por que a navegação e o Toaster moram AQUI, e não em cada página
 *
 * Porque o layout não é re-renderizado durante a navegação — ele persiste
 * enquanto o `loading.tsx` da rota de destino aparece. Com a navegação dentro
 * de cada página, ela sumia da tela durante o carregamento (medido: 1,7s na
 * rota de alertas), e a pessoa ficava sem como voltar ou trocar de ideia
 * justamente durante a espera. Achado clicando de verdade, não em teoria.
 *
 * O `Toaster` segue a mesma lógica: uma ação disparada numa página não pode
 * perder a confirmação porque a página trocou.
 *
 * O `exigirAmbienteLocal()` aqui é a primeira das três camadas — a página e
 * cada leitura repetem a checagem. Redundante por escolha: no layout, a
 * proteção depende do Next executar este componente antes de renderizar os
 * filhos, e não vale apostar a base de clientes inteira num detalhe de ordem
 * de execução do framework.
 */
export default async function LayoutDaCentral({ children }: { children: React.ReactNode }) {
  await exigirAmbienteLocal()

  // O contador do menu vem de uma consulta própria e barata (uma contagem no
  // banco), NÃO de `lerCentral()`: o layout roda em toda navegação, e fazê-lo
  // falar com Asaas, Resend e Meta a cada clique somaria mais de um segundo a
  // páginas que não precisam desse dado. É a mesma lição do layout do produto,
  // onde consultas em série no caminho quente foram a causa do lag de
  // navegação.
  const alertas = await contarAlertasAbertos()

  return (
    <div className="bg-background min-h-dvh">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
        <Navegacao alertas={alertas} />
        {children}
      </div>
      <Toaster />
    </div>
  )
}
