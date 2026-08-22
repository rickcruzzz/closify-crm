-- Bug real reportado pelo dono: quem aceita convite entra na empresa
-- ERRADA (a mais antiga que já participava, ou a que acabou de criar no
-- cadastro), nunca na empresa de quem convidou.
--
-- Causa raiz, achada lendo o código: `accept_workspace_invite` devolve
-- `void`. Depois de aceitar, os dois pontos que chamam a função
-- (app/convite/[token]/page.tsx no aceite automático via GET, e
-- lib/workspace/actions.ts::acceptInvite no aceite manual) redirecionam
-- direto para `/dashboard` SEM nunca gravar o cookie `vf_empresa`
-- (lib/workspace/ativo.ts). `resolverWorkspaceAtivo` então cai no
-- fallback documentado: "sem escolha guardada, a empresa mais antiga" —
-- que quase nunca é a empresa do convite recém-aceito.
--
-- A correção real é fazer a função devolver o `workspace_id` que ela
-- inseriu em `workspace_members`, para quem chama poder gravar o cookie
-- na hora — sem isso, os dois callers TypeScript teriam que fazer uma
-- segunda consulta (buscar o invite de novo pelo token) só para saber
-- em qual empresa a pessoa acabou de entrar, informação que a própria
-- função já tem na mão.

-- Postgres recusa `create or replace function` quando o tipo de RETORNO
-- muda (`void` para `uuid`) — só permite quando nome e parâmetros são
-- idênticos e o retorno também. Precisa dropar antes.
drop function if exists public.accept_workspace_invite(uuid);

create function public.accept_workspace_invite(invite_token uuid)
returns uuid
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

  return v_invite.workspace_id;
end;
$$;

-- `drop function` apaga os grants junto com a função — precisa reconceder
-- exatamente o que a 0012/0013 já tinham fixado: `authenticated` executa,
-- `anon` e o `public` amplo não. Sem isto, esta migration reabriria (por
-- omissão, não por intenção) o mesmo buraco que a 0012 fechou.
revoke all on function public.accept_workspace_invite(uuid) from public;
grant execute on function public.accept_workspace_invite(uuid) to authenticated;
revoke execute on function public.accept_workspace_invite(uuid) from anon;
