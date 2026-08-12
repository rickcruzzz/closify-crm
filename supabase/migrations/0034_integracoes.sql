-- Velo Funil — integrações oficiais: WhatsApp Cloud API, Google Calendar, Gmail
--
-- Uma tabela para as três, porque a forma é a mesma: workspace conecta,
-- guarda token cifrado, desconecta. RLS: select para quem é membro (a
-- equipe vê o status da conexão), insert/update/delete só para admin —
-- mesma régua de workspaces_update.
--
-- Colunas de token ficam fora do alcance de `authenticated` mesmo com
-- select liberado na linha: REVOKE por coluna, defesa a mais além da
-- disciplina de nunca fazer `select('*')` nelas no app. Só a service role
-- (Server Actions/route handlers de integração) lê o token de verdade, e
-- mesmo assim ele é cifrado — INTEGRATIONS_ENCRYPTION_KEY só existe no
-- servidor.

create type public.integration_provider as enum ('google_calendar', 'gmail', 'whatsapp');
create type public.integration_status as enum ('connected', 'error', 'disconnected');

create table public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  provider public.integration_provider not null,
  status public.integration_status not null default 'disconnected',

  -- E-mail da conta Google, ou número do WhatsApp formatado — o que a tela
  -- mostra pra pessoa saber QUAL conta está conectada.
  account_label text,
  -- Calendar id do Google, ou phone_number_id da Meta.
  external_id text,
  scopes text[] not null default '{}',

  access_token_enc bytea,
  refresh_token_enc bytea,
  token_expires_at timestamptz,

  last_synced_at timestamptz,
  last_error text,

  connected_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (workspace_id, provider)
);

create index integration_connections_workspace_id_idx
  on public.integration_connections (workspace_id);

alter table public.integration_connections enable row level security;

create policy "integration_connections_select" on public.integration_connections
  for select using ((select public.is_workspace_member(workspace_id)));

create policy "integration_connections_insert" on public.integration_connections
  for insert with check ((select public.is_workspace_admin(workspace_id)));

create policy "integration_connections_update" on public.integration_connections
  for update using ((select public.is_workspace_admin(workspace_id)))
  with check ((select public.is_workspace_admin(workspace_id)));

create policy "integration_connections_delete" on public.integration_connections
  for delete using ((select public.is_workspace_admin(workspace_id)));

-- Defesa a mais: uma mudança futura na tela de configurações que vire um
-- `select('*')` descuidado não vaza o cifrado à toa — a coluna nem chega na
-- resposta do PostgREST.
--
-- `revoke select (coluna) ... from authenticated` SOZINHO não funciona —
-- testado contra o banco real: o Supabase já concede `select` na TABELA
-- INTEIRA para `authenticated` por default privilege (mesma armadilha que a
-- 0013 documentou para EXECUTE de função). Revogar uma coluna não subtrai de
-- um grant mais amplo já concedido. A correção que funciona é revogar
-- `select` da tabela inteira e conceder de volta só nas colunas seguras —
-- assim o grant específico é o único que existe, e as colunas de token
-- simplesmente não aparecem nele.
revoke select on public.integration_connections from authenticated, anon;

grant select (
  id, workspace_id, provider, status, account_label, external_id, scopes,
  token_expires_at, last_synced_at, last_error, connected_by, created_at, updated_at
) on public.integration_connections to authenticated;

-- `tocar_updated_at` já existe desde a 0030 (onboarding_state usa a mesma).
create trigger integration_connections_updated_at
  before update on public.integration_connections
  for each row
  execute function public.tocar_updated_at();

-- Dedupe de mensagem recebida do webhook do WhatsApp. Mesmo desenho de
-- `asaas_webhook_events` (0012): só a service role escreve, RLS ligada e
-- sem policy nenhuma — nenhum client alcança.
create table public.whatsapp_webhook_events (
  event_id text primary key,
  processed_at timestamptz not null default now()
);

alter table public.whatsapp_webhook_events enable row level security;

create index whatsapp_webhook_events_processed_at_idx
  on public.whatsapp_webhook_events (processed_at);
