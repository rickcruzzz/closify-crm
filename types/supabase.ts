export type Json =
  string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type WorkspaceRole = 'admin' | 'membro'
export type WorkspacePlan = 'free' | 'pro'
export type DealStage =
  | 'novo'
  | 'contato_realizado'
  | 'proposta_enviada'
  | 'negociacao'
  | 'fechado_ganho'
  | 'fechado_perdido'
export type ActivityType = 'ligacao' | 'email' | 'reuniao' | 'nota' | 'whatsapp'
export type OnboardingStatus = 'not_started' | 'in_progress' | 'skipped' | 'completed'
export type OnboardingEtapa = 'empresa' | 'segmento' | 'venda' | 'equipe' | 'processando'
export type TourStatus = 'not_started' | 'skipped' | 'completed'
export type ModeloVenda = 'servicos' | 'produtos' | 'ambos'
export type TamanhoEquipe = 'so_eu' | '2_5' | '6_20' | '21_mais'

/**
 * Os campos de empresa acrescentados em 0030.
 *
 * Separados num tipo próprio porque `Row`, `Insert` e `Update` repetiriam os
 * 18 três vezes, e a terceira cópia é onde um campo some sem ninguém notar.
 * Todos anuláveis: o banco não exige nenhum deles.
 */
export type DadosDaEmpresa = {
  segmento: string | null
  modelo_venda: ModeloVenda | null
  tamanho_equipe: TamanhoEquipe | null
  logo_url: string | null
  nome_fantasia: string | null
  /** Só dígitos, o banco recusa máscara (`^[0-9]{14}$`). */
  cnpj: string | null
  descricao: string | null
  email_comercial: string | null
  whatsapp: string | null
  telefone: string | null
  site: string | null
  cep: string | null
  endereco: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  /** UF em maiúscula, o banco recusa minúscula (`^[A-Z]{2}$`). */
  estado: string | null
}
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled'
export type WorkspaceInviteStatus = 'pending' | 'accepted' | 'expired'
// `whatsapp` sempre existiu no enum do banco: a migration 0043 removeu o
// codigo da Cloud API, nao o valor (Postgres nao tem ALTER TYPE ... DROP
// VALUE). O tipo volta agora que a integracao pelo Evolution usa esse mesmo
// slot em `integration_connections` e `activities.integration_provider`.
export type IntegrationProvider = 'google_calendar' | 'gmail' | 'whatsapp'
export type IntegrationStatus = 'connected' | 'error' | 'disconnected'

export type Database = {
  public: {
    Tables: {
      // Os campos de empresa (0030) são todos anuláveis: as empresas que já
      // existiam continuam válidas sem uma linha ser tocada. Só `name` é
      // obrigatório, e ele já era.
      workspaces: {
        Row: {
          id: string
          name: string
          plan: WorkspacePlan
          created_by: string | null
          created_at: string
          // De onde a empresa veio, se veio de campanha rastreada, ver
          // 0041_atribuicao_de_cadastro.sql. Nullable: maioria não vem de nenhuma.
          utm_source: string | null
          utm_medium: string | null
          utm_campaign: string | null
          // Âncoras de match da Conversions API do Meta, ver 0042_fbc_fbp.sql.
          fbc: string | null
          fbp: string | null
          /**
           * Fim do trial de 7 dias que toda empresa nova ganha (0051).
           * `null` em empresa criada antes disso — elas não ganharam trial
           * retroativo de propósito.
           *
           * Distinto de `subscriptions.status`: aquele é o estado da cobrança
           * no Asaas, este é cortesia do produto. Confundir os dois seria dar
           * Pro de graça a quem só abriu o checkout.
           */
          trial_ate: string | null
          /**
           * Último envio do e-mail de fim de trial (0055).
           *
           * Existe aqui, e não em `subscriptions`, porque quem está em trial
           * não tem linha lá: a assinatura só nasce no primeiro checkout.
           * Comparado por DIA DE CALENDÁRIO em São Paulo, o que permite um
           * aviso por dia na reta final sem repetir dentro do mesmo dia.
           */
          aviso_trial_enviado_em: string | null
        } & DadosDaEmpresa
        Insert: {
          id?: string
          name: string
          plan?: WorkspacePlan
          created_by?: string | null
          created_at?: string
          utm_source?: string | null
          utm_medium?: string | null
          utm_campaign?: string | null
          fbc?: string | null
          fbp?: string | null
          /** Quem escreve isto é a RPC `create_workspace_with_admin` (0051). */
          trial_ate?: string | null
        } & Partial<DadosDaEmpresa>
        Update: {
          id?: string
          name?: string
          plan?: WorkspacePlan
          created_by?: string | null
          created_at?: string
          utm_source?: string | null
          utm_medium?: string | null
          utm_campaign?: string | null
          fbc?: string | null
          fbp?: string | null
          /**
           * Escrito só pelo cron de aviso, com service role. `trial_ate`
           * continua fora deste Update de propósito: a trigger
           * `proteger_trial_ate` (0051) recusa a alteração, e deixar o tipo
           * permitir o que o banco proíbe convida ao erro.
           */
          aviso_trial_enviado_em?: string | null
        } & Partial<DadosDaEmpresa>
        Relationships: []
      }
      // Estado do onboarding, por PESSOA e não por empresa, quem é convidado
      // para uma empresa que já existe tem o próprio onboarding a fazer. É a
      // única tabela do projeto cuja RLS é `user_id = auth.uid()`; ver
      // 0030_onboarding.sql.
      onboarding_state: {
        Row: {
          user_id: string
          status: OnboardingStatus
          etapa: OnboardingEtapa | null
          tour_status: TourStatus
          checklist_oculto: boolean
          respostas: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          status?: OnboardingStatus
          etapa?: OnboardingEtapa | null
          tour_status?: TourStatus
          checklist_oculto?: boolean
          respostas?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          status?: OnboardingStatus
          etapa?: OnboardingEtapa | null
          tour_status?: TourStatus
          checklist_oculto?: boolean
          respostas?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          workspace_id: string
          user_id: string
          role: WorkspaceRole
          created_at: string
        }
        Insert: {
          workspace_id: string
          user_id: string
          role?: WorkspaceRole
          created_at?: string
        }
        Update: {
          workspace_id?: string
          user_id?: string
          role?: WorkspaceRole
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'workspace_members_workspace_id_fkey'
            columns: ['workspace_id']
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          },
        ]
      }
      leads: {
        Row: {
          id: string
          workspace_id: string
          owner_id: string | null
          name: string
          email: string | null
          phone: string | null
          company: string | null
          status: DealStage
          value: number
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          owner_id?: string | null
          name: string
          email: string | null
          phone?: string | null
          company?: string | null
          status?: DealStage
          value?: number
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          owner_id?: string | null
          name?: string
          email?: string | null
          phone?: string | null
          company?: string | null
          status?: DealStage
          value?: number
          created_at?: string
        }
        Relationships: []
      }
      // `updated_at` e `stage_changed_at` (0033) são escritos por trigger, e a
      // trigger sobrescreve o que vier do app, por isso ficam fora de `Insert`
      // e de `Update`. Mandá-los pelo PostgREST não adianta.
      deals: {
        Row: {
          id: string
          workspace_id: string
          lead_id: string | null
          owner_id: string | null
          title: string
          value: number
          stage: DealStage
          due_date: string | null
          created_at: string
          updated_at: string
          /** Só muda quando a ETAPA muda. É a base de "parado". */
          stage_changed_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          lead_id?: string | null
          owner_id?: string | null
          title: string
          value?: number
          stage?: DealStage
          due_date?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          lead_id?: string | null
          owner_id?: string | null
          title?: string
          value?: number
          stage?: DealStage
          due_date?: string | null
          created_at?: string
        }
        Relationships: []
      }
      activities: {
        Row: {
          id: string
          workspace_id: string
          lead_id: string
          author_id: string | null
          type: ActivityType
          description: string
          // Preenchido só quando a atividade nasceu de uma integração
          // automática (Calendar/Gmail/WhatsApp), null pra lançamento manual.
          integration_provider: IntegrationProvider | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          lead_id: string
          author_id?: string | null
          type: ActivityType
          description: string
          integration_provider?: IntegrationProvider | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          lead_id?: string
          author_id?: string | null
          type?: ActivityType
          description?: string
          integration_provider?: IntegrationProvider | null
          created_at?: string
        }
        Relationships: []
      }
      // Tarefas com prazo, o que ainda vai acontecer. Separada de `activities`
      // de propósito: atividade é log do que aconteceu, tarefa muda de estado.
      // `lead_id` e `deal_id` são os dois opcionais, mas o check
      // `tasks_alvo_minimo` exige pelo menos um, ver 0029_tarefas.sql.
      tasks: {
        Row: {
          id: string
          workspace_id: string
          lead_id: string | null
          deal_id: string | null
          assignee_id: string | null
          created_by: string | null
          title: string
          type: ActivityType
          due_at: string
          done_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          lead_id?: string | null
          deal_id?: string | null
          assignee_id?: string | null
          created_by?: string | null
          title: string
          type?: ActivityType
          due_at: string
          done_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          lead_id?: string | null
          deal_id?: string | null
          assignee_id?: string | null
          created_by?: string | null
          title?: string
          type?: ActivityType
          due_at?: string
          done_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      // Dedupe de webhook do Asaas. Só a service_role escreve aqui (RLS ligada
      // e sem policy), ver 0012_security_audit_fixes.sql.
      // Dedupe do webhook do Evolution (WhatsApp). Mesmo padrao de
      // asaas_webhook_events: RLS ligada, zero policy, so a service_role
      // alcanca. Diferenca que importa: esta tabela NASCE com purga de 7 dias
      // (0047), porque o volume de WhatsApp e ordens de grandeza maior — ver o
      // cabecalho da migration.
      whatsapp_webhook_events: {
        Row: {
          event_id: string
          processed_at: string
        }
        Insert: {
          event_id: string
          processed_at?: string
        }
        Update: {
          event_id?: string
          processed_at?: string
        }
        Relationships: []
      }
      asaas_webhook_events: {
        Row: {
          event_id: string
          event_type: string
          processed_at: string
        }
        Insert: {
          event_id: string
          event_type: string
          processed_at?: string
        }
        Update: {
          event_id?: string
          event_type?: string
          processed_at?: string
        }
        Relationships: []
      }
      // Histórico append-only da assinatura (0055). Diferente de
      // `asaas_webhook_events`, que é dedupe: aqui o MEMBRO lê, porque é a
      // tabela que responde "o que eu paguei e quando" na tela de Cobrança.
      // Escrita só pela service role, de dentro de lib/asaas/aplicar-evento.ts.
      //
      // Existe porque `subscriptions` guarda UMA linha por empresa, só o estado
      // atual. Quem assinou, cancelou e voltou não deixava rastro — foi isso
      // que impediu, em 18/08, distinguir "Pro vencido" de "nunca teve Pro".
      assinatura_eventos: {
        Row: {
          id: string
          workspace_id: string
          /** `null` no primeiro evento da empresa: não havia estado anterior. */
          de_status: SubscriptionStatus | null
          para_status: SubscriptionStatus
          /** `webhook` ou `reconciliacao:cron`. Responde "quem aplicou isto". */
          origem: string
          /** Forma de pagamento no momento. Explica a graça de 1 ou 3 dias. */
          billing_type: string | null
          asaas_event_id: string | null
          criado_em: string
        }
        Insert: {
          id?: string
          workspace_id: string
          de_status?: SubscriptionStatus | null
          para_status: SubscriptionStatus
          origem: string
          billing_type?: string | null
          asaas_event_id?: string | null
          criado_em?: string
        }
        // Sem Update de propósito: a tabela é append-only, e não há policy de
        // update nem de delete no banco. Deixar o tipo permitir o que o banco
        // proíbe convida ao erro.
        Update: Record<string, never>
        Relationships: []
      }
      // Uma conversa por contato por canal (0056). `respondida_em` nulo é o
      // estado que ordena a tela inteira: significa ESPERANDO RESPOSTA.
      //
      // Coluna e não subconsulta em `mensagens`: a lista é lida a cada
      // carregamento da tela mais aberta do produto.
      conversas: {
        Row: {
          id: string
          workspace_id: string
          lead_id: string
          canal: string
          ultimo_recebido_em: string | null
          ultimo_enviado_em: string | null
          /** `null` = ninguém respondeu ainda. É o que alimenta o relógio. */
          respondida_em: string | null
          dono_id: string | null
          assumida_em: string | null
          arquivada_em: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          lead_id: string
          canal?: string
          ultimo_recebido_em?: string | null
          ultimo_enviado_em?: string | null
          respondida_em?: string | null
          dono_id?: string | null
          assumida_em?: string | null
          arquivada_em?: string | null
          created_at?: string
        }
        Update: {
          ultimo_recebido_em?: string | null
          ultimo_enviado_em?: string | null
          respondida_em?: string | null
          dono_id?: string | null
          assumida_em?: string | null
          arquivada_em?: string | null
        }
        Relationships: []
      }
      // Mensagens de uma conversa (0056), recebidas e enviadas.
      //
      // `external_id` é único por empresa e é o dedupe do reenvio do Evolution.
      // Anulável porque mensagem ENVIADA nasce antes de o WhatsApp devolver o
      // id, e o índice único é parcial por isso.
      mensagens: {
        Row: {
          id: string
          workspace_id: string
          conversa_id: string
          direcao: 'recebida' | 'enviada'
          tipo: 'texto' | 'audio' | 'imagem' | 'video' | 'documento' | 'figurinha' | 'outro'
          texto: string
          /** Chave da mídia no Evolution. Buscada sob demanda, nunca no webhook. */
          midia_chave: string | null
          midia_mime: string | null
          midia_segundos: number | null
          external_id: string | null
          enviada_por: string | null
          status: 'pendente' | 'enviada' | 'falhou'
          erro: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          conversa_id: string
          direcao: 'recebida' | 'enviada'
          tipo?: 'texto' | 'audio' | 'imagem' | 'video' | 'documento' | 'figurinha' | 'outro'
          texto?: string
          midia_chave?: string | null
          midia_mime?: string | null
          midia_segundos?: number | null
          external_id?: string | null
          enviada_por?: string | null
          status?: 'pendente' | 'enviada' | 'falhou'
          erro?: string | null
          created_at?: string
        }
        // Só o envio atualiza, para marcar `enviada`/`falhou` depois da
        // resposta do Evolution. Não há delete: apagar mensagem de conversa é
        // reescrever história com o cliente.
        Update: {
          external_id?: string | null
          status?: 'pendente' | 'enviada' | 'falhou'
          erro?: string | null
        }
        Relationships: []
      }
      // Captura real dos erros que `app/(dashboard)/error.tsx` e
      // `app/global-error.tsx` recebem, gravada por app/api/log-erro/route.ts.
      // Mesmo padrão de asaas_webhook_events: RLS ligada, sem policy, só a
      // service_role lê/escreve. workspace_id/user_id sem FK de propósito
      // (erro pode acontecer antes de resolver sessão/workspace, ou depois
      // que um dos dois já foi apagado), ver 0046_error_logs.sql.
      error_logs: {
        Row: {
          id: string
          message: string
          digest: string | null
          stack: string | null
          url: string | null
          origem: string
          workspace_id: string | null
          user_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          message: string
          digest?: string | null
          stack?: string | null
          url?: string | null
          origem: string
          workspace_id?: string | null
          user_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          message?: string
          digest?: string | null
          stack?: string | null
          url?: string | null
          origem?: string
          workspace_id?: string | null
          user_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          id: string
          workspace_id: string
          asaas_customer_id: string | null
          asaas_subscription_id: string | null
          status: SubscriptionStatus
          current_period_end: string | null
          // Como foi o último pagamento (CREDIT_CARD, BOLETO, PIX). Decide a
          // graça depois do vencimento, ver `dias_de_graca` na migration 0044.
          ultimo_billing_type: string | null
          // Trava de idempotência do aviso de vencimento (migration 0044).
          aviso_vencimento_enviado_em: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          status?: SubscriptionStatus
          current_period_end?: string | null
          ultimo_billing_type?: string | null
          aviso_vencimento_enviado_em?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          status?: SubscriptionStatus
          current_period_end?: string | null
          ultimo_billing_type?: string | null
          aviso_vencimento_enviado_em?: string | null
          created_at?: string
        }
        Relationships: []
      }
      workspace_invites: {
        Row: {
          id: string
          workspace_id: string
          email: string
          role: WorkspaceRole
          token: string
          status: WorkspaceInviteStatus
          invited_by: string | null
          created_at: string
          expires_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          email: string
          role?: WorkspaceRole
          token?: string
          status?: WorkspaceInviteStatus
          invited_by?: string | null
          created_at?: string
          expires_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          email?: string
          role?: WorkspaceRole
          token?: string
          status?: WorkspaceInviteStatus
          invited_by?: string | null
          created_at?: string
          expires_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'workspace_invites_workspace_id_fkey'
            columns: ['workspace_id']
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          },
        ]
      }
      // Tokens cifrados no app antes de gravar aqui, ver lib/integrations/crypto.ts.
      // access_token_enc/refresh_token_enc não são legíveis por `authenticated`
      // (revoke por coluna na 0034), mesmo com RLS de select liberado na linha.
      integration_connections: {
        Row: {
          id: string
          workspace_id: string
          provider: IntegrationProvider
          status: IntegrationStatus
          account_label: string | null
          external_id: string | null
          scopes: string[]
          access_token_enc: string | null
          refresh_token_enc: string | null
          token_expires_at: string | null
          last_synced_at: string | null
          last_error: string | null
          connected_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          provider: IntegrationProvider
          status?: IntegrationStatus
          account_label?: string | null
          external_id?: string | null
          scopes?: string[]
          access_token_enc?: string | null
          refresh_token_enc?: string | null
          token_expires_at?: string | null
          last_synced_at?: string | null
          last_error?: string | null
          connected_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          provider?: IntegrationProvider
          status?: IntegrationStatus
          account_label?: string | null
          external_id?: string | null
          scopes?: string[]
          access_token_enc?: string | null
          refresh_token_enc?: string | null
          token_expires_at?: string | null
          last_synced_at?: string | null
          last_error?: string | null
          connected_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      is_workspace_member: {
        Args: { target_workspace_id: string }
        Returns: boolean
      }
      is_workspace_admin: {
        Args: { target_workspace_id: string }
        Returns: boolean
      }
      workspace_has_no_members: {
        Args: { target_workspace_id: string }
        Returns: boolean
      }
      is_workspace_creator: {
        Args: { target_workspace_id: string }
        Returns: boolean
      }
      create_workspace_with_admin: {
        Args: { workspace_name: string }
        Returns: string
      }
      // Idempotente, ao contrário da de cima: se a pessoa já é membro de
      // alguma empresa, devolve a MAIS ANTIGA (mesma regra de
      // `resolverWorkspaceAtivo`) e só atualiza os campos informados. Chamar
      // três vezes deixa uma empresa só, provado em produção.
      garantir_workspace_do_onboarding: {
        Args: {
          p_nome: string
          p_segmento?: string | null
          p_modelo_venda?: string | null
          p_tamanho_equipe?: string | null
        }
        Returns: string
      }
      email_e_membro_do_workspace: {
        Args: { target_email: string; target_workspace_id: string }
        Returns: boolean
      }
      /**
       * O Pro vale AGORA? Por assinatura paga OU por trial dentro do prazo.
       * Ver migrations 0027 (assinatura) e 0051 (trial).
       */
      pro_vigente: {
        Args: { target_workspace_id: string }
        Returns: boolean
      }
      /**
       * Está em trial e ainda NÃO pagou.
       *
       * Distingue "está avaliando" de "é cliente", que `pro_vigente()` sozinha
       * não separa. As travas de estoque (empresas e colaboradores) usam esta
       * função: trial dá funcionalidade, nunca estoque — ver migration 0053.
       */
      em_trial: {
        Args: { target_workspace_id: string }
        Returns: boolean
      }
      /** Rebaixa `workspaces.plan` quando o período venceu. Nunca promove. */
      sincronizar_plano_do_workspace: {
        Args: { target_workspace_id: string }
        Returns: 'free' | 'pro' | null
      }
      excluir_minha_conta: { Args: never; Returns: undefined }
      get_workspace_member_names: {
        Args: { target_workspace_id: string; target_user_ids: string[] }
        Returns: { user_id: string; name: string }[]
      }
      get_open_pipeline_value: {
        Args: { target_workspace_id: string; desde?: string | null; ate?: string | null }
        Returns: number
      }
      // Agrupa no banco: no máximo 6 linhas, qualquer que seja o tamanho do
      // funil. A versão anterior lia uma linha por negócio e batia no teto de
      // 1.000 do PostgREST, ver 0032.
      get_funnel_counts: {
        Args: { target_workspace_id: string; desde?: string | null; ate?: string | null }
        Returns: { stage: DealStage; total: number }[]
      }
      // Teto POR ETAPA, com o total de cada uma junto, para a tela poder dizer
      // quantos ficaram de fora em vez de sumir com os cards.
      get_board_deals: {
        Args: { target_workspace_id: string; por_etapa?: number }
        Returns: {
          id: string
          title: string
          lead_id: string | null
          value: number
          stage: DealStage
          due_date: string | null
          created_at: string
          stage_changed_at: string
          owner_id: string | null
          total_na_etapa: number
        }[]
      }
      get_dashboard_counts: {
        Args: { target_workspace_id: string; desde?: string | null; ate?: string | null }
        Returns: {
          total_leads: number
          open_deals: number
          closed_deals: number
          won_deals: number
        }[]
      }
      accept_workspace_invite: {
        Args: { invite_token: string }
        Returns: string
      }
      get_invite_by_token: {
        Args: { invite_token: string }
        Returns: {
          email: string
          role: WorkspaceRole
          status: WorkspaceInviteStatus
          expires_at: string
          workspace_name: string
        }[]
      }
      // Só o webhook do Asaas chama, via service role, `revoke` na 0014 tira
      // de anon e authenticated. Devolve false quando nenhuma assinatura casa
      // com o id, o que não é erro.
      // Limitador de tentativas. Só Server Action chama, via service role,
      // `revoke` na 0015 tira de anon e authenticated. Devolve true quando a
      // ação deve ser bloqueada.
      registrar_tentativa: {
        Args: {
          p_chave: string
          p_limite: number
          p_janela_segundos: number
        }
        Returns: boolean
      }
      limpar_tentativas: {
        Args: { p_chave: string }
        Returns: void
      }
      apply_asaas_subscription_status: {
        Args: {
          p_asaas_subscription_id: string
          p_status: SubscriptionStatus
        }
        Returns: boolean
      }
      // Casa o telefone que o WhatsApp entrega (com DDI) contra `leads.phone`
      // (digitado a mao ou vindo de planilha) pelos ultimos 8 digitos, usando
      // indice funcional. Substitui a varredura O(n) do codigo antigo, que
      // trazia todos os leads do workspace por mensagem recebida. Ver 0047.
      encontrar_lead_por_telefone: {
        Args: {
          p_workspace_id: string
          p_telefone: string
        }
        Returns: string | null
      }
      // Purga de 7 dias do dedupe do WhatsApp. Chamada pelo cron.
      purge_old_whatsapp_webhook_events: {
        Args: Record<string, never>
        Returns: number
      }
      // Purga de 90 dias do dedupe do Asaas. Existe desde a 0014 e nunca foi
      // agendada — o comentario da migration esperava pg_cron, que nao e
      // necessario: o projeto ja tem Vercel Cron.
      purge_old_asaas_webhook_events: {
        Args: Record<string, never>
        Returns: number
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
