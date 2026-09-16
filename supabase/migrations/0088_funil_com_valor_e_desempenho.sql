-- O funil passa a devolver VALOR junto da contagem, e nasce a RPC de
-- desempenho (ticket médio, ciclo, ganho, perdido).
--
-- ## Por que isto precisa ser SQL, e não uma soma em JavaScript
--
-- Somar valor por etapa no cliente exigiria trazer uma linha por negócio, e o
-- PostgREST corta em 1.000 linhas SEM devolver erro. Este projeto já pagou
-- exatamente isso: até a 0032 o gráfico do funil mostrava 1.000 de 1.100
-- negócios, calado. A 0032 resolveu para a CONTAGEM; o valor chegaria agora
-- pela mesma porta errada.
--
-- Aqui são no máximo 6 linhas, independentemente do tamanho do funil.
--
-- ## O que NÃO entra, e é decisão
--
-- Nada de tabela de histórico ou snapshot mensal. A comparação com o período
-- anterior é feita chamando as RPCs que já existem com a janela anterior,
-- porque `created_at` é o recorte de todas elas. Criar tabela de snapshot para
-- um produto com 410 negócios na base inteira seria estrutura para um problema
-- que não existe.

-- `create or replace` só substitui com assinatura IDÊNTICA. Acrescentar coluna
-- ao `returns table` muda o tipo de retorno, então o `drop` é obrigatório —
-- mesma razão escrita na 0036.
drop function if exists public.get_funnel_counts(uuid, timestamptz, timestamptz);

create function public.get_funnel_counts(
  target_workspace_id uuid,
  desde timestamptz default null,
  ate timestamptz default null
)
returns table (stage public.deal_stage, total bigint, valor numeric)
language sql
security invoker
stable
set search_path to ''
as $$
  select d.stage, count(*), coalesce(sum(d.value), 0)
  from public.deals d
  where d.workspace_id = target_workspace_id
    and (desde is null or d.created_at >= desde)
    and (ate is null or d.created_at <= ate)
  group by d.stage;
$$;

revoke all on function public.get_funnel_counts(uuid, timestamptz, timestamptz) from public;
grant execute on function public.get_funnel_counts(uuid, timestamptz, timestamptz) to authenticated;

-- ## Desempenho: o que dá para medir com as colunas que existem
--
--     ticket médio   soma de `value` dos ganhos / quantos ganhos
--     ciclo médio    média de (stage_changed_at - created_at) nos FECHADOS
--     ganho/perdido  soma de `value` por lado
--
-- **O ciclo é uma APROXIMAÇÃO, e o nome da coluna diz por quê.**
-- `stage_changed_at` (0033) guarda a ÚLTIMA troca de etapa, não a data de
-- fechamento. Para um negócio fechado as duas coincidem — a menos que alguém
-- reabra e feche de novo, e aí o número conta do início até o último
-- fechamento. Não existe histórico de mudança de etapa neste schema, então
-- esta é a melhor medida disponível, e quem mostra na tela precisa dizer que
-- ela é aproximada.
--
-- `ticket_medio` sai NULO quando não há negócio ganho, em vez de zero: zero
-- afirma "vendemos por R$ 0", e a verdade é "ainda não vendemos". A mesma
-- distinção que `textoDaConversao` já faz com o percentual.
create or replace function public.get_funnel_performance(
  target_workspace_id uuid,
  desde timestamptz default null,
  ate timestamptz default null
)
returns table (
  valor_ganho numeric,
  valor_perdido numeric,
  negocios_ganhos bigint,
  negocios_perdidos bigint,
  ticket_medio numeric,
  dias_ate_fechar numeric
)
language sql
security invoker
stable
set search_path to ''
as $$
  select
    coalesce(sum(d.value) filter (where d.stage = 'fechado_ganho'), 0),
    coalesce(sum(d.value) filter (where d.stage = 'fechado_perdido'), 0),
    count(*) filter (where d.stage = 'fechado_ganho'),
    count(*) filter (where d.stage = 'fechado_perdido'),
    avg(d.value) filter (where d.stage = 'fechado_ganho'),
    avg(extract(epoch from (d.stage_changed_at - d.created_at)) / 86400)
      filter (where d.stage in ('fechado_ganho', 'fechado_perdido')
                and d.stage_changed_at is not null
                and d.stage_changed_at >= d.created_at)
  from public.deals d
  where d.workspace_id = target_workspace_id
    and (desde is null or d.created_at >= desde)
    and (ate is null or d.created_at <= ate);
$$;

revoke all on function public.get_funnel_performance(uuid, timestamptz, timestamptz) from public;
grant execute on function public.get_funnel_performance(uuid, timestamptz, timestamptz) to authenticated;
