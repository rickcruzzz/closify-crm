-- Limite de empresas do Free passa a existir no BANCO.
--
-- Este projeto já pagou três vezes pela mesma lição, registrada em
-- CLAUDE.md: "regra que só vive na Server Action não é regra". Server Action
-- é endpoint HTTP, e a chave pública do Supabase está no HTML por design —
-- quem chama o PostgREST direto pula a validação inteira. Foi assim com o
-- autoupgrade para Pro (0019→0022), com o limite de leads (0023) e com o
-- autoconvite (0024).
--
-- `canAddWorkspace` (lib/limits.ts) é a quarta ocorrência: a policy de INSERT
-- em `workspaces` é `with check (created_by = auth.uid())`, ou seja, qualquer
-- usuário autenticado cria quantas empresas quiser mandando um POST direto.
--
-- O que isso custa em dinheiro: o Free dá 1 empresa e 2 colaboradores. Sem
-- esta trava, basta criar uma empresa nova para cada dupla e ter equipe
-- ilimitada de graça — exatamente o buraco que `lib/plans.ts` descreve, e que
-- já foi visto em produção (um usuário com 4 workspaces).
--
-- A regra abaixo espelha `canAddWorkspace` campo a campo:
--
--   * conta só onde a pessoa é ADMIN — participar da empresa de outro a
--     convite não pode consumir a vaga dela, senão quem aceita dois convites
--     fica impedido de ter a própria empresa;
--   * uma empresa Pro vigente libera a criação, porque o plano é do workspace
--     e quem paga tem direito a multi-empresa;
--   * `pro_vigente()` e nunca a coluna `workspaces.plan` — doutrina travada
--     desde a 0027: a coluna é o último valor gravado e não sabe que o
--     período pago venceu;
--   * quem já passou do limite mantém o que criou, a trava só barra criação
--     nova.

create or replace function public.validar_limite_de_empresas()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_empresas_como_admin int;
  v_tem_pro boolean;
  limite_free constant int := 1;
begin
  -- Sem sessão não há o que contar: é o caminho da service role (webhook,
  -- job de reconciliação, scripts de manutenção), que não é o abuso que esta
  -- trava existe para impedir.
  if auth.uid() is null then
    return new;
  end if;

  select count(*) into v_empresas_como_admin
    from public.workspace_members
   where user_id = auth.uid()
     and role = 'admin';

  if v_empresas_como_admin < limite_free then
    return new;
  end if;

  -- Alguma das empresas onde já é admin está com Pro vigente? Basta uma.
  select exists (
    select 1
      from public.workspace_members wm
     where wm.user_id = auth.uid()
       and wm.role = 'admin'
       and public.pro_vigente(wm.workspace_id)
  ) into v_tem_pro;

  if v_tem_pro then
    return new;
  end if;

  -- `42501` (insufficient_privilege) é o mesmo código das outras travas de
  -- plano, e é o que `lib/leads/actions.ts` já sabe traduzir para uma
  -- mensagem legível em vez de "não foi possível salvar".
  raise exception 'O plano Free inclui % empresa. Faça upgrade para o Pro para gerenciar várias.', limite_free
    using errcode = '42501';
end;
$$;

drop trigger if exists validar_limite_de_empresas on public.workspaces;

create trigger validar_limite_de_empresas
  before insert on public.workspaces
  for each row
  execute function public.validar_limite_de_empresas();
