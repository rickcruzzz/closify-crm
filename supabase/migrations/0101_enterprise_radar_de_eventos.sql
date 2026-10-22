-- Completa o radar Enterprise iniciado na 0100. A base comum (0001-0100)
-- precisa existir antes desta migration.

create table public.enterprise_agendas (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  nome text not null check (length(trim(nome)) between 3 and 160),
  cidade text not null check (length(trim(cidade)) between 2 and 120),
  tipo text not null default 'agenda' check (tipo in ('centro_de_convencoes', 'feira', 'simposio', 'agenda')),
  url text not null check (url ~ '^https://'),
  ativa boolean not null default true,
  ultima_varredura_em timestamptz,
  ultimo_erro text,
  criado_em timestamptz not null default now(),
  unique (workspace_id, url),
  unique (workspace_id, id)
);

create index enterprise_agendas_ativas_idx
  on public.enterprise_agendas (workspace_id, cidade) where ativa;

create table public.enterprise_espacos (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  nome text not null check (length(trim(nome)) between 3 and 160),
  cidade text not null check (length(trim(cidade)) between 2 and 120),
  regiao text,
  formatos text[] not null default '{}',
  descricao text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create index enterprise_espacos_ativos_idx
  on public.enterprise_espacos (workspace_id, cidade) where ativo;

alter table public.enterprise_eventos
  add column agenda_id uuid,
  add column tipo text,
  add column perfil_publico text,
  add column fonte_contato_url text check (fonte_contato_url is null or fonte_contato_url ~ '^https://'),
  add column informacoes_faltantes text[] not null default '{}',
  add column compatibilidade_espacos text,
  add column lead_id uuid references public.leads(id) on delete set null,
  add column mensagem_aprovada text,
  add column aprovada_em timestamptz,
  add constraint enterprise_eventos_agenda_da_empresa_fk
    foreign key (workspace_id, agenda_id)
    references public.enterprise_agendas (workspace_id, id);

alter table public.enterprise_eventos
  drop constraint enterprise_eventos_status_check;
alter table public.enterprise_eventos
  add constraint enterprise_eventos_status_check
  check (status in ('novo', 'rascunho', 'aprovado', 'contatado', 'descartado'));

create unique index enterprise_eventos_fonte_data_unica
  on public.enterprise_eventos (workspace_id, fonte_url, data_inicio);

create index enterprise_eventos_lead_idx
  on public.enterprise_eventos (workspace_id, lead_id) where lead_id is not null;

-- A tabela de evidências referencia o par empresa/evento, não apenas o ID.
alter table public.enterprise_eventos
  add constraint enterprise_eventos_empresa_id_unicos unique (workspace_id, id);

create table public.enterprise_evento_fontes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  evento_id uuid not null,
  tipo text not null check (tipo in ('evento', 'organizador', 'contato', 'publico')),
  url text not null check (url ~ '^https://'),
  titulo text,
  trecho text,
  verificada_em timestamptz not null default now(),
  unique (evento_id, tipo, url),
  foreign key (workspace_id, evento_id)
    references public.enterprise_eventos (workspace_id, id) on delete cascade
);

-- A relação com o contato do CRM não pode apontar para outra empresa, mesmo
-- que um cliente altere o lead_id diretamente pela Data API.
create function public.enterprise_evento_validar_lead()
returns trigger language plpgsql set search_path to '' as $$
begin
  if new.lead_id is not null and not exists (
    select 1 from public.leads l
    where l.id = new.lead_id and l.workspace_id = new.workspace_id
  ) then
    raise exception 'Contato não pertence à empresa do evento.';
  end if;
  return new;
end;
$$;

create trigger enterprise_evento_validar_lead_antes
  before insert or update of lead_id, workspace_id on public.enterprise_eventos
  for each row execute function public.enterprise_evento_validar_lead();

alter table public.enterprise_agendas enable row level security;
alter table public.enterprise_espacos enable row level security;
alter table public.enterprise_evento_fontes enable row level security;

create policy enterprise_agendas_ler on public.enterprise_agendas
  for select using ((select public.enterprise_vigente(workspace_id)));
create policy enterprise_agendas_criar on public.enterprise_agendas
  for insert with check ((select public.enterprise_vigente(workspace_id)));
create policy enterprise_agendas_atualizar on public.enterprise_agendas
  for update using ((select public.enterprise_vigente(workspace_id)))
  with check ((select public.enterprise_vigente(workspace_id)));

create policy enterprise_espacos_ler on public.enterprise_espacos
  for select using ((select public.enterprise_vigente(workspace_id)));
create policy enterprise_espacos_criar on public.enterprise_espacos
  for insert with check ((select public.enterprise_vigente(workspace_id)));
create policy enterprise_espacos_atualizar on public.enterprise_espacos
  for update using ((select public.enterprise_vigente(workspace_id)))
  with check ((select public.enterprise_vigente(workspace_id)));

create policy enterprise_evento_fontes_ler on public.enterprise_evento_fontes
  for select using ((select public.enterprise_vigente(workspace_id)));
create policy enterprise_evento_fontes_criar on public.enterprise_evento_fontes
  for insert with check ((select public.enterprise_vigente(workspace_id)));
create policy enterprise_evento_fontes_atualizar on public.enterprise_evento_fontes
  for update using ((select public.enterprise_vigente(workspace_id)))
  with check ((select public.enterprise_vigente(workspace_id)));

-- Usuários autenticados precisam dos grants para chegar às policies RLS.
grant select, insert, update on public.enterprise_agendas,
  public.enterprise_espacos, public.enterprise_evento_fontes to authenticated;
