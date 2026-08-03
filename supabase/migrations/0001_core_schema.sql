-- Closify CRM — schema core + RLS multi-tenant
-- Aplicar no SQL Editor do Supabase Studio, na ordem em que aparece neste arquivo.

-- ============================================================================
-- Enums
-- ============================================================================

create type public.workspace_role as enum ('admin', 'membro');

create type public.workspace_plan as enum ('free', 'pro');

create type public.deal_stage as enum (
  'novo',
  'contato_realizado',
  'proposta_enviada',
  'negociacao',
  'fechado_ganho',
  'fechado_perdido'
);

create type public.activity_type as enum ('ligacao', 'email', 'reuniao', 'nota');

create type public.subscription_status as enum (
  'trialing',
  'active',
  'past_due',
  'canceled'
);

-- ============================================================================
-- Tabelas
-- ============================================================================

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan public.workspace_plan not null default 'free',
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.workspace_role not null default 'membro',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  owner_id uuid references auth.users (id) on delete set null,
  name text not null,
  email text not null,
  phone text,
  company text,
  status public.deal_stage not null default 'novo',
  value numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete set null,
  owner_id uuid references auth.users (id) on delete set null,
  title text not null,
  value numeric(12, 2) not null default 0,
  stage public.deal_stage not null default 'novo',
  due_date date,
  created_at timestamptz not null default now()
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  type public.activity_type not null,
  description text not null,
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces (id) on delete cascade,
  asaas_customer_id text,
  asaas_subscription_id text,
  status public.subscription_status not null default 'trialing',
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Índices
-- ============================================================================

create index leads_workspace_id_idx on public.leads (workspace_id);
create index deals_workspace_id_idx on public.deals (workspace_id);
create index deals_lead_id_idx on public.deals (lead_id);
create index activities_workspace_id_idx on public.activities (workspace_id);
create index activities_lead_id_idx on public.activities (lead_id);
create index workspace_members_user_id_idx on public.workspace_members (user_id);

-- ============================================================================
-- Helper: verifica se o usuário autenticado é membro do workspace
-- (security definer evita recursão de RLS ao consultar workspace_members)
-- ============================================================================

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_admin(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
      and role = 'admin'
  );
$$;

-- ============================================================================
-- RLS
-- ============================================================================

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.leads enable row level security;
alter table public.deals enable row level security;
alter table public.activities enable row level security;
alter table public.subscriptions enable row level security;

-- workspaces: só enxerga/edita workspace onde é membro
create policy "workspaces_select" on public.workspaces
  for select using ((select public.is_workspace_member(id)));

create policy "workspaces_update" on public.workspaces
  for update using ((select public.is_workspace_admin(id)))
  with check ((select public.is_workspace_admin(id)));

create policy "workspaces_insert" on public.workspaces
  for insert with check (true);

-- workspace_members: só enxerga membros do próprio workspace; só admin gerencia
create policy "workspace_members_select" on public.workspace_members
  for select using ((select public.is_workspace_member(workspace_id)));

create policy "workspace_members_insert" on public.workspace_members
  for insert with check ((select public.is_workspace_admin(workspace_id)));

create policy "workspace_members_update" on public.workspace_members
  for update using ((select public.is_workspace_admin(workspace_id)))
  with check ((select public.is_workspace_admin(workspace_id)));

create policy "workspace_members_delete" on public.workspace_members
  for delete using ((select public.is_workspace_admin(workspace_id)));

-- leads
create policy "leads_select" on public.leads
  for select using ((select public.is_workspace_member(workspace_id)));

create policy "leads_insert" on public.leads
  for insert with check ((select public.is_workspace_member(workspace_id)));

create policy "leads_update" on public.leads
  for update using ((select public.is_workspace_member(workspace_id)))
  with check ((select public.is_workspace_member(workspace_id)));

create policy "leads_delete" on public.leads
  for delete using ((select public.is_workspace_member(workspace_id)));

-- deals
create policy "deals_select" on public.deals
  for select using ((select public.is_workspace_member(workspace_id)));

create policy "deals_insert" on public.deals
  for insert with check ((select public.is_workspace_member(workspace_id)));

create policy "deals_update" on public.deals
  for update using ((select public.is_workspace_member(workspace_id)))
  with check ((select public.is_workspace_member(workspace_id)));

create policy "deals_delete" on public.deals
  for delete using ((select public.is_workspace_member(workspace_id)));

-- activities
create policy "activities_select" on public.activities
  for select using ((select public.is_workspace_member(workspace_id)));

create policy "activities_insert" on public.activities
  for insert with check ((select public.is_workspace_member(workspace_id)));

create policy "activities_update" on public.activities
  for update using ((select public.is_workspace_member(workspace_id)))
  with check ((select public.is_workspace_member(workspace_id)));

create policy "activities_delete" on public.activities
  for delete using ((select public.is_workspace_member(workspace_id)));

-- subscriptions: só select client-facing (admin vê o próprio plano).
-- insert/update são feitos só via service_role key (webhook do Asaas),
-- que ignora RLS — não expor policy de escrita pro client aqui.
create policy "subscriptions_select" on public.subscriptions
  for select using ((select public.is_workspace_member(workspace_id)));
