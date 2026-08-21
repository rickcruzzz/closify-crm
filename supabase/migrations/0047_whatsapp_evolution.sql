-- WhatsApp pelo Evolution API: dedupe de webhook, casamento de telefone e purga.
--
-- ## O que esta migration resolve
--
-- A dor que motivou a integração não é "esquecer de responder" — é o histórico
-- da conversa morar no celular do vendedor. Quando ele sai (demissão, licença,
-- concorrente), a empresa perde contato, negociação em andamento e histórico de
-- uma vez só, e ainda fica exposta na LGPD por não conseguir auditar o que
-- aconteceu. Com o webhook, toda conversa vira `activity` do lead dentro do
-- CRM, e a empresa passa a ser dona do próprio histórico.
--
-- ## Três peças, e o porquê de cada uma
--
-- 1. `whatsapp_webhook_events` — dedupe. A tabela existiu antes (migration
--    0034) e foi dropada pela 0043 quando a Cloud API saiu. Volta com uma
--    diferença que importa: **nasce com purga**. A `asaas_webhook_events`
--    sobrevive sem limpeza porque recebe poucas linhas por mês; o WhatsApp
--    gera mais eventos em um dia que o Asaas na vida inteira do projeto.
--
-- 2. Índice funcional em `leads` + RPC de casamento. O código antigo buscava
--    TODOS os leads do workspace e comparava os últimos 8 dígitos em
--    JavaScript — O(n) por mensagem recebida. Com 3.000 leads num workspace,
--    cada mensagem varria 3.000 linhas. Agora o Postgres resolve com índice.
--
-- 3. `purge_old_whatsapp_webhook_events` — espelha
--    `purge_old_asaas_webhook_events` (migration 0014), mas com janela bem
--    menor: 7 dias em vez de 90. O dedupe só precisa cobrir a janela de retry
--    do Evolution, que é de minutos; guardar mais é pagar armazenamento por
--    dado que não responde pergunta nenhuma.

-- ---------------------------------------------------------------------------
-- 1. Dedupe de webhook
-- ---------------------------------------------------------------------------

create table if not exists public.whatsapp_webhook_events (
  event_id text primary key,
  processed_at timestamptz not null default now()
);

-- RLS ligada com ZERO policy, mesmo padrão de `asaas_webhook_events` e
-- `error_logs`: é tabela de sistema, alcançável só pela service role. Sem
-- policy, nem `authenticated` nem `anon` leem uma linha sequer.
alter table public.whatsapp_webhook_events enable row level security;

-- O índice serve à purga, que varre por data. Sem ele, apagar 7 dias de
-- eventos viraria varredura sequencial de milhões de linhas.
create index if not exists whatsapp_webhook_events_processed_at_idx
  on public.whatsapp_webhook_events (processed_at);

-- ---------------------------------------------------------------------------
-- 2. Casamento de telefone: índice funcional + RPC
-- ---------------------------------------------------------------------------

-- Por que os últimos 8 dígitos, e não o número inteiro:
--
-- O WhatsApp entrega o remetente com DDI (`5511999998888`), enquanto
-- `leads.phone` foi digitado à mão ou importado de planilha em qualquer
-- formato — com máscara, sem DDI, com espaço, com traço. Comparar o número
-- cru nunca casaria.
--
-- Os últimos 8 dígitos são o miolo do número em qualquer formatação
-- brasileira. O risco conhecido e aceito: dois leads com os mesmos 8 dígitos
-- finais em DDDs diferentes colidem. É raro, e o custo de errar é anexar a
-- mensagem ao lead errado — reparável, ao contrário de perder a mensagem.
create index if not exists leads_telefone_ultimos8_idx
  on public.leads (workspace_id, right(regexp_replace(phone, '\D', '', 'g'), 8))
  where phone is not null;

-- `security definer` porque o webhook roda sem sessão de usuário: ele chega
-- autenticado por segredo na URL, não por JWT. Mesmo padrão de
-- `apply_asaas_subscription_status` (migration 0044).
--
-- `search_path` vazio é obrigatório em `security definer`: sem isso, um
-- schema malicioso no path do chamador poderia sequestrar a resolução de
-- nomes. Lição já paga neste projeto na migration 0019.
create or replace function public.encontrar_lead_por_telefone(
  p_workspace_id uuid,
  p_telefone text
)
returns uuid
language sql
stable
security definer
set search_path to ''
as $$
  select l.id
    from public.leads l
   where l.workspace_id = p_workspace_id
     and l.phone is not null
     and right(regexp_replace(l.phone, '\D', '', 'g'), 8)
       = right(regexp_replace(p_telefone, '\D', '', 'g'), 8)
   -- Mais antigo primeiro: se houver colisão de 8 dígitos, o lead que existe
   -- há mais tempo é o palpite menos surpreendente para quem olha depois.
   order by l.created_at
   limit 1;
$$;

revoke all on function public.encontrar_lead_por_telefone(uuid, text) from public;
revoke execute on function public.encontrar_lead_por_telefone(uuid, text) from anon;
revoke execute on function public.encontrar_lead_por_telefone(uuid, text) from authenticated;
grant execute on function public.encontrar_lead_por_telefone(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Purga
-- ---------------------------------------------------------------------------

-- Sete dias, contra os 90 do Asaas. O dedupe do WhatsApp só precisa cobrir
-- retry de minutos, e o volume é ordens de grandeza maior: guardar 90 dias
-- aqui custaria gigabytes para responder uma pergunta que ninguém faz.
create or replace function public.purge_old_whatsapp_webhook_events()
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_deleted integer;
begin
  delete from public.whatsapp_webhook_events
   where processed_at < now() - interval '7 days';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.purge_old_whatsapp_webhook_events() from public;
revoke execute on function public.purge_old_whatsapp_webhook_events() from anon;
revoke execute on function public.purge_old_whatsapp_webhook_events() from authenticated;
grant execute on function public.purge_old_whatsapp_webhook_events() to service_role;
