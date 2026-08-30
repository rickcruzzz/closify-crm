-- Duas coisas que o canal de feedback (0060) não tinha, e que o primeiro uso
-- real já cobraria.
--
-- **Anexo.** Quem relata "não funciona" quase sempre tem um print que explica
-- em um segundo o que o texto leva um parágrafo para descrever. Sem anexo, o
-- caminho é a pessoa mandar por e-mail à parte — e aí o arquivo se separa do
-- relato, que é como se perde a única evidência do defeito.
--
-- **Acompanhamento.** A Central só sabia esconder um relato ("Já tratei",
-- guardado num arquivo local). Esconder não é acompanhar: não registra o que
-- foi feito, quando, nem permite reler a decisão seis meses depois, quando a
-- mesma coisa for relatada de novo por outra pessoa.

-- ============================================================================
-- 1. Bucket privado para os anexos
-- ============================================================================
--
-- PRIVADO, mesmo motivo do `logos` (0031): bucket público serve o arquivo a
-- quem souber a URL, e a URL contém o id do workspace, que aparece em resposta
-- de API para qualquer membro. Aqui é ainda mais sensível — o print de um
-- defeito costuma mostrar a tela cheia, com nome de cliente e valor de
-- negócio de terceiro.
--
-- O teto e a lista de tipos são a SEGUNDA linha de defesa. `allowed_mime_types`
-- compara com o Content-Type que o cliente DECLARA, e o cliente mente. A
-- checagem que vale é a dos bytes iniciais, no servidor
-- (`lib/storage/anexo-de-feedback.ts`).
--
-- 10 MB por arquivo, contra os 2 MB do bucket de logos: print em tela retina
-- passa de 2 MB com folga, e recusar justamente o print de quem está tentando
-- mostrar o defeito seria o pior lugar possível para economizar espaço.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'anexos-feedback',
  'anexos-feedback',
  false,
  10485760, -- 10 MB
  array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- ============================================================================
-- 2. Políticas do bucket
-- ============================================================================
--
-- Reusa `workspace_do_caminho` (0031), que já resolve a empresa a partir do
-- primeiro segmento do caminho e devolve `null` para caminho fora do padrão —
-- e `is_workspace_member(null)` é `false`, então caminho torto não pertence a
-- ninguém. Quem escolhe o caminho é quem envia o arquivo, então formato torto
-- é a regra, não a exceção.
--
-- Caminho: `<workspace_id>/<feedback_id>/<arquivo>`
--
-- LER é de MEMBRO, não de admin: o arquivo é da pessoa que o enviou, e negar
-- a ela o acesso ao próprio print não protegeria nada. Diferente de `logos`,
-- onde ler é de membro e escrever é de admin porque a marca é da empresa —
-- aqui **escrever também é de membro**: qualquer pessoa da equipe pode ter um
-- problema para relatar, inclusive quem não é admin.

create policy "anexos_feedback_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'anexos-feedback'
    and (select public.is_workspace_member(public.workspace_do_caminho(name)))
  );

create policy "anexos_feedback_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'anexos-feedback'
    and (select public.is_workspace_member(public.workspace_do_caminho(name)))
  );

-- `using` E `with check` juntos, a armadilha que a 0031 documenta: sem o
-- `with check`, alguém pode RENOMEAR o próprio arquivo para a pasta de outra
-- empresa — a checagem de `using` olha a linha ANTES da mudança e aprovaria.
create policy "anexos_feedback_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'anexos-feedback'
    and (select public.is_workspace_member(public.workspace_do_caminho(name)))
  )
  with check (
    bucket_id = 'anexos-feedback'
    and (select public.is_workspace_member(public.workspace_do_caminho(name)))
  );

create policy "anexos_feedback_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'anexos-feedback'
    and (select public.is_workspace_member(public.workspace_do_caminho(name)))
  );

-- ============================================================================
-- 3. Colunas novas em `feedback`
-- ============================================================================

-- Os anexos daquele relato: caminho no bucket, nome original e tamanho.
--
-- `jsonb` e não tabela nova: são no máximo três itens que nascem e morrem com
-- o relato, e nada é consultado POR anexo — nenhuma pergunta deste produto
-- começa com "quais relatos têm PDF". Tabela filha custaria um join em toda
-- leitura para servir uma consulta que não existe.
alter table public.feedback
  add column if not exists anexos jsonb not null default '[]'::jsonb;

-- ## O acompanhamento
--
-- `aberto` é o estado inicial de todo relato. `resolvido` e `descartado` são
-- destinos diferentes de propósito: "consertei" e "decidi não fazer" são
-- decisões distintas, e guardar as duas como "fechado" apagaria justamente a
-- informação que interessa reler quando a mesma coisa for relatada de novo.
alter table public.feedback
  add column if not exists status text not null default 'aberto'
    check (status in ('aberto', 'em_andamento', 'resolvido', 'descartado'));

-- O que foi feito. Texto livre porque a resposta útil é uma frase ("era cache
-- do navegador, pedi para limpar"), não um campo estruturado.
alter table public.feedback
  add column if not exists solucao text;

alter table public.feedback
  add column if not exists resolvido_em timestamptz;

-- O índice parcial da 0060 cobria a fila de cliente por data. A fila agora é
-- filtrada por status primeiro — "o que está aberto" é a pergunta de toda
-- abertura da tela.
create index if not exists feedback_status_idx
  on public.feedback (status, created_at desc)
  where interno = false;

comment on column public.feedback.anexos is
  'Lista de {caminho, nome, tamanho} no bucket anexos-feedback. Máximo 3, validados por bytes iniciais no servidor.';
comment on column public.feedback.status is
  'aberto | em_andamento | resolvido | descartado. `descartado` é decisão de não fazer, e é diferente de resolvido de propósito.';

-- ============================================================================
-- 4. A purga precisa levar os ARQUIVOS junto
-- ============================================================================
--
-- `purge_old_feedback` (0060) apaga a linha. Com anexo, o arquivo no bucket
-- ficaria órfão para sempre — e a conta que a 0047 fez (9,7 GB em 12 meses
-- projetados a 400 clientes) vale ainda mais para binário de 10 MB do que para
-- linha de texto.
--
-- `storage.objects` é tabela como qualquer outra, e apagar a linha de lá
-- remove o objeto. `security definer` já atravessa a RLS do storage.
--
-- A ordem importa: os arquivos saem ANTES das linhas. Apagar a linha primeiro
-- perderia o caminho do arquivo, e o órfão ficaria sem nada que o aponte.

create or replace function public.purge_old_feedback()
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_cliente integer;
  v_interno integer;
begin
  -- Os caminhos de todo relato que está de saída, nas duas janelas.
  delete from storage.objects
   where bucket_id = 'anexos-feedback'
     and name in (
       select a->>'caminho'
         from public.feedback f
        cross join lateral jsonb_array_elements(f.anexos) as a
        where (f.interno = false and f.created_at < now() - interval '365 days')
           or (f.interno = true  and f.created_at < now() - interval '14 days')
     );

  delete from public.feedback
   where interno = false
     and created_at < now() - interval '365 days';
  get diagnostics v_cliente = row_count;

  delete from public.feedback
   where interno = true
     and created_at < now() - interval '14 days';
  get diagnostics v_interno = row_count;

  return v_cliente + v_interno;
end;
$$;

revoke all on function public.purge_old_feedback() from public;

comment on function public.purge_old_feedback() is
  'Apaga relato de cliente com mais de 1 ano e interno com mais de 14 dias, REMOVENDO os anexos do bucket antes das linhas. Chamada pelo cron diário.';
