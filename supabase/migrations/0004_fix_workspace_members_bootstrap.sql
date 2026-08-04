-- workspace_members_insert exigia is_workspace_admin(workspace_id), mas no
-- fluxo de onboarding o usuário ainda não é membro de lugar nenhum — a
-- policy nunca passava e travava a criação do primeiro admin do workspace.
--
-- Libera o insert quando quem insere já é admin do workspace (convite de
-- colaborador) ou quando é o próprio criador do workspace fazendo o
-- bootstrap do primeiro admin. Bootstrap por "workspace sem membros" sozinho
-- seria um IDOR: qualquer usuário autenticado poderia se auto-inserir como
-- admin de um workspace órfão (ex.: criado por outro usuário cujo segundo
-- insert falhou no meio do onboarding). Por isso o bootstrap exige também
-- ser o criador do workspace (workspaces.created_by), não só "sem membros".

alter table public.workspaces
  add column created_by uuid references auth.users (id) on delete set null;

create or replace function public.workspace_has_no_members(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select not exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
  );
$$;

drop policy "workspaces_insert" on public.workspaces;
create policy "workspaces_insert" on public.workspaces
  for insert with check (created_by = (select auth.uid()));

drop policy "workspace_members_insert" on public.workspace_members;
create policy "workspace_members_insert" on public.workspace_members
  for insert with check (
    (select public.is_workspace_admin(workspace_id))
    or (
      user_id = (select auth.uid())
      and (select public.workspace_has_no_members(workspace_id))
      and exists (
        select 1
        from public.workspaces
        where id = workspace_id
          and created_by = (select auth.uid())
      )
    )
  );
