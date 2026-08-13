-- Velo Funil — corrige regressão introduzida pela própria 0038.
--
-- Revisão cruzada com o agente sql-pro achou dois problemas reais na trigger
-- `impedir_workspace_sem_admin` (0038), o primeiro grave:
--
-- 1. CRÍTICO: `excluir_minha_conta()` (0017, LGPD art. 18 VI) apaga o
--    workspace inteiro quando o titular é o único membro — `delete from
--    workspaces` dispara cascade em `workspace_members`, e a trigger nova
--    via essa linha como "o admin está saindo", não achava outro admin
--    (era o único) e recusava o DELETE com exceção, que sobe e desfaz a
--    transação inteira. Quebrava a exclusão de conta para o caso mais comum
--    do banco: quem nunca convidou ninguém.
-- 2. ALTO: a trigger é `for each row`, e cada linha vê o snapshot do INÍCIO
--    da instrução — um único UPDATE/DELETE em lote (ex.: PATCH no PostgREST
--    filtrando `role=eq.admin` de um workspace com 2+ admins) rebaixa todos
--    de uma vez, e cada linha, avaliada isoladamente, ainda enxerga as
--    outras como admin. Zera os admins do workspace sem precisar de
--    corrida entre transações — só de uma instrução multi-linha.

-- ============================================================================
-- Fix 1 — não bloquear quando o workspace inteiro está sendo desmontado
-- ============================================================================
create or replace function public.impedir_workspace_sem_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_perde_status_de_admin boolean;
  v_ficaria_sem_admin boolean;
begin
  if old.role <> 'admin' then
    return coalesce(new, old);
  end if;

  -- O cascade de `delete from workspaces` (excluir_minha_conta, 0017) apaga
  -- a linha de `workspaces` ANTES de disparar o cascade em
  -- `workspace_members`, na mesma transação. Se o workspace já não existe
  -- mais, não faz sentido exigir admin nele — ele está sendo desmontado
  -- inteiro, não abandonado.
  if not exists (select 1 from public.workspaces where id = old.workspace_id) then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    v_perde_status_de_admin := true;
  else
    v_perde_status_de_admin := new.role is distinct from 'admin';
  end if;

  if not v_perde_status_de_admin then
    return new;
  end if;

  select not exists (
    select 1 from public.workspace_members
     where workspace_id = old.workspace_id
       and role = 'admin'
       and user_id <> old.user_id
  ) into v_ficaria_sem_admin;

  if v_ficaria_sem_admin then
    raise exception 'A empresa precisa de pelo menos um administrador.'
      using errcode = '42501';
  end if;

  return coalesce(new, old);
end;
$$;

-- ============================================================================
-- Fix 2 — trava de nível de instrução, pra pegar UPDATE/DELETE em lote
-- ============================================================================
--
-- Trigger de LINHA não resolve isto: dentro da MESMA instrução, travar a
-- linha que está sendo alterada não ajuda quando o problema é o conjunto de
-- N linhas irmãs mudando junto. A ferramenta certa é uma trigger de
-- INSTRUÇÃO com transition table (`referencing old table`/`new table`,
-- Postgres 10+): roda UMA vez depois que a instrução inteira já aplicou
-- todas as mudanças, e aí sim vê o resultado final de verdade.
create or replace function public.impedir_workspace_sem_admin_apos_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from (select distinct workspace_id from old_rows) afetados
    join public.workspaces w on w.id = afetados.workspace_id
    where not exists (
      select 1 from public.workspace_members m
       where m.workspace_id = afetados.workspace_id
         and m.role = 'admin'
    )
  ) then
    raise exception 'A empresa precisa de pelo menos um administrador.'
      using errcode = '42501';
  end if;
  return null;
end;
$$;

create trigger impedir_workspace_sem_admin_apos_update
  after update on public.workspace_members
  referencing old table as old_rows
  for each statement
  execute function public.impedir_workspace_sem_admin_apos_update();

-- DELETE em lote usa a MESMA função (só o nome da transition table muda na
-- declaração da trigger) — Postgres não deixa reusar `old table` entre
-- triggers UPDATE e DELETE na mesma declaração, por isso duas triggers
-- separadas apontando pra mesma function.
create trigger impedir_workspace_sem_admin_apos_delete
  after delete on public.workspace_members
  referencing old table as old_rows
  for each statement
  execute function public.impedir_workspace_sem_admin_apos_update();

-- ============================================================================
-- Fix 3 (menor, UX) — mensagem específica para conta sem e-mail confirmado
-- ============================================================================
--
-- A 0038 restaurou `is distinct from` (fecha o fail-open de verdade — sem
-- e-mail, a comparação já recusa o convite), mas perdeu a mensagem
-- específica que a 0012 tinha para esse caso. Sem risco de segurança, só
-- clareza: hoje a pessoa vê "convite pra outro e-mail" quando o problema real
-- é "sua conta não tem e-mail confirmado".
create or replace function public.accept_workspace_invite(invite_token uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite record;
  v_member_count int;
  v_user_email text;
  limite_free_membros constant int := 2;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
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

  select email into v_user_email from auth.users where id = auth.uid();

  if v_user_email is null then
    raise exception 'Sua conta precisa de um e-mail confirmado para aceitar convites.';
  end if;

  if lower(v_invite.email) is distinct from lower(v_user_email) then
    raise exception 'Este convite foi enviado para outro e-mail.';
  end if;

  if not public.pro_vigente(v_invite.workspace_id) then
    select count(*) into v_member_count
      from public.workspace_members
     where workspace_id = v_invite.workspace_id;

    if v_member_count >= limite_free_membros then
      raise exception 'Workspace atingiu o limite de % membros do plano Free.', limite_free_membros;
    end if;
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_invite.workspace_id, auth.uid(), v_invite.role)
  on conflict (workspace_id, user_id) do nothing;

  update public.workspace_invites set status = 'accepted' where id = v_invite.id;
end;
$$;

-- ============================================================================
-- Fix 4 (menor, performance) — pular a checagem de referência quando o
-- vínculo não mudou
-- ============================================================================
--
-- `deals` já tem `tocar_datas_do_negocio` (0033) rodando em todo UPDATE,
-- inclusive o arrasto de card no Kanban — o UPDATE mais frequente do
-- produto. Sem esta guarda, cada arrasto pagava também um EXISTS contra
-- `leads` mesmo quando `lead_id` não mudou nada.
create or replace function public.checar_referencia_de_tarefa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.lead_id is not null
     and (tg_op = 'INSERT' or new.lead_id is distinct from old.lead_id)
     and not exists (
       select 1 from public.leads where id = new.lead_id and workspace_id = new.workspace_id
     ) then
    raise exception 'Lead referenciado pertence a outra empresa.'
      using errcode = '42501';
  end if;

  if new.deal_id is not null
     and (tg_op = 'INSERT' or new.deal_id is distinct from old.deal_id)
     and not exists (
       select 1 from public.deals where id = new.deal_id and workspace_id = new.workspace_id
     ) then
    raise exception 'Negócio referenciado pertence a outra empresa.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.checar_referencia_de_negocio()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.lead_id is not null
     and (tg_op = 'INSERT' or new.lead_id is distinct from old.lead_id)
     and not exists (
       select 1 from public.leads where id = new.lead_id and workspace_id = new.workspace_id
     ) then
    raise exception 'Lead referenciado pertence a outra empresa.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;
