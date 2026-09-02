-- ============================================================================
-- 0067 — A purga que faltava em `rate_limit_attempts`
-- ============================================================================
--
-- Auditoria de 02/09. Cinco tabelas de sistema tinham purga
-- (`asaas_webhook_events`, `error_logs`, `feedback`, `notificacoes`,
-- `whatsapp_webhook_events`) e esta não. Ela é a mais escrita de todas.
--
-- ## Por que ela cresce mais rápido que as outras
--
-- Ganha uma linha por TENTATIVA, não por sucesso: login, cadastro, convite,
-- recuperação de senha, relato de suporte e checkout. Ou seja, ela mede
-- exatamente o volume que o tráfego pago vai trazer — e o tráfego pago começa
-- agora.
--
-- 351 linhas hoje, com a base sendo só teste do dono. Com anúncio rodando,
-- cada visitante que erra a senha uma vez deixa uma linha.
--
-- ## Uma hora, e não 90 dias como as outras
--
-- As outras purgas guardam evidência: erro para investigar, relato para reler,
-- evento de webhook para deduplicar retry. Esta não guarda evidência nenhuma —
-- a janela mais longa do projeto é de 1 hora (`lib/rate-limit.ts`), e linha
-- mais velha que isso não participa de decisão nenhuma.
--
-- Guardar 90 dias de tentativa de login seria acumular dado pessoal (o IP está
-- na chave) sem nenhuma finalidade, que é o oposto do que a LGPD pede.
--
-- 24 horas em vez de 1 pelo mesmo motivo que a tolerância do vigia é de três
-- horas e não de uma: dá folga para investigar um pico de tentativa que tenha
-- acabado de acontecer, sem virar arquivo.

create or replace function public.purge_old_rate_limit_attempts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  apagadas integer;
begin
  delete from public.rate_limit_attempts
  where ocorrido_em < now() - interval '24 hours';

  get diagnostics apagadas = row_count;
  return apagadas;
end;
$$;

-- O Supabase concede `execute` a `authenticated` por default privilege, e a
-- 0013 já pagou por supor o contrário. Purga é rotina de sistema: deixá-la
-- chamável pelo cliente daria a qualquer pessoa um jeito de zerar o controle
-- de tentativas — ou seja, de desligar o próprio rate limit.
revoke all on function public.purge_old_rate_limit_attempts() from public, anon, authenticated;
grant execute on function public.purge_old_rate_limit_attempts() to service_role;

comment on function public.purge_old_rate_limit_attempts() is
  'Apaga tentativas com mais de 24h. A janela mais longa do rate limit e de 1h, '
  'entao linha mais velha nao decide nada. Chamada por /api/cron/limpar-eventos.';
