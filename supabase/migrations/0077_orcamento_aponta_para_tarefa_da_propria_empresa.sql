-- O orçamento só pode apontar para uma tarefa da PRÓPRIA empresa.
--
-- ## O buraco que esta migration fecha
--
-- A 0076 criou `deals.orcamento_tarefa_id` com chave estrangeira para `tasks`.
-- **Chave estrangeira garante que a tarefa EXISTE, não que ela é da mesma
-- empresa.** Um membro chamando o PostgREST direto com a chave pública — que
-- está no HTML por design — grava no próprio negócio uma referência à tarefa
-- de outra empresa, e nada recusa.
--
-- O raio de estrago hoje é pequeno, e vale dizer para a correção não parecer
-- maior do que é: `registrarOrcamento` escopa a escrita da tarefa por
-- `workspace_id`, então a atualização não casa e o caminho cai na criação de
-- uma tarefa nova. Não vaza dado nenhum — a leitura de `tasks` continua
-- barrada pela RLS. O que fica é uma referência cruzada gravada no banco.
--
-- ## É a TERCEIRA vez que esta classe aparece, e é por isso que ela é migration
--
-- A 0038 nasceu exatamente para fechá-la em `lead_id` e `deal_id`. A auditoria
-- de 18/08 a encontrou de novo em `tasks.assignee_id`, e o registro daquele dia
-- diz, com estas palavras: *"mesma classe que a 0038 já corrigiu para
-- `lead_id`/`deal_id`, não estendida para responsável"*. Agora em
-- `orcamento_tarefa_id`.
--
-- Toda vez a causa é a mesma: uma coluna de referência nova nasce, a RLS olha
-- só `workspace_id` da LINHA, e ninguém confere para onde a referência aponta.
-- A regra que o projeto já tem escrita: **regra que só vive na Server Action
-- não é regra**, porque Server Action é endpoint HTTP e o PostgREST fica ao
-- lado dela.
--
-- ## Estende a função, não cria trigger
--
-- A trigger `checar_referencia_de_negocio` já está pendurada em `deals` desde a
-- 0038. Criar uma segunda para a mesma pergunta faria duas travas com nomes
-- diferentes recusando o mesmo tipo de erro, e a próxima coluna de referência
-- não saberia em qual entrar.
--
-- O corpo abaixo é o da 0039 (que acrescentou a guarda `is distinct from old`)
-- mais o bloco novo. Substituir a versão da 0038 aqui teria regredido essa
-- guarda em silêncio — o tipo de perda que um `create or replace` faz sem
-- reclamar.

create or replace function public.checar_referencia_de_negocio()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.lead_id is not null
     and (tg_op = 'INSERT' or new.lead_id is distinct from old.lead_id)
     and not exists (
       select 1 from public.leads where id = new.lead_id and workspace_id = new.workspace_id
     ) then
    raise exception 'Lead referenciado pertence a outra empresa.'
      using errcode = '42501';
  end if;

  -- `is distinct from old` não é otimização cosmética: sem ele, TODA escrita em
  -- `deals` — mover card no Kanban, salvar orçamento, renomear negócio — pagaria
  -- uma consulta a `tasks`. O Kanban escreve a cada arraste.
  if new.orcamento_tarefa_id is not null
     and (tg_op = 'INSERT' or new.orcamento_tarefa_id is distinct from old.orcamento_tarefa_id)
     and not exists (
       select 1 from public.tasks where id = new.orcamento_tarefa_id and workspace_id = new.workspace_id
     ) then
    raise exception 'Tarefa referenciada pertence a outra empresa.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;
