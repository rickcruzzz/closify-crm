-- O Pro passa a cobrir até CINCO empresas do mesmo dono, todas com os
-- recursos Pro.
--
-- ## O que estava errado, e por que era pior que uma limitação
--
-- O plano é do WORKSPACE: `subscriptions.workspace_id`, e `pro_vigente()`
-- consulta a assinatura daquela empresa. A 0018 deixa quem tem uma empresa Pro
-- criar outras, e a 0057 faz toda empresa nova nascer no Free.
--
-- Resultado: a pessoa pagava R$ 49, criava a segunda empresa e batia num teto
-- de 50 contatos — num plano que ela já tinha comprado.
--
-- E a tela prometia o contrário. **"Empresas ilimitadas"** aparece como
-- benefício do Pro na landing, no cartão de plano e na tabela de comparação.
-- É a mesma classe de defeito que este projeto já pagou com "contatos
-- ilimitados" enquanto o Free estava em 300: a página promete e o banco
-- cumpre outra coisa.
--
-- ## Cinco, e o número saiu da base
--
-- Contados os admins em 09/09:
--
--     1 empresa    41 pessoas   91%
--     2 empresas    3 pessoas
--     3 empresas    1 pessoa
--     4 ou mais     ninguem
--
-- Cinco cobre com folga o caso brasileiro comum — o dono da marcenaria que
-- também tem a loja — e barra a agência com vinte clientes, que levaria vinte
-- CRMs completos por R$ 49.
--
-- ## O DONO, e não quem é admin
--
-- A regra segue `workspaces.created_by`. Se seguisse a associação de admin,
-- **aceitar um convite viraria upgrade**: quem fosse convidado como admin de
-- uma empresa Pro passaria a ter as próprias empresas liberadas de graça.
--
-- ## O teto mora na CRIAÇÃO, não aqui
--
-- `pro_vigente` não conta empresas de propósito. Quem impede a sexta é a
-- função de criação abaixo, e concentrar a contagem num lugar só evita as duas
-- regras discordarem — que é como um limite vira decorativo.

create or replace function public.pro_vigente(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    -- 1. A assinatura desta empresa.
    exists (
      select 1
        from public.subscriptions s
       where s.workspace_id = target_workspace_id
         and s.status in ('active', 'past_due')
         and s.current_period_end is not null
         and s.current_period_end
             + (public.dias_de_graca(s.ultimo_billing_type) || ' days')::interval > now()
    )
    -- 2. O trial desta empresa.
    or exists (
      select 1
        from public.workspaces w
       where w.id = target_workspace_id
         and w.trial_ate is not null
         and w.trial_ate > now()
    )
    -- 3. A assinatura de QUALQUER empresa do mesmo dono.
    or exists (
      select 1
        from public.workspaces alvo
        join public.workspaces irma on irma.created_by = alvo.created_by
        join public.subscriptions s on s.workspace_id = irma.id
       where alvo.id = target_workspace_id
         and alvo.created_by is not null
         and s.status in ('active', 'past_due')
         and s.current_period_end is not null
         and s.current_period_end
             + (public.dias_de_graca(s.ultimo_billing_type) || ' days')::interval > now()
    );
$$;

comment on function public.pro_vigente(uuid) is
  'O Pro vale para até cinco empresas do mesmo dono (created_by). O teto de '
  'cinco é aplicado na criação, em criar_workspace_com_admin.';

-- ## A criação: 1 no Free, 5 no Pro
--
-- Duas mudanças além do número.
--
-- **Passou a ler `pro_vigente()` no lugar de `w.plan = 'pro'`.** A coluna é o
-- último valor gravado e não sabe que o tempo passou: um Pro vencido
-- continuava liberando a criação de empresas. É a regra que o próprio
-- `docs/estado-atual.md` registra em letras grandes — *"regra de plano lê a
-- função, nunca a coluna"* — e ela estava sendo quebrada aqui desde a 0018.
--
-- **E conta por `created_by`, não por associação de admin.** A 0018 contava
-- onde a pessoa é admin, para o convite de outro não consumir a vaga dela. A
-- intenção continua certa e o critério ficou melhor: quem CRIOU é dono, e ser
-- promovido a admin na empresa de outro não gasta vaga nenhuma.

create or replace function public.criar_workspace_com_admin(workspace_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid;
  current_user_id uuid := auth.uid();
  empresas_do_dono int;
  tem_plano_pro boolean;
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

  teto := case when tem_plano_pro then 5 else 1 end;

  -- Mensagem repetida na allowlist de erros da Server Action; mudar o texto
  -- aqui exige mudar lá também, senão vira "erro inesperado" na tela.
  if empresas_do_dono >= teto then
    if tem_plano_pro then
      raise exception 'O plano Pro inclui 5 empresas. Fale com a gente para ter mais.';
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
