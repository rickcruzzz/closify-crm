-- Velo Funil, saber que um negócio parou de andar
--
-- `deals` guarda `created_at` e mais nada sobre o tempo. Não há como responder
-- "este negócio está há quanto tempo na mesma etapa?", que é a pergunta que
-- separa um funil de uma lista.
--
-- Duas colunas, e a distinção entre elas é o ponto:
--
--   updated_at        qualquer alteração, corrigir um valor, trocar o
--                     responsável, ajustar o título
--   stage_changed_at  só quando a ETAPA muda
--
-- Parado é sobre a segunda. Um negócio cujo valor foi corrigido ontem, mas que
-- está em "Proposta enviada" há três semanas, está parado, e usar
-- `updated_at` para isso o marcaria como ativo, escondendo justamente o caso
-- que interessa.

alter table public.deals
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists stage_changed_at timestamptz not null default now();

-- Os negócios que já existem nasceram na data de criação, não em `now()`.
-- Marcá-los como movidos agora zeraria o histórico de todo mundo e faria o
-- funil parecer recém-mexido no dia da migration.
update public.deals
set updated_at = created_at,
    stage_changed_at = created_at
where updated_at > created_at;

-- ============================================================================
-- Trigger, o relógio não pode depender de quem escreve lembrar dele
-- ============================================================================
--
-- `stage_changed_at` só se move quando a etapa muda de verdade. Arrastar um
-- card para a coluna onde ele já está manda um update com a MESMA etapa: sem o
-- `is distinct from`, isso reiniciaria a contagem e um negócio parado ficaria
-- eternamente novo com um arrastar que não mudou nada.
--
-- E ninguém escreve estas colunas pelo app: a trigger sobrescreve o que vier,
-- então mandá-las pelo PostgREST não adianta.

create or replace function public.tocar_datas_do_negocio()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  new.updated_at := now();

  if new.stage is distinct from old.stage then
    new.stage_changed_at := now();
  else
    new.stage_changed_at := old.stage_changed_at;
  end if;

  return new;
end;
$$;

drop trigger if exists tocar_datas_do_negocio on public.deals;

create trigger tocar_datas_do_negocio
  before update on public.deals
  for each row
  execute function public.tocar_datas_do_negocio();

-- ============================================================================
-- Índice
-- ============================================================================
--
-- Parcial nas etapas ABERTAS: negócio fechado não para, ele acabou. Marcar
-- "parado há 90 dias" um negócio ganho seria ruído puro, e as etapas
-- fechadas são justamente as que mais acumulam linha.

create index if not exists deals_parados_idx
  on public.deals (workspace_id, stage_changed_at)
  where stage not in ('fechado_ganho', 'fechado_perdido');

-- ============================================================================
-- O board passa a carregar `stage_changed_at`
-- ============================================================================
--
-- Mesma função da 0032, com uma coluna a mais. Sem ela o card não teria como
-- saber há quanto tempo o negócio não anda, e a informação ficaria presa no
-- banco.
--
-- `drop` antes do `create`: o Postgres recusa `create or replace` que mude o
-- tipo de retorno ("cannot change return type of existing function"). A
-- migration roda em transação, então não existe instante em que o Kanban
-- encontre a função ausente.

drop function if exists public.get_board_deals(uuid, int);

create function public.get_board_deals(
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
  stage_changed_at timestamptz,
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
      d.id, d.title, d.lead_id, d.value, d.stage, d.due_date,
      d.created_at, d.stage_changed_at, d.owner_id,
      row_number() over (partition by d.stage order by d.created_at desc) as posicao,
      count(*) over (partition by d.stage) as total_na_etapa
    from public.deals d
    where d.workspace_id = target_workspace_id
  )
  select id, title, lead_id, value, stage, due_date, created_at,
         stage_changed_at, owner_id, total_na_etapa
  from numerados
  where posicao <= greatest(por_etapa, 1)
  order by created_at desc;
$$;

revoke all on function public.get_board_deals(uuid, int) from public;
grant execute on function public.get_board_deals(uuid, int) to authenticated;
