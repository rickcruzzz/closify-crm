-- getDashboardMetrics somava deals.value em JS depois de trazer todas as
-- linhas de deals abertos — funciona, mas com um workspace de milhares de
-- deals isso transfere N linhas pela rede só para calcular 1 número que o
-- Postgres soma nativamente. RPC faz a soma no banco, retorna só o total.

create or replace function public.get_open_pipeline_value(target_workspace_id uuid)
returns numeric
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(sum(value), 0)
  from public.deals
  where workspace_id = target_workspace_id
    and stage not in ('fechado_ganho', 'fechado_perdido')
    and (select public.is_workspace_member(target_workspace_id));
$$;

revoke all on function public.get_open_pipeline_value(uuid) from public;
grant execute on function public.get_open_pipeline_value(uuid) to authenticated;
