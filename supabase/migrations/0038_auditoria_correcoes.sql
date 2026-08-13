-- Velo Funil — correções da auditoria de 13/08/2026 (docs/prd-conversao-pro.md
-- não cobre isto; ver histórico de conversa). Cinco achados, dois graves.

-- ============================================================================
-- FALHA 1 (segurança) — accept_workspace_invite perdeu o fail-open fix da 0012
-- ============================================================================
--
-- A 0028 reescreveu a função inteira pra trocar a checagem de plano por
-- `pro_vigente()`, e ao reescrever a partir da versão antiga (0011) perdeu
-- dois endurecimentos que a 0012 já tinha aplicado:
--
-- 1. `v_invite.email <> (select email from auth.users where id = auth.uid())`
--    — em SQL, `x <> NULL` avalia pra NULL, e `if NULL then` nunca dispara.
--    Se a conta que aceita tiver `auth.users.email` NULL, a checagem de
--    e-mail é pulada em silêncio: qualquer convite pendente cujo token seja
--    descoberto é aceitável, mesmo endereçado a outro e-mail.
-- 2. `search_path = public` em vez de `search_path = ''` — reverte o
--    endurecimento que a 0006/0012 aplicaram no schema inteiro.
--
-- Volta a usar `is distinct from` (nunca avalia pra NULL) + guarda explícita
-- de sessão + `search_path = ''`. A parte de `pro_vigente()` da 0028
-- continua igual.
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

  -- `is distinct from` nunca avalia pra NULL: se `v_user_email` for NULL, a
  -- comparação vira `true` (são distintos) e o convite é recusado — o oposto
  -- do `<>`, que pulava a checagem inteira nesse caso.
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
-- FALHA 2 (billing) — create_workspace_with_admin lê a coluna, não a validade
-- ============================================================================
--
-- A 0027 introduziu `pro_vigente()` exatamente porque `workspaces.plan` é só
-- o último valor gravado pelo webhook e não sabe que o período pago venceu —
-- e corrigiu o limite de leads e (na 0028) o aceite de convite, mas esta RPC,
-- que é a PORTA DE ENTRADA do limite de 1 empresa no Free, nunca foi
-- atualizada. Admin com Pro vencido, coluna ainda não sincronizada, criava
-- empresa extra sem pagar.
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
begin
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select count(*) into workspaces_como_admin
  from public.workspace_members
  where user_id = current_user_id
    and role = 'admin';

  -- Troca de `w.plan = 'pro'` para `pro_vigente(w.id)` — a única mudança
  -- desta função.
  select exists (
    select 1
    from public.workspace_members m
    join public.workspaces w on w.id = m.workspace_id
    where m.user_id = current_user_id
      and m.role = 'admin'
      and public.pro_vigente(w.id)
  ) into tem_plano_pro;

  if not tem_plano_pro and workspaces_como_admin >= 1 then
    raise exception 'O plano Free inclui 1 empresa. Faça upgrade para o Pro para gerenciar várias.';
  end if;

  insert into public.workspaces (name, created_by)
  values (workspace_name, current_user_id)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, current_user_id, 'admin');

  return new_workspace_id;
end;
$$;

-- ============================================================================
-- Achado 4 — admin único pode zerar os admins do próprio workspace
-- ============================================================================
--
-- `updateMemberRole`/`removeMember` (lib/workspace/actions.ts) checam em
-- TypeScript que sobra pelo menos 1 admin, mas a policy de
-- `workspace_members` (0003) só exige `is_workspace_admin` de quem executa —
-- não que a operação não zere os admins. Contornando a Server Action via
-- supabase-js, um admin único rebaixa/remove a própria linha e trava a
-- empresa sem ninguém que possa gerenciar.
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
  -- Só interessa quando a linha afetada JÁ ERA admin. `new` não existe de
  -- verdade num trigger de DELETE — por isso `tg_op` decide o ramo ANTES de
  -- qualquer referência a `new.role`, em vez de depender de short-circuit
  -- numa expressão booleana só.
  if old.role <> 'admin' then
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

create trigger impedir_workspace_sem_admin
  before update or delete on public.workspace_members
  for each row
  execute function public.impedir_workspace_sem_admin();

-- ============================================================================
-- Achado 5 — task/deal podem referenciar lead/negócio de outro workspace
-- ============================================================================
--
-- `conferirAlvo` (lib/tasks/actions.ts) e `createDeal` (lib/deals/actions.ts)
-- checam em TypeScript que `lead_id`/`deal_id` referenciado é do mesmo
-- workspace da linha sendo criada — a policy de `tasks`/`deals` (0003/0029)
-- só olha o `workspace_id` da própria linha, não o dos relacionamentos.
-- Contornando a Server Action, dá pra criar task/deal no próprio workspace
-- apontando pra lead de outro (sabendo o UUID) — não vaza dado, mas cria
-- referência cruzada inconsistente.
-- Duas funções, não uma compartilhada por `tg_table_name`: `deals` não tem
-- coluna `deal_id`, e acesso a campo INEXISTENTE num RECORD estoura em tempo
-- de execução mesmo dentro de um `and` cujo lado esquerdo já seria `false` —
-- diferente de um valor NULL, que o `and` de fato blinda. Confirmado testando
-- contra produção: a versão com uma função só quebrava todo insert em `deals`.
create or replace function public.checar_referencia_de_tarefa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.lead_id is not null and not exists (
    select 1 from public.leads where id = new.lead_id and workspace_id = new.workspace_id
  ) then
    raise exception 'Lead referenciado pertence a outra empresa.'
      using errcode = '42501';
  end if;

  if new.deal_id is not null and not exists (
    select 1 from public.deals where id = new.deal_id and workspace_id = new.workspace_id
  ) then
    raise exception 'Negócio referenciado pertence a outra empresa.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger checar_referencia_de_tarefa
  before insert or update on public.tasks
  for each row
  execute function public.checar_referencia_de_tarefa();

create or replace function public.checar_referencia_de_negocio()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.lead_id is not null and not exists (
    select 1 from public.leads where id = new.lead_id and workspace_id = new.workspace_id
  ) then
    raise exception 'Lead referenciado pertence a outra empresa.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger checar_referencia_de_negocio
  before insert or update on public.deals
  for each row
  execute function public.checar_referencia_de_negocio();
