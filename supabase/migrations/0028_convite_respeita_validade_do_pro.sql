-- O aceite de convite passa a olhar a validade do Pro, não a coluna `plan`.
--
-- `accept_workspace_invite` (0011) decide o limite de membros assim:
--
--   select plan into v_plan from public.workspaces where id = ...;
--   if v_plan = 'free' and v_member_count >= 2 then raise ...
--
-- Depois da 0027 isso ficou incoerente com o resto do sistema. A coluna `plan`
-- é o último valor gravado pelo webhook e não sabe que o período pago venceu;
-- quem sabe é `pro_vigente()`. Um workspace com Pro vencido, cuja coluna ainda
-- não passou pela sincronização preguiçosa, aceitaria o terceiro membro, e a
-- trigger de leads, que já usa `pro_vigente`, recusaria o lead dele. Duas
-- regras do mesmo plano respondendo coisas diferentes.
--
-- O `2` escrito à mão vai junto. Ele repete `FREE_MEMBER_LIMIT` de
-- lib/plans.ts, e não há como o Postgres ler a constante do TypeScript, mas
-- dá para ao menos declará-la uma vez aqui, em vez de espalhar o número pelo
-- corpo da função.
--
-- O resto da função continua igual: a conferência do e-mail, da expiração e o
-- `for update` que serializa aceites simultâneos já estavam certos.

create or replace function public.accept_workspace_invite(invite_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite record;
  v_member_count int;
  limite_free_membros constant int := 2;
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

  -- Aqui está a mudança: validade real em vez da coluna.
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
