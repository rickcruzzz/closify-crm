-- A memória do vigia: o que já foi avisado, para não avisar de novo.
--
-- ## Por que isto precisa existir
--
-- O vigia (`/api/cron/vigia`, 01/09) manda e-mail sempre que encontra algo.
-- Rodando uma vez por dia isso funciona. De hora em hora, um erro que apareceu
-- de manhã e continua lá gera VINTE E QUATRO e-mails idênticos até alguém
-- resolver — e aí a pessoa aprende a arquivar sem ler, que é exatamente o
-- estado que a fila de 20/08 produziu com 8 de 11 alertas de ruído.
--
-- "Vigilância contínua" não quer dizer aviso contínuo. Quer dizer varrer
-- sempre e avisar quando MUDA.
--
-- ## Uma linha por tipo de alerta, sobrescrita
--
-- Não é histórico: é o último valor comunicado. `assinatura_eventos` (0055) é
-- append-only porque lá a pergunta é "o que aconteceu com esta assinatura ao
-- longo do tempo"; aqui a pergunta é só "eu já falei disto?", e guardar todas
-- as respostas anteriores encheria a tabela sem responder nada a mais.
--
-- ## Tabela de sistema: RLS ligada, zero policy
--
-- Mesmo padrão de `asaas_webhook_events` e `error_logs`. Só o service role
-- escreve aqui, pelo cron; nenhum cliente tem o que ler nesta tabela, e sem
-- policy nenhuma o PostgREST recusa qualquer sessão `authenticated` — que é a
-- forma mais simples de garantir isso sem depender de ninguém lembrar.

create table if not exists public.vigia_ultimo_aviso (
  -- O tipo de alerta: `errosNovos`, `trialsVencendo`, `suporteParado`...
  -- Texto e não enum de propósito: acrescentar um sinal novo ao vigia não deve
  -- exigir migration, e o Postgres não tem `alter type ... drop value` para
  -- desfazer se o nome mudar.
  chave text primary key,

  -- Quantos itens havia quando o aviso saiu. É o que permite distinguir
  -- "continua igual" de "piorou" — sem o número, só daria para saber que o
  -- alerta existia, e 2 erros virando 30 passaria em silêncio.
  quantidade integer not null check (quantidade >= 0),

  avisado_em timestamptz not null default now()
);

comment on table public.vigia_ultimo_aviso is
  'Último estado comunicado por alerta do vigia. Evita repetir o mesmo aviso a cada varredura.';

alter table public.vigia_ultimo_aviso enable row level security;

-- Sem policy: nenhuma sessão `authenticated` lê ou escreve. O cron usa o
-- service role, que ignora RLS por definição.
