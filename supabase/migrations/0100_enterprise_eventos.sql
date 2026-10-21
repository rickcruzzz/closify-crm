-- Acesso Enterprise concedido manualmente a uma única empresa.
-- Não passa pelo checkout público e não pode ser ativado pelo cliente.
create table public.enterprise_workspaces (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  active boolean not null default true,
  granted_at timestamptz not null default now()
);

create unique index enterprise_um_cliente_ativo
  on public.enterprise_workspaces ((true)) where active;

alter table public.enterprise_workspaces enable row level security;
revoke all on public.enterprise_workspaces from anon, authenticated;

create or replace function public.enterprise_vigente(target_workspace_id uuid)
returns boolean
language sql stable security definer
set search_path to ''
as $$
  select public.is_workspace_member(target_workspace_id)
    and exists (
      select 1 from public.enterprise_workspaces e
      where e.workspace_id = target_workspace_id and e.active
    );
$$;

revoke all on function public.enterprise_vigente(uuid) from public, anon;
grant execute on function public.enterprise_vigente(uuid) to authenticated, service_role;

-- Enterprise herda os direitos Pro e Max da própria empresa, sem criar
-- assinatura fictícia no Asaas nem estender WhatsApp às empresas irmãs.
create or replace function public.pro_vigente(target_workspace_id uuid)
returns boolean
language sql stable security definer
set search_path to ''
as $$
  select exists (
    select 1 from public.enterprise_workspaces e
    where e.workspace_id = target_workspace_id and e.active
  ) or exists (
    select 1 from public.subscriptions s
    where s.workspace_id = target_workspace_id
      and s.status in ('active', 'past_due')
      and s.current_period_end is not null
      and s.current_period_end
        + (public.dias_de_graca(s.ultimo_billing_type) || ' days')::interval > now()
  ) or exists (
    select 1 from public.workspaces w
    where w.id = target_workspace_id
      and w.trial_ate is not null and w.trial_ate > now()
  ) or exists (
    select 1 from public.workspaces alvo
    join public.workspaces irma on irma.created_by = alvo.created_by
    join public.subscriptions s on s.workspace_id = irma.id
    where alvo.id = target_workspace_id
      and alvo.created_by is not null
      and s.status in ('active', 'past_due')
      and s.current_period_end is not null
      and s.current_period_end
        + (public.dias_de_graca(s.ultimo_billing_type) || ' days')::interval > now()
  );
$$;

create or replace function public.max_vigente(target_workspace_id uuid)
returns boolean
language sql stable security definer
set search_path to ''
as $$
  select exists (
    select 1 from public.enterprise_workspaces e
    where e.workspace_id = target_workspace_id and e.active
  ) or exists (
    select 1 from public.subscriptions s
    where s.workspace_id = target_workspace_id
      and s.plano = 'max'
      and s.status in ('active', 'past_due')
      and s.current_period_end is not null
      and s.current_period_end
        + (public.dias_de_graca(s.ultimo_billing_type) || ' days')::interval > now()
  );
$$;

-- O robô guarda a fonte e a justificativa junto com cada oportunidade.
-- O número exibido na tela é prioridade comercial de 0 a 100, não uma
-- probabilidade calibrada de fechamento.
create table public.enterprise_eventos (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  nome text not null check (length(trim(nome)) between 3 and 200),
  data_inicio date not null,
  cidade text not null,
  local_evento text,
  fonte_url text not null check (fonte_url ~ '^https://'),
  organizador text,
  contato_nome text,
  contato_email text,
  contato_telefone text,
  publico_estimado integer check (publico_estimado >= 0),
  prioridade smallint check (prioridade between 0 and 100),
  justificativa text,
  mensagem_rascunho text,
  status text not null default 'novo'
    check (status in ('novo', 'rascunho', 'contatado', 'descartado')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index enterprise_eventos_empresa_data
  on public.enterprise_eventos (workspace_id, data_inicio, id);

alter table public.enterprise_eventos enable row level security;

create policy enterprise_eventos_ler on public.enterprise_eventos
  for select using ((select public.enterprise_vigente(workspace_id)));
create policy enterprise_eventos_criar on public.enterprise_eventos
  for insert with check ((select public.enterprise_vigente(workspace_id)));
create policy enterprise_eventos_atualizar on public.enterprise_eventos
  for update using ((select public.enterprise_vigente(workspace_id)))
  with check ((select public.enterprise_vigente(workspace_id)));
create policy enterprise_eventos_apagar on public.enterprise_eventos
  for delete using ((select public.enterprise_vigente(workspace_id)));
