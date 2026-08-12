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
export type ActivityType = 'ligacao' | 'email' | 'reuniao' | 'nota'
export type OnboardingStatus = 'not_started' | 'in_progress' | 'skipped' | 'completed'
export type OnboardingEtapa = 'empresa' | 'segmento' | 'venda' | 'equipe' | 'processando'
export type TourStatus = 'not_started' | 'skipped' | 'completed'
export type ModeloVenda = 'servicos' | 'produtos' | 'ambos'
export type TamanhoEquipe = 'so_eu' | '2_5' | '6_20' | '21_mais'

/**
 * Os campos de empresa acrescentados em 0030.
 *
 * Separados num tipo próprio porque `Row`, `Insert` e `Update` repetiriam os
 * 18 três vezes — e a terceira cópia é onde um campo some sem ninguém notar.
 * Todos anuláveis: o banco não exige nenhum deles.
 */
export type DadosDaEmpresa = {
  segmento: string | null
  modelo_venda: ModeloVenda | null
  tamanho_equipe: TamanhoEquipe | null
  logo_url: string | null
  nome_fantasia: string | null
  /** Só dígitos — o banco recusa máscara (`^[0-9]{14}$`). */
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
  /** UF em maiúscula — o banco recusa minúscula (`^[A-Z]{2}$`). */
  estado: string | null
}
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled'
export type WorkspaceInviteStatus = 'pending' | 'accepted' | 'expired'
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
        } & DadosDaEmpresa
        Insert: {
          id?: string
          name: string
          plan?: WorkspacePlan
          created_by?: string | null
          created_at?: string
        } & Partial<DadosDaEmpresa>
        Update: {
          id?: string
          name?: string
          plan?: WorkspacePlan
          created_by?: string | null
          created_at?: string
        } & Partial<DadosDaEmpresa>
        Relationships: []
      }
      // Estado do onboarding, por PESSOA e não por empresa — quem é convidado
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
      // trigger sobrescreve o que vier do app — por isso ficam fora de `Insert`
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
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          lead_id: string
          author_id?: string | null
          type: ActivityType
          description: string
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          lead_id?: string
          author_id?: string | null
          type?: ActivityType
          description?: string
          created_at?: string
        }
        Relationships: []
      }
      // Tarefas com prazo — o que ainda vai acontecer. Separada de `activities`
      // de propósito: atividade é log do que aconteceu, tarefa muda de estado.
      // `lead_id` e `deal_id` são os dois opcionais, mas o check
      // `tasks_alvo_minimo` exige pelo menos um — ver 0029_tarefas.sql.
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
      // e sem policy) — ver 0012_security_audit_fixes.sql.
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
      subscriptions: {
        Row: {
          id: string
          workspace_id: string
          asaas_customer_id: string | null
          asaas_subscription_id: string | null
          status: SubscriptionStatus
          current_period_end: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          status?: SubscriptionStatus
          current_period_end?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          status?: SubscriptionStatus
          current_period_end?: string | null
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
      // Tokens cifrados no app antes de gravar aqui — ver lib/integrations/crypto.ts.
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
      // Dedupe de mensagem recebida do webhook do WhatsApp — mesmo desenho de
      // asaas_webhook_events. Só a service_role escreve (RLS ligada, sem policy).
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
      // três vezes deixa uma empresa só — provado em produção.
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
      /** O período pago ainda vale? Ver migration 0027. */
      pro_vigente: {
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
        Args: { target_workspace_id: string }
        Returns: number
      }
      // Agrupa no banco: no máximo 6 linhas, qualquer que seja o tamanho do
      // funil. A versão anterior lia uma linha por negócio e batia no teto de
      // 1.000 do PostgREST — ver 0032.
      get_funnel_counts: {
        Args: { target_workspace_id: string }
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
        Args: { target_workspace_id: string }
        Returns: {
          total_leads: number
          open_deals: number
          closed_deals: number
          won_deals: number
        }[]
      }
      accept_workspace_invite: {
        Args: { invite_token: string }
        Returns: void
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
      // Só o webhook do Asaas chama, via service role — `revoke` na 0014 tira
      // de anon e authenticated. Devolve false quando nenhuma assinatura casa
      // com o id, o que não é erro.
      // Limitador de tentativas. Só Server Action chama, via service role —
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
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
