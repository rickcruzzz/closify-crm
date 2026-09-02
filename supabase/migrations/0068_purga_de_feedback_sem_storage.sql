-- ============================================================================
-- 0068 — A purga de feedback nunca rodou, e o motivo estava no Storage
-- ============================================================================
--
-- Achado em 02/09 exercitando `/api/cron/limpar-eventos` contra PRODUÇÃO: a
-- rota devolvia `{"ok": false, "feedback": null}` — e devolvia isso todo dia
-- desde que a 0060 criou a função. Ninguém lê o corpo da resposta de um cron.
--
--     ERROR: 42501: Direct deletion from storage tables is not allowed.
--            Use the Storage API instead.
--     CONTEXT: PL/pgSQL function storage.protect_delete()
--
-- O Supabase instala uma trigger em `storage.objects` que **proíbe** `delete`
-- direto — a intenção é impedir que uma linha apagada no banco deixe o arquivo
-- órfão no bucket. A função tentava apagar o anexo por SQL, e o Postgres
-- abortava a transação INTEIRA. Ou seja: o `delete` de `feedback` logo abaixo
-- também nunca acontecia.
--
-- ## Consequência real
--
-- Nenhum relato foi apagado nunca, nem os internos de 14 dias nem os de
-- cliente com mais de um ano. E o `ok: false` do cron era o único sinal, num
-- corpo de resposta que ninguém abre.
--
-- ## A correção separa as duas metades, porque elas são de sistemas diferentes
--
-- Esta função passa a apagar SÓ as linhas do banco, e devolve os caminhos dos
-- anexos que ficaram órfãos. Quem apaga arquivo é a Storage API, do lado do
-- Node, em `/api/cron/limpar-eventos` — que é o único lugar com credencial
-- para isso.
--
-- Ordem importa: os caminhos são coletados ANTES do `delete`, senão a linha
-- some e o arquivo fica órfão para sempre sem ninguém saber o nome dele.
--
-- Falhar ao apagar o arquivo não desfaz o `delete` da linha, de propósito: a
-- linha é o dado pessoal (mensagem, e-mail, empresa) e é ela que a retenção
-- precisa cortar. Arquivo órfão custa centavos de armazenamento; relato
-- guardado além do prazo é problema de LGPD.

-- O retorno muda de `integer` para `jsonb` (precisa carregar os caminhos
-- junto), e o Postgres nao deixa `create or replace` trocar tipo de
-- retorno: exige derrubar antes.
drop function if exists public.purge_old_feedback();

create function public.purge_old_feedback()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caminhos jsonb;
  v_cliente integer;
  v_interno integer;
begin
  -- ANTES de apagar: depois, não há de onde tirar o nome do arquivo.
  select coalesce(jsonb_agg(caminho), '[]'::jsonb) into v_caminhos
  from (
    select distinct a->>'caminho' as caminho
      from public.feedback f
      cross join lateral jsonb_array_elements(f.anexos) as a
     where (f.interno = false and f.created_at < now() - interval '365 days')
        or (f.interno = true  and f.created_at < now() - interval '14 days')
  ) s
  where caminho is not null;

  delete from public.feedback
   where interno = false and created_at < now() - interval '365 days';
  get diagnostics v_cliente = row_count;

  delete from public.feedback
   where interno = true and created_at < now() - interval '14 days';
  get diagnostics v_interno = row_count;

  return jsonb_build_object(
    'apagados', v_cliente + v_interno,
    'anexos', v_caminhos
  );
end;
$$;

revoke all on function public.purge_old_feedback() from public, anon, authenticated;
grant execute on function public.purge_old_feedback() to service_role;

comment on function public.purge_old_feedback() is
  'Apaga relato fora da janela de retencao (365d cliente, 14d interno) e DEVOLVE '
  'os caminhos dos anexos orfaos. Quem apaga arquivo e a Storage API, no cron: '
  'delete direto em storage.objects e bloqueado por trigger do Supabase.';
