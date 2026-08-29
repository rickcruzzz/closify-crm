-- ============================================================================
-- Empresa nova deixa de nascer com 7 dias de Pro
-- ============================================================================
--
-- Decisão do dono, 29/08/2026: o reverse trial da 0051 sai. Empresa nova nasce
-- no Free, e quem quiser o Pro assina.
--
-- ## Por que UMA linha, e não a remoção do trial inteiro
--
-- O trial vive em 43 arquivos: `em_trial()`, `pro_vigente()`, quatro e-mails de
-- aviso (D-4 a D-1), a tarja no produto, a tela `/dono/trial`, o aviso na
-- cobrança. Arrancar tudo isso seria uma rodada grande, arriscada, e — o que
-- decide — QUEBRARIA PROMESSA FEITA.
--
-- Havia 5 empresas em trial no momento desta decisão. Elas se cadastraram
-- lendo "7 dias com tudo liberado" na tela. Tirar o Pro delas no meio é a
-- mesma classe de defeito que o "contatos ilimitados" e o "suporte
-- prioritário" corrigidos nesta semana: prometer o que não se entrega.
--
-- Mudando só o NASCIMENTO, tudo se resolve sozinho:
--
--     empresa nova        trial_ate = null  ->  em_trial() false  ->  Free
--     as 5 em trial       linha intocada    ->  terminam os 7 dias
--     e-mails, tarja,     seguem funcionando para essas 5, e se calam
--     /dono/trial         sozinhos quando a ultima vencer
--
-- Nenhum dos outros 42 arquivos precisa mudar. E a máquina do trial fica de
-- pé, o que importa: se a decisão for revertida, é esta mesma linha de volta.
--
-- ## O que NÃO muda
--
-- A trava de uma empresa por conta no Free (0053) continua idêntica, com a
-- mesma leitura de `pro_vigente() and not em_trial()`. A primeira empresa de
-- uma conta nova continua passando, porque a contagem dela é zero.
--
-- `proteger_trial_ate` (0051) segue no lugar: sem ela, qualquer autenticado
-- daria a si mesmo um trial eterno por um PATCH no PostgREST.
-- ============================================================================

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

  select count(*) into workspaces_como_admin
  from public.workspace_members
  where user_id = current_user_id
    and role = 'admin';

  -- `not em_trial` continua aqui de propósito. Ele não é mais alcançável por
  -- empresa nova, mas as que estão em avaliação agora ainda passam por esta
  -- checagem enquanto o prazo delas não vence — e durante o trial ninguém
  -- ganha direito à segunda empresa, que era a regra da 0053.
  select exists (
    select 1
    from public.workspace_members m
    join public.workspaces w on w.id = m.workspace_id
    where m.user_id = current_user_id
      and m.role = 'admin'
      and public.pro_vigente(w.id)
      and not public.em_trial(w.id)
  ) into tem_plano_pro;

  if not tem_plano_pro and workspaces_como_admin >= 1 then
    raise exception 'O plano Free inclui 1 empresa. Faça upgrade para o Pro para gerenciar várias.';
  end if;

  -- Sem `trial_ate`: a coluna fica nula e `em_trial()` devolve false desde o
  -- primeiro instante. É a única diferença em relação à versão da 0053.
  insert into public.workspaces (name, created_by)
  values (workspace_name, current_user_id)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, current_user_id, 'admin');

  return new_workspace_id;
end;
$$;

revoke all on function public.create_workspace_with_admin(text) from public, anon;
grant execute on function public.create_workspace_with_admin(text) to authenticated;

comment on function public.create_workspace_with_admin(text) is
  'Cria empresa e vincula quem chamou como admin. Desde a 0057 a empresa nasce '
  'no Free: `trial_ate` fica nulo. As empresas que ja estavam em avaliacao '
  'terminam o prazo delas normalmente, porque a linha delas nao foi tocada.';
