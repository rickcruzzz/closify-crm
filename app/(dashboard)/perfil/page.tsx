import type { Metadata } from 'next'

import { PageHeader } from '@/components/layout/page-header'
import { ProfileClient } from '@/components/settings/profile-client'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUserAndWorkspace } from '@/lib/supabase/workspace'

export const metadata: Metadata = { title: 'Meu perfil' }

/**
 * Dados da PESSOA, separados dos dados da EMPRESA.
 *
 * Antes "Meu perfil" e "Configurações" apontavam para a mesma tela, porque não
 * existia página de perfil, o menu oferecia dois destinos e entregava um. A
 * divisão agora segue o dono do dado: aqui ficam nome, e-mail e senha; em
 * `/settings` ficam workspace, colaboradores e plano.
 */
export default async function PerfilPage() {
  const { user } = await getCurrentUserAndWorkspace()
  const supabase = await createClient()

  const {
    data: { user: atual },
  } = await supabase.auth.getUser()

  // `identities` diz por onde a pessoa entra. Quem só tem Google não possui
  // senha, então a tela oferece "criar senha" em vez de "trocar senha", o
  // texto errado aqui faz a pessoa procurar uma senha que nunca existiu.
  const identidades = atual?.identities ?? []
  const temSenha = identidades.some((i) => i.provider === 'email')
  const provedores = identidades.map((i) => i.provider)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Meu perfil" description="Seus dados de acesso e exibição." />

      <ProfileClient
        nomeAtual={(atual?.user_metadata?.name as string | undefined) ?? ''}
        email={user.email ?? ''}
        temSenha={temSenha}
        provedores={provedores}
      />
    </div>
  )
}
