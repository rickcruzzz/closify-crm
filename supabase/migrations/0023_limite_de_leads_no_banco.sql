-- Move o limite de leads do plano Free para o banco.
--
-- `canAddLead` (lib/limits.ts) roda na Server Action, que é um endpoint HTTP
-- como qualquer outro. Quem chama o PostgREST direto com a chave pública — que
-- está no HTML por design — pula a checagem inteira. Verificado em produção:
-- 60 leads inseridos de uma vez num workspace Free, contra um limite de 50.
--
-- Não é vazamento nem upgrade grátis: o infrator ganha só linhas a mais na
-- própria empresa. Mas é um limite de plano que não limita, então a regra
-- desce para onde não há como contorná-la.
--
-- O trigger é `before insert` por linha em vez de uma checagem em lote porque
-- a importação de CSV insere várias de uma vez: contando a cada linha, o
-- INSERT para exatamente no limite em vez de aprovar ou recusar o lote inteiro.
--
-- `FREE_LEAD_LIMIT` está duplicado aqui e em lib/plans.ts. Não há como o
-- Postgres ler a constante do TypeScript; o teste em lib/validations/
-- workspace.test.ts fixa o valor 50 dos dois lados, então uma mudança só de um
-- lado quebra o teste em vez de passar silenciosamente.

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
  select plan into v_plan from public.workspaces where id = new.workspace_id;

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

drop trigger if exists checar_limite_de_leads on public.leads;

create trigger checar_limite_de_leads
  before insert on public.leads
  for each row
  execute function public.checar_limite_de_leads();
