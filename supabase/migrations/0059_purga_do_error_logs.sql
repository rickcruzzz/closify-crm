-- `error_logs` era a única tabela de sistema deste banco SEM purga.
--
--     purge_old_asaas_webhook_events       existe desde a 0014
--     purge_old_whatsapp_webhook_events    existe desde a 0047
--     error_logs                           crescia para sempre
--
-- A 0047 nasceu com purga por uma conta explícita: projetada a 400 clientes,
-- a tabela de dedupe chegaria a 9,7 GB em 12 meses e estouraria o plano do
-- Supabase em ~9 meses, guardando dado sem valor. `error_logs` tem o mesmo
-- desenho — linha de texto que só cresce — e não tinha a mesma proteção.
--
-- Medido em 30/08, antes desta migration: 73 linhas, 240 kB, média de 1.446
-- bytes de texto por linha. A 0058 acrescentou `component_stack`, que sobe
-- essa média. É pouco hoje porque há 39 empresas; a conta muda com o volume,
-- e é agora que sai barato.

-- ---------------------------------------------------------------------------
-- Duas janelas, e a diferença entre elas é a decisão
-- ---------------------------------------------------------------------------
--
-- **90 dias para erro de cliente.** É a mesma janela da purga do Asaas, e o
-- motivo é o mesmo: erro que ninguém investigou em três meses não vai ser
-- investigado, e o registro deixou de responder qualquer pergunta útil.
--
-- **14 dias para erro interno.** Erro do dono, da conta de demonstração e das
-- contas de teste (`interno = true`, migration 0058) serve para uma
-- investigação em curso, não para histórico. Foi um registro desses que
-- resolveu a tela preta de 24/08 — e ele foi lido no MESMO dia. Duas semanas
-- é folga generosa para esse uso.
--
-- Guardar interno por 90 dias seria pagar armazenamento para manter na tabela
-- exatamente o ruído que a 0058 acabou de separar.

create or replace function public.purge_old_error_logs()
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_deleted integer;
  v_total integer;
begin
  delete from public.error_logs
   where interno = false
     and created_at < now() - interval '90 days';
  get diagnostics v_total = row_count;

  delete from public.error_logs
   where interno = true
     and created_at < now() - interval '14 days';
  get diagnostics v_deleted = row_count;

  return v_total + v_deleted;
end;
$$;

-- Mesmo padrão das outras duas: `security definer` para atravessar a RLS (a
-- tabela tem RLS ligada e ZERO policy), e `execute` revogado de todo mundo. O
-- único chamador é `/api/cron/limpar-eventos` via `createAdminClient()`.
--
-- A 0013 já pagou a lição de que `revoke` de coluna não subtrai de um grant
-- mais amplo; aqui é `revoke all ... from public`, que é o que de fato fecha.
revoke all on function public.purge_old_error_logs() from public;

comment on function public.purge_old_error_logs() is
  'Apaga erro de cliente com mais de 90 dias e erro interno com mais de 14. Chamada pelo cron diário, nunca por usuário.';
