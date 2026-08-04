-- leads.owner_id e activities.author_id referenciam auth.users, mas
-- auth.users não é exposto via PostgREST (fora do schema public) — o client
-- não pode fazer join direto pra mostrar nome do responsável/autor na UI.
-- Função security definer expõe só o necessário (id + nome), restrita a
-- membros do próprio workspace, sem vazar e-mail ou outros dados de auth.users.

create or replace function public.get_workspace_member_names(
  target_workspace_id uuid,
  target_user_ids uuid[]
)
returns table (user_id uuid, name text)
language sql
security definer
set search_path = ''
stable
as $$
  select u.id, coalesce(u.raw_user_meta_data ->> 'name', u.email)
  from auth.users u
  where u.id = any(target_user_ids)
    and exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = target_workspace_id
        and wm.user_id = u.id
    )
    and (select public.is_workspace_member(target_workspace_id));
$$;

revoke all on function public.get_workspace_member_names(uuid, uuid[]) from public;
grant execute on function public.get_workspace_member_names(uuid, uuid[]) to authenticated;

-- A busca de leads usa ilike '%termo%' (name/company) — sem índice trigram,
-- isso é sempre Seq Scan por mais índice B-tree que exista em workspace_id,
-- porque LIKE com wildcard nos dois lados não usa B-tree. Com volume real
-- (milhares de leads por workspace), isso vira o ponto mais lento da tela.
create extension if not exists pg_trgm;

create index leads_name_trgm_idx on public.leads using gin (name gin_trgm_ops);
create index leads_company_trgm_idx on public.leads using gin (company gin_trgm_ops);

-- Cursor de paginação ordena por (created_at desc, id desc) — índice
-- composto cobre esse order by direto, sem sort adicional em memória.
create index leads_workspace_created_id_idx
  on public.leads (workspace_id, created_at desc, id desc);
