-- Captura real de erro em produção: hoje `app/(dashboard)/error.tsx` e
-- `app/global-error.tsx` só fazem `console.error(...)`, que morre no log da
-- Vercel e ninguém vê até um cliente reclamar (docs/estado-atual.md, fila
-- técnica item 4). Tabela de sistema, mesmo padrão de `asaas_webhook_events`:
-- RLS ligada, ZERO policy — só `service_role` (via createAdminClient(), a
-- partir de app/api/log-erro/route.ts) grava e lê. O projeto não tem
-- conceito de "dono da plataforma" no RLS (toda a superfície gira em
-- is_workspace_member/is_workspace_admin, relativo a um workspace), então
-- não faz sentido inventar um papel novo só pra esta tabela.

create table public.error_logs (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  digest text,
  stack text,
  url text,
  -- 'dashboard' | 'global', qual error boundary capturou.
  origem text not null,
  -- Sem FK: o workspace pode já ter sido deletado, e o log não deve sumir
  -- junto (CASCADE apagaria a evidência do próprio erro que pode ter
  -- causado o problema). Idem user_id: sem FK para auth.users, mesmo padrão
  -- já documentado em docs/schema.md para tasks.assignee_id e outras.
  workspace_id uuid,
  user_id uuid,
  created_at timestamptz not null default now()
);

alter table public.error_logs enable row level security;

create index error_logs_created_at_idx on public.error_logs (created_at desc);
