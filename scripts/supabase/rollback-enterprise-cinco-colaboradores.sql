-- Reverte apenas 20261022135807_enterprise_cinco_colaboradores_email_confirmado.
-- Restaura as funções das migrations 0024, 0048 e 0053, sem excluir dados.
-- Também restaura o comportamento anterior que não exigia email_confirmed_at.
-- Executar somente se houver decisão de reverter a alteração do Enterprise.
begin;

create or replace function public.validar_convite_de_workspace()
returns trigger language plpgsql security definer set search_path to ''
as $$
declare v_email_de_quem_convida text;
begin
  new.email := lower(trim(new.email));
  select lower(email) into v_email_de_quem_convida from auth.users where id = auth.uid();
  if v_email_de_quem_convida is not null and new.email = v_email_de_quem_convida then
    raise exception 'Você já faz parte desta empresa. Convide o e-mail de outra pessoa.'
      using errcode = '42501';
  end if;
  if exists (
    select 1 from public.workspace_members m join auth.users u on u.id = m.user_id
    where m.workspace_id = new.workspace_id and lower(u.email) = new.email
  ) then
    raise exception 'Esta pessoa já faz parte da empresa.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.validar_limite_de_membros()
returns trigger language plpgsql security definer set search_path to ''
as $$
declare v_membros int; limite_free constant int := 2;
begin
  if auth.uid() is null then return new; end if;
  if public.pro_vigente(new.workspace_id) and not public.em_trial(new.workspace_id) then
    return new;
  end if;
  perform 1 from public.workspaces where id = new.workspace_id for update;
  select count(*) into v_membros from public.workspace_members where workspace_id = new.workspace_id;
  if v_membros >= limite_free then
    raise exception 'Workspace atingiu o limite de % membros do plano Free.', limite_free
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists validar_limite_de_membros on public.workspace_members;
create trigger validar_limite_de_membros before insert on public.workspace_members
  for each row execute function public.validar_limite_de_membros();

create or replace function public.accept_workspace_invite(invite_token uuid)
returns uuid language plpgsql security definer set search_path to ''
as $$
declare
  v_invite record;
  v_member_count int;
  v_user_email text;
  limite_free_membros constant int := 2;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into v_invite from public.workspace_invites
  where token = invite_token and status = 'pending' for update;
  if not found then raise exception 'Convite inválido ou já utilizado.'; end if;
  if v_invite.expires_at < now() then
    update public.workspace_invites set status = 'expired' where id = v_invite.id;
    raise exception 'Convite expirado.';
  end if;
  select email into v_user_email from auth.users where id = auth.uid();
  if v_user_email is null then
    raise exception 'Sua conta precisa de um e-mail confirmado para aceitar convites.';
  end if;
  if lower(v_invite.email) is distinct from lower(v_user_email) then
    raise exception 'Este convite foi enviado para outro e-mail.';
  end if;
  if not public.pro_vigente(v_invite.workspace_id) then
    select count(*) into v_member_count from public.workspace_members
    where workspace_id = v_invite.workspace_id;
    if v_member_count >= limite_free_membros then
      raise exception 'Workspace atingiu o limite de % membros do plano Free.', limite_free_membros;
    end if;
  end if;
  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_invite.workspace_id, auth.uid(), v_invite.role)
  on conflict (workspace_id, user_id) do nothing;
  update public.workspace_invites set status = 'accepted' where id = v_invite.id;
  return v_invite.workspace_id;
end;
$$;

revoke all on function public.accept_workspace_invite(uuid) from public, anon;
grant execute on function public.accept_workspace_invite(uuid) to authenticated;
grant execute on function public.validar_convite_de_workspace() to public;
grant execute on function public.validar_limite_de_membros() to public;
commit;
