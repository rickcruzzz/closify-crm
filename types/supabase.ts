export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

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
          email: string
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
          email: string
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
          email?: string
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
      get_workspace_member_names: {
        Args: { target_workspace_id: string; target_user_ids: string[] }
        Returns: { user_id: string; name: string }[]
      }
      get_open_pipeline_value: {
        Args: { target_workspace_id: string }
        Returns: number
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
