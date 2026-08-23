-- Limite de colaboradores do Free passa a valer em QUALQUER caminho.
--
-- ## O furo, medido em produção (23/08)
--
-- A trava de 2 membros existia, mas só dentro de `accept_workspace_invite`
-- (0011, endurecida na 0028). Ela protege quem ACEITA CONVITE — e ninguém é
-- obrigado a usar convite.
--
-- A policy `workspace_members_insert` (0004) permite que um admin insira
-- direto na tabela:
--
--   for insert with check ( is_workspace_admin(workspace_id) or <bootstrap> )
--
-- E a chave pública do Supabase está no HTML por design. Testado com sessão
-- autenticada real de uma conta Free: **6 membros inseridos numa empresa cujo
-- teto é 2**, sem convite, sem e-mail, sem tocar em nenhuma Server Action.
--
--   membro 1: ENTROU sem passar por convite nenhum
--   ...
--   membros no fim: 6 | limite do Free: 2
--
-- O prejuízo é direto e é exatamente o abuso que o dono do produto previu:
-- uma empresa com dez vendedores usa UMA conta Free, todos no mesmo funil,
-- com os dados juntos, e nunca paga.
--
-- ## Quinta ocorrência da mesma lição
--
-- Autoupgrade para Pro (0019→0022), limite de leads (0023), autoconvite
-- (0024), limite de empresas (0018) e agora este. A frase em CLAUDE.md
-- ("regra que só vive na Server Action não é regra") ganha aqui uma variação
-- mais sutil, que vale registrar: **a regra vivia numa RPC**, que já é melhor
-- que Server Action — só que protegendo apenas UM dos caminhos até a tabela.
-- Trigger na tabela protege todos.
--
-- ## O que a regra NÃO faz, de propósito
--
--   * não conta quem já está dentro: empresa que passou do teto antes desta
--     migration mantém a equipe, só não cresce mais. Expulsar colaborador de
--     cliente existente por causa de uma correção nossa seria pior que o furo;
--   * não interfere no caminho da service role (webhook, job, script de
--     manutenção), que não é o abuso que isto combate;
--   * lê `pro_vigente()`, nunca `workspaces.plan` — doutrina travada desde a
--     0027: a coluna é o último valor gravado e não sabe que o período pago
--     venceu.

create or replace function public.validar_limite_de_membros()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_membros int;
  limite_free constant int := 2;
begin
  -- Sem sessão é o caminho da service role: webhook, job de reconciliação,
  -- scripts. Não é o abuso que esta trava existe para impedir.
  if auth.uid() is null then
    return new;
  end if;

  -- Quem paga não tem teto.
  if public.pro_vigente(new.workspace_id) then
    return new;
  end if;

  -- `for update` na linha do workspace pelo mesmo motivo da 0026: sob READ
  -- COMMITTED, dois inserts simultâneos leem a MESMA contagem antes de
  -- qualquer commit e os dois passam. Aqui o teto é de monetização — o
  -- terceiro colaborador é receita — então a corrida importa.
  perform 1 from public.workspaces where id = new.workspace_id for update;

  select count(*) into v_membros
    from public.workspace_members
   where workspace_id = new.workspace_id;

  if v_membros >= limite_free then
    -- Mesmo texto de `accept_workspace_invite`, para a pessoa ver a mesma
    -- explicação venha por onde vier. `42501` é o código que
    -- `lib/workspace/actions.ts` já sabe traduzir para a tela.
    raise exception 'Workspace atingiu o limite de % membros do plano Free.', limite_free
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists validar_limite_de_membros on public.workspace_members;

create trigger validar_limite_de_membros
  before insert on public.workspace_members
  for each row
  execute function public.validar_limite_de_membros();
