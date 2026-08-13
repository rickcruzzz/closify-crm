-- Velo Funil — aperta o Free e vira as integrações em valor exclusivo do Pro.
--
-- Contexto (docs/prd-conversao-pro.md): zero cliente pagante até agora, e o
-- Free de hoje libera TUDO — inclusive as integrações mais caras de construir
-- desta base (Google Calendar, Gmail, WhatsApp Cloud API), sem nenhuma
-- checagem de plano em lib/integrations/*. É o maior motivo real pra pagar
-- que faltava.

-- ============================================================================
-- 1. Teto de leads do Free: 50 → 25
-- ============================================================================

-- Mesma função da 0027 (já usa `pro_vigente`, não a coluna — ver armadilha
-- documentada em docs/estado-atual.md), só troca a constante.
create or replace function public.checar_limite_de_leads()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_total int;
  v_pro boolean;
  limite_free constant int := 25;
begin
  perform 1 from public.workspaces where id = new.workspace_id for update;

  v_pro := public.pro_vigente(new.workspace_id);
  if v_pro then
    return new;
  end if;

  select count(*) into v_total from public.leads where workspace_id = new.workspace_id;

  if v_total >= limite_free then
    raise exception 'Plano Free permite no máximo % leads. Faça upgrade para o Pro para continuar.', limite_free
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- ============================================================================
-- 2. Integrações (Google Calendar, Gmail, WhatsApp Cloud API) passam a exigir Pro
-- ============================================================================

-- A checagem em Server Action (lib/integrations/actions.ts) só dá mensagem
-- boa antes de tentar — quem chamasse o PostgREST direto contornava. A regra
-- de verdade mora na policy, mesma lição paga em 0019/0023/0024: "regra que
-- só vive na Server Action não é regra".
--
-- `pro_vigente`, não a coluna `plan` — mesma razão da 0027: Pro vencido não
-- pode continuar reconectando/renovando token só porque a coluna ainda diz
-- 'pro' e ninguém rodou a sincronização preguiçosa ainda.
drop policy "integration_connections_insert" on public.integration_connections;
create policy "integration_connections_insert" on public.integration_connections
  for insert with check (
    (select public.is_workspace_admin(workspace_id))
    and (select public.pro_vigente(workspace_id))
  );

drop policy "integration_connections_update" on public.integration_connections;
create policy "integration_connections_update" on public.integration_connections
  for update using (
    (select public.is_workspace_admin(workspace_id))
    and (select public.pro_vigente(workspace_id))
  )
  with check (
    (select public.is_workspace_admin(workspace_id))
    and (select public.pro_vigente(workspace_id))
  );

-- select e delete não mudam: quem já tinha conectado no Pro e venceu continua
-- vendo a linha (histórico) e consegue desconectar/limpar, só não
-- reconecta/renova sem pagar de novo.
