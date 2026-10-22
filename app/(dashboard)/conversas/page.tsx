import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/layout/page-header'
import { ConversasClient } from '@/components/conversas/conversas-client'
import { WhatsappConexao } from '@/components/settings/whatsapp-conexao'
import { buttonVariants } from '@/components/ui/button'
import { getConversas, getMensagensDaConversa } from '@/lib/conversas/queries'
import { getCurrentUserAndWorkspace } from '@/lib/supabase/workspace'
import { getWorkspaceMembers } from '@/lib/leads/queries'
import { createClient } from '@/lib/supabase/server'
import { CABECALHOS } from '@/lib/telas/cabecalhos'
import { direitoAoWhatsapp } from '@/lib/plans/max'
import { situacaoDoMax } from '@/lib/plans/max-queries'
import { conexaoDaEmpresa } from '@/lib/whatsapp/instancia'
import { provisionamentoAutomatico } from '@/lib/whatsapp/zapi'

export const metadata: Metadata = { title: 'WhatsApp' }

/**
 * O WhatsApp da empresa: o numero e quem esta esperando resposta.
 *
 * ## Uma tela, e ate 17/09 eram duas
 *
 * `/conversas` era a caixa de entrada e `/settings/whatsapp` era a conexao,
 * cada uma com entrada propria no menu. Sao a caixa e o cano da mesma coisa, e
 * a divisao cobrava da pessoa uma distincao que so faz sentido para quem
 * construiu: quem abre o WhatsApp e nao ve mensagem chegando cai na lista
 * vazia, que nao explica nada, e a explicacao esta no outro item.
 *
 * Agora e uma tela so, e **ela decide o que mostrar pelo estado da conexao**:
 *
 *     sem Max ou sem numero     o painel de conexao, com o QR Code
 *     conectado                 a caixa de entrada, com a conexao recolhida
 *
 * `/settings/whatsapp` continua existindo e redireciona para ca. Ele e citado
 * no e-mail de pedido de conexao, no aviso de queda e no card do plano Max, e
 * link publicado que passa a dar 404 e pior do que rota duplicada.
 *
 * ## Tudo de plano e resolvido no SERVIDOR
 *
 * O componente de cliente recebe a decisao pronta, nunca os dados para toma-la.
 * As Server Actions refazem cada checagem e a trigger da 0090 refaz de novo no
 * banco: tela nao e barreira.
 */
export default async function ConversasPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; conexao?: string }>
}) {
  const { c, conexao: verConexao } = await searchParams
  const { user, workspaceId } = await getCurrentUserAndWorkspace()

  const supabase = await createClient()

  // Tudo na mesma onda: nenhuma depende do resultado das outras, e em serie
  // seriam seis idas de rede empilhadas na tela mais aberta do produto.
  const [conversas, aberta, membros, assinatura, conexao, { data: ehAdmin }, cobranca] =
    await Promise.all([
      getConversas(workspaceId, c),
      c ? getMensagensDaConversa(c) : Promise.resolve(null),
      getWorkspaceMembers(workspaceId),
      situacaoDoMax(workspaceId),
      conexaoDaEmpresa(workspaceId),
      supabase.rpc('is_workspace_admin', { target_workspace_id: workspaceId }),
      // A oferta do Max agora assina NESTA tela, então ela precisa saber se já
      // existe cobrança esperando pagamento: sem isso o botão apareceria e
      // `createCheckout` recusaria depois do clique. Entra na mesma onda, então
      // não custa viagem de rede nenhuma.
      supabase
        .from('subscriptions')
        .select('status')
        .eq('workspace_id', workspaceId)
        .maybeSingle(),
    ])

  const direito = direitoAoWhatsapp(assinatura, conexao.estado)
  const conectado = conexao.estado === 'conectado'

  // Nome de quem assumiu a conversa, para o aviso de colisao dizer QUEM esta
  // respondendo em vez de "alguem". `WorkspaceMember.id` ja e o `user_id`,
  // que e como `getWorkspaceMembers` monta a lista.
  const nomesPorUsuario: Record<string, string> = {}
  for (const m of membros) {
    if (m.id && m.name) nomesPorUsuario[m.id] = m.name
  }

  const painelDeConexao = (
    <WhatsappConexao
      estado={conexao.estado}
      telefone={conexao.telefone}
      ultimoErro={conexao.ultimoErro}
      conectadaEm={conexao.conectadaEm}
      ehAdmin={ehAdmin === true}
      temMax={assinatura.maxVigente}
      // A frase da negativa vem pronta do servidor. A tela nao a monta: as
      // quatro negativas de `direitoAoWhatsapp` existem porque cada uma pede
      // uma acao diferente, e reconstrui-las aqui criaria uma quinta versao.
      bloqueio={direito.pode ? null : { tipo: direito.tipo, motivo: direito.motivo }}
      // O modo e resolvido no SERVIDOR e a tela so obedece.
      // `ZAPI_PARTNER_TOKEN` e variavel de ambiente: o componente de cliente
      // nao tem como saber. Sem esta prop, o botao chamaria a API, tomaria
      // erro e diria "tente de novo em alguns minutos", mentira, para quem
      // acabou de pagar R$ 250.
      automatico={provisionamentoAutomatico()}
      temCobrancaEmAberto={Boolean(cobranca.data) && cobranca.data?.status !== 'canceled'}
    />
  )

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        {...CABECALHOS.conversas}
        // A descricao acompanha o que a tela esta mostrando. Sem numero de pe
        // nao ha caixa de entrada, e prometer "quem esta esperando resposta"
        // sobre um painel de conexao descreve uma tela que a pessoa nao esta
        // vendo.
        description={
          conectado
            ? CABECALHOS.conversas.description
            : 'Conecte o número da sua empresa e as mensagens passam a cair aqui dentro.'
        }
        actions={
          // O atalho so existe quando o numero esta de pe. Enquanto nao esta, o
          // painel JA e a tela inteira, e um botao "Ver conexao" apontaria para
          // o que a pessoa esta olhando.
          conectado && !verConexao ? (
            <Link
              href="/conversas?conexao=1"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <span
                aria-hidden
                className="size-2 rounded-full bg-emerald-500"
              />
              {conexao.telefone ? formatarTelefone(conexao.telefone) : 'Conectado'}
            </Link>
          ) : null
        }
      />

      {/* ## A ordem da tela e a da pergunta de quem chega
          Sem numero conectado nao existe caixa de entrada possivel: a lista
          vazia nao seria "ninguem escreveu", seria "nada esta ligado", e as
          duas pedem acoes opostas. Por isso o painel ocupa a tela ate o numero
          estar de pe, e depois some para dar lugar ao que importa. */}
      {(!conectado || verConexao) && painelDeConexao}

      {conectado && (
        <ConversasClient
          workspaceId={workspaceId}
          conversas={conversas}
          conversaAberta={aberta ? c! : null}
          mensagens={aberta?.mensagens ?? []}
          usuarioId={user.id}
          nomesPorUsuario={nomesPorUsuario}
        />
      )}
    </div>
  )
}

/**
 * `5571993309404` vira `+55 71 99330-9404`.
 *
 * Fica local porque e o unico lugar do produto que mostra o numero da
 * INSTANCIA, e ele chega da Z-API sem formatacao nenhuma. Numero cru no
 * cabecalho e o tipo de detalhe que faz uma tela parecer inacabada.
 */
function formatarTelefone(cru: string): string {
  const d = cru.replace(/\D/g, '')
  if (d.length < 12 || !d.startsWith('55')) return cru
  const ddd = d.slice(2, 4)
  const resto = d.slice(4)
  const meio = resto.length > 8 ? resto.slice(0, resto.length - 4) : resto.slice(0, 4)
  const fim = resto.slice(-4)
  return `+55 ${ddd} ${meio}-${fim}`
}
