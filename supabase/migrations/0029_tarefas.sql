-- Velo Funil — tarefas com próxima ação
--
-- O produto registrava só o passado. `activities` (0001) tem type, description
-- e created_at: sem data prevista, sem responsável, sem concluído. Dá para
-- contar o que já foi feito e não dá para saber o que fazer hoje — que é a
-- pergunta que o dono de PME abre o CRM para responder.
--
-- Tabela nova em vez de colunas em `activities` de propósito. Atividade é log
-- imutável: a timeline do lead conta o que aconteceu. Tarefa é compromisso
-- futuro que muda de estado. Juntar as duas obrigaria TODO select de atividade
-- a filtrar linha que ainda não aconteceu — e a primeira vez que alguém
-- esquecesse o filtro, a timeline passaria a mostrar futuro como se fosse
-- passado.

-- ============================================================================
-- Tabela
-- ============================================================================

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,

  -- Os dois são opcionais, mas o check abaixo exige pelo menos um: tarefa que
  -- não pende de lead nem de negócio não tem tela onde apareça, e viraria
  -- lixo invisível ocupando a contagem do teto.
  lead_id uuid references public.leads (id) on delete cascade,
  deal_id uuid references public.deals (id) on delete cascade,

  assignee_id uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,

  title text not null,

  -- Reusa o enum de atividade (ligacao/email/reuniao/nota) em vez de criar um
  -- enum paralelo com os mesmos quatro valores. Concluir tarefa grava uma
  -- atividade do MESMO tipo, e um enum só é o que torna isso um repasse
  -- direto em vez de um de-para.
  type public.activity_type not null default 'nota',

  -- `not null` de propósito. Tarefa sem data é anotação, e anotação já existe
  -- em `activities`. Sem essa trava, a tela "Hoje" nasce com uma gaveta de
  -- itens que nunca aparecem em grupo nenhum.
  due_at timestamptz not null,

  done_at timestamptz,
  created_at timestamptz not null default now(),

  constraint tasks_alvo_minimo check (lead_id is not null or deal_id is not null)
);

-- ============================================================================
-- Índices — um por consulta que a tela faz, todos parciais em `done_at is null`
-- porque tarefa concluída não é lida por nenhuma delas.
-- ============================================================================

-- Tela /hoje: as tarefas abertas de uma pessoa, por prazo.
create index tasks_abertas_do_responsavel_idx
  on public.tasks (workspace_id, assignee_id, due_at)
  where done_at is null;

-- Card do Kanban: a próxima ação de cada negócio, numa consulta só.
create index tasks_proxima_acao_do_negocio_idx
  on public.tasks (workspace_id, deal_id, due_at)
  where done_at is null;

-- Página do lead: o bloco de tarefas acima da timeline.
create index tasks_lead_idx on public.tasks (lead_id);

-- ============================================================================
-- RLS — mesmo formato de activities na 0003
-- ============================================================================

alter table public.tasks enable row level security;

create policy "tasks_select" on public.tasks
  for select using ((select public.is_workspace_member(workspace_id)));

create policy "tasks_insert" on public.tasks
  for insert with check ((select public.is_workspace_member(workspace_id)));

create policy "tasks_update" on public.tasks
  for update using ((select public.is_workspace_member(workspace_id)))
  with check ((select public.is_workspace_member(workspace_id)));

create policy "tasks_delete" on public.tasks
  for delete using ((select public.is_workspace_member(workspace_id)));

-- ============================================================================
-- Teto contra abuso — NÃO é limite de plano
-- ============================================================================
--
-- Tarefa não entra no limite do Free. Travar follow-up empurraria a pessoa de
-- volta para o WhatsApp e mataria justo o hábito diário que faz ela pagar
-- depois. Mas "sem limite nenhum" numa tabela escrita pelo PostgREST com a
-- chave pública (que está no HTML por design) é convite para encher o banco —
-- a mesma lição das 0023 e 0024.
--
-- Por que SEM `for update`, ao contrário da 0026: lá o número era 50, uma
-- fronteira de monetização — deixar passar o 51º é receita perdida, e valia o
-- lock. Aqui o número é 5.000, um teto de abuso. Sob corrida, N transações
-- simultâneas leem 4.999 e passam todas, então o estouro é o tamanho da
-- concorrência, não infinito: a leva seguinte já lê >= 5.000 e é recusada.
-- 5.010 em vez de 5.000 não significa nada, e o lock significaria: ele é na
-- MESMA linha de workspace que a trava de leads pega, então cada tarefa criada
-- durante uma importação de planilha ficaria esperando a importação inteira
-- terminar.
--
-- O teto conta tarefas ABERTAS, que é o que os índices acima servem e o que
-- degradaria a tela /hoje. Concluída sai da conta.

create or replace function public.checar_teto_de_tarefas()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_abertas int;
  teto constant int := 5000;
begin
  select count(*) into v_abertas
    from public.tasks
   where workspace_id = new.workspace_id
     and done_at is null;

  if v_abertas >= teto then
    raise exception 'Limite de % tarefas em aberto atingido. Conclua ou exclua tarefas para criar novas.', teto
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger checar_teto_de_tarefas
  before insert on public.tasks
  for each row
  execute function public.checar_teto_de_tarefas();
