-- Snapshot anterior à herança Enterprise; restaura regras sem apagar dados.
begin;
CREATE OR REPLACE FUNCTION public.create_workspace_with_admin(workspace_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  new_workspace_id uuid;
  current_user_id uuid := auth.uid();
  workspaces_como_admin int;
  tem_plano_pro boolean;
begin
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select count(*) into workspaces_como_admin
  from public.workspace_members
  where user_id = current_user_id
    and role = 'admin';

  -- `not em_trial` continua aqui de propósito. Ele não é mais alcançável por
  -- empresa nova, mas as que estão em avaliação agora ainda passam por esta
  -- checagem enquanto o prazo delas não vence — e durante o trial ninguém
  -- ganha direito à segunda empresa, que era a regra da 0053.
  select exists (
    select 1
    from public.workspace_members m
    join public.workspaces w on w.id = m.workspace_id
    where m.user_id = current_user_id
      and m.role = 'admin'
      and public.pro_vigente(w.id)
      and not public.em_trial(w.id)
  ) into tem_plano_pro;

  if not tem_plano_pro and workspaces_como_admin >= 1 then
    raise exception 'O plano Free inclui 1 empresa. Faça upgrade para o Pro para gerenciar várias.';
  end if;

  -- Sem `trial_ate`: a coluna fica nula e `em_trial()` devolve false desde o
  -- primeiro instante. É a única diferença em relação à versão da 0053.
  insert into public.workspaces (name, created_by)
  values (workspace_name, current_user_id)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, current_user_id, 'admin');

  return new_workspace_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.criar_workspace_com_admin(workspace_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  new_workspace_id uuid;
  current_user_id uuid := auth.uid();
  empresas_do_dono int;
  tem_plano_pro boolean;
  tem_plano_max boolean;
  teto int;
begin
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select count(*) into empresas_do_dono
  from public.workspaces
  where created_by = current_user_id;

  select exists (
    select 1
    from public.workspaces w
    where w.created_by = current_user_id
      and public.pro_vigente(w.id)
  ) into tem_plano_pro;

  select exists (
    select 1
    from public.workspaces w
    where w.created_by = current_user_id
      and public.max_vigente(w.id)
  ) into tem_plano_max;

  teto := case
            when tem_plano_max then 10
            when tem_plano_pro then 5
            else 1
          end;

  if empresas_do_dono >= teto then
    -- Tres mensagens e nao duas: quem ja esta no Max e bateu em dez precisa
    -- ouvir outra coisa que quem esta no Pro, senao a tela oferece um upgrade
    -- que a pessoa ja tem. E o defeito de 18/08, "Seu Pro venceu, reative"
    -- aparecendo para quem nunca teve Pro, do outro lado.
    if tem_plano_max then
      raise exception 'O plano Max inclui 10 empresas. Fale com a gente para ter mais.';
    elsif tem_plano_pro then
      raise exception 'O plano Pro inclui 5 empresas. Assine o Max para gerenciar até 10.';
    else
      raise exception 'O plano Free inclui 1 empresa. Faça upgrade para o Pro para gerenciar várias.';
    end if;
  end if;

  insert into public.workspaces (name, created_by)
  values (workspace_name, current_user_id)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, current_user_id, 'admin');

  return new_workspace_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.enterprise_vigente(target_workspace_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select public.is_workspace_member(target_workspace_id)
    and exists (
      select 1 from public.enterprise_workspaces e
      where e.workspace_id = target_workspace_id and e.active
    );
$function$;

CREATE OR REPLACE FUNCTION public.max_vigente(target_workspace_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.enterprise_workspaces e
    where e.workspace_id = target_workspace_id and e.active
  ) or exists (
    select 1 from public.subscriptions s
    where s.workspace_id = target_workspace_id
      and s.plano = 'max'
      and s.status in ('active', 'past_due')
      and s.current_period_end is not null
      and s.current_period_end
        + (public.dias_de_graca(s.ultimo_billing_type) || ' days')::interval > now()
  );
$function$;

CREATE OR REPLACE FUNCTION public.pro_vigente(target_workspace_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.enterprise_workspaces e
    where e.workspace_id = target_workspace_id and e.active
  ) or exists (
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
$function$;
drop function if exists public.listar_empresas_enterprise_ativas();
drop function if exists private.enterprise_cobre_empresa(uuid);
commit;
