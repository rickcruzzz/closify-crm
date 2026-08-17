-- Best practices do skill supabase-postgres-best-practices aplicadas ao schema
-- existente (0001-0005), sem alterar comportamento:
--
-- 1) Índices em colunas de FK que não tinham cobertura própria. Sem índice,
--    JOIN/filtro por owner_id/author_id/created_by faz Seq Scan e o
--    ON DELETE SET NULL dessas FKs varre a tabela toda.
-- 2) search_path das funções security definer trocado de 'public' para ''
--    (empty search_path), todas já referenciam public.<tabela> de forma
--    qualificada, então não muda comportamento; só remove a dependência
--    implícita do search_path da sessão, prevenindo schema hijacking caso
--    alguém crie um objeto malicioso em outro schema do search_path.

create index leads_owner_id_idx on public.leads (owner_id);
create index deals_owner_id_idx on public.deals (owner_id);
create index activities_author_id_idx on public.activities (author_id);
create index workspaces_created_by_idx on public.workspaces (created_by);

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_admin(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.workspace_has_no_members(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select not exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
  );
$$;

create or replace function public.is_workspace_creator(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.workspaces
    where id = target_workspace_id
      and created_by = auth.uid()
  );
$$;
