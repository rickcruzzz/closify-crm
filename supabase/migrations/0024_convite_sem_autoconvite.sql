-- Impede convite para o próprio e-mail e para quem já é membro do workspace.
--
-- `inviteMember` validava formato, permissão, rate limit e limite de plano, mas
-- nunca comparava o e-mail convidado com o de quem convida. Não é hipótese:
-- em produção, `pedroescobar90sb@gmail.com` convidou a si mesmo DUAS vezes no
-- workspace "Henrique System", e as duas foram aceitas.
--
-- O prejuízo é o limite do plano. `canAddMember` conta membros ativos MAIS
-- convites pendentes, então no Free (limite 2) o admin já é 1 membro e o
-- autoconvite vira o segundo: a pessoa fica impedida de convidar alguém de
-- verdade. E o convite nunca serve para nada, `accept_workspace_invite`
-- termina em `on conflict (workspace_id, user_id) do nothing`, então aceitar
-- não produz efeito algum. Convidar quem já é membro tem o mesmo resultado.
--
-- Por que trigger e não só checagem na Server Action: a política
-- `workspace_invites_insert_admin` libera INSERT direto para qualquer admin,
-- e Server Action é endpoint HTTP como outro qualquer. Quem chama o PostgREST
-- com a chave pública pularia a validação inteira, mesma lição do limite de
-- leads (0023) e da coluna `plan` (0022).
--
-- A normalização do e-mail entra aqui junto porque é o que faz o índice único
-- `workspace_invites_pending_email_idx` funcionar de verdade: ele é
-- `(workspace_id, email)` sobre o texto cru, então `ana@x.com` e `Ana@X.com`
-- passavam como convites distintos, cada um consumindo uma vaga. Normalizando
-- na escrita, o índice que já existe passa a pegar o caso, sem precisar de
-- índice novo nem de migração de dados.

create or replace function public.validar_convite_de_workspace()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_email_de_quem_convida text;
begin
  new.email := lower(trim(new.email));

  select lower(email) into v_email_de_quem_convida
  from auth.users
  where id = auth.uid();

  if v_email_de_quem_convida is not null
     and new.email = v_email_de_quem_convida then
    raise exception 'Você já faz parte desta empresa. Convide o e-mail de outra pessoa.'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.workspace_members m
    join auth.users u on u.id = m.user_id
    where m.workspace_id = new.workspace_id
      and lower(u.email) = new.email
  ) then
    raise exception 'Esta pessoa já faz parte da empresa.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists validar_convite_de_workspace on public.workspace_invites;

create trigger validar_convite_de_workspace
  before insert on public.workspace_invites
  for each row
  execute function public.validar_convite_de_workspace();

-- Usada pela Server Action apenas para produzir a mensagem amigável antes de
-- tentar o insert. Sem ela, o erro do trigger chegaria à tela como falha crua
-- do Postgres.
--
-- Não abre superfície de enumeração: responde somente sobre workspace que o
-- solicitante administra, e a lista de membros daquele workspace ele já vê em
-- `/settings`.
create or replace function public.email_e_membro_do_workspace(
  target_workspace_id uuid,
  target_email text
)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from public.workspace_members m
    join auth.users u on u.id = m.user_id
    where m.workspace_id = target_workspace_id
      and lower(u.email) = lower(trim(target_email))
      and (select public.is_workspace_admin(target_workspace_id))
  );
$$;
