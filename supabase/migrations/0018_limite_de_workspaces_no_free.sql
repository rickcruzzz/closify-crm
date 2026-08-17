-- Velo Funil, limite de empresas no plano Free (M21)
-- Aplicar no SQL Editor do Supabase Studio.
--
-- O plano Free limitava 2 colaboradores e 50 leads, mas ambos POR WORKSPACE, e
-- nada impedia criar workspaces à vontade. Na prática o teto de colaboradores
-- não segurava nada: bastava abrir uma empresa nova para cada dupla. Um
-- usuário de produção já tinha 4 workspaces quando isto foi detectado.
--
-- A checagem vive aqui, e não só na Server Action, porque Server Action é
-- endpoint HTTP: um request forjado chama a RPC direto e pularia a validação
-- da aplicação inteira. Esta é a barreira que não dá para contornar.

create or replace function public.create_workspace_with_admin(workspace_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_workspace_id uuid;
  current_user_id uuid := auth.uid();
  workspaces_como_admin int;
  tem_plano_pro boolean;
begin
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  -- Conta apenas onde a pessoa é ADMIN: participar de uma empresa a convite de
  -- outro não deve consumir a vaga dela, senão quem aceita dois convites fica
  -- impedido de ter a própria empresa.
  select count(*) into workspaces_como_admin
  from public.workspace_members
  where user_id = current_user_id
    and role = 'admin';

  -- Uma empresa Pro libera a criação: o plano é do workspace, e quem paga por
  -- qualquer um deles tem direito a multi-empresa.
  select exists (
    select 1
    from public.workspace_members m
    join public.workspaces w on w.id = m.workspace_id
    where m.user_id = current_user_id
      and m.role = 'admin'
      and w.plan = 'pro'
  ) into tem_plano_pro;

  -- Mensagem repetida na allowlist de erros da Server Action; mudar o texto
  -- aqui exige mudar lá também, senão vira "erro inesperado" na tela.
  if not tem_plano_pro and workspaces_como_admin >= 1 then
    raise exception 'O plano Free inclui 1 empresa. Faça upgrade para o Pro para gerenciar várias.';
  end if;

  insert into public.workspaces (name, created_by)
  values (workspace_name, current_user_id)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, current_user_id, 'admin');

  return new_workspace_id;
end;
$$;

revoke all on function public.create_workspace_with_admin(text) from public;
grant execute on function public.create_workspace_with_admin(text) to authenticated;
