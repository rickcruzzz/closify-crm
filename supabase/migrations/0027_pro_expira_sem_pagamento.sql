-- O Pro passa a ter prazo. Antes não tinha, e isso era um furo de receita.
--
-- Como era: `PAYMENT_OVERDUE` marcava a assinatura como `past_due`, e a 0020
-- tratava `past_due` como acesso mantido — de propósito, para não derrubar o
-- cliente na primeira falha de cobrança. A intenção estava certa. O que faltava
-- era o outro lado: **nada encerrava essa carência**.
--
-- `subscriptions.current_period_end` existe desde a 0001 e NUNCA foi gravado.
-- Não há `pg_cron` no projeto (dito em 0014 e 0015). Não há job, não há
-- varredura. Consequência medida em 11/08/2026: aplicar `past_due` num
-- workspace o deixa `pro`, e ele fica `pro` para sempre. Cliente pagava um mês
-- e usava o Pro de graça pelo resto da vida.
--
-- Regra nova, decidida pelo dono: pagou, tem 30 dias. Passou de 30 dias sem
-- pagar de novo, volta para o Free.
--
-- A implementação NÃO usa cron, e isso é deliberado: cron que não roda falha em
-- silêncio, e o projeto já pagou caro por regra que parecia existir. Em vez de
-- um relógio que precisa acordar, a validade vira uma FUNÇÃO consultada por
-- quem aplica limite. Um plano vencido para de valer sozinho, no instante em
-- que alguém tenta usá-lo, sem depender de nada ter rodado antes.

-- ============================================================================
-- 1. A validade do Pro, num lugar só
-- ============================================================================

-- Tempo que o banco leva para confirmar boleto ou Pix.
--
-- NÃO é carência comercial — é o intervalo entre a pessoa pagar e o Asaas
-- avisar. Sem isso, quem paga o boleto no último dia do período seria cortado
-- no dia seguinte, com o dinheiro já saído da conta dele, e abriria chamado de
-- suporte tendo razão. Para cortar exatamente no dia 30, troque para 0.
create or replace function public.dias_para_compensacao_bancaria()
returns int
language sql
immutable
set search_path to ''
as $$ select 3 $$;

/**
 * O workspace tem Pro VÁLIDO agora?
 *
 * Diferente de ler `workspaces.plan`, que é só o último valor gravado e não
 * sabe que o tempo passou. Esta função é a verdade: existe assinatura não
 * cancelada E o período pago ainda não venceu.
 *
 * `current_period_end` nulo conta como VENCIDO, nunca como válido. É a escolha
 * segura: "não sei quando essa assinatura foi paga" não pode virar acesso
 * liberado. Assinatura legítima passa a gravar a data no pagamento seguinte.
 */
create or replace function public.pro_vigente(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
      from public.subscriptions s
     where s.workspace_id = target_workspace_id
       and s.status in ('active', 'past_due')
       and s.current_period_end is not null
       and s.current_period_end
           + (public.dias_para_compensacao_bancaria() || ' days')::interval > now()
  );
$$;

revoke all on function public.pro_vigente(uuid) from public, anon;
grant execute on function public.pro_vigente(uuid) to authenticated, service_role;

-- ============================================================================
-- 2. O webhook passa a gravar quando o período pago termina
-- ============================================================================

/**
 * Aplica no banco o que o Asaas avisou.
 *
 * Novidade: em pagamento confirmado, grava `current_period_end`. O ciclo é
 * MONTHLY fixo (lib/asaas/actions.ts), então a data sai de `now()` e não do
 * payload — payload de webhook é entrada externa, e derivar a validade do
 * acesso a partir dele deixaria alguém com o token estender o próprio plano.
 *
 * O `plan` deixa de sair direto do status e passa a sair de `pro_vigente`. São
 * coisas diferentes: `status` é o que o Asaas diz da cobrança, `plan` é o que a
 * pessoa pode usar. Assinatura `past_due` cujo período já venceu tem status
 * atrasado E plano free, e antes disto não havia como expressar isso.
 */
create or replace function public.apply_asaas_subscription_status(
  p_asaas_subscription_id text,
  p_status subscription_status
)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_workspace_id uuid;
begin
  update public.subscriptions
     set status = p_status,
         -- Só pagamento move a validade. `past_due` e `canceled` deixam a data
         -- como está: é justamente ela que diz até quando o último pagamento
         -- comprou acesso.
         current_period_end = case
                                when p_status = 'active' then now() + interval '30 days'
                                else current_period_end
                              end
   where asaas_subscription_id = p_asaas_subscription_id
  returning workspace_id into v_workspace_id;

  if v_workspace_id is null then
    return false;
  end if;

  update public.workspaces
     set plan = case
                  when public.pro_vigente(v_workspace_id) then 'pro'
                  else 'free'
                end::public.workspace_plan
   where id = v_workspace_id;

  return true;
end;
$function$;

-- ============================================================================
-- 3. O limite de leads passa a olhar a validade, não a coluna
-- ============================================================================

-- Mantém o `for update` da 0026 — a corrida continua existindo — e troca a
-- leitura de `workspaces.plan` por `pro_vigente`. É esta linha que fecha o furo
-- de receita: mesmo que a coluna `plan` esteja desatualizada dizendo 'pro', o
-- inadimplente não passa do teto do Free.
create or replace function public.checar_limite_de_leads()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_total int;
  v_pro boolean;
  limite_free constant int := 50;
begin
  -- Trava a linha do workspace antes de contar, como na 0026: sob READ
  -- COMMITTED duas transações leriam a mesma contagem e as duas passariam.
  perform 1 from public.workspaces where id = new.workspace_id for update;

  v_pro := public.pro_vigente(new.workspace_id);
  if v_pro then
    return new;
  end if;

  select count(*) into v_total from public.leads where workspace_id = new.workspace_id;

  if v_total >= limite_free then
    raise exception 'Plano Free permite no máximo % leads. Faça upgrade para o Pro para continuar.', limite_free
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- ============================================================================
-- 4. Rebaixar deixa de ser privilégio da service role
-- ============================================================================

-- A 0022 impede qualquer um de mexer em `workspaces.plan` fora da service role,
-- e por bom motivo: era assim que se ganhava Pro sem pagar.
--
-- Mas a regra nova precisa que a coluna acompanhe o vencimento, e vencimento
-- acontece sem ninguém chamar webhook nenhum. A saída é assimétrica: SUBIR para
-- 'pro' continua sendo só da service role; DESCER para 'free' passa a ser
-- livre.
--
-- Isso não reabre o furo. O ataque original era ganhar acesso que não se pagou;
-- rebaixar o próprio workspace não dá nada a ninguém, e um rebaixamento
-- indevido se conserta sozinho no pagamento seguinte. A assimetria é o ponto:
-- a direção perigosa segue trancada.
create or replace function public.proteger_colunas_do_workspace()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $$
begin
  if coalesce(current_setting('role', true), '') = 'service_role'
     or coalesce((select auth.role()), '') = 'service_role' then
    return new;
  end if;

  if new.plan is distinct from old.plan then
    -- Descer é permitido; subir, não.
    if not (old.plan = 'pro' and new.plan = 'free') then
      raise exception 'O plano do workspace só muda por pagamento confirmado.'
        using errcode = '42501';
    end if;
  end if;

  if new.id is distinct from old.id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Campos de identidade do workspace são imutáveis.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- ============================================================================
-- 5. Sincronização preguiçosa da coluna `plan`
-- ============================================================================

/**
 * Alinha `workspaces.plan` com a validade real, e SÓ para baixo.
 *
 * Existe porque a UI lê a coluna, e a coluna não sabe que o tempo passou. O app
 * chama isto ao carregar o workspace: se o período venceu enquanto ninguém
 * mexia, a tela já mostra Free e o botão de upgrade aparece.
 *
 * Nunca promove. Promover é do webhook, contra pagamento confirmado — a regra
 * que a 0019 até a 0022 levaram quatro tentativas para acertar.
 */
create or replace function public.sincronizar_plano_do_workspace(target_workspace_id uuid)
returns public.workspace_plan
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_plan public.workspace_plan;
begin
  -- Só quem participa da empresa pode disparar isto. Sem a checagem, qualquer
  -- autenticado rebaixaria o workspace alheio só sabendo o UUID.
  if not exists (
    select 1 from public.workspace_members m
     where m.workspace_id = target_workspace_id
       and m.user_id = (select auth.uid())
  ) then
    return null;
  end if;

  select plan into v_plan from public.workspaces where id = target_workspace_id;

  if v_plan = 'pro' and not public.pro_vigente(target_workspace_id) then
    update public.workspaces set plan = 'free' where id = target_workspace_id;
    return 'free';
  end if;

  return v_plan;
end;
$$;

revoke all on function public.sincronizar_plano_do_workspace(uuid) from public, anon;
grant execute on function public.sincronizar_plano_do_workspace(uuid) to authenticated, service_role;

-- ============================================================================
-- 6. Acerta o que já está gravado
-- ============================================================================

-- Assinaturas ativas sem data ficariam vencidas para sempre pela regra nova.
-- Dá a elas um período a partir de agora: quem está pagando não pode ser
-- cortado por causa de uma coluna que o código antigo nunca preencheu.
update public.subscriptions
   set current_period_end = now() + interval '30 days'
 where status in ('active', 'past_due')
   and current_period_end is null;

-- E alinha os planos com a validade real.
update public.workspaces w
   set plan = 'free'
 where w.plan = 'pro'
   and not public.pro_vigente(w.id);
