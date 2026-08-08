-- Endurecimento do webhook do Asaas (equivalente ao passo de webhook do
-- curso, que era escrito para Stripe). Três problemas encontrados ao revisar
-- `app/api/webhooks/asaas/route.ts` contra o banco real:
--
-- 1) As duas escritas do webhook (`subscriptions.status` e `workspaces.plan`)
--    eram round-trips separados e NÃO atômicos. Se a segunda falhasse, a
--    assinatura ficava `active` com o workspace em `free` — e o evento já
--    estava marcado como processado na tabela de dedupe, então nenhum retry
--    do Asaas consertava. O plano ficava errado em silêncio.
--
-- 2) O `update ... where asaas_subscription_id = $1` não tinha índice: seq
--    scan em toda chamada de webhook. E, sem constraint de unicidade, dois
--    registros com o mesmo id de assinatura fariam o `.maybeSingle()` do
--    route handler lançar erro em vez de atualizar.
--
-- 3) `asaas_webhook_events` só cresce. O índice em `processed_at` foi criado
--    na 0012 "para housekeeping", mas nada nunca apagou nada.

-- ============================================================================
-- 1) Unicidade + índice em asaas_subscription_id
-- ============================================================================

-- Parcial (`where ... is not null`) porque a linha semeada pela 0002 tem o
-- campo nulo, e nulos não conflitam entre si de qualquer forma. Verificado
-- contra produção antes de criar: 1 linha, id nulo, zero duplicatas.
create unique index if not exists subscriptions_asaas_subscription_id_key
  on public.subscriptions (asaas_subscription_id)
  where asaas_subscription_id is not null;

-- ============================================================================
-- 2) Aplicação atômica do status vindo do webhook
-- ============================================================================

-- Faz as duas escritas na mesma transação e devolve se alguma assinatura
-- casou, para o route handler distinguir "evento de assinatura que não é
-- nossa" (200, ignora) de "falha real" (500, pede retry ao Asaas).
create or replace function public.apply_asaas_subscription_status(
  p_asaas_subscription_id text,
  p_status public.subscription_status
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid;
begin
  update public.subscriptions
     set status = p_status
   where asaas_subscription_id = p_asaas_subscription_id
  returning workspace_id into v_workspace_id;

  if v_workspace_id is null then
    return false;
  end if;

  update public.workspaces
     set plan = case when p_status = 'active' then 'pro' else 'free' end
   where id = v_workspace_id;

  return true;
end;
$$;

-- Só o webhook chama isto, e ele usa a service role. Nenhum client precisa
-- de acesso: quem alcançasse esta função mudaria o plano de qualquer
-- workspace conhecendo só o id da assinatura.
-- Revoke de `anon` E de `authenticated`: revogar de PUBLIC não basta, porque
-- o Supabase concede EXECUTE explicitamente a esses roles por default
-- privilege (a lição que a 0013 documenta).
revoke all on function public.apply_asaas_subscription_status(text, public.subscription_status) from public;
revoke execute on function public.apply_asaas_subscription_status(text, public.subscription_status) from anon;
revoke execute on function public.apply_asaas_subscription_status(text, public.subscription_status) from authenticated;

-- ============================================================================
-- 3) Housekeeping da tabela de deduplicação
-- ============================================================================

-- A janela de retry do Asaas é de dias, não de meses. Guardar 90 dias cobre
-- com folga; o resto é lixo que só faz a tabela crescer. Não é auditoria —
-- o histórico de cobrança verdadeiro vive no Asaas.
create or replace function public.purge_old_asaas_webhook_events()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from public.asaas_webhook_events
   where processed_at < now() - interval '90 days';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.purge_old_asaas_webhook_events() from public;
revoke execute on function public.purge_old_asaas_webhook_events() from anon;
revoke execute on function public.purge_old_asaas_webhook_events() from authenticated;

-- Agendamento fica de fora de propósito: exige a extensão pg_cron habilitada
-- no projeto. Enquanto não estiver, chamar manualmente pelo SQL Editor
-- resolve — o volume é de poucas linhas por assinatura por mês.
--   select public.purge_old_asaas_webhook_events();
