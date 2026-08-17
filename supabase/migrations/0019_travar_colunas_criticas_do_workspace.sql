-- ATENÇÃO: a checagem por `service_role` deste arquivo está incorreta e foi
-- substituída pela 0021, `SECURITY DEFINER` troca o dono da execução, não o
-- papel da sessão, então esta versão bloqueava o próprio webhook. Mantido
-- como está por já ter sido aplicado; leia sempre junto com a 0021.
--
-- Impede que um admin promova o próprio workspace para 'pro' sem pagar.
--
-- A política `workspaces_update` só verifica `is_workspace_admin(id)`, porque o
-- admin precisa poder renomear a empresa. Só que `plan` mora na mesma linha, e
-- a chave anônima do Supabase está no HTML por design: qualquer admin com o
-- console do navegador aberto rodava
--
--   update workspaces set plan = 'pro' where id = '<o seu>'
--
-- direto no PostgREST e ganhava o Pro de graça. Verificado contra produção:
-- das 7 tentativas de escrita indevida, 6 (contra OUTRA empresa) já eram
-- bloqueadas pela RLS; só o autoupgrade próprio passava. Não é vazamento de
-- dados entre empresas, é o cliente contra a própria receita do produto.
--
-- Por que trigger e não `WITH CHECK` na política: o `WITH CHECK` enxerga
-- apenas a linha NOVA. Dá para exigir "plan = 'free'", o que quebraria todo
-- workspace pago que tentasse trocar de nome, mas não dá para exprimir "plan
-- não pode ter MUDADO", isso exige comparar OLD com NEW, e só o trigger tem
-- as duas versões.
--
-- `plan` continua mudando normalmente pelo webhook do Asaas: aquele caminho
-- roda com a service role, que é `BYPASSRLS` e não passa por este trigger.

-- A limpeza vem ANTES de criar o trigger de propósito: o trigger bloqueia
-- qualquer alteração de `plan` que não venha da service role, e uma migration
-- não roda com esse papel. Invertida, a ordem faz a própria migration falhar
-- com '42501' ao tentar corrigir a linha.
--
-- Corrige o rastro deixado pela auditoria: este workspace foi promovido a
-- 'pro' pelo teste que descobriu a falha, sem nenhum pagamento correspondente.
-- A condição `not exists` evita rebaixar um workspace com assinatura legítima,
-- caso este arquivo rode de novo no futuro.
update public.workspaces w
set plan = 'free'
where w.plan = 'pro'
  and not exists (
    select 1
    from public.subscriptions s
    where s.workspace_id = w.id
      and s.status in ('active', 'past_due')
  );

create or replace function public.proteger_colunas_do_workspace()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $$
begin
  -- A service role (webhook do Asaas, scripts administrativos) precisa mudar o
  -- plano, é justamente ela quem aplica o pagamento confirmado. Só o acesso
  -- via API pública é restrito.
  if current_setting('role', true) = 'service_role'
     or (select auth.role()) = 'service_role' then
    return new;
  end if;

  if new.plan is distinct from old.plan then
    raise exception 'O plano do workspace só muda por pagamento confirmado.'
      using errcode = '42501';
  end if;

  -- Reescrever `created_by` transferiria a propriedade do workspace para
  -- outra pessoa; `id` e `created_at` não têm motivo legítimo para mudar.
  if new.id is distinct from old.id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Campos de identidade do workspace são imutáveis.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists proteger_colunas_do_workspace on public.workspaces;

create trigger proteger_colunas_do_workspace
  before update on public.workspaces
  for each row
  execute function public.proteger_colunas_do_workspace();
