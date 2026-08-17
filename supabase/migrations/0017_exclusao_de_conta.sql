-- Velo Funil, exclusão de conta pelo próprio titular (M20)
-- Aplicar no SQL Editor do Supabase Studio.
--
-- A LGPD (art. 18, VI) dá ao titular o direito de eliminação dos dados. Até
-- aqui isso dependia de pedido por e-mail atendido à mão em 15 dias, o que é
-- legalmente válido mas frágil: depende de alguém ler a caixa e executar
-- `DELETE` correto em produção.
--
-- Por que uma RPC e não um `delete` direto do client:
--
-- 1. `workspaces` tem RLS habilitado e NENHUMA policy de DELETE. Sem policy, o
--    Postgres nega a operação em silêncio, o client receberia sucesso com
--    zero linhas afetadas e a pessoa acharia que a conta foi apagada.
-- 2. A decisão de quais workspaces morrem junto é uma regra de negócio: só os
--    que ficariam sem nenhum membro. Workspace compartilhado com outras
--    pessoas precisa sobreviver à saída de um integrante.
-- 3. Precisa ser atômico. Apagar o membership e falhar ao apagar o workspace
--    deixaria um workspace órfão, invisível e impossível de administrar.

-- ============================================================================
-- RPC: excluir a conta do usuário autenticado
-- ============================================================================

create or replace function public.excluir_minha_conta()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace record;
begin
  if v_user_id is null then
    raise exception 'Sessão inválida.';
  end if;

  -- Assinatura ativa bloqueia: apagar a conta não cancela a cobrança no Asaas,
  -- que é sistema externo e continuaria faturando um cliente sem acesso. A
  -- pessoa precisa cancelar antes, e a mensagem diz isso.
  if exists (
    select 1
    from public.subscriptions s
    join public.workspace_members m on m.workspace_id = s.workspace_id
    where m.user_id = v_user_id
      and s.status in ('active', 'past_due')
  ) then
    raise exception 'Cancele sua assinatura antes de excluir a conta.';
  end if;

  -- Workspaces onde esta pessoa é o ÚNICO membro morrem junto: ninguém mais
  -- poderia acessá-los, e manter workspace órfão só acumula dado pessoal de
  -- lead sem controlador, o oposto do que o pedido de eliminação quer.
  --
  -- Onde há outros membros, o workspace sobrevive e só o vínculo é removido.
  for v_workspace in
    select w.id
    from public.workspaces w
    join public.workspace_members m on m.workspace_id = w.id
    where m.user_id = v_user_id
      and (
        select count(*) from public.workspace_members wm where wm.workspace_id = w.id
      ) = 1
  loop
    -- O cascade de `workspaces` leva junto members, leads, deals, activities,
    -- subscriptions e invites (ver FKs da 0001).
    delete from public.workspaces where id = v_workspace.id;
  end loop;

  -- Vínculos restantes: workspaces que continuam vivos com outras pessoas.
  delete from public.workspace_members where user_id = v_user_id;

  -- Convites que esta pessoa enviou e ainda não foram aceitos. `invited_by` é
  -- `on delete set null`, então eles sobreviveriam órfãos, permitindo que
  -- alguém entrasse num workspace por convite de uma conta que não existe mais.
  delete from public.workspace_invites
  where invited_by = v_user_id and status = 'pending';

  -- A linha em `auth.users` é apagada pela Server Action, com a service role:
  -- `auth.users` não é acessível por RPC de usuário comum, e apagá-la aqui
  -- exigiria elevar o privilégio desta função além do necessário.
end;
$$;

revoke all on function public.excluir_minha_conta() from public;
grant execute on function public.excluir_minha_conta() to authenticated;
