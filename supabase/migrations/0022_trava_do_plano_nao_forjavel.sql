-- Fecha o furo da 0021: a marca de permissão era forjável.
--
-- A 0021 liberava o UPDATE quando a variável de sessão
-- `velofunil.aplicando_pagamento` valesse '1', partindo da ideia de que só a
-- RPC a definiria. Errado: `set_config` é chamável por qualquer um. Um admin
-- rodava, num bloco só,
--
--   select set_config('velofunil.aplicando_pagamento','1',true);
--   update workspaces set plan='pro' where id='<o seu>';
--
-- e voltava a ganhar o Pro de graça. Confirmado em produção, o ataque passou
-- e o workspace ficou 'pro' sem pagamento.
--
-- A trava passa a não depender de nada que o chamador controle. Qualquer
-- variável de sessão, marca ou flag é forjável por quem executa SQL; a
-- distinção precisa vir de uma credencial que o atacante não possui.
--
-- A solução é estrutural: o trigger passa a REJEITAR toda alteração de
-- `plan` vinda de qualquer sessão que não seja a service role, sem exceção. A
-- RPC deixa de escrever em `workspaces` diretamente e passa a ser chamada
-- apenas pelo webhook, que já usa a service role (`createAdminClient()` com a
-- `SUPABASE_SERVICE_ROLE_KEY`). Essa chave nunca chega ao navegador, vive só
-- nas variáveis de ambiente do servidor.
--
-- Consequência: `apply_asaas_subscription_status` continua existindo e
-- funcionando, mas só produz efeito quando invocada com a service role. Se
-- alguém a chamar pela API pública com um token de usuário comum, o UPDATE de
-- `subscriptions` já é barrado pela RLS e a função retorna false sem tocar em
-- `workspaces`.

-- Desfaz o rastro do teste que comprovou o furo da 0021.
--
-- A marca abaixo é justamente o furo sendo corrigido, e é o que permite a esta
-- limpeza passar pelo trigger da 0021, ainda vigente neste ponto do arquivo.
-- Depois que a nova versão do trigger for instalada (mais abaixo), a marca
-- deixa de ter qualquer efeito.
select set_config('velofunil.aplicando_pagamento', '1', true);

update public.workspaces w
set plan = 'free'
where w.plan = 'pro'
  and not exists (
    select 1 from public.subscriptions s
    where s.workspace_id = w.id and s.status in ('active', 'past_due')
  );

create or replace function public.proteger_colunas_do_workspace()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $$
begin
  -- Único escape: a service role. É o papel do webhook (`createAdminClient`) e
  -- de scripts administrativos. A chave que o concede é secreta e server-side;
  -- um cliente no navegador nunca a possui, e `set_config` não a concede.
  if coalesce(current_setting('role', true), '') = 'service_role'
     or coalesce((select auth.role()), '') = 'service_role' then
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

-- Remove o `set_config` da RPC: além de não ser mais necessário, deixá-lo
-- manteria viva a variável que o ataque explorava.
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
