-- Corrige a RPC do webhook, que falhava em tempo de execução e impedia
-- qualquer pagamento de liberar o plano Pro.
--
-- `plan` é do tipo enum `workspace_plan`, mas o CASE devolvia `text`:
--
--   set plan = case when p_status = 'active' then 'pro' else 'free' end
--
-- O Postgres não converte enum a partir de text implicitamente em UPDATE, e a
-- função estourava com
--
--   42804: column "plan" is of type public.workspace_plan
--          but expression is of type text
--
-- O erro nunca apareceu em teste porque `plpgsql` só valida a expressão quando
-- a linha executa de fato, e, até agora, nenhum pagamento chegou a rodar este
-- caminho: o webhook estava cadastrado no domínio antigo e sem authToken, então
-- todo evento parava com 401 antes de tocar o banco. Os dois defeitos se
-- escondiam um atrás do outro.
--
-- Efeito prático se tivesse ido ao ar: cliente paga, `subscriptions.status`
-- vira 'active', o UPDATE de `workspaces` estoura, a transação inteira desfaz,
-- o route.ts devolve 500 e apaga a marca de dedupe. O Asaas reenvia, falha
-- igual, e o cliente segue no Free tendo pago.
--
-- Além do cast, a condição passa a tratar 'past_due' como acesso mantido: uma
-- fatura atrasada não deve derrubar o cliente para o Free no mesmo instante,
-- o Asaas ainda vai tentar cobrar, e derrubar o acesso na primeira falha de
-- cobrança gera cancelamento que não precisava acontecer. Só 'canceled'
-- rebaixa de fato.

create or replace function public.apply_asaas_subscription_status(
  p_asaas_subscription_id text,
  p_status subscription_status
)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
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
     set plan = case
                  when p_status in ('active', 'past_due') then 'pro'
                  else 'free'
                end::public.workspace_plan
   where id = v_workspace_id;

  return true;
end;
$function$;
