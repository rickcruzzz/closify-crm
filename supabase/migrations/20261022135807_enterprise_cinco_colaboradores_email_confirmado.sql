-- Enterprise: o criador + cinco colaboradores, inclusive administradores.
-- Convites pendentes e ainda válidos reservam vagas. Nenhum membro é removido.
-- Todas as entradas travam primeiro workspaces, depois o convite: a contagem
-- permanece serializada mesmo com convites e aceites simultâneos.
begin;

create or replace function public.validar_convite_de_workspace()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_email_de_quem_convida text;
  v_owner uuid;
  v_ocupadas bigint;
begin
  new.email := lower(trim(new.email));

  select lower(email) into v_email_de_quem_convida
  from auth.users where id = auth.uid();

  if v_email_de_quem_convida is not null
     and new.email = v_email_de_quem_convida then
    raise exception 'Você já faz parte desta empresa. Convide o e-mail de outra pessoa.'
      using errcode = '42501';
  end if;

  if exists (
    select 1 from public.workspace_members m
    join auth.users u on u.id = m.user_id
    where m.workspace_id = new.workspace_id and lower(u.email) = new.email
  ) then
    raise exception 'Esta pessoa já faz parte da empresa.' using errcode = '42501';
  end if;

  -- A RPC enterprise_vigente exige participação. Quem aceita ainda não é
  -- membro, portanto os gatilhos consultam a concessão protegida diretamente.
  if new.status = 'pending' and new.expires_at > now() and exists (
    select 1 from public.enterprise_workspaces e
    where e.workspace_id = new.workspace_id and e.active
  ) then
    select w.created_by into v_owner
    from public.workspaces w where w.id = new.workspace_id for update;

    -- O índice único existente inclui todo status pending, mesmo vencido.
    -- Encerra somente a reserva vencida deste destinatário antes do INSERT,
    -- preservando o histórico e permitindo um novo convite para o mesmo e-mail.
    -- Se a criação falhar depois (inclusive por lotação), tudo é revertido.
    update public.workspace_invites i set status = 'expired'
    where i.workspace_id = new.workspace_id and i.email = new.email
      and i.status = 'pending' and i.expires_at <= now();

    select
      (select count(*) from public.workspace_members m
       where m.workspace_id = new.workspace_id and m.user_id is distinct from v_owner)
      + (select count(*) from public.workspace_invites i
         where i.workspace_id = new.workspace_id
           and i.status = 'pending' and i.expires_at > now())
    into v_ocupadas;

    if v_ocupadas >= 5 then
      raise exception 'O plano Enterprise inclui até 5 colaboradores além do titular. Cancele um convite pendente ou remova um colaborador para liberar uma vaga.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.validar_limite_de_membros()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_owner uuid;
  v_membros bigint;
  v_pendentes bigint;
  v_old_workspace uuid;
  v_old_user uuid;
begin
  if tg_op = 'UPDATE' then
    if new.workspace_id = old.workspace_id and new.user_id = old.user_id then
      return new;
    end if;
    v_old_workspace := old.workspace_id;
    v_old_user := old.user_id;
  end if;

  if exists (
    select 1 from public.enterprise_workspaces e
    where e.workspace_id = new.workspace_id and e.active
  ) then
    select w.created_by into v_owner
    from public.workspaces w where w.id = new.workspace_id for update;

    -- Um INSERT idempotente (ON CONFLICT DO NOTHING) não ocupa outra vaga.
    if exists (
      select 1 from public.workspace_members m
      where m.workspace_id = new.workspace_id and m.user_id = new.user_id
    ) then
      return new;
    end if;
    if new.user_id = v_owner then return new; end if;

    if not exists (
      select 1 from auth.users u
      where u.id = new.user_id and u.email is not null and u.email_confirmed_at is not null
    ) then
      raise exception 'Sua conta precisa de um e-mail confirmado para aceitar convites.'
        using errcode = '42501';
    end if;

    select count(*) into v_membros from public.workspace_members m
    where m.workspace_id = new.workspace_id and m.user_id is distinct from v_owner
      and not (m.workspace_id is not distinct from v_old_workspace
               and m.user_id is not distinct from v_old_user);
    select count(*) into v_pendentes from public.workspace_invites i
    where i.workspace_id = new.workspace_id
      and i.status = 'pending' and i.expires_at > now();

    if v_membros + v_pendentes >= 5 then
      raise exception 'O plano Enterprise inclui até 5 colaboradores além do titular. Cancele um convite pendente ou remova um colaborador para liberar uma vaga.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- Mantém as regras anteriores para Free/Pro e tarefas de manutenção.
  if tg_op = 'UPDATE' or auth.uid() is null then return new; end if;
  if public.pro_vigente(new.workspace_id) and not public.em_trial(new.workspace_id) then
    return new;
  end if;
  perform 1 from public.workspaces where id = new.workspace_id for update;
  select count(*) into v_membros from public.workspace_members
  where workspace_id = new.workspace_id;
  if v_membros >= 2 then
    raise exception 'Workspace atingiu o limite de % membros do plano Free.', 2
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists validar_limite_de_membros on public.workspace_members;
create trigger validar_limite_de_membros
  before insert or update of workspace_id, user_id on public.workspace_members
  for each row execute function public.validar_limite_de_membros();

create or replace function public.accept_workspace_invite(invite_token uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_invite public.workspace_invites%rowtype;
  v_workspace_id uuid;
  v_member_count bigint;
  v_user_email text;
  v_confirmed_at timestamptz;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select workspace_id into v_workspace_id from public.workspace_invites
  where token = invite_token and status = 'pending';
  if not found then raise exception 'Convite inválido ou já utilizado.'; end if;

  perform 1 from public.workspaces where id = v_workspace_id for update;
  select * into v_invite from public.workspace_invites
  where token = invite_token and workspace_id = v_workspace_id and status = 'pending'
  for update;
  if not found then raise exception 'Convite inválido ou já utilizado.'; end if;
  if v_invite.expires_at <= now() then raise exception 'Convite expirado.'; end if;

  select email, email_confirmed_at into v_user_email, v_confirmed_at
  from auth.users where id = auth.uid();
  if v_user_email is null or v_confirmed_at is null then
    raise exception 'Sua conta precisa de um e-mail confirmado para aceitar convites.'
      using errcode = '42501';
  end if;
  if lower(v_invite.email) is distinct from lower(v_user_email) then
    raise exception 'Este convite foi enviado para outro e-mail.';
  end if;

  if not public.pro_vigente(v_workspace_id) then
    select count(*) into v_member_count from public.workspace_members
    where workspace_id = v_workspace_id;
    if v_member_count >= 2 then
      raise exception 'Workspace atingiu o limite de % membros do plano Free.', 2;
    end if;
  end if;

  -- A reserva vira membro na mesma transação. Se o gatilho recusar o INSERT,
  -- esta atualização também é desfeita e o convite continua pendente.
  update public.workspace_invites set status = 'accepted' where id = v_invite.id;
  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace_id, auth.uid(), v_invite.role)
  on conflict (workspace_id, user_id) do nothing;
  return v_workspace_id;
end;
$$;

revoke all on function public.accept_workspace_invite(uuid) from public, anon;
grant execute on function public.accept_workspace_invite(uuid) to authenticated;
revoke all on function public.validar_convite_de_workspace() from public, anon, authenticated;
revoke all on function public.validar_limite_de_membros() from public, anon, authenticated;

commit;
