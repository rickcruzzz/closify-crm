-- ============================================================================
-- 0072 — Inteligência de mercado: enriquecimento de lead com sinal público
-- ============================================================================
--
-- Guarda o que `lib/inteligencia-de-mercado/` produz: para cada lead, o estado
-- da consulta ao Exa e os sinais públicos encontrados sobre a empresa dele —
-- reclamação, contratação, captação —, cada um com link para a fonte.
--
-- ## Por que duas tabelas e não uma
--
-- O estado da consulta é 1:1 com o lead e muda a cada passagem do cron; o sinal
-- é 1:N e é imutável depois de gravado. Numa tabela só, cada `update` de status
-- reescreveria a linha inteira, e o histórico de sinais viraria array — que o
-- Postgres até aceita, mas que impede índice por tipo e por data.
--
-- ## Por que `service_role` escreve e `authenticated` não
--
-- Mesmo motivo de `notificacoes` (0066) e `error_logs` (0046): a chave pública
-- está no HTML por design. Com policy de `insert` para `authenticated`, um
-- `POST` no PostgREST fabricaria "sinal de mercado" na tela de outra empresa —
-- e sinal forjável é aviso de venda forjável. Quem escreve é o cron.

-- ============================================================================
-- Estado da consulta, um por lead
-- ============================================================================

create table if not exists public.enriquecimento_de_lead (
  id uuid primary key default gen_random_uuid(),

  -- `workspace_id` é redundante com `leads.workspace_id` e existe assim mesmo:
  -- sem ele, toda policy de RLS precisaria de um join com `leads`, em TODA
  -- leitura. É a mesma denormalização que `deals` já faz desde a 0001.
  workspace_id uuid not null references public.workspaces(id) on delete cascade,

  -- `unique`: um lead tem um estado. É o que transforma a tabela em cache e o
  -- que faz `on conflict (lead_id) do update` funcionar sem corrida.
  lead_id uuid not null unique references public.leads(id) on delete cascade,

  status text not null default 'pendente' check (
    status in (
      'pendente',   -- na fila, ainda não consultado
      'ok',         -- consultado, achou pelo menos um sinal
      'sem_sinal',  -- consultado, não achou nada. É resposta, não falha
      'falhou'      -- o Exa recusou ou caiu. Tenta de novo na próxima janela
    )
  ),

  -- `null` enquanto nunca foi consultado. É o que `deveReenriquecer` lê para
  -- decidir a janela de 30 dias (`dominio/orcamento.ts`).
  consultado_em timestamptz,

  -- Centavos de real, do `costDollars` da resposta. Inteiro de propósito:
  -- dinheiro em ponto flutuante acumula erro, e este número é somado para
  -- valer contra o teto mensal.
  custo_centavos integer not null default 0 check (custo_centavos >= 0),

  -- Guardado para o relato de erro ser específico ("sem crédito" é diferente de
  -- "fora do ar"), sem virar texto livre: cabe em 200 e é cortado antes.
  ultimo_erro text check (ultimo_erro is null or char_length(ultimo_erro) <= 200),

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- A consulta quente do cron é exatamente esta: "os pendentes, mais antigos
-- primeiro". Índice PARCIAL porque só a fatia pendente interessa — o índice
-- cheio cresceria com todo lead já processado, que é a maioria permanente.
create index if not exists enriquecimento_fila
  on public.enriquecimento_de_lead (criado_em)
  where status = 'pendente';

-- A segunda consulta quente é a janela de 30 dias: "o que já foi consultado e
-- passou do prazo". `consultado_em` sozinho basta; `workspace_id` não entra
-- porque o cron varre a base inteira, não uma empresa.
create index if not exists enriquecimento_por_consulta
  on public.enriquecimento_de_lead (consultado_em)
  where consultado_em is not null;

-- Soma do gasto do mês por empresa. `include` põe o valor no índice: a soma sai
-- sem ir à heap. Sem isto, o teto exigiria varredura da tabela a cada lead da
-- fila — e o teto existe justamente para o caminho de alto volume.
create index if not exists enriquecimento_gasto_por_empresa
  on public.enriquecimento_de_lead (workspace_id, consultado_em)
  include (custo_centavos);

-- ============================================================================
-- Sinais encontrados, N por lead
-- ============================================================================

create table if not exists public.sinal_de_mercado (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,

  -- Lista fechada pelo mesmo motivo da 0066: acrescentar tipo passa a exigir
  -- migration, e exigir migration é o que transforma "entrou na lista" em
  -- decisão em vez de efeito colateral de um deploy.
  tipo text not null check (
    tipo in ('dor', 'contratacao', 'investimento', 'reclamacao')
  ),

  -- RECORTE do próprio trecho devolvido pelo Exa, nunca paráfrase. O teto de
  -- 400 é o mesmo de `dominio/dor.ts`, e o corte acontece lá — aqui é a trava
  -- que garante que nenhum outro caminho grave mais que isso.
  resumo text not null check (char_length(resumo) between 1 and 400),

  -- `not null` e https obrigatório, e é a regra central deste recurso: insight
  -- sem link é opinião da máquina sobre a empresa de um cliente. Com link, a
  -- pessoa confere em um clique. `http` fica de fora porque o produto é servido
  -- por HTTPS e o link geraria aviso de conteúdo misto.
  fonte_url text not null check (
    fonte_url like 'https://%' and char_length(fonte_url) <= 2000
  ),

  -- Quando a fonte foi publicada. `null` é comum: nem toda página informa.
  publicado_em date,

  -- Só `alta` é gravado hoje (ver `dominio/dor.ts`), mas a coluna aceita as
  -- três: a classificação é honesta sobre a própria força, e mudar a régua de
  -- gravação não deve exigir migration.
  confianca text not null check (confianca in ('alta', 'media', 'baixa')),

  criado_em timestamptz not null default now(),

  -- Uma fonte, um sinal, por lead. O Exa devolve vários trechos da MESMA
  -- página; `dominio/dor.ts` já deduplica, e esta trava é a segunda linha de
  -- defesa — a que continua valendo se um caminho novo esquecer a primeira.
  unique (lead_id, fonte_url)
);

-- A leitura da tela: os sinais deste lead, mais novos primeiro.
create index if not exists sinal_por_lead
  on public.sinal_de_mercado (lead_id, criado_em desc);

-- O contador agregado do aviso honesto ("N sinais no seu nicho esta semana")
-- varre por empresa e por data.
create index if not exists sinal_por_empresa
  on public.sinal_de_mercado (workspace_id, criado_em desc);

-- ============================================================================
-- `atualizado_em` sem depender de quem escreve
-- ============================================================================
--
-- Trigger e não `default`: o `default` só vale no insert. Deixar isso a cargo
-- do código faria a coluna mentir no dia em que um caminho novo esquecesse de
-- setá-la — e coluna de data que mente é pior que coluna ausente, porque
-- ninguém desconfia dela.
create or replace function public.tocar_atualizado_em()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists enriquecimento_toca_atualizado_em on public.enriquecimento_de_lead;
create trigger enriquecimento_toca_atualizado_em
  before update on public.enriquecimento_de_lead
  for each row execute function public.tocar_atualizado_em();

-- ============================================================================
-- RLS
-- ============================================================================

alter table public.enriquecimento_de_lead enable row level security;
alter table public.sinal_de_mercado enable row level security;

drop policy if exists "membro le o enriquecimento da empresa" on public.enriquecimento_de_lead;
create policy "membro le o enriquecimento da empresa"
  on public.enriquecimento_de_lead
  for select
  to authenticated
  using ((select public.is_workspace_member(workspace_id)));

drop policy if exists "membro le os sinais da empresa" on public.sinal_de_mercado;
create policy "membro le os sinais da empresa"
  on public.sinal_de_mercado
  for select
  to authenticated
  using ((select public.is_workspace_member(workspace_id)));

-- Nenhuma policy de insert, update ou delete para `authenticated`, nas duas
-- tabelas. Ver o cabeçalho: quem escreve é `service_role`, pelo cron.

-- ============================================================================
-- Purga
-- ============================================================================
--
-- Nasce com purga, como a 0066 — e não catorze migrations depois, como a
-- `error_logs`. 180 dias e não 90: sinal de mercado é o histórico que dá
-- contexto a uma negociação longa, e ciclo de venda B2B passa de três meses.
--
-- Entra no cron que JÁ existe (`/api/cron/limpar-eventos`). Rotina nova é como
-- `purge_old_asaas_webhook_events` ficou sete migrations sem nunca ter sido
-- agendada.
create or replace function public.purge_old_sinais_de_mercado()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.sinal_de_mercado
  where criado_em < now() - interval '180 days';
$$;

revoke all on function public.purge_old_sinais_de_mercado() from public;
revoke all on function public.purge_old_sinais_de_mercado() from anon;
revoke all on function public.purge_old_sinais_de_mercado() from authenticated;
