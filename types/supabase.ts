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
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled'
export type WorkspaceInviteStatus = 'pending' | 'accepted' | 'expired'

export type Database = {
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string
          name: string
          plan: WorkspacePlan
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          plan?: WorkspacePlan
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          plan?: WorkspacePlan
          created_by?: string | null
          created_at?: string
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
