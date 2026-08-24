-- O trial dá funcionalidade, não estoque.
--
-- ## O furo, provado com sessão autenticada real (23/08)
--
-- A 0051 fez `pro_vigente()` devolver `true` durante os 7 dias de trial. O
-- limite de 1 empresa do Free (0018/0038) lê exatamente essa função. Resultado
-- medido no banco:
--
--     durante o trial, criou 5 empresas extras
--     depois do trial vencido: fica com 6 empresas, de graça, para sempre
--
-- O limite trava criação NOVA, nunca apaga o que já existe — comportamento
-- correto e que deve continuar. Só que combinado com o trial ele vira uma
-- janela de 7 dias para acumular recurso permanente.
--
-- O mesmo raciocínio vale para colaboradores: a trigger da 0050 também lê
-- `pro_vigente()`, então durante o trial daria para encher a equipe e ficar
-- com ela depois.
--
-- ## A distinção que resolve
--
-- Existem dois tipos de coisa atrás do Pro, e o trial não deve tratá-las
-- igual:
--
--   FUNCIONALIDADE  WhatsApp, Google Calendar, Gmail, teto de contatos.
--                   Some quando o trial acaba. É isso que a pessoa precisa
--                   experimentar para decidir se paga, e é isso que dói perder.
--
--   ESTOQUE         Empresas e colaboradores. NÃO some quando o trial acaba,
--                   porque apagar empresa ou expulsar colaborador de alguém
--                   seria pior que qualquer ganho de conversão.
--
-- Como estoque não é removível, ele não pode ser concedido por acesso
-- temporário. Durante o trial, os limites de empresa e de membros passam a ser
-- os do **Free**; o resto do Pro continua liberado.
--
-- Isso não enfraquece o trial: ninguém avalia um CRM criando cinco empresas.
-- Avalia importando os contatos, conectando o WhatsApp e vendo o funil
-- funcionar — tudo isso continua livre.

-- ============================================================================
-- 1. Quem está em trial (e não pagou)
-- ============================================================================

/**
 * Verdadeiro quando o Pro vale por TRIAL, não por assinatura paga.
 *
 * Existe para as duas travas de estoque distinguirem "está avaliando" de
 * "é cliente", sem duplicar a regra de vigência em cada uma.
 */
create or replace function public.em_trial(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select
    exists (
      select 1
        from public.workspaces w
       where w.id = target_workspace_id
         and w.trial_ate is not null
         and w.trial_ate > now()
    )
    and not exists (
      select 1
        from public.subscriptions s
       where s.workspace_id = target_workspace_id
         and s.status in ('active', 'past_due')
         and s.current_period_end is not null
         and s.current_period_end
             + (public.dias_para_compensacao_bancaria() || ' days')::interval > now()
    );
$$;

revoke all on function public.em_trial(uuid) from public, anon;
grant execute on function public.em_trial(uuid) to authenticated, service_role;

-- ============================================================================
-- 2. Empresas: o trial não vale para criar a segunda
-- ============================================================================

/**
 * Mesma RPC da 0038 e da 0051, com uma condição a mais: assinatura PAGA libera
 * várias empresas; trial, não.
 *
 * `pro_vigente(w.id) and not em_trial(w.id)` é a expressão que separa as duas
 * coisas. Fica assim, e não com uma consulta própria a `subscriptions`, para a
 * regra de vigência continuar existindo num lugar só — a 0038 já teve que
 * corrigir esta função justamente por ela ter uma cópia divergente da regra
 * de plano (lia `w.plan` em vez de `pro_vigente()`).
 */
create or replace function public.create_workspace_with_admin(workspace_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_workspace_id uuid;
  current_user_id uuid := auth.uid();
  workspaces_como_admin int;
  tem_plano_pro boolean;
  dias_de_trial constant int := 7;
begin
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select count(*) into workspaces_como_admin
  from public.workspace_members
  where user_id = current_user_id
    and role = 'admin';

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

  -- Empresa nova nasce com trial. Como a checagem acima ignora trial, quem já
  -- tem uma empresa em avaliação não chega até aqui: não existe cadeia de
  -- trials, cada conta ganha os 7 dias uma vez.
  insert into public.workspaces (name, created_by, trial_ate)
  values (workspace_name, current_user_id, now() + (dias_de_trial || ' days')::interval)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, current_user_id, 'admin');

  return new_workspace_id;
end;
$$;

revoke all on function public.create_workspace_with_admin(text) from public, anon;
grant execute on function public.create_workspace_with_admin(text) to authenticated;

-- ============================================================================
-- 3. Colaboradores: mesma regra
-- ============================================================================

/**
 * Trigger da 0050, com a mesma distinção.
 *
 * O teto de 2 continua valendo durante o trial porque colaborador também é
 * estoque: quem entrou não é expulso quando os 7 dias acabam.
 */
create or replace function public.validar_limite_de_membros()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_membros int;
  limite_free constant int := 2;
begin
  -- Sem sessão é o caminho da service role: webhook, job, scripts.
  if auth.uid() is null then
    return new;
  end if;

  if public.pro_vigente(new.workspace_id) and not public.em_trial(new.workspace_id) then
    return new;
  end if;

  -- `for update` pelo mesmo motivo da 0026: sob READ COMMITTED, dois inserts
  -- simultâneos leem a MESMA contagem antes de qualquer commit e os dois passam.
  perform 1 from public.workspaces where id = new.workspace_id for update;

  select count(*) into v_membros
    from public.workspace_members
   where workspace_id = new.workspace_id;

  if v_membros >= limite_free then
    raise exception 'Workspace atingiu o limite de % membros do plano Free.', limite_free
      using errcode = '42501';
  end if;

  return new;
end;
$$;
