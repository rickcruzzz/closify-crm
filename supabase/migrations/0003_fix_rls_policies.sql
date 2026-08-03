-- Correção de segurança e performance das políticas RLS criadas em 0001_core_schema.sql
--
-- 1) UPDATE policies sem WITH CHECK permitiam mover uma linha para outro
--    workspace_id (a policy USING só valida a linha antes do update).
-- 2) subscriptions não deveria aceitar insert/update vindo do client —
--    billing só deve ser escrito por webhook/service role (Asaas).
-- 3) Chamadas a is_workspace_member/is_workspace_admin sem envolver em
--    (select ...) fazem a função rodar por linha em vez de ser cacheada
--    pelo planner — recriamos todas as policies já com o wrap correto.

-- ============================================================================
-- workspaces
-- ============================================================================

drop policy "workspaces_select" on public.workspaces;
create policy "workspaces_select" on public.workspaces
  for select using ((select public.is_workspace_member(id)));

drop policy "workspaces_update" on public.workspaces;
create policy "workspaces_update" on public.workspaces
  for update using ((select public.is_workspace_admin(id)))
  with check ((select public.is_workspace_admin(id)));

-- workspaces_insert (with check (true)) já está correto, sem alteração.

-- ============================================================================
-- workspace_members
-- ============================================================================

drop policy "workspace_members_select" on public.workspace_members;
create policy "workspace_members_select" on public.workspace_members
  for select using ((select public.is_workspace_member(workspace_id)));

drop policy "workspace_members_insert" on public.workspace_members;
create policy "workspace_members_insert" on public.workspace_members
  for insert with check ((select public.is_workspace_admin(workspace_id)));

drop policy "workspace_members_update" on public.workspace_members;
create policy "workspace_members_update" on public.workspace_members
  for update using ((select public.is_workspace_admin(workspace_id)))
  with check ((select public.is_workspace_admin(workspace_id)));

drop policy "workspace_members_delete" on public.workspace_members;
create policy "workspace_members_delete" on public.workspace_members
  for delete using ((select public.is_workspace_admin(workspace_id)));

-- ============================================================================
-- leads
-- ============================================================================

drop policy "leads_select" on public.leads;
create policy "leads_select" on public.leads
  for select using ((select public.is_workspace_member(workspace_id)));

drop policy "leads_insert" on public.leads;
create policy "leads_insert" on public.leads
  for insert with check ((select public.is_workspace_member(workspace_id)));

drop policy "leads_update" on public.leads;
create policy "leads_update" on public.leads
  for update using ((select public.is_workspace_member(workspace_id)))
  with check ((select public.is_workspace_member(workspace_id)));

drop policy "leads_delete" on public.leads;
create policy "leads_delete" on public.leads
  for delete using ((select public.is_workspace_member(workspace_id)));

-- ============================================================================
-- deals
-- ============================================================================

drop policy "deals_select" on public.deals;
create policy "deals_select" on public.deals
  for select using ((select public.is_workspace_member(workspace_id)));

drop policy "deals_insert" on public.deals;
create policy "deals_insert" on public.deals
  for insert with check ((select public.is_workspace_member(workspace_id)));

drop policy "deals_update" on public.deals;
create policy "deals_update" on public.deals
  for update using ((select public.is_workspace_member(workspace_id)))
  with check ((select public.is_workspace_member(workspace_id)));

drop policy "deals_delete" on public.deals;
create policy "deals_delete" on public.deals
  for delete using ((select public.is_workspace_member(workspace_id)));

-- ============================================================================
-- activities
-- ============================================================================

drop policy "activities_select" on public.activities;
create policy "activities_select" on public.activities
  for select using ((select public.is_workspace_member(workspace_id)));

drop policy "activities_insert" on public.activities;
create policy "activities_insert" on public.activities
  for insert with check ((select public.is_workspace_member(workspace_id)));

drop policy "activities_update" on public.activities;
create policy "activities_update" on public.activities
  for update using ((select public.is_workspace_member(workspace_id)))
  with check ((select public.is_workspace_member(workspace_id)));

drop policy "activities_delete" on public.activities;
create policy "activities_delete" on public.activities
  for delete using ((select public.is_workspace_member(workspace_id)));

-- ============================================================================
-- subscriptions: remove escrita client-facing.
-- Mantém só select para membros; insert/update passam a ser feitos com a
-- service_role key (que ignora RLS), a partir do webhook do Asaas.
-- ============================================================================

drop policy "subscriptions_select" on public.subscriptions;
create policy "subscriptions_select" on public.subscriptions
  for select using ((select public.is_workspace_member(workspace_id)));

drop policy "subscriptions_update" on public.subscriptions;
drop policy "subscriptions_insert" on public.subscriptions;
