-- Filtro de período no Dashboard (7 dias / 30 dias / mês / ano / livre).
-- Filtra por `created_at`, quando o lead/negócio nasceu,, de forma
-- consistente nas três RPCs. `desde`/`ate` opcionais (default null = sem
-- filtro, comportamento idêntico a antes) para não quebrar quem já chama
-- sem eles.
--
-- `create or replace function` só substitui quando a assinatura é IDÊNTICA,
-- acrescentar parâmetros cria um OVERLOAD novo em vez de substituir, e
-- deixaria as duas versões (1 e 3 argumentos) coexistindo, arriscando
-- "could not choose the best candidate function" no PostgREST. Por isso o
-- `drop function` explícito antes de recriar com a assinatura nova.

drop function if exists public.get_dashboard_counts(uuid);

create function public.get_dashboard_counts(
  target_workspace_id uuid,
  desde timestamptz default null,
  ate timestamptz default null
)
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
    (select count(*) from public.leads
      where workspace_id = target_workspace_id
        and (desde is null or created_at >= desde)
        and (ate is null or created_at <= ate)),
    coalesce((select count(*) from public.deals
      where workspace_id = target_workspace_id
        and stage not in ('fechado_ganho', 'fechado_perdido')
        and (desde is null or created_at >= desde)
        and (ate is null or created_at <= ate)), 0),
    coalesce((select count(*) from public.deals
      where workspace_id = target_workspace_id
        and stage in ('fechado_ganho', 'fechado_perdido')
        and (desde is null or created_at >= desde)
        and (ate is null or created_at <= ate)), 0),
    coalesce((select count(*) from public.deals
      where workspace_id = target_workspace_id
        and stage = 'fechado_ganho'
        and (desde is null or created_at >= desde)
        and (ate is null or created_at <= ate)), 0)
  where (select public.is_workspace_member(target_workspace_id));
$$;

revoke all on function public.get_dashboard_counts(uuid, timestamptz, timestamptz) from public;
grant execute on function public.get_dashboard_counts(uuid, timestamptz, timestamptz) to authenticated;

drop function if exists public.get_open_pipeline_value(uuid);

create function public.get_open_pipeline_value(
  target_workspace_id uuid,
  desde timestamptz default null,
  ate timestamptz default null
)
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
    and (desde is null or created_at >= desde)
    and (ate is null or created_at <= ate)
    and (select public.is_workspace_member(target_workspace_id));
$$;

revoke all on function public.get_open_pipeline_value(uuid, timestamptz, timestamptz) from public;
grant execute on function public.get_open_pipeline_value(uuid, timestamptz, timestamptz) to authenticated;

drop function if exists public.get_funnel_counts(uuid);

create function public.get_funnel_counts(
  target_workspace_id uuid,
  desde timestamptz default null,
  ate timestamptz default null
)
returns table (stage public.deal_stage, total bigint)
language sql
security invoker
stable
set search_path to ''
as $$
  select d.stage, count(*)
  from public.deals d
  where d.workspace_id = target_workspace_id
    and (desde is null or d.created_at >= desde)
    and (ate is null or d.created_at <= ate)
  group by d.stage;
$$;

revoke all on function public.get_funnel_counts(uuid, timestamptz, timestamptz) from public;
grant execute on function public.get_funnel_counts(uuid, timestamptz, timestamptz) to authenticated;
