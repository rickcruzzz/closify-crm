import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { PlanComparisonTable } from '@/components/settings/plan-comparison-table'
import { SubscriptionCard } from '@/components/settings/subscription-card'
import { MaxCard } from '@/components/settings/max-card'
import { situacaoDoMax } from '@/lib/plans/max-queries'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUserAndWorkspace } from '@/lib/supabase/workspace'
import { getWorkspaceSettingsData } from '@/lib/workspace/queries'
import { getEstadoAssinatura, getHistoricoDaAssinatura } from '@/lib/asaas/queries'
import { AvisoDeTesteNaCobranca } from '@/components/settings/aviso-de-teste-na-cobranca'
import { HistoricoDaAssinatura } from '@/components/settings/historico-da-assinatura'
import {
  FREE_LEAD_LIMIT,
  FREE_MEMBER_LIMIT,
  PLANO_NA_TELA,
  planoEfetivo,
} from '@/lib/plans'
import { cn } from '@/lib/utils'
import { situacaoDoPlanoDaEmpresaAtiva } from '@/lib/plans/trial-queries'
import { EnterpriseCard } from '@/components/settings/enterprise-card'

export const metadata: Metadata = { title: 'Cobrança' }

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ assinar?: string; pago?: string; pagar?: string }>
}) {
  // `assinar=1` abre o fluxo de quem NÃO tem assinatura (pede CPF/CNPJ e cria
  // a cobrança). `pagar=1` abre o de quem JÁ tem, direto no Pix. São dois
  // caminhos diferentes, e é por isso que o e-mail de fim de trial aponta para
  // o primeiro e o de vencimento para o segundo.
  const { assinar, pago, pagar } = await searchParams
  const { user, workspaceId } = await getCurrentUserAndWorkspace()
  const situacao = await situacaoDoPlanoDaEmpresaAtiva()
  if (situacao.temEnterprise) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Plano Enterprise"
          description="Recursos incluídos para sua equipe."
        />
        <EnterpriseCard />
      </div>
    )
  }

  const supabase = await createClient()

  // As três consultas abaixo só dependem de `workspaceId`, nenhuma do
  // resultado das outras, mas rodavam uma atrás da outra: três idas
  // sequenciais ao banco onde uma bastava. Estado real da cobrança
  // (`getEstadoAssinatura`), não só o plano: sem isto, quem tinha assinatura
  // criada com fatura em aberto via "Free" e um botão de assinar de novo,
  // sem saber que já existia uma cobrança esperando pagamento.
  const [
    { workspace, members },
    { count: leadCount },
    assinatura,
    historico,
    max,
    proVigenteRpc,
  ] = await Promise.all([
    getWorkspaceSettingsData(workspaceId),
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId),
    getEstadoAssinatura(workspaceId),
    getHistoricoDaAssinatura(workspaceId),
    // Entra no MESMO `Promise.all`, e não numa quinta ida em série. O
    // comentário acima já registra por que estas leituras foram juntadas: são
    // independentes entre si, e encadeá-las paga uma viagem de rede a mais
    // em toda abertura da tela de cobrança.
    situacaoDoMax(workspaceId),
    // ## A FUNÇÃO, e não a coluna, e ela entra no mesmo `Promise.all`
    //
    // `workspaces.plan` mente por dois motivos independentes, e esta tela
    // caía nos dois: ela nunca é promovida (o ramo 3 de `pro_vigente` cobre
    // as empresas irmãs sem tocar em coluna nenhuma), e vale `'pro'` para
    // quem paga MAX, por construção da 0089.
    //
    // O resultado era a tela de COBRANÇA chamando de "Pro" quem paga R$ 250,
    // e oferecendo assinar o Pro a quem já o tem. Uma RPC a mais, em
    // paralelo, custa zero viagem de rede adicional.
    supabase.rpc('pro_vigente', { target_workspace_id: workspaceId }),
  ])

  const isAdmin = members.find((m) => m.user_id === user.id)?.role === 'admin'

  // `=== true` e não `Boolean(...)`: a RPC devolve `null` quando a leitura
  // falha, e `null` precisa cair no lado NEGADO. Aqui o custo de errar para
  // mais seria mostrar Pro a quem não pagou.
  const proVigente = proVigenteRpc.data === true
  const plano = planoEfetivo({
    plan: workspace?.plan ?? 'free',
    temMax: max.maxVigente,
    proVigente,
  })

  // ## Coberta por OUTRA empresa do mesmo dono
  //
  // `pro_vigente` verdadeiro sem assinatura aqui só pode ser o ramo 3 ou o
  // trial. O trial tem aviso próprio logo abaixo, então o que sobra é o ramo 3:
  // a pessoa paga numa empresa e usa em outra.
  //
  // Sem dizer isso, a tela mostra "Pro" e nenhuma assinatura, e quem vier
  // conferir a cobrança conclui que ela sumiu.
  //
  // A frase NÃO nomeia a empresa que paga, e isso é escolha: descobrir qual é
  // exigiria repetir o predicado de `pro_vigente` (com `dias_de_graca` junto)
  // em TypeScript ou numa RPC nova, e uma segunda cópia da regra é exatamente
  // o defeito que esta rodada existe para fechar.
  const cobertaPorEmpresaIrma =
    proVigente && !assinatura && !workspace?.trial_ate && plano !== 'max'

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Cobrança" description="Plano atual e comparação de recursos." />

      {/* Volta do Asaas depois de pagar. O Pro não é liberado aqui e sim pelo
          webhook, que é assíncrono, Pix costuma levar segundos, boleto pode
          levar dias. Sem este aviso a pessoa voltaria, veria "Free" e concluiria
          que o pagamento não funcionou. */}
      {pago === '1' && plano === 'free' && (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="text-base">Pagamento recebido</CardTitle>
            <CardDescription>
              Estamos aguardando a confirmação do Asaas para liberar o Pro. Pix costuma
              levar alguns segundos; boleto, até três dias úteis. Você recebe um e-mail
              assim que estiver ativo.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-col-reverse items-start gap-3 sm:flex-row sm:justify-between sm:gap-4">
          <div>
            <CardTitle>Plano atual</CardTitle>
            <CardDescription>
              {/* O Max ganha frase própria: dizer "colaboradores e contatos
                  ilimitados" para quem paga R$ 250 descreve o que ele tem de
                  COMUM com o Pro e cala sobre o que ele comprou. */}
              {plano === 'max'
                ? 'O WhatsApp da empresa dentro do CRM, mais tudo do Pro.'
                : plano === 'pro'
                  ? /* "leads" e o jargao que a renomeacao de 19/08 tirou do
                       produto — a tela do menu se chama Contatos. Mesma troca
                       feita em `plan-card.tsx`, onde a frase vizinha ainda
                       prometia "empresas ilimitadas" contra o teto de 5. */
                    'Colaboradores e contatos ilimitados.'
                  : 'Ideal para começar a organizar seu funil.'}
            </CardDescription>
          </div>
          <Badge variant={plano === 'free' ? 'secondary' : 'default'}>
            {PLANO_NA_TELA[plano]}
          </Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {/* Quando o teste termina.
              Quem está em trial não tem linha em `subscriptions`, então o
              SubscriptionCard nem aparece para essa pessoa — e a data só
              existia na tarja do layout, a partir de 4 dias. Quem abre esta
              tela no primeiro dia para entender o que ganhou não encontrava a
              data em lugar nenhum do produto. */}
          {!assinatura && (
            <AvisoDeTesteNaCobranca trialAte={workspace?.trial_ate ?? null} />
          )}

          {/* O selo diz Pro e não existe assinatura nenhuma nesta tela. Sem
              esta frase, quem vier conferir a cobrança conclui que ela sumiu. */}
          {cobertaPorEmpresaIrma && (
            <p className="text-muted-foreground border-border/60 rounded-lg border p-3 text-sm leading-relaxed">
              Esta empresa usa o {PLANO_NA_TELA.pro} que você já paga em outra empresa
              sua. Não há cobrança separada aqui, e o valor continua sendo um só.
            </p>
          )}

          {plano === 'free' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <UsageBar label="Contatos" used={leadCount ?? 0} limit={FREE_LEAD_LIMIT} />
              {/* "Pessoas" e não "Colaboradores": `members.length` inclui o
                  DONO, e `FREE_MEMBER_LIMIT` também. Com o rótulo antigo, um
                  dono sozinho lia "1/2 colaboradores" e concluía que ainda
                  cabiam dois — cabia um. O número sempre esteve certo; a
                  palavra é que contava outra coisa. */}
              <UsageBar
                label="Pessoas na empresa"
                used={members.length}
                limit={FREE_MEMBER_LIMIT}
              />
            </div>
          )}

          {/* A assinatura aparece sempre que existir, inclusive no plano Free:
              é justamente quem criou a cobrança e ainda não pagou que precisa
              ver a fatura em aberto. */}
          {assinatura && (
            <SubscriptionCard
              estado={assinatura}
              isAdmin={isAdmin}
              abrirDeInicio={pagar === '1'}
            />
          )}

          {/* O que aconteceu com a assinatura, em ordem. Fica DEPOIS do card
              de estado porque responde uma pergunta de conferência ("o que eu
              paguei e quando"), não de ação. Quem entrou aqui para pagar acha
              o botão antes de chegar nele. */}
          <HistoricoDaAssinatura eventos={historico} />

          {/* Só oferece assinar quem não tem cobrança em andamento, senão a
              pessoa criaria uma segunda assinatura sem perceber que a primeira
              está esperando pagamento. */}
          {/* ## O botao de assinar saiu DAQUI em 16/09
              
              Ele aparecia ANTES do cartao de comparacao, ou seja a oferta vinha
              antes do argumento — e havia dois botoes na mesma pagina, cada um
              com o proprio dialogo. O cabecalho de `plan-comparison-table.tsx`
              documenta o problema oposto ("quem se convencia lendo o cartao do
              Pro tinha que rolar de volta"), e ao consertar aquilo ninguem
              removeu este.
              
              Sobra um, dentro do cartao do Pro, depois do argumento. O
              `abrirDeInicio` foi junto. */}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Compare os planos</CardTitle>
        </CardHeader>
        <CardContent>
          <PlanComparisonTable
            plan={plano}
            isAdmin={isAdmin}
            // `?assinar=1` continua abrindo o formulario direto para quem JA
            // decidiu: e o destino dos e-mails de trial, da reconciliacao e da
            // landing logada. Quem chega por "Conhecer o Pro" cai na ancora, sem
            // parametro, e le antes.
            assinarDeInicio={
              assinar === '1' && (!assinatura || assinatura.status === 'canceled')
            }
          />
        </CardContent>
      </Card>

      {/* Depois da comparacao, e nao como terceira coluna dela: o Max nao e uma
          opcao paralela ao Pro, e TUDO do Pro mais uma coisa. Ver o cabecalho
          de `max-card.tsx`. */}
      <MaxCard
        temMax={max.maxVigente}
        isAdmin={isAdmin}
        temCobrancaEmAberto={Boolean(assinatura) && assinatura?.status !== 'canceled'}
      />
    </div>
  )
}

// "Perto do limite" em 2/2 é falso: o limite não está perto, já acabou, e
// quem lê "perto" tenta adicionar mais um e toma o erro do banco sem entender
// por quê. Os dois estados ficam separados, e o texto do cheio diz o que fazer
// em vez de só constatar o problema.
function UsageBar({
  label,
  used,
  limit,
}: {
  label: string
  used: number
  limit: number
}) {
  const percent = Math.min(100, Math.round((used / limit) * 100))
  const noLimite = used >= limit
  const perto = !noLimite && percent >= 80
  const emAlerta = noLimite || perto

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span
          className={cn(
            'font-medium',
            noLimite && 'text-destructive',
            perto && 'text-amber-600 dark:text-amber-500',
          )}
        >
          {used}/{limit}
        </span>
      </div>
      <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            noLimite && 'bg-destructive',
            perto && 'bg-amber-500',
            !emAlerta && 'bg-primary',
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      {noLimite && (
        <p className="text-destructive text-xs">
          Limite do plano Free atingido. Assine o Pro para adicionar mais.
        </p>
      )}
      {perto && (
        <p className="text-xs text-amber-600 dark:text-amber-500">
          Restam {limit - used} de {limit} no plano Free.
        </p>
      )}
    </div>
  )
}
