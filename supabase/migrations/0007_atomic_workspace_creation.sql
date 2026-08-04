-- createWorkspace fazia 2 inserts separados (workspaces, depois
-- workspace_members) sem transação. Se o segundo insert falhasse (timeout,
-- erro de rede, RLS), sobrava um workspace órfão sem membro — e o usuário,
-- ao tentar de novo pelo onboarding, criava outro workspace, acumulando
-- lixo por usuário a cada falha transitória. Em produção, com volume,
-- isso não é hipotético.
--
-- Move a criação para uma função transacional: os dois inserts ocorrem na
-- mesma transação implícita da função, então uma falha em qualquer um
-- desfaz os dois. security definer porque o insert em workspace_members
-- roda antes do usuário existir como membro (mesmo bootstrap problem já
-- resolvido nas policies de RLS em 0004/0005), então a função ignora RLS
-- e faz a validação de autoria manualmente.

create or replace function public.create_workspace_with_admin(workspace_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_workspace_id uuid;
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  insert into public.workspaces (name, created_by)
  values (workspace_name, current_user_id)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, current_user_id, 'admin');

  return new_workspace_id;
end;
$$;

revoke all on function public.create_workspace_with_admin(text) from public;
grant execute on function public.create_workspace_with_admin(text) to authenticated;
