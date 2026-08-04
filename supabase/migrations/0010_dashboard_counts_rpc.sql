-- getDashboardMetrics fazia 4 round-trips separados de rede com count:exact
-- (total_leads, open_deals, closed_deals, won_deals). Uma única RPC devolve
-- os 4 números numa resposta só, trocando 4 idas ao Supabase por 1.

create or replace function public.get_dashboard_counts(target_workspace_id uuid)
returns table (
  total_leads bigint,
  open_deals bigint,
  closed_deals bigint,
  won_deals bigint
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    (select count(*) from public.leads where workspace_id = target_workspace_id),
    coalesce((select count(*) from public.deals
      where workspace_id = target_workspace_id
        and stage not in ('fechado_ganho', 'fechado_perdido')), 0),
    coalesce((select count(*) from public.deals
      where workspace_id = target_workspace_id
        and stage in ('fechado_ganho', 'fechado_perdido')), 0),
    coalesce((select count(*) from public.deals
      where workspace_id = target_workspace_id
        and stage = 'fechado_ganho'), 0)
  where (select public.is_workspace_member(target_workspace_id));
$$;

revoke all on function public.get_dashboard_counts(uuid) from public;
grant execute on function public.get_dashboard_counts(uuid) to authenticated;
