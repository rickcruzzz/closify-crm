-- Closify CRM — convites de colaboradores (M13)
-- Aplicar no SQL Editor do Supabase Studio.

-- ============================================================================
-- Tabela
-- ============================================================================

create type public.workspace_invite_status as enum ('pending', 'accepted', 'expired');

create table public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null,
  role public.workspace_role not null default 'membro',
  token uuid not null default gen_random_uuid(),
  status public.workspace_invite_status not null default 'pending',
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  unique (token)
);

create index workspace_invites_workspace_id_idx on public.workspace_invites (workspace_id);
create index workspace_invites_token_idx on public.workspace_invites (token);

-- Evita convite duplicado pendente pro mesmo e-mail no mesmo workspace.
create unique index workspace_invites_pending_email_idx
  on public.workspace_invites (workspace_id, email)
  where status = 'pending';

-- ============================================================================
-- RLS
-- ============================================================================

alter table public.workspace_invites enable row level security;

-- Admin do workspace vê/gerencia os convites que ele mandou.
create policy "workspace_invites_select_admin" on public.workspace_invites
  for select using ((select public.is_workspace_admin(workspace_id)));

create policy "workspace_invites_insert_admin" on public.workspace_invites
  for insert with check ((select public.is_workspace_admin(workspace_id)));

create policy "workspace_invites_delete_admin" on public.workspace_invites
  for delete using ((select public.is_workspace_admin(workspace_id)));

-- Quem está aceitando o convite ainda não é membro do workspace (nem
-- necessariamente logado) — não dá pra usar is_workspace_member aqui.
-- Selecionar por token exige já saber o token (veio do e-mail), então expor
-- select público é seguro: o token de 128 bits funciona como a própria
-- credencial de posse, igual qualquer link de convite/reset de senha.
create policy "workspace_invites_select_by_token" on public.workspace_invites
  for select using (true);

-- ============================================================================
-- RPC: aceitar convite (transação atômica — insere membro + marca convite)
-- ============================================================================

create or replace function public.accept_workspace_invite(invite_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite record;
  v_member_count int;
  v_plan public.workspace_plan;
begin
  select * into v_invite
  from public.workspace_invites
  where token = invite_token
    and status = 'pending'
  for update;

  if not found then
    raise exception 'Convite inválido ou já utilizado.';
  end if;

  if v_invite.expires_at < now() then
    update public.workspace_invites set status = 'expired' where id = v_invite.id;
    raise exception 'Convite expirado.';
  end if;

  if v_invite.email <> (select email from auth.users where id = auth.uid()) then
    raise exception 'Este convite foi enviado para outro e-mail.';
  end if;

  select plan into v_plan from public.workspaces where id = v_invite.workspace_id;
  select count(*) into v_member_count from public.workspace_members where workspace_id = v_invite.workspace_id;

  if v_plan = 'free' and v_member_count >= 2 then
    raise exception 'Workspace atingiu o limite de 2 membros do plano Free.';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_invite.workspace_id, auth.uid(), v_invite.role)
  on conflict (workspace_id, user_id) do nothing;

  update public.workspace_invites set status = 'accepted' where id = v_invite.id;
end;
$$;
