-- Três coisas, todas na volta da assinatura avisar antes de vencer.
--
-- 1. Devolve a `pro_vigente()` a graça por forma de pagamento, que a 0051
--    desfez sem querer.
-- 2. Cria `assinatura_eventos`, para o cliente ver o histórico do que pagou.
-- 3. Dá a `workspaces` onde marcar que o aviso de fim de trial já saiu.

-- ===========================================================================
-- 1. A regressão: `pro_vigente()` parou de chamar `dias_de_graca()`
-- ===========================================================================
--
-- A 0044 fez a tolerância pós-vencimento depender da forma de pagamento, e o
-- motivo continua válido: cartão recusa na hora, então 1 dia basta; Pix e
-- boleto levam dias para compensar, então 3.
--
-- A 0051, ao acrescentar o trial, REESCREVEU esta função inteira e voltou a
-- chamar `dias_para_compensacao_bancaria()`, a constante de 3 dias que a
-- própria 0044 marcou como OBSOLETA. Ninguém percebeu porque reescrever uma
-- função para acrescentar uma cláusula não deixa rastro de que a outra metade
-- regrediu.
--
-- Medido no banco de produção em 25/08/2026:
--
--   pro_vigente     usa dias_de_graca .......... false
--                   usa dias_para_compensacao .. true
--   dias_de_graca   existe, e nenhuma função, trigger, policy ou índice chama
--
-- O efeito é dinheiro: cartão recusado ganhava 3 dias de Pro em vez de 1.
--
-- A cláusula do trial da 0051 é preservada inteira. Só a linha da graça muda.
--
-- `ultimo_billing_type` é anulável, e `dias_de_graca(null)` devolve 3 — a
-- comparação com 'CREDIT_CARD' dá NULL e cai no `else`. É o padrão certo:
-- sem saber a forma de pagamento, o benefício da dúvida vai para o cliente.

create or replace function public.pro_vigente(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select
    exists (
      select 1
        from public.subscriptions s
       where s.workspace_id = target_workspace_id
         and s.status in ('active', 'past_due')
         and s.current_period_end is not null
         and s.current_period_end
             + (public.dias_de_graca(s.ultimo_billing_type) || ' days')::interval > now()
    )
    or exists (
      select 1
        from public.workspaces w
       where w.id = target_workspace_id
         and w.trial_ate is not null
         and w.trial_ate > now()
    );
$$;

revoke all on function public.pro_vigente(uuid) from public, anon;
grant execute on function public.pro_vigente(uuid) to authenticated, service_role;

comment on function public.pro_vigente(uuid) is
  'Plano pago vigente OU trial vigente. A tolerância pós-vencimento vem de '
  'dias_de_graca(ultimo_billing_type), restaurada na 0055 depois de a 0051 '
  'tê-la substituído sem querer pela constante de 3 dias.';

-- `dias_para_compensacao_bancaria()` continua existindo porque `em_trial()`
-- ainda a chama. Não é apagada aqui: derrubar função usada por outra é como
-- se cria o defeito seguinte.

-- ===========================================================================
-- 2. `assinatura_eventos` — o histórico que nunca existiu
-- ===========================================================================
--
-- `subscriptions` guarda UMA linha por empresa, só o estado atual. Quem
-- assinou, cancelou e voltou não deixa rastro nenhum.
--
-- Isso já custou caro: em 18/08 foi impossível distinguir "Pro vencido" de
-- "nunca teve Pro", e o contorno foi inferir pela existência de linha em
-- `integration_connections` — gambiarra registrada como tal no código.
--
-- A tabela é append-only por construção: não há policy de update nem de
-- delete, e a escrita acontece num lugar só, `lib/asaas/aplicar-evento.ts`,
-- que já é o caminho compartilhado entre o webhook e o cron. Duas cópias da
-- regra do dinheiro divergiriam no primeiro dia em que uma mudasse.

create table if not exists public.assinatura_eventos (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,

  -- Anulável de propósito: o primeiro evento de uma empresa não tem "de".
  de_status public.subscription_status,
  para_status public.subscription_status not null,

  -- 'webhook' ou 'reconciliacao:cron'. Mesmo vocabulário do parâmetro `origem`
  -- de `aplicarEventoAsaas`, para o histórico responder "quem aplicou isto".
  origem text not null,

  -- Forma de pagamento no momento do evento. É o que a tela mostra ao lado da
  -- data, e o que explica por que a graça foi de 1 ou de 3 dias.
  billing_type text,

  -- Id do evento no Asaas. Não é chave: o dedupe verdadeiro vive em
  -- `asaas_webhook_events`, e duplicar a restrição aqui faria o histórico
  -- recusar linha por um motivo que não é dele.
  asaas_event_id text,

  criado_em timestamptz not null default now()
);

-- A tela lê "os últimos eventos desta empresa". Índice composto na ordem em
-- que a consulta filtra e ordena, com `desc` casando o `order by` para o
-- Postgres não precisar reordenar.
create index if not exists assinatura_eventos_workspace_criado_idx
  on public.assinatura_eventos (workspace_id, criado_em desc);

alter table public.assinatura_eventos enable row level security;

-- Mesmo desenho de `subscriptions`: membro LÊ, ninguém escreve pelo cliente.
-- A escrita é só pela service role, de dentro de `aplicar-evento.ts`.
--
-- `(select is_workspace_member(...))` e não a chamada direta: dentro do
-- parêntese o Postgres avalia uma vez e reusa, em vez de chamar a função linha
-- a linha. É o padrão que as policies de `activities` e `subscriptions` já
-- usam neste banco.
drop policy if exists assinatura_eventos_select on public.assinatura_eventos;
create policy assinatura_eventos_select
  on public.assinatura_eventos
  for select
  using ((select public.is_workspace_member(workspace_id)));

comment on table public.assinatura_eventos is
  'Histórico append-only de mudança de status de assinatura. Escrito só por '
  'lib/asaas/aplicar-evento.ts, o caminho compartilhado entre webhook e cron.';

-- ===========================================================================
-- 3. Onde marcar que o aviso de fim de trial já saiu
-- ===========================================================================
--
-- O aviso de vencimento do Pro marca `subscriptions.aviso_vencimento_enviado_em`
-- (0044). Quem está em trial NÃO TEM linha em `subscriptions`: o trial nasce
-- em `create_workspace_with_admin` gravando `workspaces.trial_ate`, e a
-- assinatura só existe depois do primeiro checkout.
--
-- Sem coluna própria, o cron reenviaria o mesmo e-mail toda vez que rodasse.

alter table public.workspaces
  add column if not exists aviso_trial_enviado_em timestamptz;

comment on column public.workspaces.aviso_trial_enviado_em is
  'Último envio do e-mail de fim de trial. Comparado por DIA DE CALENDÁRIO em '
  'São Paulo, não por intervalo: é o que permite um aviso por dia na reta '
  'final sem repetir dentro do mesmo dia.';

-- A coluna é escrita pelo cron com service role. `proteger_colunas_do_workspace`
-- (0027) só barra alteração de `plan` por sessão autenticada, e
-- `proteger_trial_ate` (0051) só barra `trial_ate` — nenhuma das duas precisa
-- mudar. Mas a policy de update de `workspaces` é de admin, então um admin
-- conseguiria zerar o próprio aviso e receber o e-mail de novo. Isso é
-- inofensivo: o pior caso é a pessoa receber um lembrete a mais sobre a
-- própria conta.
