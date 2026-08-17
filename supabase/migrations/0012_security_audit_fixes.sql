-- Correções da auditoria de segurança pré-deploy (M17).
--
-- 1) accept_workspace_invite ficou sem revoke/grant: no Postgres, toda função
--    nova recebe EXECUTE para PUBLIC por padrão, então anon podia chamá-la.
--    Pior, a checagem de e-mail usava `<>` contra uma subquery que devolve
--    NULL quando auth.uid() é nulo (ou quando o usuário não tem e-mail, caso
--    possível com OAuth e "allow users without email"). `'x' <> NULL` é NULL,
--    não true, o `if` não disparava e a checagem falhava EM ABERTO. Trocado
--    por `is distinct from`, mais guarda explícita de sessão.
-- 2) get_invite_by_token e accept_workspace_invite ficaram com
--    `search_path = public` enquanto a 0006 endureceu todo o resto do schema
--    para `''`. Alinhado (as queries já são schema-qualified).
-- 3) Helpers is_workspace_* / workspace_has_no_members nunca tiveram revoke.
--    Retornam só booleanos sobre o próprio chamador, mas não há motivo para
--    anon poder executá-los.
--    ATENÇÃO: os `revoke ... from public` abaixo foram testados contra o banco
--    real e NÃO surtem efeito, o Supabase concede EXECUTE explicitamente a
--    `anon` via default privileges, e revogar de PUBLIC não remove grant de
--    role. A correção que funciona está na 0013.
-- 4) Webhook do Asaas não tinha idempotência: reenviar um PAYMENT_CONFIRMED
--    legítimo reativava plan='pro' depois de um cancelamento. Tabela de
--    eventos processados com unique no id do evento resolve replay e também
--    os retries normais do Asaas.

-- ============================================================================
-- 1 + 2) accept_workspace_invite: fecha o fail-open e endurece search_path
-- ============================================================================

create or replace function public.accept_workspace_invite(invite_token uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite record;
  v_member_count int;
  v_plan public.workspace_plan;
  v_user_email text;
begin
  if auth.uid() is null then
    raise exception 'Convite inválido ou já utilizado.';
  end if;

  select email into v_user_email from auth.users where id = auth.uid();

  if v_user_email is null then
    raise exception 'Sua conta precisa de um e-mail confirmado para aceitar convites.';
  end if;

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

  -- is distinct from trata NULL como valor: nunca devolve NULL, então a
  -- comparação não pode mais passar por omissão.
  if lower(v_invite.email) is distinct from lower(v_user_email) then
    raise exception 'Este convite foi enviado para outro e-mail.';
  end if;

  select plan into v_plan from public.workspaces where id = v_invite.workspace_id;
  select count(*) into v_member_count
  from public.workspace_members
  where workspace_id = v_invite.workspace_id;

  if v_plan = 'free' and v_member_count >= 2 then
    raise exception 'Workspace atingiu o limite de 2 membros do plano Free.';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_invite.workspace_id, auth.uid(), v_invite.role)
  on conflict (workspace_id, user_id) do nothing;

  update public.workspace_invites set status = 'accepted' where id = v_invite.id;
end;
$$;

revoke all on function public.accept_workspace_invite(uuid) from public;
grant execute on function public.accept_workspace_invite(uuid) to authenticated;

-- get_invite_by_token continua acessível a anon de propósito (a tela de
-- convite é pública), mas com search_path endurecido.
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
set search_path = ''
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
-- 3) Helpers de autorização: tira o EXECUTE default de PUBLIC
-- ============================================================================

revoke all on function public.is_workspace_member(uuid) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;

revoke all on function public.is_workspace_admin(uuid) from public;
grant execute on function public.is_workspace_admin(uuid) to authenticated;

revoke all on function public.is_workspace_creator(uuid) from public;
grant execute on function public.is_workspace_creator(uuid) to authenticated;

revoke all on function public.workspace_has_no_members(uuid) from public;
grant execute on function public.workspace_has_no_members(uuid) to authenticated;

-- ============================================================================
-- 4) Idempotência do webhook do Asaas
-- ============================================================================

create table public.asaas_webhook_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

-- RLS ligada e SEM policy nenhuma: só a service_role (que ignora RLS) grava
-- aqui, a partir do route handler do webhook. Nenhum client tem acesso.
alter table public.asaas_webhook_events enable row level security;

-- Housekeeping: o histórico só serve pra deduplicar retries, não é auditoria.
create index asaas_webhook_events_processed_at_idx
  on public.asaas_webhook_events (processed_at);
