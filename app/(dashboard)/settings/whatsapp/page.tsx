import type { Metadata } from 'next'

import { PageHeader } from '@/components/layout/page-header'
import { WhatsappConexao } from '@/components/settings/whatsapp-conexao'
import { direitoAoWhatsapp } from '@/lib/plans/max'
import { situacaoDoMax } from '@/lib/plans/max-queries'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUserAndWorkspace } from '@/lib/supabase/workspace'
import { conexaoDaEmpresa } from '@/lib/whatsapp/instancia'
import { provisionamentoAutomatico } from '@/lib/whatsapp/zapi'

export const metadata: Metadata = { title: 'WhatsApp' }

/**
 * A conexão de WhatsApp da empresa.
 *
 * ## Por que uma tela própria, e não uma aba de Integrações
 *
 * `integration_connections` é gateada em `pro_vigente()` por três policies da
 * 0037, e o WhatsApp é do Max. Morar lá daria o recurso a quem paga Pro, e o
 * gate erraria para o lado do dinheiro em silêncio — cada empresa conectada
 * consome uma instância paga no provedor.
 *
 * E o fluxo não é o mesmo: Google é OAuth, aqui é QR Code lido no celular, com
 * um estado que cai sozinho e precisa ser reconquistado.
 *
 * ## Tudo do plano é resolvido no SERVIDOR
 *
 * O componente de cliente recebe a decisão pronta, nunca os dados para tomá-la.
 * Ele é uma tela, e tela não é barreira: as Server Actions refazem cada
 * checagem, e a trigger da 0090 refaz de novo no banco.
 */
export default async function WhatsappPage() {
  const { workspaceId } = await getCurrentUserAndWorkspace()

  const supabase = await createClient()

  const [assinatura, conexao, { data: ehAdmin }] = await Promise.all([
    situacaoDoMax(workspaceId),
    conexaoDaEmpresa(workspaceId),
    supabase.rpc('is_workspace_admin', { target_workspace_id: workspaceId }),
  ])

  const direito = direitoAoWhatsapp(assinatura, conexao.estado)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="WhatsApp"
        description="Receba e responda as mensagens da sua empresa sem sair do funil."
      />

      <WhatsappConexao
        estado={conexao.estado}
        telefone={conexao.telefone}
        ultimoErro={conexao.ultimoErro}
        conectadaEm={conexao.conectadaEm}
        ehAdmin={ehAdmin === true}
        temMax={assinatura.maxVigente}
        // A frase da negativa vem pronta do servidor. A tela não a monta: as
        // quatro negativas de `direitoAoWhatsapp` existem porque cada uma pede
        // uma ação diferente, e reconstruí-las aqui criaria uma quinta versão.
        bloqueio={direito.pode ? null : { tipo: direito.tipo, motivo: direito.motivo }}
        // ## O modo e resolvido no SERVIDOR, e a tela so obedece
        //
        // `ZAPI_PARTNER_TOKEN` e variavel de ambiente: o componente de cliente
        // nao tem como saber. Sem esta prop, o botao chamaria a API, tomaria
        // erro e diria "tente de novo em alguns minutos" — mentira, para quem
        // acabou de pagar R$ 250.
        automatico={provisionamentoAutomatico()}
      />
    </div>
  )
}
