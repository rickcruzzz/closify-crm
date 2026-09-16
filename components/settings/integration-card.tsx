'use client'

import * as React from 'react'
import { toast } from 'sonner'
import {
  CalendarDays,
  Loader2,
  Mail,
  MessageCircle,
  Plug,
  Trash2,
  Zap,
  type LucideIcon,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { desconectarIntegracao, testarConexaoIntegracao } from '@/lib/integrations/actions'
import { ProUpsellDialog } from '@/components/settings/pro-upsell-dialog'
import { PrepararConexaoGoogle } from '@/components/settings/preparar-conexao-google'
import type { IntegrationProvider, IntegrationStatus } from '@/types/supabase'
import {
  AVISO_DE_MIGRACAO,
  AVISO_PARA_QUEM_NAO_TEM_PRO,
  podeConectarWhatsapp,
  seloDoWhatsapp,
  WHATSAPP_MORA_NO_MAX,
} from '@/lib/integrations/whatsapp-estado'
import { buttonVariants } from '@/components/ui/button'
import Link from 'next/link'

const META: Record<
  IntegrationProvider,
  {
    titulo: string
    descricao: string
    icone: LucideIcon
    conectarHref: string | null
    /** Como nomear o uso pro cliente, singular e plural, linguagem dele, não termo técnico. */
    usoSingular: string
    usoPlural: string
    /**
     * O que quem está no Free deixa de fazer.
     *
     * Escrito como perda concreta do dia a dia, não como recurso: "integração
     * indisponível" não diz nada a quem nunca usou, e a decisão de pagar se
     * toma pelo problema que some, não pelo nome da funcionalidade.
     */
    ganhoNoPro: string
    /**
     * O que a integracao NAO faz, dito antes de alguem descobrir sozinho.
     *
     * Medido em 11/09: o Calendar so ESCREVE no Google. A tela `/calendario`
     * le apenas `getTasksNoIntervalo()`, do proprio banco — quem marca uma
     * reuniao pelo celular nao ve nada no Velo Funil, e o cartao nao dizia.
     *
     * Limite nao dito e promessa implicita: quem conecta esperando mao dupla
     * conclui que o produto esta quebrado, e o suporte chega semanas depois
     * como "a agenda nao sincroniza". A frase custa uma linha; a expectativa
     * errada custa o cliente.
     *
     * O do Gmail nao e um limite, e informacao que a pessoa nao tem: o envio
     * JA fica registrado, e quem nao sabe disso guarda uma copia por fora.
     */
    limite: string | null
  }
> = {
  google_calendar: {
    titulo: 'Google Calendar',
    descricao: 'Agende reuniões direto do painel do negócio.',
    icone: CalendarDays,
    conectarHref: '/api/integrations/google/connect?provider=google_calendar',
    usoSingular: 'reunião agendada',
    usoPlural: 'reuniões agendadas',
    ganhoNoPro:
      'No Pro, a reunião que você marca aqui já aparece na sua agenda do Google, com convite pro cliente.',
    limite:
      'Os eventos criados aqui vão para a sua agenda. O Velo Funil não lê os compromissos que você marca por fora.',
  },
  gmail: {
    titulo: 'Gmail',
    descricao: 'Envie e-mail para o lead sem sair do CRM.',
    icone: Mail,
    conectarHref: '/api/integrations/google/connect?provider=gmail',
    usoSingular: 'e-mail enviado',
    usoPlural: 'e-mails enviados',
    ganhoNoPro:
      'No Pro, você responde o cliente sem trocar de aba, e o e-mail fica registrado no histórico dele.',
    limite: 'O e-mail sai da sua conta e fica no histórico do contato.',
  },
  whatsapp: {
    titulo: 'WhatsApp',
    // A dor real, achada na pesquisa de mercado: não é "esquecer de
    // responder" (essa é a segunda). É o histórico morar no celular do
    // vendedor — quando ele sai, a empresa perde contato, negociação em
    // andamento e histórico de uma vez, e se ele for pro concorrente, a
    // carteira vai junto. Esquecer uma venda dói uma vez; perder a carteira
    // não tem conserto.
    descricao: 'Toda conversa fica no histórico do cliente, não no celular de quem atendeu.',
    // `null` de propósito: conectar exige ler QR Code, então é diálogo, não
    // link direto como o OAuth do Google.
    conectarHref: null,
    icone: MessageCircle,
    usoSingular: 'conversa registrada',
    usoPlural: 'conversas registradas',
    ganhoNoPro:
      'No Pro, quando o cliente responde no WhatsApp vira histórico e tarefa aqui, e continua sendo da empresa mesmo se o vendedor sair.',
    // Sem linha de limite: durante a migracao o selo "Em breve" ja diz o que
    // acontece, e uma segunda frase competiria com ele.
    limite: null,
  },
}

/**
 * Um card por integração, mesmo componente pros três provedores.
 *
 * `isAdmin` vem do servidor (a página já verificou); aqui só decide o que
 * mostrar, a régua de verdade é a RLS + a checagem repetida nas próprias
 * Server Actions (regra que só vive num lugar não é regra).
 */
export function IntegrationCard({
  provider,
  isAdmin,
  status,
  accountLabel,
  lastError,
  uso,
  plano,
}: {
  provider: IntegrationProvider
  isAdmin: boolean
  status: IntegrationStatus
  accountLabel: string | null
  lastError: string | null
  /** Quantas vezes essa integração foi usada nos últimos 30 dias. */
  uso: number
  /**
   * O plano do workspace, só para decidir o que o card MOSTRA.
   *
   * `docs/estado-atual.md` registra que "regra de plano lê a função, nunca a
   * coluna". Isto não é regra: é rótulo. Quem decide de verdade continua sendo
   * o `pro_vigente()` em `/api/integrations/google/connect`, que roda antes de
   * assinar o `state` do OAuth e fecha o caminho por inteiro — mesmo que
   * alguém force esta prop no cliente, a conexão não acontece. E a página de
   * configurações roda `sincronizar_plano_do_workspace` antes de renderizar,
   * então a coluna está em dia justamente aqui.
   */
  plano: 'free' | 'pro'
}) {
  const [pendente, startTransition] = React.useTransition()
  const [upsellAberto, setUpsellAberto] = React.useState(false)
  const [prepararGoogleAberto, setPrepararGoogleAberto] = React.useState(false)
  const info = META[provider]
  const Icone = info.icone
  // ## "Conectado" só vale se o plano ainda dá direito ao recurso
  //
  // Achado em produção (24/08): uma empresa no Free mostrava a etiqueta
  // "✓ Conectado" e, logo abaixo, o botão "Conhecer o plano Pro" — a tela
  // afirmando duas coisas incompatíveis ao mesmo tempo.
  //
  // A causa é que conexão não expira sozinha quando o plano cai: a linha em
  // `integration_connections` continua com `status: 'connected'` de quando a
  // empresa ainda era Pro (ou estava em trial). O estado guardado está certo
  // sobre o passado e errado sobre o presente.
  //
  // Aqui o plano tem a última palavra. Quem perdeu o Pro vê "Pausado", que é a
  // verdade: a conexão existe, o WhatsApp segue pareado no servidor, e as
  // mensagens NÃO estão entrando — é o que o webhook passou a fazer na mesma
  // correção. Dizer "Não conectado" seria mentira na direção oposta e faria a
  // pessoa tentar parear de novo à toa.
  // `null` para Google Calendar e Gmail, e para o WhatsApp quando a API
  // oficial estiver ligada. So existe enquanto a migracao dura.
  const seloWhatsapp = provider === 'whatsapp' ? seloDoWhatsapp() : null

  const temDireitoAoRecurso = plano === 'pro'
  const conectado = status === 'connected' && temDireitoAoRecurso
  const pausadoPorPlano = status === 'connected' && !temDireitoAoRecurso

  function testar() {
    startTransition(async () => {
      const resultado = await testarConexaoIntegracao(provider)
      if (resultado?.error) toast.error(resultado.error)
      else toast.success('Conexão funcionando.')
    })
  }

  function desconectar() {
    startTransition(async () => {
      const resultado = await desconectarIntegracao(provider)
      if (resultado?.error) toast.error(resultado.error)
      else toast.success(`${info.titulo} desconectado.`)
    })
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="flex items-start gap-3">
          <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg">
            <Icone aria-hidden className="size-5" />
          </div>
          <div>
            <CardTitle className="text-base">{info.titulo}</CardTitle>
            <CardDescription>{info.descricao}</CardDescription>
            {/* Abaixo da descricao e nao num tooltip: tooltip so aparece para
                quem ja desconfiou que ha algo a descobrir, e aqui a pessoa nao
                tem motivo para desconfiar. */}
            {info.limite && (
              <p className="text-muted-foreground mt-1 text-xs text-pretty">{info.limite}</p>
            )}
          </div>
        </div>
        {/* Durante a migracao o WhatsApp nao funciona para NINGUEM, nem no
            Free nem no Pro. "Nao conectado" ou "Erro" fariam a pessoa tentar
            conectar; "Pausado" implicaria que pagar resolve. Nenhum dos tres e
            verdade agora — o selo diz o que de fato acontece. */}
        <Badge
          variant={
            seloWhatsapp
              ? 'secondary'
              : conectado
                ? 'default'
                : pausadoPorPlano || status === 'error'
                  ? 'destructive'
                  : 'secondary'
          }
        >
          {seloWhatsapp
            ? seloWhatsapp.texto
            : conectado
              ? '✓ Conectado'
              : pausadoPorPlano
                ? 'Pausado'
                : status === 'error'
                  ? 'Erro'
                  : 'Não conectado'}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {accountLabel && <p className="text-muted-foreground text-sm">{accountLabel}</p>}

        {/* O selo "Pausado" sozinho não explica nada — e num card que também
            mostra "Conhecer o plano Pro", a pessoa fica sem saber se perdeu a
            conexão ou se ela nunca existiu. O texto separa as duas coisas: o
            número segue pareado (não precisa refazer nada), o que parou foi a
            entrada das mensagens. */}
        {pausadoPorPlano && !seloWhatsapp && (
          <p className="text-destructive text-xs text-pretty">
            Seu número continua pareado, mas as mensagens não estão entrando no
            funil enquanto o plano não for Pro.
          </p>
        )}

        {/* Só mostra uso pra quem já conectou, card desconectado não tem
            número nenhum pra exibir, e "0" ali só soaria vazio. */}
        {conectado && (
          <p className="text-muted-foreground text-xs">
            {uso === 0
              ? 'Nenhum uso nos últimos 30 dias.'
              : `${uso} ${uso === 1 ? info.usoSingular : info.usoPlural} nos últimos 30 dias.`}
          </p>
        )}

        {/* Duas gravidades, e a diferença importa. `error` é a conexão caída:
            nada entra, e o vermelho está certo. Mas existe um terceiro estado
            que antes não aparecia em lugar nenhum — conectado E com aviso: a
            sessão do WhatsApp está de pé, mensagens de contatos conhecidos
            entram normalmente, e só as de números novos estão sendo recusadas
            porque o plano chegou ao teto. Pintar isso de vermelho faria a
            pessoa tentar reconectar uma conexão que está boa; esconder faria
            ela perder venda sem saber. Âmbar, e o texto diz o que ainda
            funciona. */}
        {lastError && (
          <p
            role="alert"
            className={
              status === 'error'
                ? 'bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm'
                : 'rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400'
            }
          >
            {lastError}
          </p>
        )}

        {/* O Free vem ANTES do resto de propósito. Antes disto o card oferecia
            "Conectar" normalmente, a pessoa clicava, saía da página, o servidor
            recusava e ela voltava com um toast cinza: uma viagem inteira ao
            servidor para dizer não. Aqui ela sabe antes de gastar o clique, e
            tem para onde ir. */}
        {/* O WhatsApp vem antes do gate de plano durante a migracao.
            "Integracoes sao um recurso Pro, faca upgrade para conectar"
            implicaria que pagar resolve — e nao resolve: o Pro tambem nao tem
            WhatsApp agora. Cobrar por algo que nao entrega e a classe de
            defeito que este projeto ja pagou duas vezes, com os "contatos
            ilimitados" e com o CNPJ baixado na vitrine. */}
        {seloWhatsapp ? (
          <div className="border-border/60 flex flex-col gap-1 rounded-lg border p-3">
            <span className="text-sm font-medium">{AVISO_DE_MIGRACAO.titulo}</span>
            <p className="text-muted-foreground text-xs leading-relaxed">
              {plano === 'free' ? AVISO_PARA_QUEM_NAO_TEM_PRO : AVISO_DE_MIGRACAO.detalhe}
            </p>
          </div>
        ) : plano === 'free' ? (
          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground text-xs">
              {info.ganhoNoPro}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => setUpsellAberto(true)}
            >
              <Zap className="size-4" />
              Conhecer o plano Pro
            </Button>
          </div>
        ) : !isAdmin ? (
          <p className="text-muted-foreground text-xs">
            Só administradores podem gerenciar integrações.
          </p>
        ) : conectado ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={pendente} onClick={testar}>
              {pendente && <Loader2 className="size-4 animate-spin" />}
              Testar conexão
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              disabled={pendente}
              onClick={desconectar}
            >
              <Trash2 className="size-4" />
              Desconectar
            </Button>
          </div>
        ) : info.conectarHref ? (
          /* Era um `<a>` direto para a rota de conexão. O problema não está
             aqui, está na tela seguinte: a de consentimento do Google mostra
             uma caixa de permissão DESMARCADA, e continuar sem marcar devolve
             um token sem a permissão. O produto não alcança ninguém depois que
             a pessoa sai daqui, então o aviso tem que vir antes do clique. */
          <Button className="w-fit" size="sm" onClick={() => setPrepararGoogleAberto(true)}>
            <Plug className="size-4" />
            Conectar {info.titulo}
          </Button>
        ) : provider === 'whatsapp' ? (
          // A ponte nao oficial saiu de operacao e a API oficial ainda nao foi
          // aprovada. Oferecer o botao aqui chamaria um servidor que nem
          // resolve no DNS, e o cliente tomaria erro de rede sem entender o
          // que fez de errado. Melhor dizer a verdade.
          podeConectarWhatsapp() ? (
            // O WhatsApp saiu de Integracoes e virou plano proprio: a conexao
            // e por empresa e consome uma instancia paga, enquanto esta tela e
            // gateada em pro_vigente() pela 0037. O card fica como PLACA, e nao
            // como ausencia: quem procura WhatsApp aqui precisa achar o
            // caminho.
            //
            // Ancora crua com `buttonVariants`, e nao `<Button render={<Link/>}>`:
            // o Base UI DESCARTA o onClick do filho no merge, defeito que
            // custou uma rodada em 08/09. Aqui nao ha handler, e a ancora e o
            // elemento certo para navegar.
            <div className="border-border/60 flex flex-col items-start gap-2 rounded-lg border p-3">
              <span className="text-sm font-medium">{WHATSAPP_MORA_NO_MAX.titulo}</span>
              <p className="text-muted-foreground text-xs leading-relaxed">
                {WHATSAPP_MORA_NO_MAX.detalhe}
              </p>
              <Link
                href={WHATSAPP_MORA_NO_MAX.destino}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                <MessageCircle className="size-4" />
                Abrir o WhatsApp
              </Link>
            </div>
          ) : (
            <div className="border-border/60 flex flex-col gap-1 rounded-lg border p-3">
              <span className="text-sm font-medium">{AVISO_DE_MIGRACAO.titulo}</span>
              <p className="text-muted-foreground text-xs leading-relaxed">
                {AVISO_DE_MIGRACAO.detalhe}
              </p>
            </div>
          )
        ) : (
          <p className="text-muted-foreground text-xs">Em breve.</p>
        )}
      </CardContent>

      <ProUpsellDialog
        open={upsellAberto}
        onOpenChange={setUpsellAberto}
        recurso={info.titulo}
        isAdmin={isAdmin}
      />

      {info.conectarHref && (
        <PrepararConexaoGoogle
          open={prepararGoogleAberto}
          onOpenChange={setPrepararGoogleAberto}
          titulo={info.titulo}
          href={info.conectarHref}
        />
      )}

    </Card>
  )
}
