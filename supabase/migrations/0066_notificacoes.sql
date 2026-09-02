-- ============================================================================
-- 0066 — Notificações dentro do produto
-- ============================================================================
--
-- Até aqui o sistema só falava por e-mail. Quem está com o CRM aberto é
-- justamente quem não vai abrir a caixa de entrada, então todo aviso que o
-- produto tem a dar — pagamento confirmado, plano vencendo, WhatsApp caído —
-- chegava no lugar errado para quem estava no lugar certo.
--
-- ## A regra que governa o que entra aqui, e ela é a lição de 20/08
--
-- Na primeira execução dos alertas da Central, 8 dos 11 eram ruído. A conclusão
-- ficou registrada: fila com lixo dentro ensina a ignorar a fila inteira, e
-- junto com o item chato vai embora o alerta de dinheiro.
--
-- Por isso esta tabela nasce com uma restrição de tipo (`check`) em vez de
-- aceitar texto livre: acrescentar um tipo novo passa a exigir uma migration,
-- que é uma decisão, e não um `insert` casual em qualquer lugar do código.
-- Nada do que a própria pessoa acabou de fazer vira notificação.
--
-- ## As três decisões de RLS
--
-- 1. `select` por `is_workspace_member`, e só do que é seu (`user_id` nulo
--    significa "toda a empresa").
-- 2. `update` só da própria linha, e o único campo que muda é `lida_em` —
--    marcar como lida é ação de quem lê.
-- 3. **`insert` NENHUM para `authenticated`.** Notificação escrita pelo
--    cliente é aviso de cobrança forjado: bastaria um `POST` no PostgREST com
--    a chave pública (que está no HTML por design) para qualquer pessoa
--    fabricar "seu pagamento falhou" na tela de outra. Quem escreve é
--    `service_role`, pelo mesmo motivo que `error_logs` e
--    `asaas_webhook_events` têm RLS ligada e zero policy de escrita.
--
-- É a mesma doutrina de 12/08 que este projeto pagou três vezes para aprender:
-- regra que só vive na Server Action não é regra, porque Server Action é
-- endpoint HTTP e o PostgREST fica ao lado dela.

create table if not exists public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,

  -- Nulo = para todo mundo da empresa. É o caso da maioria: cobrança, plano e
  -- integração são fatos da EMPRESA, não de uma pessoa. Preenchido só quando o
  -- aviso é pessoal de verdade.
  user_id uuid references auth.users(id) on delete cascade,

  -- Quatro, e cada um tem um chamador VIVO hoje. Dois candidatos óbvios
  -- ficaram de fora de propósito, e a razão é a mesma regra:
  --
  --   whatsapp_caiu     a integracao esta em FASE_DO_WHATSAPP = 'migrando',
  --                     e o e-mail que avisava disso nao existe mais. Tipo sem
  --                     chamador e codigo morto com aparencia de recurso.
  --   limite_do_plano   a pessoa ja recebe a mensagem NA TELA, no mesmo
  --                     segundo (lib/leads/actions.ts trata o 42501). Repetir
  --                     no sino seria avisar sobre o que ela acabou de fazer,
  --                     que e como se ensina alguem a ignorar o sino.
  --
  -- Quando o WhatsApp voltar, uma migration acrescenta o valor. Exigir uma
  -- migration para isso é o ponto do `check`: entrar na lista vira decisão.
  tipo text not null check (
    tipo in (
      'pagamento_confirmado',
      'pagamento_atrasado',
      'plano_vencendo',
      'trial_terminando'
    )
  ),

  titulo text not null check (char_length(titulo) between 1 and 120),
  corpo text check (char_length(corpo) <= 400),

  -- Para onde o clique leva. Caminho interno, nunca URL absoluta: um `href`
  -- gravado por quem escreve a notificação e renderizado como link é um vetor
  -- de phishing se puder apontar para fora.
  href text check (href is null or href like '/%'),

  criada_em timestamptz not null default now(),
  lida_em timestamptz
);

-- A consulta quente é sempre a mesma: as não lidas desta empresa, mais novas
-- primeiro. Ela roda no layout, ou seja, em TODA navegação — sem índice seria
-- varredura por clique.
create index if not exists notificacoes_por_empresa
  on public.notificacoes (workspace_id, criada_em desc);

create index if not exists notificacoes_nao_lidas
  on public.notificacoes (workspace_id)
  where lida_em is null;

alter table public.notificacoes enable row level security;

drop policy if exists "membro le as notificacoes da empresa" on public.notificacoes;
create policy "membro le as notificacoes da empresa"
  on public.notificacoes
  for select
  to authenticated
  using (
    (select public.is_workspace_member(workspace_id))
    and (user_id is null or user_id = (select auth.uid()))
  );

-- `using` E `with check`, os dois. Só com `using` a pessoa poderia mover a
-- linha para outra empresa no mesmo `update`: `using` avalia a linha ANTES da
-- mudança e aprovaria. É a armadilha que a 0031 já pagou nas policies do
-- Storage, e está registrada no estado-atual.
drop policy if exists "membro marca a propria notificacao como lida" on public.notificacoes;
create policy "membro marca a propria notificacao como lida"
  on public.notificacoes
  for update
  to authenticated
  using (
    (select public.is_workspace_member(workspace_id))
    and (user_id is null or user_id = (select auth.uid()))
  )
  with check (
    (select public.is_workspace_member(workspace_id))
    and (user_id is null or user_id = (select auth.uid()))
  );

-- Nenhuma policy de insert nem de delete, de propósito. Ver o cabeçalho.

-- ============================================================================
-- Purga
-- ============================================================================
--
-- Nasce com purga em vez de esperar catorze migrations como a `error_logs`
-- esperou. 90 dias: notificação de três meses atrás não muda decisão nenhuma,
-- e o histórico de dinheiro que importa vive em `assinatura_eventos` (0055),
-- que é append-only e não é apagado por isto.
--
-- Entra no cron que já existe (`/api/cron/limpar-eventos`), não numa rotina
-- nova — foi assim que `purge_old_asaas_webhook_events` ficou sete migrations
-- sem nunca ter sido agendada.
create or replace function public.purge_old_notificacoes()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  apagadas integer;
begin
  delete from public.notificacoes
  where criada_em < now() - interval '90 days';

  get diagnostics apagadas = row_count;
  return apagadas;
end;
$$;

-- `revoke` explícito: o Supabase concede `execute` de função a `authenticated`
-- por default privilege, e a 0013 já pagou por supor o contrário. Purga é
-- rotina de sistema; deixá-la chamável pelo cliente daria a qualquer pessoa um
-- `delete` em massa disfarçado de RPC.
revoke all on function public.purge_old_notificacoes() from public, anon, authenticated;
grant execute on function public.purge_old_notificacoes() to service_role;

comment on table public.notificacoes is
  'Avisos do produto para quem esta dentro dele. Escrita so por service_role; '
  'leitura por membro da empresa; update so de lida_em. Purga de 90 dias.';
