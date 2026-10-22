-- Enterprise cobre a principal e mais quatro empresas do MESMO criador.
-- A concessão manual continua única e protegida; nenhum plano é escrito no cliente.
-- Reversão: scripts/supabase/rollback-enterprise-cinco-empresas.sql.
begin;
create schema if not exists private;

create or replace function private.enterprise_cobre_empresa(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (
    select 1 from public.enterprise_workspaces e
    join public.workspaces principal on principal.id=e.workspace_id
    join public.workspaces alvo on alvo.id=target_workspace_id
    where e.active and (
      alvo.id=principal.id or (
        principal.created_by is not null and alvo.created_by=principal.created_by
        and alvo.id in (
          select irma.id from public.workspaces irma
          where irma.created_by=principal.created_by and irma.id<>principal.id
          order by irma.created_at,irma.id limit 4
        )
      )
    )
  );
$$;
revoke all on function private.enterprise_cobre_empresa(uuid) from public,anon,authenticated,service_role;

create or replace function public.enterprise_vigente(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select public.is_workspace_member(target_workspace_id)
    and private.enterprise_cobre_empresa(target_workspace_id);
$$;

CREATE OR REPLACE FUNCTION public.pro_vigente(target_workspace_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select private.enterprise_cobre_empresa(target_workspace_id) or exists (
    select 1 from public.subscriptions s
    where s.workspace_id = target_workspace_id
      and s.status in ('active', 'past_due')
      and s.current_period_end is not null
      and s.current_period_end
        + (public.dias_de_graca(s.ultimo_billing_type) || ' days')::interval > now()
  ) or exists (
    select 1 from public.workspaces w
    where w.id = target_workspace_id
      and w.trial_ate is not null and w.trial_ate > now()
  ) or exists (
    select 1 from public.workspaces alvo
    join public.workspaces irma on irma.created_by = alvo.created_by
    join public.subscriptions s on s.workspace_id = irma.id
    where alvo.id = target_workspace_id
      and alvo.created_by is not null
      and s.status in ('active', 'past_due')
      and s.current_period_end is not null
      and s.current_period_end
        + (public.dias_de_graca(s.ultimo_billing_type) || ' days')::interval > now()
  );
$function$;

CREATE OR REPLACE FUNCTION public.max_vigente(target_workspace_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select private.enterprise_cobre_empresa(target_workspace_id) or exists (
    select 1 from public.subscriptions s
    where s.workspace_id = target_workspace_id
      and s.plano = 'max'
      and s.status in ('active', 'past_due')
      and s.current_period_end is not null
      and s.current_period_end
        + (public.dias_de_graca(s.ultimo_billing_type) || ' days')::interval > now()
  );
$function$;

CREATE OR REPLACE FUNCTION public.validar_convite_de_workspace()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if new.status = 'pending' and new.expires_at > now() and private.enterprise_cobre_empresa(new.workspace_id) then
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
$function$;

CREATE OR REPLACE FUNCTION public.validar_limite_de_membros()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  if private.enterprise_cobre_empresa(new.workspace_id) then
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
$function$;

-- Os dois nomes públicos usam a MESMA regra; a UI usa o nome em inglês.
create or replace function public.create_workspace_with_admin(workspace_name text)
returns uuid language plpgsql security definer set search_path to '' as $$
declare
  v_usuario uuid := auth.uid();
  v_nova uuid;
  v_quantidade int;
  v_enterprise boolean;
  v_pro boolean;
  v_max boolean;
  v_teto int;
begin
  if v_usuario is null then raise exception 'not_authenticated'; end if;
  -- Serializa as criações do mesmo titular, inclusive entre os dois nomes RPC.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('workspace:'||v_usuario::text,0));
  select count(*) into v_quantidade from public.workspaces where created_by=v_usuario;
  select exists (
    select 1 from public.enterprise_workspaces e
    join public.workspaces w on w.id=e.workspace_id
    where e.active and w.created_by=v_usuario
  ) into v_enterprise;
  select exists (
    select 1 from public.workspaces w where w.created_by=v_usuario
    and public.pro_vigente(w.id) and not public.em_trial(w.id)
  ) into v_pro;
  select exists (
    select 1 from public.workspaces w where w.created_by=v_usuario and public.max_vigente(w.id)
  ) into v_max;
  v_teto := case when v_enterprise then 5 when v_max then 10 when v_pro then 5 else 1 end;
  if v_quantidade >= v_teto then
    if v_enterprise then
      raise exception 'O plano Enterprise inclui até 5 empresas do titular.' using errcode='42501';
    elsif v_max then
      raise exception 'O plano Max inclui 10 empresas. Fale com a gente para ter mais.' using errcode='42501';
    elsif v_pro then
      raise exception 'O plano Pro inclui 5 empresas. Assine o Max para gerenciar até 10.' using errcode='42501';
    else
      raise exception 'O plano Free inclui 1 empresa. Faça upgrade para o Pro para gerenciar várias.' using errcode='42501';
    end if;
  end if;
  insert into public.workspaces(name,created_by) values(workspace_name,v_usuario) returning id into v_nova;
  insert into public.workspace_members(workspace_id,user_id,role) values(v_nova,v_usuario,'admin');
  return v_nova;
end;
$$;
revoke all on function public.create_workspace_with_admin(text) from public,anon;
grant execute on function public.create_workspace_with_admin(text) to authenticated;

create or replace function public.criar_workspace_com_admin(workspace_name text)
returns uuid language sql security invoker set search_path to '' as $$
  select public.create_workspace_with_admin(workspace_name);
$$;
revoke all on function public.criar_workspace_com_admin(text) from public,anon;
grant execute on function public.criar_workspace_com_admin(text) to authenticated;

-- Somente a automação do servidor pode enumerar todas as empresas cobertas.
create or replace function public.listar_empresas_enterprise_ativas()
returns table(workspace_id uuid) language sql stable security definer set search_path to '' as $$
  select w.id from public.workspaces w where private.enterprise_cobre_empresa(w.id);
$$;
revoke all on function public.listar_empresas_enterprise_ativas() from public,anon,authenticated;
grant execute on function public.listar_empresas_enterprise_ativas() to service_role;
comment on function public.enterprise_vigente(uuid) is
  'Enterprise para membros da principal e até quatro empresas irmãs do mesmo created_by. Concessão manual e revogável.';
comment on function public.create_workspace_with_admin(text) is
  'Criação serializada por titular: Enterprise 5, Max 10, Pro 5, Free 1. Conta created_by, nunca convites.';
commit;
