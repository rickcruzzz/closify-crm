-- O teto de contatos do Free volta de 300 para 50.
--
-- ## Por que desfazer a 0040
--
-- A migration 0040 se chama `free_menos_apertado` e subiu o limite de 50 para
-- 300. Foi decidido sem nenhum dado de conversão — porque não existia nenhum.
--
-- Agora existe. O funil de ativação (`/dono/ativacao`, 23/08) mostrou que 300
-- é um teto que **ninguém alcança**: uma clínica cadastra ~20 pacientes novos
-- por mês, uma agência fecha 3 clientes. São anos até esbarrar. O plano
-- gratuito deixava de ser um degrau para o Pro e passava a ser o produto
-- final — e nenhuma pessoa que não sente falta de nada vai pagar por algo.
--
-- Com 50, o teto chega em cerca de dois meses de uso real: tempo suficiente
-- para o CRM virar rotina, curto o bastante para a decisão de pagar acontecer
-- enquanto o produto ainda é aberto todo dia.
--
-- ## O que esta mudança NÃO faz
--
-- **Não apaga nem esconde contato de ninguém.** A trigger age no INSERT: quem
-- já tem mais de 50 continua com todos, só não cadastra novos enquanto estiver
-- no Free. Tirar dado de cliente por causa de uma decisão comercial nossa seria
-- pior que qualquer ganho de conversão.
--
-- Conferido antes de aplicar: nenhuma empresa da base tem mais de 20 contatos,
-- então ninguém é afetado hoje.
--
-- ## Por que o teto continua no banco, e não na Server Action
--
-- Doutrina do projeto desde as migrations 0019-0026: Server Action é endpoint
-- HTTP, e quem chama o PostgREST direto com a chave pública (que está no HTML
-- por design) pula a validação. O limite de leads já foi contornado uma vez
-- exatamente assim.
--
-- O `for update` na linha do workspace vem da 0026 e continua necessário: sob
-- READ COMMITTED, duas transações leem a MESMA contagem antes de qualquer
-- commit e as duas passam, deixando 51 contatos num plano de 50.

create or replace function public.checar_limite_de_leads()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_total int;
  v_pro boolean;
  limite_free constant int := 50;
begin
  -- `pro_vigente()` e nunca a coluna `workspaces.plan`: a coluna é o último
  -- valor gravado pelo webhook e não sabe que o período pago venceu (0027).
  -- Desde a 0051 ela também devolve `true` durante os 7 dias de trial, então
  -- quem está avaliando o produto importa a planilha inteira sem esbarrar aqui
  -- — que é justamente o ponto: a pessoa precisa ver o produto cheio para
  -- decidir se paga.
  v_pro := public.pro_vigente(new.workspace_id);

  if v_pro then
    return new;
  end if;

  perform 1 from public.workspaces where id = new.workspace_id for update;

  select count(*) into v_total
    from public.leads
   where workspace_id = new.workspace_id;

  if v_total >= limite_free then
    raise exception 'Plano Free permite no máximo % contatos. Faça upgrade para o Pro para continuar.', limite_free
      using errcode = '42501';
  end if;

  return new;
end;
$$;
