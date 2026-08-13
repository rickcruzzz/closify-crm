import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/page-header'
import { EmpresaCard } from '@/components/settings/empresa-card'
import { urlDaLogo } from '@/lib/workspace/empresa'
import { MembersCard } from '@/components/settings/members-card'
import { PlanCard } from '@/components/settings/plan-card'
import { DeleteAccountCard } from '@/components/settings/delete-account-card'
import { IntegrationsTab } from '@/components/settings/integrations-tab'
import {
  SettingsTabs,
  type AbaDeConfiguracoes,
} from '@/components/settings/settings-tabs'
import { getCurrentUserAndWorkspace } from '@/lib/supabase/workspace'
import { createClient } from '@/lib/supabase/server'
import {
  getWorkspaceSettingsData,
  getWorkspacesExclusivosDoUsuario,
} from '@/lib/workspace/queries'
import { getIntegrationConnections, getUsoDasIntegracoes } from '@/lib/integrations/queries'

export const metadata: Metadata = { title: 'Configurações' }

const ABAS_VALIDAS: AbaDeConfiguracoes[] = ['empresa', 'equipe', 'plano', 'integracoes']

/**
 * Configurações em três abas, na mesma rota.
 *
 * Antes eram quatro cards empilhados — empresa com dezoito campos, membros,
 * plano e excluir conta —, e chegar ao plano exigia rolar por todo o cadastro
 * da empresa.
 *
 * A aba vive em `?aba=`, não em estado de cliente: recarregar mantém o lugar,
 * dá para mandar o link de uma aba a um colega, e o botão de voltar funciona.
 */
const MENSAGEM_DE_ERRO_DA_INTEGRACAO: Record<string, string> = {
  provider_invalido: 'Integração desconhecida.',
  somente_admin: 'Apenas administradores podem conectar integrações.',
  cancelado: 'Conexão cancelada — nada foi alterado.',
  parametros_ausentes: 'O Google não devolveu os dados esperados. Tente conectar de novo.',
  state_invalido: 'O link de conexão expirou ou é inválido. Tente conectar de novo.',
  falha_ao_conectar: 'Não foi possível concluir a conexão. Tente de novo em instantes.',
}

const NOME_DA_INTEGRACAO: Record<string, string> = {
  google_calendar: 'Google Calendar',
  gmail: 'Gmail',
  whatsapp: 'WhatsApp',
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; conectado?: string; erro?: string }>
}) {
  const params = await searchParams
  const { user, workspaceId } = await getCurrentUserAndWorkspace()

  // Único lugar que ainda sincroniza `workspaces.plan` com a validade real da
  // assinatura — saiu do caminho quente (`getCurrentUserAndWorkspace`, que
  // roda em toda navegação) porque era uma ESCRITA a cada tela. Aqui é onde a
  // pessoa de fato olha o próprio plano, e o rótulo "Free/Pro" merece estar em
  // dia. Os LIMITES não dependem disto: consultam `pro_vigente()` direto no
  // banco, então plano vencido é barrado na hora mesmo com o rótulo atrasado.
  const supabase = await createClient()
  await supabase.rpc('sincronizar_plano_do_workspace', { target_workspace_id: workspaceId })

  const { workspace, members, invites } = await getWorkspaceSettingsData(workspaceId)

  const aba: AbaDeConfiguracoes = ABAS_VALIDAS.includes(params.aba as AbaDeConfiguracoes)
    ? (params.aba as AbaDeConfiguracoes)
    : 'empresa'

  const currentMember = members.find((m) => m.user_id === user.id)
  const isAdmin = currentMember?.role === 'admin'

  // Mesma regra da RPC `excluir_minha_conta`: workspace com um único membro
  // morre junto da conta. Listado no diálogo para a pessoa ver o que perde —
  // ela costuma pensar só na própria conta e esquecer dos dados dos clientes
  // que estão lá dentro.
  const workspacesQueSeraoApagados =
    aba === 'equipe' ? await getWorkspacesExclusivosDoUsuario(user.id) : []

  const [integrationConnections, usoDasIntegracoes] =
    aba === 'integracoes'
      ? await Promise.all([getIntegrationConnections(workspaceId), getUsoDasIntegracoes(workspaceId)])
      : [[], { google_calendar: 0, gmail: 0, whatsapp: 0 }]

  const descricao: Record<AbaDeConfiguracoes, string> = {
    empresa: 'Dados da sua empresa, usados no sistema e nas comunicações.',
    equipe: 'Quem tem acesso a esta empresa e com qual permissão.',
    plano: 'Seu plano atual e o que cada um inclui.',
    integracoes: 'Conecte WhatsApp, Google Calendar e Gmail ao fluxo do funil.',
  }

  const mensagemDeErro = params.erro ? MENSAGEM_DE_ERRO_DA_INTEGRACAO[params.erro] : null
  const nomeConectado = params.conectado ? NOME_DA_INTEGRACAO[params.conectado] : null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Configurações" description={descricao[aba]} className="mb-0" />

      <SettingsTabs ativa={aba} />

      {aba === 'integracoes' && nomeConectado && (
        <p
          role="status"
          className="rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400"
        >
          {nomeConectado} conectado com sucesso.
        </p>
      )}

      {aba === 'integracoes' && mensagemDeErro && (
        <p role="alert" className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
          {mensagemDeErro}
        </p>
      )}

      {aba === 'empresa' && (
        <EmpresaCard
          isAdmin={isAdmin}
          inicial={{
            name: workspace?.name ?? '',
            nome_fantasia: workspace?.nome_fantasia ?? '',
            segmento: workspace?.segmento ?? '',
            descricao: workspace?.descricao ?? '',
            cnpj: workspace?.cnpj ?? '',
            email_comercial: workspace?.email_comercial ?? '',
            whatsapp: workspace?.whatsapp ?? '',
            telefone: workspace?.telefone ?? '',
            site: workspace?.site ?? '',
            cep: workspace?.cep ?? '',
            endereco: workspace?.endereco ?? '',
            numero: workspace?.numero ?? '',
            complemento: workspace?.complemento ?? '',
            bairro: workspace?.bairro ?? '',
            cidade: workspace?.cidade ?? '',
            estado: workspace?.estado ?? '',
            logoUrl: await urlDaLogo(workspace?.logo_url ?? null),
          }}
        />
      )}

      {aba === 'equipe' && (
        <div className="flex flex-col gap-6">
          <MembersCard
            currentUserId={user.id}
            isAdmin={isAdmin}
            members={members}
            invites={invites}
            plan={workspace?.plan ?? 'free'}
          />

          {/* Excluir conta fica aqui, separado por uma linha e no fim: é a
              única ação irreversível da tela, e dividir card com o convite de
              colaborador é convite a errar o clique. */}
          <div className="border-border/60 border-t pt-6">
            <DeleteAccountCard workspacesQueSeraoApagados={workspacesQueSeraoApagados} />
          </div>
        </div>
      )}

      {aba === 'plano' && <PlanCard plan={workspace?.plan ?? 'free'} isAdmin={isAdmin} />}

      {aba === 'integracoes' && (
        <IntegrationsTab
          isAdmin={isAdmin}
          connections={integrationConnections}
          uso={usoDasIntegracoes}
        />
      )}
    </div>
  )
}
