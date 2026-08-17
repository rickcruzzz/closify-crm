-- Conserta a trava criada em 0019, que bloqueava o próprio webhook.
--
-- A 0019 liberava a alteração de `plan` só quando o papel da sessão fosse
-- `service_role`. Isso está errado: `apply_asaas_subscription_status` é
-- `SECURITY DEFINER`, o que troca o DONO da execução (para o postgres), mas
-- **não** troca o `role` da sessão. Chamada via PostgREST, a sessão continua
-- como `authenticated`/`anon`, então o trigger recusava a promoção legítima:
--
--   42501: O plano do workspace só muda por pagamento confirmado.
--   CONTEXT: SQL statement "update public.workspaces set plan = ..."
--            PL/pgSQL function public.apply_asaas_subscription_status(...)
--
-- Ou seja: o cliente pagaria e continuaria no Free, o mesmo defeito que a
-- 0019 pretendia proteger, por outro caminho.
--
-- A correção troca "quem é o papel?" por "estou dentro da RPC autorizada?",
-- usando uma variável de sessão que só a própria RPC define. Não é
-- contornável de fora: `set_config` com `is_local = true` some no fim da
-- transação, e quem chamasse a variável pela API pública estaria numa
-- transação sem a RPC, teria que executar `set_config` manualmente, o que o
-- PostgREST não expõe.

create or replace function public.proteger_colunas_do_workspace()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $$
begin
  -- Marca posta por `apply_asaas_subscription_status` logo antes do UPDATE.
  -- É a única via legítima de alteração de plano.
  if coalesce(current_setting('velofunil.aplicando_pagamento', true), '') = '1' then
    return new;
  end if;

  -- A service role (scripts administrativos, correções manuais) não passa por
  -- RLS nem precisa da RPC; mantida como escape explícito.
  if coalesce(current_setting('role', true), '') = 'service_role' then
    return new;
  end if;

  if new.plan is distinct from old.plan then
    raise exception 'O plano do workspace só muda por pagamento confirmado.'
      using errcode = '42501';
  end if;

  if new.id is distinct from old.id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Campos de identidade do workspace são imutáveis.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- A RPC passa a declarar a marca antes de tocar em `workspaces`. O terceiro
-- argumento `true` de `set_config` limita o efeito à transação corrente: se a
-- transação falhar ou terminar, a permissão evapora junto.
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

  perform set_config('velofunil.aplicando_pagamento', '1', true);

  update public.workspaces
     set plan = case
                  when p_status in ('active', 'past_due') then 'pro'
                  else 'free'
                end::public.workspace_plan
   where id = v_workspace_id;

  -- Fecha a janela dentro da própria transação: se algo mais rodar depois
  -- nesta mesma transação, já não carrega a permissão.
  perform set_config('velofunil.aplicando_pagamento', '0', true);

  return true;
end;
$function$;
