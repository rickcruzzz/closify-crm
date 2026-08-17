-- A 0012 (e antes dela a 0008, 0009, 0010, 0011) usava só
-- `revoke all on function ... from public`. Testado contra o banco real com a
-- anon key, isso NÃO revoga nada: o Supabase roda
--
--   alter default privileges in schema public
--     grant all on functions to anon, authenticated, service_role;
--
-- então toda função nasce com grant EXPLÍCITO para `anon`, e revogar de
-- PUBLIC não remove grant explícito de role. Resultado: todas as RPCs
-- respondiam a chamadas anônimas.
--
-- Não houve vazamento de dado porque cada função tem guard interno
-- (is_workspace_member / not_authenticated), que é a defesa que de fato
-- funcionou. As exceções tratadas aqui:
--
-- 1) workspace_has_no_members não tinha guard nenhum e devolvia true/false
--    sobre qualquer uuid para chamador anônimo. Corrigido dentro da função,
--    que é robusto independente de grant.
-- 2) Revoke real (de `anon`, não de PUBLIC) nas RPCs que retornam dado ou
--    escrevem. Deixadas de fora de propósito:
--    - get_invite_by_token: a tela de convite é pública por design.
--    - is_workspace_member / is_workspace_admin / is_workspace_creator: são
--      chamadas DENTRO das policies de RLS, e policy roda com as permissões
--      de quem consulta. Revogar de anon arriscaria quebrar avaliação de RLS
--      em algum caminho anônimo para ganhar nada, elas já retornam false
--      sem sessão.

-- 3) DRIFT DE SCHEMA: a 0009 nunca foi aplicada no banco. Verificado chamando
--    a RPC como service role, get_open_pipeline_value não existe, enquanto
--    todas as outras (0001, 0004, 0005, 0007, 0008, 0010, 0011) existem.
--    Consequência visível: getDashboardMetrics faz
--    `pipelineValueResult.data ?? 0`, então o erro da RPC ausente é engolido
--    e o card "Valor do Pipeline" mostra R$ 0 para todo mundo, sempre.
--    Recriada aqui para esta migration ser auto-suficiente.

-- ============================================================================
-- 0) Corrige o drift: recria a função que a 0009 deveria ter criado
-- ============================================================================

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

-- ============================================================================
-- 1) workspace_has_no_members: guard interno em vez de depender de grant
-- ============================================================================

create or replace function public.workspace_has_no_members(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select auth.uid() is not null
    and not exists (
      select 1
      from public.workspace_members
      where workspace_id = target_workspace_id
    );
$$;

-- ============================================================================
-- 2) Revoke que de fato funciona: de `anon`, não de PUBLIC
-- ============================================================================

revoke execute on function public.accept_workspace_invite(uuid) from anon;
revoke execute on function public.create_workspace_with_admin(text) from anon;
revoke execute on function public.get_workspace_member_names(uuid, uuid[]) from anon;
revoke execute on function public.get_dashboard_counts(uuid) from anon;
revoke execute on function public.get_open_pipeline_value(uuid) from anon;

-- NOTA: `alter default privileges in schema public revoke execute on functions
-- from anon` evitaria a regressão em funções futuras, mas foi deixado de fora
-- de propósito, muda um default global e a falha vira silenciosa (função nova
-- simplesmente não responde a anon, sem erro óbvio). Enquanto isso, toda RPC
-- nova precisa de `revoke execute ... from anon` explícito, e o guard interno
-- de auth continua sendo a defesa principal.
