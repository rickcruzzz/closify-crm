-- Velo Funil, o teto de 1.000 linhas do PostgREST deixa de mentir
--
-- Medido em produção em 12/08 com 1.100 negócios num workspace: o app recebe
-- 1.000 linhas e NENHUM erro. Três consultas do produto liam tabela inteira
-- sem limite, e a partir desse número passavam a mostrar coisa errada em
-- silêncio:
--
--   getFunnelCounts             gráfico de funil com número menor que o real
--   getBoardDeals               CARDS SOMEM do Kanban, ordena por data, então
--                               os negócios mais antigos desaparecem da tela
--   getWorkspaceLeadsForSelect  leads somem do seletor de novo negócio; ordena
--                               por nome, então some quem vem depois no alfabeto
--
-- Não é lentidão: é dado sumindo da tela do cliente. Hoje o banco tem 14
-- negócios, então ninguém é afetado, esta migration existe para que continue
-- assim quando não estiver.

-- ============================================================================
-- 1. Contagem do funil, no banco, não em JavaScript
-- ============================================================================
--
-- A versão anterior trazia UMA LINHA POR NEGÓCIO só para contar em memória.
-- Com 5.000 negócios seriam 5.000 linhas na rede a cada abertura do dashboard,
-- para produzir seis números, e, passando de 1.000, seis números errados.
--
-- `security invoker`: a RLS de `deals` continua valendo. Uma função `definer`
-- aqui veria o funil de todo mundo, e bastaria um `workspace_id` de outra
-- empresa para ler quantos negócios ela tem em cada etapa.

create or replace function public.get_funnel_counts(target_workspace_id uuid)
returns table (stage public.deal_stage, total bigint)
language sql
security invoker
stable
set search_path to ''
as $$
  select d.stage, count(*)
  from public.deals d
  where d.workspace_id = target_workspace_id
  group by d.stage;
$$;

revoke all on function public.get_funnel_counts(uuid) from public;
grant execute on function public.get_funnel_counts(uuid) to authenticated;

-- ============================================================================
-- 2. Board do Kanban, teto POR ETAPA, não global
-- ============================================================================
--
-- Um `.limit(1000)` global não resolveria: as etapas fechadas acumulam para
-- sempre, e um limite único deixaria "Fechado ganho" comendo a cota das
-- colunas onde o trabalho realmente acontece. Com o teto por etapa, nenhuma
-- coluna esvazia por causa de outra.
--
-- `total_na_etapa` vem junto para a tela poder dizer "mostrando 200 de 340" em
-- vez de fingir que aqueles são todos. Card que some sem aviso é o defeito;
-- mostrar menos e avisar não é.

create or replace function public.get_board_deals(
  target_workspace_id uuid,
  por_etapa int default 200
)
returns table (
  id uuid,
  title text,
  lead_id uuid,
  value numeric,
  stage public.deal_stage,
  due_date date,
  created_at timestamptz,
  owner_id uuid,
  total_na_etapa bigint
)
language sql
security invoker
stable
set search_path to ''
as $$
  with numerados as (
    select
      d.id, d.title, d.lead_id, d.value, d.stage, d.due_date, d.created_at, d.owner_id,
      row_number() over (partition by d.stage order by d.created_at desc) as posicao,
      count(*) over (partition by d.stage) as total_na_etapa
    from public.deals d
    where d.workspace_id = target_workspace_id
  )
  select id, title, lead_id, value, stage, due_date, created_at, owner_id, total_na_etapa
  from numerados
  where posicao <= greatest(por_etapa, 1)
  order by created_at desc;
$$;

revoke all on function public.get_board_deals(uuid, int) from public;
grant execute on function public.get_board_deals(uuid, int) to authenticated;

-- ============================================================================
-- 3. Índices
-- ============================================================================
--
-- `deals_workspace_id_idx` já existe, mas a janela acima particiona por etapa e
-- ordena por data. Sem um índice que cubra os três, o Postgres lê tudo do
-- workspace e ordena em memória a cada abertura do Kanban.

create index if not exists deals_workspace_stage_created_idx
  on public.deals (workspace_id, stage, created_at desc);

-- O seletor de leads do formulário de negócio passa a pedir os mais recentes
-- com limite explícito, em vez da tabela inteira ordenada por nome.
create index if not exists leads_workspace_created_idx
  on public.leads (workspace_id, created_at desc);
