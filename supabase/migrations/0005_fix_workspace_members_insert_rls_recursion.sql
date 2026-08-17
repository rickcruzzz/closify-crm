-- workspace_members_insert (criada em 0004) tinha um EXISTS direto contra
-- public.workspaces dentro do with check. Essa subquery roda como o usuário
-- autenticado e está sujeita à RLS de workspaces_select (só enxerga
-- workspace onde já é membro), no momento do bootstrap o usuário ainda não
-- é membro de lugar nenhum, então o EXISTS nunca encontrava a linha do
-- workspace mesmo com created_by correto, e o insert falhava com 42501.
--
-- Move a checagem para uma função security definer, igual já é feito para
-- is_workspace_admin/workspace_has_no_members, pra ignorar RLS na leitura.

create or replace function public.is_workspace_creator(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.workspaces
    where id = target_workspace_id
      and created_by = auth.uid()
  );
$$;

drop policy "workspace_members_insert" on public.workspace_members;
create policy "workspace_members_insert" on public.workspace_members
  for insert with check (
    (select public.is_workspace_admin(workspace_id))
    or (
      user_id = (select auth.uid())
      and (select public.workspace_has_no_members(workspace_id))
      and (select public.is_workspace_creator(workspace_id))
    )
  );
