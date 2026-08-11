-- Fecha o furo de corrida da trava de leads da 0023.
--
-- A 0023 conta os leads do workspace e recusa a partir de 50. Sob READ
-- COMMITTED, que é o padrão do Postgres, duas transações simultâneas leem a
-- MESMA contagem antes de qualquer commit — as duas veem 49, as duas passam, e
-- o workspace termina com 51 leads num plano de 50. O cenário está escrito e
-- reproduzido em scripts/load-test/k6/scenarios/race4_lead_insert_trigger_cap.js.
--
-- A correção é uma palavra: `for update` no SELECT do workspace. Quem chega
-- primeiro trava a linha do workspace até o commit; quem chega depois espera e
-- só então conta, já enxergando o lead do outro. Serializa por workspace, sem
-- serializar o banco.
--
-- O custo é um lock por linha inserida, na MESMA linha de workspace que o
-- insert já toca. Importação em lote de 300 leads pega o lock 300 vezes
-- seguidas dentro da própria transação, o que é reentrante e não bloqueia
-- ninguém de outra empresa.
--
-- Não substitui a checagem em TypeScript (lib/limits.ts): aquela existe para
-- dar mensagem boa antes de tentar. Esta existe porque Server Action é
-- endpoint HTTP e regra que só vive lá não é regra.

create or replace function public.checar_limite_de_leads()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_plan public.workspace_plan;
  v_total int;
  limite_free constant int := 50;
begin
  -- `for update` é a única diferença para a 0023, e é o que fecha a corrida.
  select plan into v_plan
    from public.workspaces
   where id = new.workspace_id
     for update;

  if v_plan = 'pro' then
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
