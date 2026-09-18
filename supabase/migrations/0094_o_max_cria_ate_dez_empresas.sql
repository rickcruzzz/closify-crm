-- O plano Max passa a permitir CRIAR ate 10 empresas.
--
-- Pedido do dono em 18/09. A escada de empresas fica:
--
--     Free    1
--     Pro     5
--     Max    10
--
-- ## A distincao que decide esta migration, e ela vale dinheiro
--
-- "10 empresas" tem duas leituras, e so uma esta aqui:
--
--     criar ate 10 empresas       custo marginal ZERO. A RPC conta linhas
--     conectar 10 WhatsApps       ~R$ 999,90/mes de instancia por R$ 250
--                                 de receita
--
-- `max_vigente()` NAO e tocada. Ela continua com UM ramo, a assinatura DESTA
-- empresa, e o comentario da 0089 registra o porque: copiar o ramo 3 de
-- `pro_vigente` daria a uma assinatura de R$ 250 o direito a varias instancias
-- pagas, receita fixa contra custo que multiplica. Criar empresa e de graca;
-- conectar numero nao e.
--
-- Ou seja: com o Max voce administra ate 10 empresas com os recursos Pro, e
-- conecta o WhatsApp de UMA delas. Quem quiser a segunda assina o Max nela.
--
-- ## `pro_vigente` tambem NAO muda, e isso foi conferido e nao suposto
--
-- O ramo 3 dela cobre as empresas IRMAS do mesmo dono **sem limite de
-- quantidade** — o teto de 5 nunca morou la, mora na criacao. Entao as
-- empresas 6 a 10 de um dono Max ja nascem com os recursos Pro, sem uma linha
-- a mais. Se o teto vivesse nos dois lugares, esta migration teria que mexer
-- numa funcao lida por SETE policies, e o risco seria outro.
--
-- ## O teto le `max_vigente` de QUALQUER empresa do dono
--
-- Mesma forma do `tem_plano_pro` logo acima: quem assinou o Max numa empresa
-- comprou o direito de administrar ate dez, e obrigar a assinatura a estar na
-- empresa que esta sendo criada seria impossivel de satisfazer, ela ainda nao
-- existe.
create or replace function public.criar_workspace_com_admin(workspace_name text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  new_workspace_id uuid;
  current_user_id uuid := auth.uid();
  empresas_do_dono int;
  tem_plano_pro boolean;
  tem_plano_max boolean;
  teto int;
begin
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select count(*) into empresas_do_dono
  from public.workspaces
  where created_by = current_user_id;

  select exists (
    select 1
    from public.workspaces w
    where w.created_by = current_user_id
      and public.pro_vigente(w.id)
  ) into tem_plano_pro;

  select exists (
    select 1
    from public.workspaces w
    where w.created_by = current_user_id
      and public.max_vigente(w.id)
  ) into tem_plano_max;

  teto := case
            when tem_plano_max then 10
            when tem_plano_pro then 5
            else 1
          end;

  if empresas_do_dono >= teto then
    -- Tres mensagens e nao duas: quem ja esta no Max e bateu em dez precisa
    -- ouvir outra coisa que quem esta no Pro, senao a tela oferece um upgrade
    -- que a pessoa ja tem. E o defeito de 18/08, "Seu Pro venceu, reative"
    -- aparecendo para quem nunca teve Pro, do outro lado.
    if tem_plano_max then
      raise exception 'O plano Max inclui 10 empresas. Fale com a gente para ter mais.';
    elsif tem_plano_pro then
      raise exception 'O plano Pro inclui 5 empresas. Assine o Max para gerenciar até 10.';
    else
      raise exception 'O plano Free inclui 1 empresa. Faça upgrade para o Pro para gerenciar várias.';
    end if;
  end if;

  insert into public.workspaces (name, created_by)
  values (workspace_name, current_user_id)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, current_user_id, 'admin');

  return new_workspace_id;
end;
$$;

comment on function public.criar_workspace_com_admin(text) is
  'Cria empresa com o autor como admin. Teto por plano: Free 1, Pro 5, Max 10. O teto do Max e sobre CRIAR empresa, nunca sobre conectar WhatsApp: instancia conectada e paga por empresa, e max_vigente() continua com um ramo so.';
