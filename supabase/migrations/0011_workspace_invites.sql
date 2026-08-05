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

-- Sem policy de select público aqui — "using (true)" deixaria qualquer
-- usuário autenticado listar/enumerar a tabela inteira de convites (e-mails
-- de outros workspaces), já que RLS não sabe qual token o client já filtrou
-- no .eq(), só decide se a QUERY em geral pode ver a LINHA. A leitura por
-- token vira RPC security definer abaixo, que recebe o token como argumento
-- e só retorna a linha exata — sem exposição de tabela.

-- ============================================================================
-- RPC: buscar convite por token (só os campos que a tela de aceite precisa)
-- ============================================================================

create or replace function public.get_invite_by_token(invite_token uuid)
returns table (
  email text,
  role public.workspace_role,
  status public.workspace_invite_status,
  expires_at timestamptz,
  workspace_name text
)
language sql
security definer
set search_path = public
stable
as $$
  select wi.email, wi.role, wi.status, wi.expires_at, w.name
  from public.workspace_invites wi
  join public.workspaces w on w.id = wi.workspace_id
  where wi.token = invite_token;
$$;

revoke all on function public.get_invite_by_token(uuid) from public;
grant execute on function public.get_invite_by_token(uuid) to anon, authenticated;

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
