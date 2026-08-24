-- Reverse trial: toda empresa nova nasce com 7 dias de Pro.
--
-- ## Por que reverse trial, e não Free puro nem trial puro
--
-- Medido no funil de ativação (`/dono/ativacao`, 23/08): o Free de 300 contatos
-- nunca aperta — uma PME de serviço leva anos para chegar lá. O plano gratuito
-- não era um degrau para o Pro, era o produto final, e ninguém tinha motivo
-- para pagar.
--
-- Com o WhatsApp no Pro (decisão do dono, e ela custa RAM na VPS por conexão),
-- o que sobra no Free é um Kanban e uma lista. Isso não vira hábito, e freemium
-- sem hábito não converte: a pessoa entra, olha, e some sem nunca sentir falta
-- de nada — porque nunca teve nada.
--
-- Benchmarks 2026 para SaaS B2B: freemium converte 2-8%, trial puro 8-22%,
-- **reverse trial 18-32%**. O reverse trial ganha dos dois porque junta a
-- urgência do trial com o volume do freemium, e porque não joga fora o cadastro
-- que o tráfego pago comprou: quem não decide em 7 dias cai para o Free e pode
-- comprar no mês seguinte, em vez de desaparecer.
--
-- ## Por que uma coluna nova, e NÃO o status `trialing`
--
-- A saída óbvia seria fazer `pro_vigente()` aceitar `subscriptions.status =
-- 'trialing'`. **Seria um furo de segurança.** O checkout do Asaas grava
-- exatamente esse status ao CRIAR a assinatura, antes de qualquer pagamento
-- (ver `lib/asaas/actions.ts`): qualquer pessoa clicaria em "Assinar Pro",
-- abandonaria o pagamento e ficaria com Pro de graça.
--
-- É a mesma família de defeito que as migrations 0019 a 0022 pagaram caro para
-- fechar ("autoupgrade para Pro sem pagar"). Trial do produto e assinatura do
-- gateway são coisas diferentes e precisam de campos diferentes.
--
-- ## Por que a coluna é protegida por trigger
--
-- `workspaces` tem policy de UPDATE para o admin da empresa, e a chave pública
-- do Supabase está no HTML por design. Sem proteção, o dono de qualquer conta
-- estenderia o próprio trial com uma chamada ao PostgREST:
--
--     PATCH /rest/v1/workspaces?id=eq.<meu>  { "trial_ate": "2030-01-01" }
--
-- Trial infinito de graça, sem tocar em Server Action nenhuma. A doutrina deste
-- projeto já diz: regra que só vive na Server Action não é regra.

-- ============================================================================
-- 1. A coluna
-- ============================================================================

alter table public.workspaces
  add column if not exists trial_ate timestamptz;

comment on column public.workspaces.trial_ate is
  'Fim do trial de 7 dias que toda empresa ganha ao nascer. Distinto de '
  '`subscriptions.status`: aquele é o estado da cobrança no Asaas, este é '
  'cortesia do produto. Só a service role escreve aqui (trigger '
  '`proteger_trial_ate`).';

-- Empresas que já existem não ganham trial retroativo: quem está aqui desde
-- antes já formou opinião sobre o produto, e dar 7 dias de Pro agora seria
-- presente para quem não pediu — além de sujar a medição de conversão do
-- trial, que é justamente o número que esta mudança existe para produzir.

-- ============================================================================
-- 2. `pro_vigente()` passa a considerar o trial
-- ============================================================================

/**
 * Pro valendo AGORA: por assinatura paga OU por trial dentro do prazo.
 *
 * A parte da assinatura é idêntica à da 0027 — inclusive os dias de
 * compensação bancária, que existem porque boleto e Pix demoram a confirmar e
 * ninguém pode perder acesso por causa do prazo do banco.
 *
 * A parte do trial é uma comparação de data pura: sem `pg_cron`, sem job, sem
 * nada para rodar. O trial acaba no instante em que alguém tenta usar o
 * produto depois da data — mesma decisão da 0027 para o Pro vencido.
 */
create or replace function public.pro_vigente(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select
    exists (
      select 1
        from public.subscriptions s
       where s.workspace_id = target_workspace_id
         and s.status in ('active', 'past_due')
         and s.current_period_end is not null
         and s.current_period_end
             + (public.dias_para_compensacao_bancaria() || ' days')::interval > now()
    )
    or exists (
      select 1
        from public.workspaces w
       where w.id = target_workspace_id
         and w.trial_ate is not null
         and w.trial_ate > now()
    );
$$;

revoke all on function public.pro_vigente(uuid) from public, anon;
grant execute on function public.pro_vigente(uuid) to authenticated, service_role;

-- ============================================================================
-- 3. Empresa nova nasce com 7 dias
-- ============================================================================

/**
 * Recria a RPC da 0007/0018 acrescentando o trial.
 *
 * O trial é dado AQUI, e não na Server Action, pelo mesmo motivo de sempre
 * neste projeto: esta RPC é o único caminho até `workspaces` (a policy de
 * INSERT recusa escrita direta, provado em 22/08 com sessão real). Quem cria
 * empresa por qualquer caminho ganha o trial, e ninguém precisa lembrar de
 * chamar mais nada.
 *
 * O limite de 1 empresa no Free (0018) continua valendo e continua lendo
 * `pro_vigente()`. Efeito colateral aceito e desejado: durante os 7 dias a
 * pessoa consegue criar uma segunda empresa, porque está com Pro de verdade.
 * Quando o trial acabar, as duas continuam existindo — o limite trava criação
 * nova, nunca apaga o que já existe.
 */
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
  dias_de_trial constant int := 7;
begin
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select count(*) into workspaces_como_admin
  from public.workspace_members
  where user_id = current_user_id
    and role = 'admin';

  select exists (
    select 1
    from public.workspace_members m
    join public.workspaces w on w.id = m.workspace_id
    where m.user_id = current_user_id
      and m.role = 'admin'
      and public.pro_vigente(w.id)
  ) into tem_plano_pro;

  if not tem_plano_pro and workspaces_como_admin >= 1 then
    raise exception 'O plano Free inclui 1 empresa. Faça upgrade para o Pro para gerenciar várias.';
  end if;

  -- A ÚNICA mudança em relação à 0038: a empresa nasce com `trial_ate`.
  -- Todo o resto acima é cópia literal, de propósito — a mensagem de erro é
  -- traduzida pela UI e a checagem de limite já foi consertada uma vez (FALHA 2
  -- da 0038, que trocou `w.plan = 'pro'` por `pro_vigente(w.id)`). Reescrever
  -- essa lógica aqui a faria divergir da corrigida no dia em que uma mudasse.
  insert into public.workspaces (name, created_by, trial_ate)
  values (workspace_name, current_user_id, now() + (dias_de_trial || ' days')::interval)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, current_user_id, 'admin');

  return new_workspace_id;
end;
$$;

revoke all on function public.create_workspace_with_admin(text) from public, anon;
grant execute on function public.create_workspace_with_admin(text) to authenticated;

-- ============================================================================
-- 4. A trava: ninguém estende o próprio trial
-- ============================================================================

/**
 * Impede que `trial_ate` seja alterado por sessão autenticada.
 *
 * Sem isto, um `PATCH` no PostgREST com a chave pública daria Pro vitalício de
 * graça. A service role continua livre porque é o caminho do webhook, do job de
 * reconciliação e da Central do Dono — nenhum deles é o abuso que esta trava
 * combate.
 */
create or replace function public.proteger_trial_ate()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.trial_ate is distinct from old.trial_ate then
    raise exception 'O período de teste não pode ser alterado.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists proteger_trial_ate on public.workspaces;

create trigger proteger_trial_ate
  before update on public.workspaces
  for each row
  execute function public.proteger_trial_ate();
